use anyhow::Result;
use clap::{Parser, Subcommand};
use colored::*;
use comfy_table::{presets::NOTHING, Table, ContentArrangement};
use clawkb_core::KnowledgeBase;
use clawkb_core::kb::KbStats;
use clawkb_core::search::SearchMode;
use clawkb_core::search::SearchHit;
use clawkb_core::export::ExportFormat;
use std::path::PathBuf;

/// ClawKB — Local-first personal secure knowledge base CLI
#[derive(Parser)]
#[command(name = "clawkb", version, about)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Path to the knowledge base file (.mv2)
    #[arg(long, global = true, default_value = "~/.clawkb/knowledge.mv2")]
    kb: String,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a new knowledge base
    Create {
        /// Optional path (overrides --kb)
        path: Option<String>,
    },

    /// Open and display knowledge base info
    Info {
        /// Optional path (overrides --kb)
        path: Option<String>,
    },

    /// Search the knowledge base
    Search {
        /// Search query
        query: String,

        /// Search mode: lex, sem, hybrid
        #[arg(long, default_value = "hybrid")]
        mode: String,

        /// Maximum number of results
        #[arg(long, short, default_value = "5")]
        limit: usize,

        /// Output format: json, table
        #[arg(long, default_value = "table")]
        format: String,
    },

    /// Add a note to the knowledge base
    AddNote {
        /// Note title
        #[arg(long)]
        title: String,

        /// Note content (if not provided, reads from stdin)
        #[arg(long)]
        content: Option<String>,

        /// Comma-separated tags
        #[arg(long, default_value = "")]
        tags: String,
    },

    /// Import files into the knowledge base
    Import {
        /// File or directory path
        path: String,

        /// Comma-separated tags
        #[arg(long, default_value = "")]
        tags: String,

        /// Import directory recursively
        #[arg(long, short)]
        recursive: bool,
    },

    /// Show knowledge base statistics
    Stats {
        /// Output format: json, table
        #[arg(long, default_value = "table")]
        format: String,
    },

    /// Query entities
    Entities {
        /// Entity name to look up
        name: Option<String>,

        /// List all entities
        #[arg(long)]
        list: bool,

        /// Output format: json, table
        #[arg(long, default_value = "table")]
        format: String,
    },

    /// Browse the knowledge base timeline
    Timeline {
        /// Start date (Unix timestamp or ISO 8601)
        #[arg(long)]
        from: Option<String>,

        /// End date (Unix timestamp or ISO 8601)
        #[arg(long)]
        to: Option<String>,

        /// Maximum entries
        #[arg(long, default_value = "20")]
        limit: usize,

        /// Output format: json, table
        #[arg(long, default_value = "table")]
        format: String,
    },

    /// Commit pending changes
    Commit,

    /// Install Skills to AI coding assistants
    InitSkills {
        /// Target: claude-code, codex, openclaw, all
        #[arg(long, default_value = "all")]
        target: String,
    },

    /// Export knowledge base content
    Export {
        /// Output directory path
        output_dir: String,

        /// Export format: md, html, json
        #[arg(long, default_value = "md")]
        format: String,
    },

    /// Manage configuration
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },

    /// List all tags with document counts
    Tags,

    /// Fetch a web page and import its content
    FetchUrl {
        /// URL to fetch
        url: String,

        /// Additional URLs to fetch
        #[arg(long)]
        urls: Option<Vec<String>>,

        /// Comma-separated tags
        #[arg(long, default_value = "")]
        tags: String,
    },

    /// Start the MCP server for EVIF Skills
    #[cfg(feature = "evif-mcp")]
    Mcp {
        /// Skills directory path
        #[arg(long, default_value = "./skills")]
        skills_dir: String,

        /// Port to listen on
        #[arg(long, default_value = "8080")]
        port: u16,
    },
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Set a configuration value
    Set {
        /// Key to set (kb-path, model)
        key: String,
        /// Value to set
        value: String,
    },
    /// Get a configuration value
    Get {
        /// Key to get
        key: String,
    },
    /// Show all configuration
    List,
}

