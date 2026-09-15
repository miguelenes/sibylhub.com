use sibyl_backend::{run, Config, Environment};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    let filter = tracing_subscriber::EnvFilter::try_new(config.log_filter.clone())?;
    match config.environment {
        Environment::Production => tracing_subscriber::fmt()
            .json()
            .with_env_filter(filter)
            .try_init()
            .map_err(|error| anyhow::anyhow!("failed to initialize tracing: {error}"))?,
        Environment::Development => tracing_subscriber::fmt()
            .with_ansi(true)
            .with_env_filter(filter)
            .try_init()
            .map_err(|error| anyhow::anyhow!("failed to initialize tracing: {error}"))?,
    }
    run(config).await?;
    Ok(())
}
