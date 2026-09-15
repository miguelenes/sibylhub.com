use anyhow::Result;
use comfy_table::{presets::UTF8_FULL, Cell, Color, ContentArrangement, Table};
use console::{Style, Term};
use indicatif::{ProgressBar, ProgressStyle};
use serde::Serialize;

#[derive(Debug, Serialize)]
struct JsonCheck<'a, T> {
    valid: bool,
    compliant: bool,
    policy_configured: bool,
    diagnostics: &'a [T],
    violations: &'a [crate::policy::PolicyViolation],
}

pub fn print_check(report: &crate::CheckReport, json: bool) -> Result<()> {
    if json {
        println!(
            "{}",
            serde_json::to_string(&JsonCheck {
                valid: report.valid,
                compliant: report.compliant,
                policy_configured: report.policy_configured,
                diagnostics: &report.diagnostics,
                violations: &report.violations,
            })?
        );
        return Ok(());
    }

    if report.violations.is_empty() && report.diagnostics.is_empty() {
        println!("{}", Style::new().green().bold().apply_to("compliant"));
        return Ok(());
    }

    if !report.violations.is_empty() {
        let mut table = Table::new();
        table
            .load_preset(UTF8_FULL)
            .set_content_arrangement(ContentArrangement::Dynamic)
            .set_header(vec![
                "Package",
                "Severity",
                "Reason",
                "Approved replacement",
            ]);
        for violation in &report.violations {
            let replacement = violation
                .approved_replacement
                .as_deref()
                .map(|value| format!("{} -> {}", violation.package, value))
                .unwrap_or_else(|| "none".to_owned());
            let severity_color = if violation.severity == "error" {
                Color::Red
            } else {
                Color::Yellow
            };
            table.add_row(vec![
                Cell::new(&violation.package),
                Cell::new(&violation.severity).fg(severity_color),
                Cell::new(&violation.reason),
                Cell::new(replacement),
            ]);
        }
        println!("{table}");
    }
    for diagnostic in &report.diagnostics {
        eprintln!(
            "{}: {}",
            Style::new().red().bold().apply_to(diagnostic.code),
            diagnostic.message
        );
    }
    Ok(())
}

pub fn sync_spinner() -> ProgressBar {
    if !Term::stderr().is_term() {
        return ProgressBar::hidden();
    }
    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::with_template("{spinner} syncing with SibylHub")
            .expect("static spinner template"),
    );
    spinner.enable_steady_tick(std::time::Duration::from_millis(100));
    spinner
}
