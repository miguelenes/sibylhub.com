## MODIFIED Requirements

### Requirement: Agent and invariant documents are safe to consume

The `.agent/` and stack-invariant contracts SHALL distinguish declarative project metadata from executable instructions, SHALL validate allowed fields and types for `.agent/config.json`, `.agent/skills.json`, `.agent/memories.json`, and invariant rules, and SHALL reject embedded credentials, private keys, unsupported execution directives, and malformed memory entries. The memories document SHALL declare its supported schema version and contain a stable ordered collection of entries with title, content, and category fields suitable for local append and synchronization.

#### Scenario: A project configuration is inspected
- **WHEN** a valid `.agent/config.json`, skills document, memories document, or invariant rule is loaded
- **THEN** it yields declarative metadata and validation rules without requiring code execution or network access

#### Scenario: A memory document is valid
- **WHEN** `.agent/memories.json` declares a supported schema version and a collection of entries with non-empty title, content, and category values
- **THEN** schema validation accepts the document, preserves entry order, and exposes no executable behavior

#### Scenario: A secret-bearing or executable field is supplied
- **WHEN** a document contains a credential, private key, or unsupported executable directive
- **THEN** schema validation fails and the value is not returned as an accepted contract field

#### Scenario: A memory entry is malformed
- **WHEN** a memory entry omits a required field, uses an unsupported field type, or contains prohibited unsafe content
- **THEN** schema validation fails at the affected entry and a consumer does not accept or rewrite the document