fn resolve_kb_path(cli_path: &str, alt_path: Option<&str>) -> PathBuf {
    let raw = alt_path.unwrap_or(cli_path);
    if raw.starts_with('~') {
        if let Some(home) = std::env::var("HOME").ok() {
            PathBuf::from(raw.replace('~', &home))
        } else {
            PathBuf::from(raw)
        }
    } else {
        PathBuf::from(raw)
    }
}

fn parse_tags(tags: &str) -> Vec<&str> {
    if tags.is_empty() {
        Vec::new()
    } else {
        tags.split(',').map(|t| t.trim()).filter(|t| !t.is_empty()).collect()
    }
}

fn parse_search_mode(mode: &str) -> SearchMode {
    match mode.to_lowercase().as_str() {
        "lex" | "lexical" => SearchMode::Lexical,
        "sem" | "semantic" => SearchMode::Semantic,
        _ => SearchMode::Hybrid,
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let kb_path = resolve_kb_path(&cli.kb, None);

    match cli.command {
        Commands::Create { path } => {
            let target = resolve_kb_path(&cli.kb, path.as_deref());
            println!("{} {}", "Creating knowledge base at".green().bold(), target.display());
            let mut kb = KnowledgeBase::create(&target)?;
            kb.commit()?;
            println!("{}", "Done!".green());
        }

        Commands::Info { path } => {
            let target = resolve_kb_path(&cli.kb, path.as_deref());
            let kb = KnowledgeBase::open(&target)?;
            let stats = kb.stats()?;
            print_stats(&stats, "table")?;
        }

        Commands::Search { query, mode, limit, format } => {
            let search_mode = parse_search_mode(&mode);
            let mut kb = KnowledgeBase::open(&kb_path)?;
            let hits = kb.search(&query, limit, search_mode)?;

            if format == "json" {
                println!("{}", serde_json::to_string_pretty(&hits)?);
            } else {
                print_search_results(&hits);
            }
        }

        Commands::AddNote { title, content, tags } => {
            let content = match content {
                Some(c) => c,
                None => {
                    eprintln!("{}", "Enter note content (Ctrl+D to finish):".cyan());
                    let mut buf = String::new();
                    std::io::Read::read_to_string(&mut std::io::stdin(), &mut buf)?;
                    buf.trim_end().to_string()
                }
            };

            let tag_list = parse_tags(&tags);
            let mut kb = KnowledgeBase::open(&kb_path)?;
            let id = kb.add_note(&title, &content, &tag_list)?;
            kb.commit()?;
            println!("{} {} (id: {})", "Added note:".green().bold(), title.cyan(), id);
        }

        Commands::Import { path, tags, recursive } => {
            let tag_list = parse_tags(&tags);
            let mut kb = KnowledgeBase::open(&kb_path)?;

            let results = if std::path::Path::new(&path).is_dir() {
                kb.import_directory(&path, &tag_list, recursive)?
            } else {
                vec![kb.import_file(&path, &tag_list)?]
            };

            let success_count = results.iter().filter(|r| r.success).count();
            let fail_count = results.len() - success_count;
            kb.commit()?;

            println!(
                "{} {} files ({} succeeded, {} failed)",
                "Import complete:".green().bold(),
                results.len().to_string().cyan(),
                success_count.to_string().green(),
                fail_count.to_string().red()
            );

            for r in &results {
                if r.success {
                    println!("  {} {}", "✓".green(), r.title.cyan());
                } else if let Some(e) = &r.error {
                    println!("  {} {} - {}", "✗".red(), r.title.red(), e);
                }
            }
        }

        Commands::Stats { format } => {
            let kb = KnowledgeBase::open(&kb_path)?;
            let stats = kb.stats()?;
            print_stats(&stats, &format)?;
        }

        Commands::Entities { name, list: _, format: _ } => {
            let _kb = KnowledgeBase::open(&kb_path)?;
            match name {
                Some(n) => {
                    println!("{}", format!("Entity lookup for '{}' requires Logic-Mesh support (coming soon)", n).yellow());
                }
                None => {
                    println!("{}", "Entity browsing requires Logic-Mesh support (coming soon).".yellow());
                }
            }
        }

        Commands::Timeline { from, to, limit, format } => {
            let mut kb = KnowledgeBase::open(&kb_path)?;
            let query = clawkb_core::timeline::TimelineQuery {
                from_date: from,
                to_date: to,
                limit: Some(limit),
                tag: None,
            };
            let entries = kb.timeline(query)?;

            if format == "json" {
                println!("{}", serde_json::to_string_pretty(&entries)?);
            } else if entries.is_empty() {
                println!("{}", "No timeline entries found.".yellow());
            } else {
                for entry in &entries {
                    println!(
                        "{} {} {}",
                        entry.timestamp.as_str().dimmed(),
                        entry.id.as_str().cyan(),
                        truncate_str(&entry.title, 60)
                    );
                }
            }
        }

        Commands::Commit => {
            let mut kb = KnowledgeBase::open(&kb_path)?;
            kb.commit()?;
            println!("{}", "Changes committed.".green());
        }

        Commands::InitSkills { target } => {
            println!("{} Installing ClawKB Skills to '{}'...",
                "ClawKB:".green().bold(), target.cyan());

            let skills_dir = std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("skills");

            if !skills_dir.exists() {
                anyhow::bail!(
                    "Skills directory not found at {}. Run from the claw-kb project root.",
                    skills_dir.display()
                );
            }

            let targets = if target == "all" {
                vec!["claude-code", "codex", "openclaw"]
            } else {
                vec![target.as_str()]
            };

            let home = std::env::var("HOME")
                .map_err(|_| anyhow::anyhow!("HOME environment variable not set"))?;

            for t in targets {
                let dest_dir = match t {
                    "claude-code" => PathBuf::from(&home).join(".claude/skills"),
                    "codex" => PathBuf::from(&home).join(".codex/skills"),
                    "openclaw" => PathBuf::from(&home).join(".openclaw/skills"),
                    _ => continue,
                };

                std::fs::create_dir_all(&dest_dir)?;

                for entry in std::fs::read_dir(&skills_dir)? {
                    let entry = entry?;
                    if entry.path().is_dir() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        let dest = dest_dir.join(&name);
                        copy_dir_recursive(&entry.path(), &dest)?;
                        println!("  {} {} -> {}", "✓".green(), name.cyan(), dest.display());
                    }
                }
            }
            println!("{}", "Done!".green());
        }

        Commands::Export { output_dir, format } => {
            let export_format = ExportFormat::from_str(&format)
                .ok_or_else(|| anyhow::anyhow!("Invalid format: {}. Use md, html, or json.", format))?;

            let mut kb = KnowledgeBase::open(&kb_path)?;
            let data = kb.export(export_format)?;

            let output_path = PathBuf::from(&output_dir);
            std::fs::create_dir_all(&output_path)?;

            let filename = format!("clawkb-export.{}", export_format.extension());
            let file_path = output_path.join(filename);

            clawkb_core::export::export_to_file(&data, export_format, &file_path)?;

            println!(
                "{} {} documents exported to {}",
                "Export complete:".green().bold(),
                data.documents.len().to_string().cyan(),
                file_path.display().to_string().blue()
            );
        }

        Commands::Config { action } => {
            handle_config(action, &kb_path.display().to_string())?;
        }

        Commands::Tags => {
            let mut kb = KnowledgeBase::open(&kb_path)?;
            let tags = kb.list_tags()?;

            if tags.is_empty() {
                println!("{}", "No tags found.".yellow());
            } else {
                println!("\n{} ({} total)\n", "Tags".green().bold(), tags.len());
                for tag in &tags {
                    println!(
                        "  {} {}",
                        format!("#{}", tag.name).cyan(),
                        format!("({})", tag.count).dimmed()
                    );
                }
            }
        }

        Commands::FetchUrl { url, urls, tags } => {
            let tag_list = parse_tags(&tags);
            let mut kb = KnowledgeBase::open(&kb_path)?;

            let mut all_urls = vec![url];
            if let Some(extra) = urls {
                all_urls.extend(extra);
            }

            println!("{} {} URL(s)...", "Fetching".green().bold(), all_urls.len().to_string().cyan());

            let url_refs: Vec<&str> = all_urls.iter().map(|s| s.as_str()).collect();
            let results = kb.fetch_urls(&url_refs, &tag_list)?;
            kb.commit()?;

            let success_count = results.iter().filter(|r| r.success).count();
            let fail_count = results.len() - success_count;

            println!(
                "{} {} URLs ({} succeeded, {} failed)",
                "Fetch complete:".green().bold(),
                results.len().to_string().cyan(),
                success_count.to_string().green(),
                fail_count.to_string().red()
            );

            for r in &results {
                if r.success {
                    println!("  {} {} ({} chars)", "✓".green(), r.title.cyan(), r.content_length.to_string().dimmed());
                    println!("    {}", r.url.blue());
                } else if let Some(e) = &r.error {
                    println!("  {} {} - {}", "✗".red(), r.url.red(), e);
                }
            }
        }

        #[cfg(feature = "evif-mcp")]
        Commands::Mcp { skills_dir, port } => {
            use clawkb_core::evif_mcp::server::{McpServerConfig, router};
            use std::net::SocketAddr;

            let addr: SocketAddr = ([127, 0, 0, 1], port).into();
            let kb_path_str = kb_path.display().to_string();

            let config = McpServerConfig {
                address: addr,
                skills_dir: PathBuf::from(&skills_dir),
                kb_path: Some(kb_path_str.clone()),
            };

            println!("{} Starting EVIF MCP server...", "ClawKB:".green().bold());
            println!("  Skills directory: {}", skills_dir.cyan());
            println!("  Listen address: {}", addr.to_string().cyan());
            println!("  Default KB: {}", kb_path_str.cyan());
            println!("");
            println!("MCP Endpoints:");
            println!("  GET  /api/v1/mcp/tools         - List all tools");
            println!("  GET  /api/v1/mcp/tools/{{name}} - Get tool definition");
            println!("  POST /api/v1/mcp/tools/{{name}}/invoke - Invoke a skill");
            println!("");

            tokio::runtime::Runtime::new()?
                .block_on(async {
                    router::serve(config).await
                        .map_err(|e| anyhow::anyhow!("{}", e))
                })?;
        }
    }

    Ok(())
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    if src.is_dir() {
        std::fs::create_dir_all(dst)?;
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            copy_dir_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        }
    } else {
        std::fs::copy(src, dst)?;
    }
    Ok(())
}

