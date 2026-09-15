use std::path::PathBuf;

use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    name = "sibyl",
    version,
    about = "Read-only project checks and explicit synchronization"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    Init(InitArgs),
    Check(CheckArgs),
    Sync(SyncArgs),
    Memory(MemoryArgs),
}

#[derive(Debug, clap::Args)]
pub struct InitArgs {
    #[arg(long, default_value = ".")]
    pub path: PathBuf,
    #[arg(long)]
    pub force: bool,
}

#[derive(Debug, clap::Args)]
pub struct CheckArgs {
    #[arg(long, default_value = ".")]
    pub path: PathBuf,
    #[arg(long)]
    pub json: bool,
    #[arg(long, env = "SIBYL_REGISTRY_SNAPSHOT")]
    pub registry: Option<PathBuf>,
}

#[derive(Debug, clap::Args)]
pub struct SyncArgs {
    #[arg(long)]
    pub payload: PathBuf,
}

#[derive(Debug, clap::Args)]
pub struct MemoryArgs {
    #[command(subcommand)]
    pub command: MemoryCommands,
}

#[derive(Debug, Subcommand)]
pub enum MemoryCommands {
    Add(MemoryAddArgs),
}

#[derive(Debug, clap::Args)]
pub struct MemoryAddArgs {
    pub title: String,
    pub content: String,
    #[arg(long)]
    pub category: String,
    #[arg(long, default_value = ".")]
    pub path: PathBuf,
    #[arg(long)]
    pub force: bool,
    #[arg(long)]
    pub json: bool,
}
