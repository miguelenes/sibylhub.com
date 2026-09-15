//! HTTP route contracts for the backend API.

use crate::{
    engine::{EvidenceDiagnostic, EvidenceError, PackageViolation, PolicyCheckError},
    server::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Json, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use tower_http::{cors::CorsLayer, timeout::TimeoutLayer, trace::TraceLayer};

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/ecosystems", get(ecosystems))
        .route("/v1/invariants/validate", post(validate_invariant))
        .route("/v1/invariants/check", post(check_invariants))
        .route("/v1/context/budget", post(context_budget))
        .layer(TimeoutLayer::new(std::time::Duration::from_secs(30)))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
    timestamp: String,
}

async fn healthz() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: "0.1.0",
        timestamp: chrono_like_timestamp(),
    })
}

#[derive(Debug, Serialize)]
struct EcosystemsResponse {
    schema_version: String,
    revision_id: Option<String>,
    active_languages: Vec<LanguageResponse>,
    detected_manifests: Vec<ManifestResponse>,
    default_package_managers: Vec<PackageManagerResponse>,
}

#[derive(Debug, Serialize)]
struct LanguageResponse {
    id: String,
    slug: String,
    name: String,
}

#[derive(Debug, Serialize)]
struct ManifestResponse {
    language_id: String,
    package_manager_id: String,
    manifest_file: String,
    lockfile_file: Option<String>,
}

#[derive(Debug, Serialize)]
struct PackageManagerResponse {
    id: String,
    slug: String,
    name: String,
    language_id: String,
}