fn print_stats(stats: &KbStats, format: &str) -> Result<()> {
    if format == "json" {
        println!("{}", serde_json::to_string_pretty(stats)?);
        return Ok(());
    }

    println!("\n{} {}\n", "ClawKB Knowledge Base".green().bold(), stats.path.dimmed());

    let mut table = Table::new();
    table.load_preset(NOTHING)
        .set_content_arrangement(ContentArrangement::Dynamic)
        .set_header(vec!["Metric", "Value"])
        .add_row(vec!["Frames", &stats.frame_count.to_string()])
        .add_row(vec!["Size", &format_bytes(stats.size_bytes)])
        .add_row(vec!["Payload", &format_bytes(stats.payload_bytes)])
        .add_row(vec!["Lex Index", if stats.has_lex_index { "Yes" } else { "No" }])
        .add_row(vec!["Vec Index", if stats.has_vec_index { "Yes" } else { "No" }])
        .add_row(vec!["Compression", &format!("{:.1}%", stats.compression_ratio_percent)])
        .add_row(vec!["Path", &stats.path]);

    println!("{table}");
    Ok(())
}

fn print_search_results(hits: &[SearchHit]) {
    if hits.is_empty() {
        println!("{}", "No results found.".yellow());
        return;
    }

    for (i, hit) in hits.iter().enumerate() {
        let score_bar = format_score_bar(hit.score);
        println!(
            "\n{} {} {}",
            format!("[{}]", i + 1).dimmed(),
            if hit.title.is_empty() { "(untitled)".to_string() } else { hit.title.clone().bold().to_string() },
            score_bar,
        );
        if !hit.tags.is_empty() {
            let tag_str: Vec<String> = hit.tags.iter().map(|t| format!("#{}", t)).collect();
            println!("   {}", tag_str.join(" ").cyan());
        }
        println!("   {}", truncate_str(&hit.content, 120).dimmed());
        if let Some(source) = &hit.source {
            println!("   {}", source.blue());
        }
    }
    println!("\n{} results", hits.len().to_string().bold());
}

fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

fn format_score_bar(score: f32) -> String {
    let normalized = score.clamp(0.0, 1.0);
    let bars = (normalized * 10.0) as usize;
    let filled = "█".repeat(bars);
    let empty = "░".repeat(10 - bars);
    format!("{}{} {:.2}", filled.green(), empty.dimmed(), score)
}

fn truncate_str(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_len).collect();
        format!("{}...", truncated)
    }
}

fn get_config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".clawkb/config.toml")
}

fn load_config() -> std::collections::HashMap<String, String> {
    let config_path = get_config_path();
    if !config_path.exists() {
        return std::collections::HashMap::new();
    }

    let content = std::fs::read_to_string(&config_path).unwrap_or_default();
    let mut config = std::collections::HashMap::new();

    for line in content.lines() {
        if let Some((key, value)) = line.split_once('=') {
            config.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    config
}

fn save_config(config: &std::collections::HashMap<String, String>) -> Result<()> {
    let config_path = get_config_path();
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut content = String::new();
    let mut keys: Vec<_> = config.keys().collect();
    keys.sort();

    for key in keys {
        if let Some(value) = config.get(key) {
            content.push_str(&format!("{} = {}\n", key, value));
        }
    }

    std::fs::write(&config_path, content)?;
    Ok(())
}

fn handle_config(action: ConfigAction, default_kb_path: &str) -> Result<()> {
    let mut config = load_config();

    match action {
        ConfigAction::Set { key, value } => {
            if !matches!(key.as_str(), "kb-path" | "model" | "embedding-model") {
                anyhow::bail!("Unknown config key: {}. Valid keys: kb-path, model, embedding-model", key);
            }
            config.insert(key.clone(), value.clone());
            save_config(&config)?;
            println!("{} {} = {}", "Config set:".green().bold(), key.cyan(), value);
        }
        ConfigAction::Get { key } => {
            let default_kb = default_kb_path.replace('~', &std::env::var("HOME").unwrap_or_default());
            let value = config.get(&key).cloned().unwrap_or_else(|| {
                if key == "kb-path" { default_kb } else { String::new() }
            });
            println!("{}", value);
        }
        ConfigAction::List => {
            let default_kb = default_kb_path.replace('~', &std::env::var("HOME").unwrap_or_default());
            println!("\n{}", "ClawKB Configuration".green().bold());
            println!("Config file: {}\n", get_config_path().display().to_string().dimmed());

            let mut table = Table::new();
            table.load_preset(NOTHING)
                .set_content_arrangement(ContentArrangement::Dynamic)
                .set_header(vec!["Key", "Value"])
                .add_row(vec!["kb-path", config.get("kb-path").unwrap_or(&default_kb)])
                .add_row(vec!["model", config.get("model").unwrap_or(&"default".to_string())])
                .add_row(vec!["embedding-model", config.get("embedding-model").unwrap_or(&"bge-small-en".to_string())]);
            println!("{table}");
        }
    }

    Ok(())
}
