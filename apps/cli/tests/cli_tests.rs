use assert_cmd::Command;
use serde_json::Value;
use std::{fs, path::Path};
use tempfile::TempDir;

fn binary() -> Command {
    Command::cargo_bin("sibyl").expect("sibyl binary")
}

fn project_with_package(contents: &str) -> TempDir {
    let project = tempfile::tempdir().expect("temporary project");
    fs::write(project.path().join("package.json"), contents).expect("package manifest");
    project
}

fn registry_fixture() -> String {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/schemas/fixtures/valid-registry")
        .to_string_lossy()
        .into_owned()
}

#[test]
fn init_generates_complete_governance_and_memory_add_appends() {
    let project = project_with_package(r#"{"name":"fixture","dependencies":{}}"#);
    fs::write(
        project.path().join("Cargo.toml"),
        "[package]\nname = \"fixture\"\nversion = \"0.1.0\"\n",
    )
    .expect("cargo manifest");
    fs::write(
        project.path().join("pnpm-workspace.yaml"),
        "packages: [apps/*]\n",
    )
    .expect("workspace evidence");
    fs::write(
        project.path().join("astro.config.ts"),
        "export default {}\n",
    )
    .expect("astro evidence");

    binary()
        .args(["init", "--path"])
        .arg(project.path())
        .env("SIBYL_SYNC_ENDPOINT", "https://127.0.0.1:1")
        .env("SIBYL_SYNC_AUTH_TOKEN", "ignored")
        .assert()
        .success()
        .stdout(predicates::str::contains("created .agent/config.json"))
        .stdout(predicates::str::contains("created .agent/rules.md"))
        .stdout(predicates::str::contains("created .agent/skills.json"))
        .stdout(predicates::str::contains("created .agent/memories.json"))
        .stdout(predicates::str::contains("created .agent/context.ignore"));

    for name in [
        "config.json",
        "rules.md",
        "skills.json",
        "memories.json",
        "context.ignore",
    ] {
        assert!(
            project.path().join(".agent").join(name).is_file(),
            "missing {name}"
        );
    }
    let config: Value = serde_json::from_str(
        &fs::read_to_string(project.path().join(".agent/config.json")).expect("config"),
    )
    .expect("valid config");
    assert_eq!(config["mode"], "declarative");
    assert_eq!(config["remoteEvidenceIsSeparate"], true);
    assert!(config["manifestEvidence"]
        .as_array()
        .expect("manifest evidence")
        .iter()
        .any(|item| item["path"] == "pnpm-workspace.yaml"));
    assert!(config["manifestEvidence"]
        .as_array()
        .expect("manifest evidence")
        .iter()
        .any(|item| item["path"] == "astro.config.ts"));
    let rules = fs::read_to_string(project.path().join(".agent/rules.md")).expect("rules");
    assert!(rules.contains("Keep project governance declarative."));
    assert!(!rules.contains("password") && !rules.contains("-----BEGIN"));
    let context_ignore =
        fs::read_to_string(project.path().join(".agent/context.ignore")).expect("context ignore");
    assert!(context_ignore.contains("node_modules/"));
    assert!(context_ignore.contains(".git/"));

    binary()
        .args([
            "memory",
            "add",
            "Use local policy",
            "Checks stay offline.",
            "--category",
            "invariant",
            "--path",
        ])
        .arg(project.path())
        .assert()
        .success();
    let memories: Value = serde_json::from_str(
        &fs::read_to_string(project.path().join(".agent/memories.json")).expect("memories"),
    )
    .expect("valid memories");
    assert_eq!(memories["memories"][0]["title"], "Use local policy");
    let config_before_check = fs::read(project.path().join(".agent/config.json")).expect("config");

    let check_output = binary()
        .args(["check", "--path"])
        .arg(project.path())
        .arg("--json")
        .output()
        .expect("check command");
    assert!(check_output.status.success());
    let check_stdout = String::from_utf8(check_output.stdout).expect("check output");
    assert!(check_stdout.contains(r#""compliant":true"#));
    assert!(!check_stdout.contains('\u{1b}'));
    assert_eq!(
        fs::read(project.path().join(".agent/config.json")).expect("config"),
        config_before_check
    );
}

#[test]
fn check_reports_banned_package_from_local_registry() {
    let project = project_with_package(
        r#"{"name":"fixture","dependencies":{"package-alt-javascript":"1.0.0"}}"#,
    );
    binary()
        .args(["init", "--path"])
        .arg(project.path())
        .assert()
        .success();

    binary()
        .args(["check", "--path"])
        .arg(project.path())
        .args(["--registry", &registry_fixture()])
        .assert()
        .failure()
        .code(1)
        .stdout(predicates::str::contains("package-alt-javascript"))
        .stdout(predicates::str::contains("package-javascript"));

    let json_output = binary()
        .args(["check", "--path"])
        .arg(project.path())
        .args(["--registry", &registry_fixture(), "--json"])
        .output()
        .expect("JSON check command");
    assert_eq!(json_output.status.code(), Some(1));
    let json_stdout = String::from_utf8(json_output.stdout).expect("JSON check output");
    let report: Value = serde_json::from_str(&json_stdout).expect("check report JSON");
    assert_eq!(report["violations"][0]["package"], "package-alt-javascript");
    assert_eq!(report["violations"][0]["severity"], "warning");
    assert_eq!(
        report["violations"][0]["approved_replacement"],
        "package-javascript"
    );
    assert_eq!(
        report["violations"][0]["reason"],
        "Use the managed package contract."
    );
    assert!(!json_stdout.contains('\u{1b}'));
}

#[test]
fn check_fails_without_local_package_policy_when_dependencies_exist() {
    let project = project_with_package(
        r#"{"name":"fixture","dependencies":{"package-alt-javascript":"1.0.0"}}"#,
    );
    binary()
        .args(["init", "--path"])
        .arg(project.path())
        .assert()
        .success();

    binary()
        .args(["check", "--path"])
        .arg(project.path())
        .arg("--json")
        .assert()
        .failure()
        .code(1)
        .stdout(predicates::str::contains("package_policy_not_configured"))
        .stdout(predicates::str::contains(r#""compliant":false"#));
}

#[test]
fn init_refuses_conflicts_without_partial_output() {
    let project = project_with_package(r#"{"name":"fixture"}"#);
    fs::create_dir(project.path().join(".agent")).expect("agent directory");
    fs::write(
        project.path().join(".agent/skills.json"),
        "{\"keep\":true}\n",
    )
    .expect("existing file");

    binary()
        .args(["init", "--path"])
        .arg(project.path())
        .assert()
        .failure()
        .code(1)
        .stderr(predicates::str::contains("governance files already exist"));
    assert!(!project.path().join(".agent/config.json").exists());
    assert_eq!(
        fs::read_to_string(project.path().join(".agent/skills.json")).expect("existing file"),
        "{\"keep\":true}\n"
    );
}

#[test]
fn remote_registry_source_is_rejected_without_network_access() {
    let project = project_with_package(r#"{"name":"fixture"}"#);
    binary()
        .args(["init", "--path"])
        .arg(project.path())
        .assert()
        .success();
    binary()
        .args(["check", "--path"])
        .arg(project.path())
        .args(["--registry", "https://example.test/registry"])
        .assert()
        .failure()
        .code(1)
        .stderr(predicates::str::contains("remote sources are not allowed"));
}

#[test]
fn memory_add_rejects_unsafe_input_and_preserves_malformed_documents() {
    let project = project_with_package(r#"{"name":"fixture"}"#);
    fs::create_dir(project.path().join(".agent")).expect("agent directory");
    let memory_path = project.path().join(".agent/memories.json");
    let original = b"{\"schemaVersion\":\"1.0\",\"memories\":[{\"title\":\"bad\"}]}\n";
    fs::write(&memory_path, original).expect("malformed memories");
    binary()
        .args([
            "memory",
            "add",
            "new",
            "content",
            "--category",
            "gotcha",
            "--path",
        ])
        .arg(project.path())
        .assert()
        .failure()
        .code(1);
    assert_eq!(
        fs::read(&memory_path).expect("preserved memories"),
        original
    );

    fs::remove_file(&memory_path).expect("remove malformed fixture");
    binary()
        .args([
            "memory",
            "add",
            "unsafe",
            "token: do-not-store",
            "--category",
            "invariant",
            "--path",
        ])
        .arg(project.path())
        .assert()
        .failure()
        .code(1);
    assert!(!memory_path.exists());
}

#[test]
fn sync_validates_prerequisites_payload_and_bounded_transport_failure() {
    let project = tempfile::tempdir().expect("temporary sync project");
    let payload_path = project.path().join("payload.json");
    fs::write(
        &payload_path,
        r#"{"schemaVersion":"1.0","kind":"episodic-memory","memories":[]}"#,
    )
    .expect("payload");

    binary()
        .args(["sync", "--payload"])
        .arg(&payload_path)
        .env_remove("SIBYL_SYNC_ENDPOINT")
        .env_remove("SIBYL_SYNC_AUTH_TOKEN")
        .assert()
        .failure()
        .code(1)
        .stderr(predicates::str::contains("SIBYL_SYNC_ENDPOINT"));

    binary()
        .args(["sync", "--payload"])
        .arg(&payload_path)
        .env("SIBYL_SYNC_ENDPOINT", "http://127.0.0.1:1")
        .env("SIBYL_SYNC_AUTH_TOKEN", "ignored")
        .assert()
        .failure()
        .code(1)
        .stderr(predicates::str::contains(
            "endpoint and authorization are invalid",
        ));

    fs::write(
        &payload_path,
        r#"{"schemaVersion":"1.0","kind":"episodic-memory","content":"token: do-not-store"}"#,
    )
    .expect("unsafe payload");
    binary()
        .args(["sync", "--payload"])
        .arg(&payload_path)
        .env("SIBYL_SYNC_ENDPOINT", "https://127.0.0.1:1")
        .env("SIBYL_SYNC_AUTH_TOKEN", "ignored")
        .assert()
        .failure()
        .code(1)
        .stderr(predicates::str::contains(
            "prohibited secret or execution material",
        ));

    fs::write(
        &payload_path,
        r#"{"schemaVersion":"1.0","kind":"episodic-memory","memories":[]}"#,
    )
    .expect("valid payload");
    binary()
        .args(["sync", "--payload"])
        .arg(&payload_path)
        .env("SIBYL_SYNC_ENDPOINT", "https://127.0.0.1:1")
        .env("SIBYL_SYNC_AUTH_TOKEN", "ignored")
        .assert()
        .failure()
        .code(1)
        .stderr(predicates::str::contains(
            "transport failed after bounded retries",
        ));
}
