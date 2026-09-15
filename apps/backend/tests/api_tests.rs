use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    response::Response,
    Router,
};
use serde_json::{json, Value};
use sibyl_backend::{engine::RegistryEngine, router, AppState};
use std::path::PathBuf;
use tower::ServiceExt;

fn state_from_fixture(relative_path: &str, schema_version: &str) -> AppState {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(relative_path);
    let registry = RegistryEngine::from_local_path(path, schema_version)
        .expect("checked-in registry fixture should be valid");
    AppState::new(registry)
}

fn schema_two_state() -> AppState {
    state_from_fixture("../../packages/schemas/fixtures/valid-registry", "2.0")
}

fn legacy_state() -> AppState {
    state_from_fixture(
        "../../packages/schemas/fixtures/valid-ecosystem.json",
        "1.0",
    )
}

fn empty_state() -> AppState {
    AppState::new(RegistryEngine::empty("2.0"))
}

async fn json_response(response: Response) -> Value {
    let bytes = to_bytes(response.into_body(), 1_048_576)
        .await
        .expect("response body should be readable");
    serde_json::from_slice(&bytes).expect("response should contain JSON")
}

async fn post_json(app: &Router, uri: &str, payload: Value) -> (StatusCode, Value) {
    let request = Request::post(uri)
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&payload).expect("test payload should serialize"),
        ))
        .expect("test request should build");
    let response = app
        .clone()
        .oneshot(request)
        .await
        .expect("router should respond");
    let status = response.status();
    (status, json_response(response).await)
}

async fn post_raw_json(app: &Router, uri: &str, body: &'static [u8]) -> (StatusCode, Value) {
    let request = Request::post(uri)
        .header("content-type", "application/json")
        .body(Body::from(body))
        .expect("test request should build");
    let response = app
        .clone()
        .oneshot(request)
        .await
        .expect("router should respond");
    let status = response.status();
    (status, json_response(response).await)
}

