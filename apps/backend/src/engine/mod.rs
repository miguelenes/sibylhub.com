//! Registry loading, normalization, and indexed package-policy evaluation.

use serde::Deserialize;
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    path::Path,
};
use thiserror::Error;

const MAX_REGISTRY_BYTES: usize = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_SECONDS: u64 = 10;
const GENERIC_RUNTIME: &str = "*";

pub const EXPECTED_LANGUAGES: [&str; 25] = [
    "c",
    "cpp",
    "csharp",
    "dart",
    "elixir",
    "go",
    "haskell",
    "java",
    "javascript",
    "kotlin",
    "lua",
    "objective-c",
    "perl",
    "php",
    "python",
    "r",
    "ruby",
    "rust",
    "scala",
    "swift",
    "typescript",
    "zig",
    "shell",
    "powershell",
    "sql",
];

#[derive(Debug, Error)]
pub enum RegistryError {
    #[error("registry snapshot could not be read")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("registry export request failed")]
    RemoteRequest(#[source] reqwest::Error),
    #[error("registry export returned HTTP status {0}")]
    RemoteStatus(u16),
    #[error("registry export exceeds the {MAX_REGISTRY_BYTES}-byte limit")]
    TooLarge,
    #[error("registry JSON is malformed")]
    Json(#[source] serde_json::Error),
    #[error("registry schema version {found:?} is unsupported")]
    UnsupportedSchema { found: String },
    #[error("registry artifact is invalid: {0}")]
    Invalid(String),
    #[error("registry export URL is invalid: {0}")]
    InvalidUrl(String),
}

#[derive(Debug, Clone)]
pub struct LanguageView {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub runtime_ids: Vec<String>,
    pub package_manager_ids: Vec<String>,
    pub default_package_manager_id: Option<String>,
    pub lockfile_id: Option<String>,
    pub invariant_ids: Vec<String>,
    pub manifests: Vec<ManifestView>,
}

#[derive(Debug, Clone)]
pub struct ManifestView {
    pub language_id: String,
    pub package_manager_id: String,
    pub manifest_file: String,
    pub lockfile_file: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PackageManagerView {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub language_id: String,
}

#[derive(Debug, Clone)]
pub struct InvariantView {
    pub language_id: String,
    pub rule: Option<String>,
    pub evidence_fields: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct EvidenceDiagnostic {
    pub code: String,
    pub message: String,
    pub field: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PackageViolation {
    pub package: String,
    pub severity: String,
    pub approved_replacement: String,
    pub reason: String,
}

#[derive(Debug, Error)]
pub enum PolicyCheckError {
    #[error("ecosystem is unknown")]
    UnknownEcosystem,
    #[error("runtime is unknown")]
    UnknownRuntime,
    #[error("runtime is not associated with the ecosystem")]
    RuntimeMismatch,
    #[error("dependency package identifiers and versions must be non-empty strings")]
    InvalidDependency,
}

#[derive(Debug, Clone)]
pub struct RegistryEngine {
    pub schema_version: String,
    pub revision_id: Option<String>,
    languages: Vec<LanguageView>,
    language_by_alias: HashMap<String, String>,
    runtime_by_alias: HashMap<String, String>,
    runtime_to_language: HashMap<String, String>,
    package_managers: HashMap<String, PackageManagerView>,
    invariants: HashMap<String, InvariantView>,
    package_aliases: HashMap<String, String>,
    policy_index: HashMap<PolicyKey, Vec<PolicyRule>>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct PolicyKey {
    ecosystem_id: String,
    runtime_id: String,
    package_alias: String,
}

#[derive(Debug, Clone)]
struct PolicyRule {
    invariant_id: String,
    severity: String,
    approved_replacement: String,
    reason: String,
}

impl RegistryEngine {
    pub fn empty(schema_version: impl Into<String>) -> Self {
        Self {
            schema_version: schema_version.into(),
            revision_id: None,
            languages: Vec::new(),
            language_by_alias: HashMap::new(),
            runtime_by_alias: HashMap::new(),
            runtime_to_language: HashMap::new(),
            package_managers: HashMap::new(),
            invariants: HashMap::new(),
            package_aliases: HashMap::new(),
            policy_index: HashMap::new(),
        }
    }

    pub fn from_snapshot(
        value: &serde_json::Value,
        schema_version: &str,
    ) -> Result<Self, RegistryError> {
        let found = schema_version_of(value)?;
        if found != schema_version {
            return Err(RegistryError::UnsupportedSchema { found });
        }
        match schema_version {
            "1.0" => Self::from_legacy(value),
            "2.0" => Err(RegistryError::Invalid(
                "schema 2.0 requires an index and language artifacts".to_owned(),
            )),
            _ => Err(RegistryError::UnsupportedSchema {
                found: schema_version.to_owned(),
            }),
        }
    }

    pub fn from_local_path(
        path: impl AsRef<Path>,
        schema_version: &str,
    ) -> Result<Self, RegistryError> {
        let path = path.as_ref();
        let index_path = if path.is_dir() {
            let data_index = path.join("data/v1/index.json");
            if data_index.is_file() {
                data_index
            } else {
                path.join("index.json")
            }
        } else {
            path.to_owned()
        };
        let value = read_json_file(&index_path)?;
        let found = schema_version_of(&value)?;
        if found != schema_version {
            return Err(RegistryError::UnsupportedSchema { found });
        }
        match schema_version {
            "1.0" => Self::from_legacy(&value),
            "2.0" => Self::from_local_v2(&index_path, &value),
            _ => Err(RegistryError::UnsupportedSchema {
                found: schema_version.to_owned(),
            }),
        }
    }

    pub async fn from_remote_url(url: &str, schema_version: &str) -> Result<Self, RegistryError> {
        let parsed = reqwest::Url::parse(url)
            .map_err(|error| RegistryError::InvalidUrl(error.to_string()))?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(RegistryError::RemoteRequest)?;
        let value = fetch_json(&client, parsed.clone()).await?;
        let found = schema_version_of(&value)?;
        if found != schema_version {
            return Err(RegistryError::UnsupportedSchema { found });
        }
        match schema_version {
            "1.0" => Self::from_legacy(&value),
            "2.0" => {
                let index = parse_index(&value)?;
                let mut artifacts = Vec::with_capacity(index.languages.len());
                for language in &index.languages {
                    validate_artifact_path(&language.path)?;
                    let artifact_url = parsed.join(&language.path).map_err(|_| {
                        RegistryError::Invalid("artifact path is invalid".to_owned())
                    })?;
                    artifacts.push(fetch_json(&client, artifact_url).await?);
                }
                Self::from_v2(index, artifacts)
            }
            _ => Err(RegistryError::UnsupportedSchema {
                found: schema_version.to_owned(),
            }),
        }
    }

    pub fn ecosystem_id(&self, value: &str) -> Option<&str> {
        self.language_by_alias
            .get(&normalize(value))
            .map(String::as_str)
    }

    pub fn language(&self, value: &str) -> Option<&LanguageView> {
        let id = self.ecosystem_id(value)?;
        self.languages.iter().find(|language| language.id == id)
    }

    pub fn runtime_id(&self, value: &str) -> Option<&str> {
        self.runtime_by_alias
            .get(&normalize(value))
            .map(String::as_str)
    }

    pub fn languages(&self) -> &[LanguageView] {
        &self.languages
    }

    pub fn package_managers(&self) -> impl Iterator<Item = &PackageManagerView> {
        self.package_managers.values()
    }

    pub fn package_manager(&self, id: &str) -> Option<&PackageManagerView> {
        self.package_managers.get(id)
    }

    pub fn language_by_alias_exists(&self, value: &str) -> bool {
        self.language_by_alias.contains_key(&normalize(value))
    }

    pub fn validate_evidence(
        &self,
        language_id: &str,
        invariant_id: &str,
        runtime_id: &str,
        lockfile_id: &str,
        manifest_paths: &[String],
        package_manager_id: Option<&str>,
    ) -> Result<Vec<EvidenceDiagnostic>, EvidenceError> {
        let Some(language) = self.language(language_id) else {
            return Err(EvidenceError::UnknownLanguage);
        };
        let Some(invariant) = self.invariants.get(invariant_id) else {
            return Err(EvidenceError::UnknownInvariant);
        };
        if invariant.language_id != language.id
            || !language.invariant_ids.iter().any(|id| id == invariant_id)
        {
            return Err(EvidenceError::UnresolvedRelationship);
        }
        if invariant.rule.as_deref() != Some("declared-runtime-and-lockfile") {
            return Err(EvidenceError::UnsupportedRule);
        }

        let mut diagnostics = Vec::new();
        if invariant
            .evidence_fields
            .iter()
            .any(|field| field == "runtimeId")
            && !language.runtime_ids.iter().any(|id| id == runtime_id)
        {
            diagnostics.push(EvidenceDiagnostic {
                code: "runtime_mismatch".to_owned(),
                message: "runtime evidence does not match the registry language relationship"
                    .to_owned(),
                field: Some("evidence.runtime_id".to_owned()),
            });
        }
        if invariant
            .evidence_fields
            .iter()
            .any(|field| field == "lockfileId")
            && language.lockfile_id.as_deref() != Some(lockfile_id)
        {
            diagnostics.push(EvidenceDiagnostic {
                code: "lockfile_mismatch".to_owned(),
                message: "lockfile evidence does not match the registry language relationship"
                    .to_owned(),
                field: Some("evidence.lockfile_id".to_owned()),
            });
        }
        if invariant
            .evidence_fields
            .iter()
            .any(|field| field == "manifestPaths")
            && manifest_paths.iter().all(|path| path.trim().is_empty())
        {
            diagnostics.push(EvidenceDiagnostic {
                code: "manifest_missing".to_owned(),
                message: "manifest evidence must contain a non-empty path".to_owned(),
                field: Some("evidence.manifest_paths".to_owned()),
            });
        }
        if invariant
            .evidence_fields
            .iter()
            .any(|field| field == "packageManagerId")
            && language.default_package_manager_id.as_deref() != package_manager_id
        {
            diagnostics.push(EvidenceDiagnostic {
                code: "package_manager_mismatch".to_owned(),
                message:
                    "package-manager evidence does not match the registry language relationship"
                        .to_owned(),
                field: Some("evidence.package_manager_id".to_owned()),
            });
        }
        Ok(diagnostics)
    }

    pub fn check_packages(
        &self,
        ecosystem: &str,
        runtime: &str,
        dependencies: &BTreeMap<String, String>,
    ) -> Result<Vec<PackageViolation>, PolicyCheckError> {
        if self.languages.is_empty() {
            if dependencies
                .iter()
                .any(|(package, version)| package.trim().is_empty() || version.trim().is_empty())
            {
                return Err(PolicyCheckError::InvalidDependency);
            }
            return Ok(Vec::new());
        }
        let Some(canonical_ecosystem) = self.ecosystem_id(ecosystem) else {
            return Err(PolicyCheckError::UnknownEcosystem);
        };
        let Some(canonical_runtime) = self.runtime_id(runtime) else {
            return Err(PolicyCheckError::UnknownRuntime);
        };
        if self
            .runtime_to_language
            .get(canonical_runtime)
            .is_none_or(|language| language != canonical_ecosystem)
        {
            return Err(PolicyCheckError::RuntimeMismatch);
        }

        let mut violations = Vec::new();
        for (package, version) in dependencies {
            if package.trim().is_empty() || version.trim().is_empty() {
                return Err(PolicyCheckError::InvalidDependency);
            }
            let alias = normalize(package);
            let mut rules = Vec::new();
            for runtime_key in [canonical_runtime, GENERIC_RUNTIME] {
                let key = PolicyKey {
                    ecosystem_id: canonical_ecosystem.to_owned(),
                    runtime_id: runtime_key.to_owned(),
                    package_alias: alias.clone(),
                };
                if let Some(indexed_rules) = self.policy_index.get(&key) {
                    rules.extend(indexed_rules.iter());
                }
            }
            let mut seen = HashSet::new();
            for rule in rules {
                if seen.insert(rule.invariant_id.clone()) {
                    violations.push(PackageViolation {
                        package: package.clone(),
                        severity: rule.severity.clone(),
                        approved_replacement: rule.approved_replacement.clone(),
                        reason: rule.reason.clone(),
                    });
                }
            }
        }
        violations.sort_by(|left, right| {
            left.package
                .cmp(&right.package)
                .then(left.severity.cmp(&right.severity))
                .then(left.approved_replacement.cmp(&right.approved_replacement))
                .then(left.reason.cmp(&right.reason))
        });
        Ok(violations)
    }

    fn from_local_v2(index_path: &Path, value: &serde_json::Value) -> Result<Self, RegistryError> {
        let index = parse_index(value)?;
        let base = index_path.parent().unwrap_or_else(|| Path::new("."));
        let mut artifacts = Vec::with_capacity(index.languages.len());
        for language in &index.languages {
            validate_artifact_path(&language.path)?;
            artifacts.push(read_json_file(&base.join(&language.path))?);
        }
        Self::from_v2(index, artifacts)
    }

    fn from_v2(
        index: RegistryIndex,
        values: Vec<serde_json::Value>,
    ) -> Result<Self, RegistryError> {
        validate_index(&index)?;
        if index.languages.len() != values.len() {
            return Err(RegistryError::Invalid(
                "language artifact count is inconsistent".to_owned(),
            ));
        }
        let artifacts = values
            .into_iter()
            .map(|value| serde_json::from_value(value).map_err(RegistryError::Json))
            .collect::<Result<Vec<LanguageArtifact>, _>>()?;
        validate_artifacts(&index, &artifacts)?;
        build_engine_from_v2(index, artifacts)
    }

    fn from_legacy(value: &serde_json::Value) -> Result<Self, RegistryError> {
        let snapshot: LegacySnapshot =
            serde_json::from_value(value.clone()).map_err(RegistryError::Json)?;
        validate_legacy(&snapshot)?;
        build_engine_from_legacy(snapshot)
    }
}

#[derive(Debug, Error)]
pub enum EvidenceError {
    #[error("language is unknown")]
    UnknownLanguage,
    #[error("invariant is unknown")]
    UnknownInvariant,
    #[error("invariant is not associated with the language")]
    UnresolvedRelationship,
    #[error("registry rule is unsupported")]
    UnsupportedRule,
}

#[derive(Debug, Deserialize)]
struct Purl {
    #[serde(rename = "type")]
    purl_type: String,
    #[serde(default)]
    namespace: Option<String>,
    name: String,
    version: String,
}

#[derive(Debug, Deserialize)]
struct LegacySnapshot {
    #[serde(rename = "schemaVersion")]
    schema_version: String,
    #[serde(rename = "revisionId")]
    revision_id: String,
    languages: Vec<LegacyLanguage>,
    runtimes: Vec<LegacyCatalogEntry>,
    #[serde(rename = "packageManagers")]
    package_managers: Vec<LegacyCatalogEntry>,
    lockfiles: Vec<LegacyCatalogEntry>,
    builders: Vec<LegacyCatalogEntry>,
    invariants: Vec<LegacyInvariant>,
    documentation: Vec<LegacyDocumentation>,
}

#[derive(Debug, Deserialize)]
struct LegacyCatalogEntry {
    id: String,
    name: String,
    purl: Purl,
}

#[derive(Debug, Deserialize)]
struct LegacyLanguage {
    id: String,
    name: String,
    purl: Purl,
    #[serde(rename = "runtimeId")]
    runtime_id: String,
    #[serde(rename = "packageManagerId")]
    package_manager_id: String,
    #[serde(rename = "lockfileId")]
    lockfile_id: String,
    #[serde(rename = "invariantIds")]
    invariant_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct LegacyInvariant {
    id: String,
    #[allow(dead_code)]
    name: String,
    #[serde(rename = "languageId")]
    language_id: String,
    rule: String,
    #[serde(rename = "evidenceFields")]
    evidence_fields: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct LegacyDocumentation {
    id: String,
    #[allow(dead_code)]
    path: String,
    #[allow(dead_code)]
    title: String,
}

#[derive(Debug, Deserialize)]
struct RegistryIndex {
    #[serde(rename = "schemaVersion")]
    schema_version: String,
    #[serde(rename = "revisionId")]
    revision_id: String,
    languages: Vec<IndexLanguage>,
    builders: Vec<IndexBuilder>,
}

#[derive(Debug, Deserialize)]
struct IndexLanguage {
    id: String,
    slug: String,
    name: String,
    path: String,
}

#[derive(Debug, Deserialize)]
struct IndexBuilder {
    id: String,
    #[allow(dead_code)]
    slug: String,
    #[allow(dead_code)]
    name: String,
}

#[derive(Debug, Deserialize)]
struct LanguageArtifact {
    #[serde(rename = "schemaVersion")]
    schema_version: String,
    #[serde(rename = "revisionId")]
    revision_id: String,
    language: ProgrammingLanguage,
    runtimes: Vec<RuntimeRecord>,
    #[serde(rename = "packageRegistries")]
    package_registries: Vec<StableRecord>,
    #[serde(rename = "packageManagers")]
    package_managers: Vec<PackageManagerRecord>,
    #[serde(rename = "lockfileSpecifications")]
    lockfile_specifications: Vec<LockfileRecord>,
    #[serde(rename = "workspaceConfigurations")]
    workspace_configurations: Vec<WorkspaceRecord>,
    #[serde(rename = "packageCategories")]
    package_categories: Vec<CategoryRecord>,
    packages: Vec<PackageRecord>,
    compatibilities: Vec<CompatibilityRecord>,
    builders: Vec<BuilderRecord>,
    invariants: Vec<StackInvariantRecord>,
    documentations: Vec<DocumentationRecord>,
    #[serde(rename = "documentationChunks")]
    documentation_chunks: Vec<DocumentationChunkRecord>,
}

#[derive(Debug, Deserialize)]
struct ProgrammingLanguage {
    id: String,
    slug: String,
    name: String,
    purl: Purl,
    #[allow(dead_code)]
    extensions: Vec<String>,
    #[serde(rename = "defaultPackageManagerId")]
    default_package_manager_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RuntimeRecord {
    id: String,
    slug: String,
    name: String,
    purl: Purl,
    #[serde(rename = "languageId")]
    language_id: String,
    #[serde(rename = "engineType")]
    engine_type: String,
}

#[derive(Debug, Deserialize)]
struct PackageManagerRecord {
    id: String,
    slug: String,
    name: String,
    purl: Purl,
    #[serde(rename = "languageId")]
    language_id: String,
    #[serde(rename = "registryId")]
    registry_id: Option<String>,
    binary: String,
    #[serde(rename = "manifestFile")]
    manifest_file: String,
    #[serde(rename = "lockfileFile")]
    lockfile_file: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "installCommand")]
    install_command: String,
    #[allow(dead_code)]
    #[serde(rename = "addCommand")]
    add_command: String,
}

#[derive(Debug, Deserialize)]
struct StableRecord {
    id: String,
    slug: String,
    name: String,
    purl: Purl,
}

#[derive(Debug, Deserialize)]
struct LockfileRecord {
    id: String,
    slug: String,
    name: String,
    purl: Purl,
    #[serde(rename = "packageManagerId")]
    package_manager_id: String,
    filename: String,
}

#[derive(Debug, Deserialize)]
struct WorkspaceRecord {
    #[serde(rename = "packageManagerId")]
    package_manager_id: String,
    manifest: String,
}

#[derive(Debug, Deserialize)]
struct CategoryRecord {
    id: String,
}

#[derive(Debug, Deserialize)]
struct PackageRecord {
    id: String,
    slug: String,
    #[allow(dead_code)]
    name: String,
    purl: Purl,
    #[serde(rename = "packageManagerId")]
    package_manager_id: String,
    #[serde(rename = "categoryId")]
    category_id: String,
}

#[derive(Debug, Deserialize)]
struct CompatibilityRecord {
    #[serde(rename = "packageId")]
    package_id: String,
    #[serde(rename = "runtimeId")]
    runtime_id: String,
}

#[derive(Debug, Deserialize)]
struct BuilderRecord {
    id: String,
    #[serde(rename = "languageIds")]
    language_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct StackInvariantRecord {
    id: String,
    #[serde(rename = "categoryId")]
    category_id: String,
    #[serde(rename = "approvedPackageId")]
    approved_package_id: String,
    #[serde(rename = "bannedPackageId")]
    banned_package_id: String,
    #[serde(rename = "runtimeId")]
    runtime_id: Option<String>,
    severity: String,
    reason: String,
    #[serde(rename = "replacementExample")]
    replacement_example: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DocumentationRecord {
    id: String,
    #[serde(rename = "documentableId")]
    documentable_id: String,
}

#[derive(Debug, Deserialize)]
struct DocumentationChunkRecord {
    id: String,
    #[serde(rename = "documentationId")]
    documentation_id: String,
    #[serde(rename = "startOffset")]
    start_offset: u64,
    #[serde(rename = "endOffset")]
    end_offset: u64,
}

fn read_json_file(path: &Path) -> Result<serde_json::Value, RegistryError> {
    let metadata = fs::metadata(path).map_err(|source| RegistryError::Io {
        path: path.display().to_string(),
        source,
    })?;
    if metadata.len() > MAX_REGISTRY_BYTES as u64 {
        return Err(RegistryError::TooLarge);
    }
    let contents = fs::read_to_string(path).map_err(|source| RegistryError::Io {
        path: path.display().to_string(),
        source,
    })?;
    serde_json::from_str(&contents).map_err(RegistryError::Json)
}

async fn fetch_json(
    client: &reqwest::Client,
    url: reqwest::Url,
) -> Result<serde_json::Value, RegistryError> {
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(RegistryError::RemoteRequest)?;
    let status = response.status();
    if !status.is_success() {
        return Err(RegistryError::RemoteStatus(status.as_u16()));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_REGISTRY_BYTES as u64)
    {
        return Err(RegistryError::TooLarge);
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(RegistryError::RemoteRequest)?
    {
        if bytes.len().saturating_add(chunk.len()) > MAX_REGISTRY_BYTES {
            return Err(RegistryError::TooLarge);
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(RegistryError::Json)
}

fn schema_version_of(value: &serde_json::Value) -> Result<String, RegistryError> {
    value
        .get("schemaVersion")
        .and_then(serde_json::Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| RegistryError::Invalid("schemaVersion is missing".to_owned()))
}

fn parse_index(value: &serde_json::Value) -> Result<RegistryIndex, RegistryError> {
    serde_json::from_value(value.clone()).map_err(RegistryError::Json)
}

fn validate_artifact_path(path: &str) -> Result<(), RegistryError> {
    let candidate = Path::new(path);
    if path.is_empty()
        || candidate.is_absolute()
        || candidate
            .components()
            .any(|component| component == std::path::Component::ParentDir)
        || !path.starts_with("languages/")
        || !path.ends_with(".json")
    {
        return Err(RegistryError::Invalid(
            "language artifact path is not canonical".to_owned(),
        ));
    }
    Ok(())
}

fn validate_index(index: &RegistryIndex) -> Result<(), RegistryError> {
    if index.schema_version != "2.0" || index.revision_id.trim().is_empty() {
        return Err(RegistryError::Invalid(
            "registry index identity is invalid".to_owned(),
        ));
    }
    validate_expected_language_ids(
        &index
            .languages
            .iter()
            .map(|entry| entry.id.as_str())
            .collect::<Vec<_>>(),
    )?;
    let builder_ids = index
        .builders
        .iter()
        .map(|entry| entry.id.clone())
        .collect::<Vec<_>>();
    ensure_unique_ids(&builder_ids, "index builders")?;
    if index.builders.len() != EXPECTED_LANGUAGES.len() {
        return Err(RegistryError::Invalid(
            "index must contain exactly 25 builders".to_owned(),
        ));
    }
    for language in &index.languages {
        if language.slug.trim().is_empty() || language.name.trim().is_empty() {
            return Err(RegistryError::Invalid(
                "index language metadata is incomplete".to_owned(),
            ));
        }
        validate_artifact_path(&language.path)?;
    }
    Ok(())
}

fn ensure_unique_ids(ids: &[String], catalog: &str) -> Result<(), RegistryError> {
    let mut seen = HashSet::with_capacity(ids.len());
    if ids.iter().any(|id| !seen.insert(id)) {
        return Err(RegistryError::Invalid(format!(
            "{catalog} contain duplicate identifiers"
        )));
    }
    Ok(())
}

fn validate_artifacts(
    index: &RegistryIndex,
    artifacts: &[LanguageArtifact],
) -> Result<(), RegistryError> {
    let expected_builders = index
        .builders
        .iter()
        .map(|builder| builder.id.as_str())
        .collect::<HashSet<_>>();
    let mut artifact_builders = HashSet::new();
    for (index_language, artifact) in index.languages.iter().zip(artifacts) {
        if artifact.schema_version != "2.0"
            || artifact.revision_id != index.revision_id
            || artifact.language.id != index_language.id
            || artifact.language.slug != index_language.slug
            || artifact.language.name != index_language.name
        {
            return Err(RegistryError::Invalid(
                "language artifact identity is inconsistent".to_owned(),
            ));
        }
        validate_stable(
            &artifact.language.id,
            &artifact.language.slug,
            &artifact.language.name,
            &artifact.language.purl,
        )?;
        validate_ids(
            &artifact
                .runtimes
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "runtimes",
        )?;
        validate_ids(
            &artifact
                .package_managers
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "package managers",
        )?;
        validate_ids(
            &artifact
                .lockfile_specifications
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "lockfiles",
        )?;
        validate_ids(
            &artifact
                .package_registries
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "registries",
        )?;
        validate_ids(
            &artifact
                .package_categories
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "categories",
        )?;
        validate_ids(
            &artifact
                .packages
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "packages",
        )?;
        validate_ids(
            &artifact
                .builders
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "builders",
        )?;
        validate_ids(
            &artifact
                .invariants
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "invariants",
        )?;
        validate_ids(
            &artifact
                .documentations
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "documentation",
        )?;
        validate_ids(
            &artifact
                .documentation_chunks
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
            "documentation chunks",
        )?;

        let runtime_ids = artifact
            .runtimes
            .iter()
            .map(|entry| entry.id.as_str())
            .collect::<HashSet<_>>();
        let manager_ids = artifact
            .package_managers
            .iter()
            .map(|entry| entry.id.as_str())
            .collect::<HashSet<_>>();
        let registry_ids = artifact
            .package_registries
            .iter()
            .map(|entry| entry.id.as_str())
            .collect::<HashSet<_>>();
        let category_ids = artifact
            .package_categories
            .iter()
            .map(|entry| entry.id.as_str())
            .collect::<HashSet<_>>();
        let package_ids = artifact
            .packages
            .iter()
            .map(|entry| entry.id.as_str())
            .collect::<HashSet<_>>();
        let documentation_ids = artifact
            .documentations
            .iter()
            .map(|entry| entry.id.as_str())
            .collect::<HashSet<_>>();
        for registry in &artifact.package_registries {
            validate_stable(&registry.id, &registry.slug, &registry.name, &registry.purl)?;
        }
        for runtime in &artifact.runtimes {
            validate_stable(&runtime.id, &runtime.slug, &runtime.name, &runtime.purl)?;
            if runtime.language_id != artifact.language.id || runtime.engine_type.trim().is_empty()
            {
                return Err(RegistryError::Invalid(
                    "runtime relationship is unresolved".to_owned(),
                ));
            }
        }
        for manager in &artifact.package_managers {
            validate_stable(&manager.id, &manager.slug, &manager.name, &manager.purl)?;
            if manager.language_id != artifact.language.id
                || manager.binary.trim().is_empty()
                || manager.manifest_file.trim().is_empty()
                || manager.install_command.trim().is_empty()
                || manager.add_command.trim().is_empty()
                || manager
                    .registry_id
                    .as_ref()
                    .is_some_and(|id| !registry_ids.contains(id.as_str()))
            {
                return Err(RegistryError::Invalid(
                    "package-manager relationship is unresolved".to_owned(),
                ));
            }
        }
        if artifact
            .language
            .default_package_manager_id
            .as_ref()
            .is_some_and(|id| !manager_ids.contains(id.as_str()))
        {
            return Err(RegistryError::Invalid(
                "default package-manager relationship is unresolved".to_owned(),
            ));
        }
        for lockfile in &artifact.lockfile_specifications {
            validate_stable(&lockfile.id, &lockfile.slug, &lockfile.name, &lockfile.purl)?;
            if !manager_ids.contains(lockfile.package_manager_id.as_str())
                || lockfile.filename.trim().is_empty()
            {
                return Err(RegistryError::Invalid(
                    "lockfile relationship is unresolved".to_owned(),
                ));
            }
        }
        for workspace in &artifact.workspace_configurations {
            if !manager_ids.contains(workspace.package_manager_id.as_str())
                || workspace.manifest.trim().is_empty()
            {
                return Err(RegistryError::Invalid(
                    "workspace relationship is unresolved".to_owned(),
                ));
            }
        }
        for package in &artifact.packages {
            validate_stable(&package.id, &package.slug, &package.name, &package.purl)?;
            if !manager_ids.contains(package.package_manager_id.as_str())
                || !category_ids.contains(package.category_id.as_str())
            {
                return Err(RegistryError::Invalid(
                    "package relationship is unresolved".to_owned(),
                ));
            }
        }
        for compatibility in &artifact.compatibilities {
            if !package_ids.contains(compatibility.package_id.as_str())
                || !runtime_ids.contains(compatibility.runtime_id.as_str())
            {
                return Err(RegistryError::Invalid(
                    "package compatibility relationship is unresolved".to_owned(),
                ));
            }
        }
        for builder in &artifact.builders {
            if !expected_builders.contains(builder.id.as_str())
                || builder
                    .language_ids
                    .iter()
                    .any(|id| id != &artifact.language.id)
            {
                return Err(RegistryError::Invalid(
                    "builder relationship is unresolved".to_owned(),
                ));
            }
            artifact_builders.insert(builder.id.as_str());
        }
        for invariant in &artifact.invariants {
            if !category_ids.contains(invariant.category_id.as_str())
                || !package_ids.contains(invariant.approved_package_id.as_str())
                || !package_ids.contains(invariant.banned_package_id.as_str())
                || invariant
                    .runtime_id
                    .as_ref()
                    .is_some_and(|id| !runtime_ids.contains(id.as_str()))
                || invariant.severity.trim().is_empty()
                || invariant.reason.trim().is_empty()
            {
                return Err(RegistryError::Invalid(
                    "invariant relationship is unresolved".to_owned(),
                ));
            }
        }
        for documentation in &artifact.documentations {
            if documentation.documentable_id != artifact.language.id
                && !package_ids.contains(documentation.documentable_id.as_str())
            {
                return Err(RegistryError::Invalid(
                    "documentation relationship is unresolved".to_owned(),
                ));
            }
        }
        for chunk in &artifact.documentation_chunks {
            if !documentation_ids.contains(chunk.documentation_id.as_str())
                || chunk.start_offset > chunk.end_offset
            {
                return Err(RegistryError::Invalid(
                    "documentation chunk relationship is unresolved".to_owned(),
                ));
            }
        }
    }
    if artifact_builders != expected_builders {
        return Err(RegistryError::Invalid(
            "index builders and language builders are inconsistent".to_owned(),
        ));
    }
    Ok(())
}

fn build_engine_from_v2(
    index: RegistryIndex,
    artifacts: Vec<LanguageArtifact>,
) -> Result<RegistryEngine, RegistryError> {
    let mut engine = RegistryEngine::empty(index.schema_version);
    engine.revision_id = Some(index.revision_id);
    for artifact in artifacts {
        let language_id = artifact.language.id.clone();
        let default_manager = artifact
            .language
            .default_package_manager_id
            .clone()
            .or_else(|| {
                (artifact.package_managers.len() == 1)
                    .then(|| artifact.package_managers[0].id.clone())
            });
        let lockfile_id = artifact
            .lockfile_specifications
            .first()
            .map(|entry| entry.id.clone());
        let manifests = artifact
            .package_managers
            .iter()
            .map(|manager| ManifestView {
                language_id: language_id.clone(),
                package_manager_id: manager.id.clone(),
                manifest_file: manager.manifest_file.clone(),
                lockfile_file: manager.lockfile_file.clone(),
            })
            .collect();
        let language = LanguageView {
            id: language_id.clone(),
            slug: artifact.language.slug.clone(),
            name: artifact.language.name.clone(),
            runtime_ids: artifact
                .runtimes
                .iter()
                .map(|entry| entry.id.clone())
                .collect(),
            package_manager_ids: artifact
                .package_managers
                .iter()
                .map(|entry| entry.id.clone())
                .collect(),
            default_package_manager_id: default_manager,
            lockfile_id,
            invariant_ids: artifact
                .invariants
                .iter()
                .map(|entry| entry.id.clone())
                .collect(),
            manifests,
        };
        insert_alias(&mut engine.language_by_alias, &language.id, &language.id)?;
        insert_alias(&mut engine.language_by_alias, &language.slug, &language.id)?;
        for runtime in &artifact.runtimes {
            insert_alias(&mut engine.runtime_by_alias, &runtime.id, &runtime.id)?;
            insert_alias(&mut engine.runtime_by_alias, &runtime.slug, &runtime.id)?;
            engine
                .runtime_to_language
                .insert(runtime.id.clone(), language.id.clone());
        }
        for manager in &artifact.package_managers {
            engine.package_managers.insert(
                manager.id.clone(),
                PackageManagerView {
                    id: manager.id.clone(),
                    slug: manager.slug.clone(),
                    name: manager.name.clone(),
                    language_id: language.id.clone(),
                },
            );
        }
        let packages = artifact
            .packages
            .iter()
            .map(|package| (package.id.as_str(), package))
            .collect::<HashMap<_, _>>();
        for package in &artifact.packages {
            for alias in package_aliases(package) {
                let normalized = normalize(&alias);
                if let Some(previous) = engine
                    .package_aliases
                    .insert(normalized, package.id.clone())
                {
                    if previous != package.id {
                        return Err(RegistryError::Invalid(
                            "package aliases are ambiguous".to_owned(),
                        ));
                    }
                }
            }
        }
        for invariant in &artifact.invariants {
            engine.invariants.insert(
                invariant.id.clone(),
                InvariantView {
                    language_id: language.id.clone(),
                    rule: None,
                    evidence_fields: inferred_evidence_fields(&artifact),
                },
            );
            let banned = packages
                .get(invariant.banned_package_id.as_str())
                .ok_or_else(|| {
                    RegistryError::Invalid("banned package relationship is unresolved".to_owned())
                })?;
            let approved = packages
                .get(invariant.approved_package_id.as_str())
                .ok_or_else(|| {
                    RegistryError::Invalid("approved package relationship is unresolved".to_owned())
                })?;
            let approved_replacement = invariant
                .replacement_example
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| canonical_package_name(&approved.purl));
            for alias in package_aliases(banned) {
                engine
                    .policy_index
                    .entry(PolicyKey {
                        ecosystem_id: language.id.clone(),
                        runtime_id: invariant
                            .runtime_id
                            .as_deref()
                            .unwrap_or(GENERIC_RUNTIME)
                            .to_owned(),
                        package_alias: normalize(&alias),
                    })
                    .or_default()
                    .push(PolicyRule {
                        invariant_id: invariant.id.clone(),
                        severity: invariant.severity.clone(),
                        approved_replacement: approved_replacement.clone(),
                        reason: invariant.reason.clone(),
                    });
            }
        }
        engine.languages.push(language);
    }
    engine
        .languages
        .sort_by(|left, right| left.id.cmp(&right.id));
    Ok(engine)
}

fn inferred_evidence_fields(artifact: &LanguageArtifact) -> Vec<String> {
    let mut fields = vec!["runtimeId".to_owned(), "manifestPaths".to_owned()];
    if !artifact.lockfile_specifications.is_empty() {
        fields.push("lockfileId".to_owned());
    }
    if artifact.language.default_package_manager_id.is_some()
        || artifact.package_managers.len() == 1
    {
        fields.push("packageManagerId".to_owned());
    }
    fields
}

fn build_engine_from_legacy(snapshot: LegacySnapshot) -> Result<RegistryEngine, RegistryError> {
    let mut engine = RegistryEngine::empty(snapshot.schema_version);
    engine.revision_id = Some(snapshot.revision_id);
    for language in snapshot.languages {
        let view = LanguageView {
            id: language.id.clone(),
            slug: language.id.clone(),
            name: language.name.clone(),
            runtime_ids: vec![language.runtime_id.clone()],
            package_manager_ids: vec![language.package_manager_id.clone()],
            default_package_manager_id: Some(language.package_manager_id.clone()),
            lockfile_id: Some(language.lockfile_id.clone()),
            invariant_ids: language.invariant_ids,
            manifests: Vec::new(),
        };
        insert_alias(&mut engine.language_by_alias, &view.id, &view.id)?;
        insert_alias(
            &mut engine.runtime_by_alias,
            &language.runtime_id,
            &language.runtime_id,
        )?;
        engine
            .runtime_to_language
            .insert(language.runtime_id.clone(), view.id.clone());
        engine.package_managers.insert(
            language.package_manager_id.clone(),
            PackageManagerView {
                id: language.package_manager_id,
                slug: view.id.clone(),
                name: view.name.clone(),
                language_id: view.id.clone(),
            },
        );
        engine.languages.push(view);
    }
    for invariant in snapshot.invariants {
        engine.invariants.insert(
            invariant.id,
            InvariantView {
                language_id: invariant.language_id,
                rule: Some(invariant.rule),
                evidence_fields: invariant.evidence_fields,
            },
        );
    }
    engine
        .languages
        .sort_by(|left, right| left.id.cmp(&right.id));
    Ok(engine)
}

fn validate_legacy(snapshot: &LegacySnapshot) -> Result<(), RegistryError> {
    if snapshot.schema_version != "1.0" || snapshot.revision_id.trim().is_empty() {
        return Err(RegistryError::Invalid(
            "legacy registry identity is invalid".to_owned(),
        ));
    }
    validate_expected_language_ids(
        &snapshot
            .languages
            .iter()
            .map(|entry| entry.id.as_str())
            .collect::<Vec<_>>(),
    )?;
    for (name, entries) in [
        (
            "runtimes",
            snapshot
                .runtimes
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
        ),
        (
            "package managers",
            snapshot
                .package_managers
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
        ),
        (
            "lockfiles",
            snapshot
                .lockfiles
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
        ),
        (
            "builders",
            snapshot
                .builders
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
        ),
        (
            "invariants",
            snapshot
                .invariants
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
        ),
        (
            "documentation",
            snapshot
                .documentation
                .iter()
                .map(|entry| entry.id.clone())
                .collect::<Vec<_>>(),
        ),
    ] {
        if entries.len() != EXPECTED_LANGUAGES.len() {
            return Err(RegistryError::Invalid(format!(
                "{name} must contain exactly 25 entries"
            )));
        }
        validate_ids(&entries, name)?;
    }
    let runtime_ids = snapshot
        .runtimes
        .iter()
        .map(|entry| entry.id.as_str())
        .collect::<HashSet<_>>();
    let manager_ids = snapshot
        .package_managers
        .iter()
        .map(|entry| entry.id.as_str())
        .collect::<HashSet<_>>();
    let lockfile_ids = snapshot
        .lockfiles
        .iter()
        .map(|entry| entry.id.as_str())
        .collect::<HashSet<_>>();
    let invariant_ids = snapshot
        .invariants
        .iter()
        .map(|entry| entry.id.as_str())
        .collect::<HashSet<_>>();
    for entry in snapshot
        .runtimes
        .iter()
        .chain(snapshot.package_managers.iter())
        .chain(snapshot.lockfiles.iter())
        .chain(snapshot.builders.iter())
    {
        validate_stable(&entry.id, &entry.id, &entry.name, &entry.purl)?;
    }
    for language in &snapshot.languages {
        validate_stable(&language.id, &language.id, &language.name, &language.purl)?;
        if !runtime_ids.contains(language.runtime_id.as_str())
            || !manager_ids.contains(language.package_manager_id.as_str())
            || !lockfile_ids.contains(language.lockfile_id.as_str())
            || language
                .invariant_ids
                .iter()
                .any(|id| !invariant_ids.contains(id.as_str()))
        {
            return Err(RegistryError::Invalid(
                "legacy language relationship is unresolved".to_owned(),
            ));
        }
    }
    for invariant in &snapshot.invariants {
        if !EXPECTED_LANGUAGES.contains(&invariant.language_id.as_str())
            || invariant.evidence_fields.is_empty()
        {
            return Err(RegistryError::Invalid(
                "legacy invariant relationship is unresolved".to_owned(),
            ));
        }
    }
    Ok(())
}

fn validate_expected_language_ids(ids: &[&str]) -> Result<(), RegistryError> {
    if ids.len() != EXPECTED_LANGUAGES.len() {
        return Err(RegistryError::Invalid(
            "registry must contain exactly 25 languages".to_owned(),
        ));
    }
    let actual = ids.iter().copied().collect::<HashSet<_>>();
    let expected = EXPECTED_LANGUAGES.iter().copied().collect::<HashSet<_>>();
    if actual.len() != ids.len() || actual != expected {
        return Err(RegistryError::Invalid(
            "registry language identities are incomplete or duplicated".to_owned(),
        ));
    }
    Ok(())
}

fn validate_ids(ids: &[String], label: &str) -> Result<(), RegistryError> {
    if ids.iter().any(|id| id.trim().is_empty())
        || ids.iter().collect::<HashSet<_>>().len() != ids.len()
    {
        return Err(RegistryError::Invalid(format!(
            "{label} contain duplicate or empty identifiers"
        )));
    }
    Ok(())
}

fn validate_stable(id: &str, slug: &str, name: &str, purl: &Purl) -> Result<(), RegistryError> {
    if id.trim().is_empty()
        || slug.trim().is_empty()
        || name.trim().is_empty()
        || purl.purl_type.trim().is_empty()
        || purl.name.trim().is_empty()
        || purl.version.trim().is_empty()
    {
        return Err(RegistryError::Invalid(
            "stable registry metadata is incomplete".to_owned(),
        ));
    }
    Ok(())
}

fn package_aliases(package: &PackageRecord) -> Vec<String> {
    let mut aliases = vec![
        package.id.clone(),
        package.slug.clone(),
        package.purl.name.clone(),
    ];
    if let Some(namespace) = &package.purl.namespace {
        aliases.push(format!("{namespace}/{}", package.purl.name));
    }
    aliases
}

fn canonical_package_name(purl: &Purl) -> String {
    purl.namespace.as_ref().map_or_else(
        || purl.name.clone(),
        |namespace| format!("{namespace}/{}", purl.name),
    )
}

fn normalize(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn insert_alias(
    aliases: &mut HashMap<String, String>,
    alias: &str,
    id: &str,
) -> Result<(), RegistryError> {
    let normalized = normalize(alias);
    if let Some(previous) = aliases.insert(normalized, id.to_owned()) {
        if previous != id {
            return Err(RegistryError::Invalid(
                "registry aliases are ambiguous".to_owned(),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::BTreeMap, path::PathBuf};

    #[test]
    fn rejects_a_non_canonical_artifact_path() {
        let error = validate_artifact_path("../secrets.json").expect_err("path must be rejected");
        assert!(error.to_string().contains("canonical"));
    }

    #[test]
    fn loads_the_split_registry_fixture_and_checks_package_aliases() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../packages/schemas/fixtures/valid-registry");
        let engine =
            RegistryEngine::from_local_path(path, "2.0").expect("split fixture should load");
        let mut dependencies = BTreeMap::new();
        dependencies.insert("package-alt-typescript".to_owned(), "1.0.0".to_owned());

        let violations = engine
            .check_packages("TypeScript", "runtime-typescript", &dependencies)
            .expect("known package policy should be checked");

        assert_eq!(engine.languages().len(), 25);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].approved_replacement, "package-typescript");
    }

    #[test]
    fn rejects_a_schema_version_mismatch_before_installing_data() {
        let value = serde_json::json!({ "schemaVersion": "1.0" });
        let error =
            RegistryEngine::from_snapshot(&value, "2.0").expect_err("schema must be rejected");
        assert!(matches!(
            error,
            RegistryError::UnsupportedSchema { found } if found == "1.0"
        ));
    }
}
