//! Emit the canonical SibylHub Gateway Admin API OpenAPI document.
//!
//! Invocation:
//!
//! ```bash
//! cargo run -p sibyl-gateway-admin --bin dump-openapi
//! ```
//!
//! Writes the same merged OpenAPI JSON served by `GET /admin/openapi.json`
//! to stdout. Redirect it to `schemas/openapi/admin-api.json` after changing
//! Admin API routes, OpenAPI metadata, or resource schemas.

fn main() {
    println!("{}", sibyl_gateway_admin::admin_openapi_json());
}