#[tokio::test]
async fn health_returns_the_versioned_readiness_contract() {
    let response = router(empty_state())
        .oneshot(
            Request::get("/healthz")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("router should respond");
    assert_eq!(response.status(), StatusCode::OK);
    let value = json_response(response).await;
    assert_eq!(value["status"], "ok");
    assert_eq!(value["version"], "0.1.0");
    let timestamp = value["timestamp"]
        .as_str()
        .expect("timestamp should be text");
    assert_eq!(timestamp.len(), 30);
    assert!(timestamp.ends_with('Z'));
    assert_eq!(&timestamp[10..11], "T");
}

#[tokio::test]
async fn ecosystems_project_schema_two_registry_metadata() {
    let app = router(schema_two_state());
    let response = app
        .oneshot(
            Request::get("/v1/ecosystems")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("router should respond");
    assert_eq!(response.status(), StatusCode::OK);
    let value = json_response(response).await;
    assert_eq!(value["schema_version"], "2.0");
    assert_eq!(value["active_languages"].as_array().map(Vec::len), Some(25));
    assert_eq!(
        value["detected_manifests"].as_array().map(Vec::len),
        Some(25)
    );
    assert_eq!(
        value["default_package_managers"].as_array().map(Vec::len),
        Some(25)
    );
    assert!(value["active_languages"]
        .as_array()
        .expect("languages should be an array")
        .iter()
        .any(|language| language["id"] == "typescript"));
}

#[tokio::test]
async fn empty_registry_returns_documented_empty_ecosystems_and_compliance() {
    let app = router(empty_state());
    let response = app
        .clone()
        .oneshot(
            Request::get("/v1/ecosystems")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("router should respond");
    let ecosystems = json_response(response).await;
    assert_eq!(
        ecosystems["active_languages"].as_array().map(Vec::len),
        Some(0)
    );
    assert_eq!(
        ecosystems["detected_manifests"].as_array().map(Vec::len),
        Some(0)
    );
    assert_eq!(
        ecosystems["default_package_managers"]
            .as_array()
            .map(Vec::len),
        Some(0)
    );

    let (status, result) = post_json(
        &app,
        "/v1/invariants/check",
        json!({
            "ecosystem": "typescript",
            "runtime": "runtime-typescript",
            "dependencies": {}
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result["compliant"], true);
    assert_eq!(result["violations"].as_array().map(Vec::len), Some(0));
}

#[tokio::test]
async fn package_check_returns_indexed_policy_violations_and_compliance() {
    let app = router(schema_two_state());
    let (status, violation) = post_json(
        &app,
        "/v1/invariants/check",
        json!({
            "ecosystem": "typescript",
            "runtime": "runtime-typescript",
            "dependencies": {
                "package-alt-typescript": "1.0.0"
            }
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(violation["compliant"], false);
    assert_eq!(
        violation["violations"][0]["package"],
        "package-alt-typescript"
    );
    assert_eq!(violation["violations"][0]["severity"], "warning");
    assert_eq!(
        violation["violations"][0]["approved_replacement"],
        "package-typescript"
    );
    assert_eq!(
        violation["violations"][0]["reason"],
        "Use the managed package contract."
    );

    let (status, compliant) = post_json(
        &app,
        "/v1/invariants/check",
        json!({
            "ecosystem": "typescript",
            "runtime": "runtime-typescript",
            "dependencies": {
                "package-typescript": "1.0.0"
            }
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(compliant["compliant"], true);
    assert_eq!(compliant["violations"].as_array().map(Vec::len), Some(0));
}

#[tokio::test]
async fn package_check_rejects_malformed_and_unresolved_requests() {
    let app = router(schema_two_state());
    let (status, error) = post_raw_json(
        &app,
        "/v1/invariants/check",
        br#"{"ecosystem":"typescript","#,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(error["code"], "invalid_request");

    let (status, error) = post_json(
        &app,
        "/v1/invariants/check",
        json!({
            "ecosystem": "unknown",
            "runtime": "runtime-typescript",
            "dependencies": {}
        }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(error["code"], "unresolved_identity");

    let request = Request::post("/v1/invariants/check")
        .header("content-type", "application/json")
        .body(Body::from(
            br#"{"ecosystem":"typescript","runtime":"runtime-typescript","dependencies":{},"extra":true}"#
                .to_vec(),
        ))
        .expect("request should build");
    let response = app
        .clone()
        .oneshot(request)
        .await
        .expect("router should respond");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let error = json_response(response).await;
    assert_eq!(error["code"], "invalid_request");

    let (status, result) = post_json(
        &app,
        "/v1/invariants/check",
        json!({
            "ecosystem": "typescript",
            "runtime": "runtime-typescript",
            "dependencies": {}
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result["compliant"], true);
}

#[tokio::test]
async fn context_budget_preserves_exact_totals_and_rejects_invalid_input() {
    let app = router(empty_state());
    let (status, budget) = post_json(
        &app,
        "/v1/context/budget",
        json!({ "context_ceiling_tokens": 128000 }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(budget["rules"], 12800);
    assert_eq!(budget["memories"], 19200);
    assert_eq!(budget["ast_skeletons"], 44800);
    assert_eq!(budget["active_files"], 38400);
    assert_eq!(budget["tools"], 12800);

    let (status, rounded) = post_json(
        &app,
        "/v1/context/budget",
        json!({ "context_ceiling_tokens": 7 }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let total = rounded["rules"].as_u64().unwrap_or_default()
        + rounded["memories"].as_u64().unwrap_or_default()
        + rounded["ast_skeletons"].as_u64().unwrap_or_default()
        + rounded["active_files"].as_u64().unwrap_or_default()
        + rounded["tools"].as_u64().unwrap_or_default();
    assert_eq!(total, 7);

    let (status, error) = post_json(&app, "/v1/context/budget", json!({})).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(error["code"], "invalid_request");

    let (status, error) = post_json(
        &app,
        "/v1/context/budget",
        json!({ "context_ceiling_tokens": 0 }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(error["code"], "invalid_request");

    let (status, error) = post_raw_json(
        &app,
        "/v1/context/budget",
        br#"{"context_ceiling_tokens":-1}"#,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(error["code"], "invalid_request");

    let (status, error) = post_json(
        &app,
        "/v1/context/budget",
        json!({ "context_ceiling_tokens": 128, "extra": true }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(error["code"], "invalid_request");
}

#[tokio::test]
async fn legacy_evidence_validation_remains_available() {
    let app = router(legacy_state());
    let (status, result) = post_json(
        &app,
        "/v1/invariants/validate",
        json!({
            "language_id": "typescript",
            "invariant_id": "invariant-typescript",
            "evidence": {
                "runtime_id": "runtime-typescript",
                "lockfile_id": "lockfile-typescript",
                "manifest_paths": ["package.json"]
            }
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result["valid"], true);
    assert_eq!(result["diagnostics"].as_array().map(Vec::len), Some(0));

    let (status, result) = post_json(
        &app,
        "/v1/invariants/validate",
        json!({
            "language_id": "typescript",
            "invariant_id": "invariant-typescript",
            "evidence": {
                "runtime_id": "runtime-python",
                "lockfile_id": "lockfile-typescript",
                "manifest_paths": ["package.json"]
            }
        }),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(result["valid"], false);
    assert_eq!(result["diagnostics"][0]["code"], "runtime_mismatch");

    let (status, error) = post_json(
        &app,
        "/v1/invariants/validate",
        json!({
            "language_id": "typescript",
            "invariant_id": "invariant-typescript",
            "compliant": true
        }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(error["code"], "invalid_request");
}