async fn ecosystems(State(state): State<AppState>) -> Json<EcosystemsResponse> {
    let active_languages = state
        .registry
        .languages()
        .iter()
        .map(|language| LanguageResponse {
            id: language.id.clone(),
            slug: language.slug.clone(),
            name: language.name.clone(),
        })
        .collect::<Vec<_>>();
    let detected_manifests = state
        .registry
        .languages()
        .iter()
        .flat_map(|language| language.manifests.iter())
        .map(|manifest| ManifestResponse {
            language_id: manifest.language_id.clone(),
            package_manager_id: manifest.package_manager_id.clone(),
            manifest_file: manifest.manifest_file.clone(),
            lockfile_file: manifest.lockfile_file.clone(),
        })
        .collect::<Vec<_>>();
    let default_package_managers = state
        .registry
        .languages()
        .iter()
        .filter_map(|language| language.default_package_manager_id.as_ref())
        .filter_map(|id| state.registry.package_manager(id))
        .map(|manager| PackageManagerResponse {
            id: manager.id.clone(),
            slug: manager.slug.clone(),
            name: manager.name.clone(),
            language_id: manager.language_id.clone(),
        })
        .collect::<Vec<_>>();

    Json(EcosystemsResponse {
        schema_version: state.registry.schema_version.clone(),
        revision_id: state.registry.revision_id.clone(),
        active_languages,
        detected_manifests,
        default_package_managers,
    })
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct InvariantRequest {
    language_id: String,
    invariant_id: String,
    evidence: InvariantEvidence,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct InvariantEvidence {
    runtime_id: String,
    lockfile_id: String,
    manifest_paths: Vec<String>,
    package_manager_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct InvariantResponse {
    valid: bool,
    language_id: String,
    invariant_id: String,
    diagnostics: Vec<DiagnosticResponse>,
}

#[derive(Debug, Serialize)]
struct DiagnosticResponse {
    code: String,
    message: String,
    field: Option<String>,
}

async fn validate_invariant(
    State(state): State<AppState>,
    payload: Result<Json<Value>, JsonRejection>,
) -> Response {
    let value = match payload {
        Ok(Json(value)) => value,
        Err(rejection) => return ApiError::malformed_json(rejection).into_response(),
    };
    let request = match serde_json::from_value::<InvariantRequest>(value) {
        Ok(request) => request,
        Err(error) => return ApiError::invalid_request(error.to_string()).into_response(),
    };
    if request.language_id.trim().is_empty() || request.invariant_id.trim().is_empty() {
        return ApiError::invalid_request("language_id and invariant_id must be non-empty")
            .into_response();
    }
    if !state
        .registry
        .language_by_alias_exists(&request.language_id)
    {
        return ApiError::unresolved("language is unknown").into_response();
    }
    let diagnostics = match state.registry.validate_evidence(
        &request.language_id,
        &request.invariant_id,
        &request.evidence.runtime_id,
        &request.evidence.lockfile_id,
        &request.evidence.manifest_paths,
        request.evidence.package_manager_id.as_deref(),
    ) {
        Ok(diagnostics) => diagnostics,
        Err(error) => return map_evidence_error(error).into_response(),
    };
    let response = InvariantResponse {
        valid: diagnostics.is_empty(),
        language_id: request.language_id,
        invariant_id: request.invariant_id,
        diagnostics: diagnostics.into_iter().map(diagnostic_response).collect(),
    };
    if response.valid {
        (StatusCode::OK, Json(response)).into_response()
    } else {
        (StatusCode::UNPROCESSABLE_ENTITY, Json(response)).into_response()
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PackageCheckRequest {
    ecosystem: String,
    runtime: String,
    dependencies: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
struct PackageCheckResponse {
    compliant: bool,
    violations: Vec<PackageViolation>,
}

async fn check_invariants(
    State(state): State<AppState>,
    payload: Result<Json<PackageCheckRequest>, JsonRejection>,
) -> Response {
    let Json(request) = match payload {
        Ok(payload) => payload,
        Err(rejection) => return ApiError::malformed_json(rejection).into_response(),
    };
    if request.ecosystem.trim().is_empty() || request.runtime.trim().is_empty() {
        return ApiError::invalid_request("ecosystem and runtime must be non-empty")
            .into_response();
    }
    let violations = match state.registry.check_packages(
        &request.ecosystem,
        &request.runtime,
        &request.dependencies,
    ) {
        Ok(violations) => violations,
        Err(error) => return map_policy_error(error).into_response(),
    };
    (
        StatusCode::OK,
        Json(PackageCheckResponse {
            compliant: violations.is_empty(),
            violations,
        }),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ContextBudgetRequest {
    context_ceiling_tokens: u64,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
struct ContextBudgetResponse {
    context_ceiling_tokens: u64,
    rules: u64,
    memories: u64,
    ast_skeletons: u64,
    active_files: u64,
    tools: u64,
}

async fn context_budget(payload: Result<Json<ContextBudgetRequest>, JsonRejection>) -> Response {
    let Json(request) = match payload {
        Ok(payload) => payload,
        Err(rejection) => return ApiError::malformed_json(rejection).into_response(),
    };
    if request.context_ceiling_tokens == 0 {
        return ApiError::invalid_request("context_ceiling_tokens must be positive")
            .into_response();
    }
    (
        StatusCode::OK,
        Json(allocate_context_budget(request.context_ceiling_tokens)),
    )
        .into_response()
}

fn allocate_context_budget(ceiling: u64) -> ContextBudgetResponse {
    let weights = [10_u128, 15, 35, 30, 10];
    let ceiling_wide = u128::from(ceiling);
    let mut allocations = weights.map(|weight| (ceiling_wide * weight) / 100);
    let remainders = weights.map(|weight| (ceiling_wide * weight) % 100);
    let mut remainder = ceiling_wide.saturating_sub(allocations.iter().sum());
    let mut order = [0_usize, 1, 2, 3, 4];
    order.sort_by(|left, right| {
        remainders[*right]
            .cmp(&remainders[*left])
            .then(left.cmp(right))
    });
    for index in order {
        if remainder == 0 {
            break;
        }
        allocations[index] = allocations[index].saturating_add(1);
        remainder -= 1;
    }
    ContextBudgetResponse {
        context_ceiling_tokens: ceiling,
        rules: allocations[0] as u64,
        memories: allocations[1] as u64,
        ast_skeletons: allocations[2] as u64,
        active_files: allocations[3] as u64,
        tools: allocations[4] as u64,
    }
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    code: &'static str,
    message: String,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

impl ApiError {
    fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code: "invalid_request",
            message: message.into(),
        }
    }

    fn unresolved(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code: "unresolved_identity",
            message: message.into(),
        }
    }

    fn malformed_json(rejection: JsonRejection) -> Self {
        Self::invalid_request(format!("request body is not valid JSON: {rejection}"))
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ErrorResponse {
                code: self.code,
                message: self.message,
            }),
        )
            .into_response()
    }
}

fn diagnostic_response(diagnostic: EvidenceDiagnostic) -> DiagnosticResponse {
    DiagnosticResponse {
        code: diagnostic.code,
        message: diagnostic.message,
        field: diagnostic.field,
    }
}

fn map_evidence_error(error: EvidenceError) -> ApiError {
    match error {
        EvidenceError::UnknownLanguage => ApiError::unresolved("language is unknown"),
        EvidenceError::UnknownInvariant => ApiError::unresolved("invariant is unknown"),
        EvidenceError::UnresolvedRelationship => {
            ApiError::unresolved("invariant is not associated with the language")
        }
        EvidenceError::UnsupportedRule => {
            ApiError::invalid_request("registry invariant rule is unsupported")
        }
    }
}

fn map_policy_error(error: PolicyCheckError) -> ApiError {
    match error {
        PolicyCheckError::UnknownEcosystem => ApiError::unresolved("ecosystem is unknown"),
        PolicyCheckError::UnknownRuntime => ApiError::unresolved("runtime is unknown"),
        PolicyCheckError::RuntimeMismatch => {
            ApiError::invalid_request("runtime is not associated with the ecosystem")
        }
        PolicyCheckError::InvalidDependency => ApiError::invalid_request(
            "dependency package identifiers and versions must be non-empty strings",
        ),
    }
}

fn chrono_like_timestamp() -> String {
    let now = match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(duration) => duration,
        Err(_) => std::time::Duration::ZERO,
    };
    let seconds = now.as_secs();
    let nanos = now.subsec_nanos();
    let days = seconds / 86_400;
    let seconds_of_day = seconds % 86_400;
    let (year, month, day) = civil_date(days as i64);
    let hour = seconds_of_day / 3_600;
    let minute = seconds_of_day / 60 % 60;
    let second = seconds_of_day % 60;
    format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{:09}Z",
        nanos
    )
}

fn civil_date(days_since_epoch: i64) -> (i64, i64, i64) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_part = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_part + 2) / 5 + 1;
    let month = month_part + if month_part < 10 { 3 } else { -9 };
    (year + if month <= 2 { 1 } else { 0 }, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn context_budget_uses_largest_remainder_order() {
        let budget = allocate_context_budget(7);
        assert_eq!(budget.rules, 1);
        assert_eq!(budget.memories, 1);
        assert_eq!(budget.ast_skeletons, 2);
        assert_eq!(budget.active_files, 2);
        assert_eq!(budget.tools, 1);
        assert_eq!(
            budget.rules
                + budget.memories
                + budget.ast_skeletons
                + budget.active_files
                + budget.tools,
            7
        );
    }
}
