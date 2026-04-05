//! AI Configuration — stores global embedding and LLM provider settings.
//!
//! This module provides a thread-safe global store for AI configuration,
//! used by both the embedding system and the LLM synthesis layer.

use serde::{Deserialize, Serialize};
use std::sync::RwLock;

/// AI provider type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    /// Local ONNX / Ollama (no API key required).
    Local,
    /// OpenAI-compatible API (OpenAI, DeepSeek, custom endpoints).
    OpenAI,
    /// Anthropic Claude API.
    Anthropic,
    /// DeepSeek API (uses OpenAI-compatible format).
    DeepSeek,
    /// Fully custom provider (URL + model name provided by user).
    Custom,
}

impl Default for AiProvider {
    fn default() -> Self {
        Self::Local
    }
}

/// Embedding model configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingConfig {
    pub provider: AiProvider,
    pub model: String,
    pub api_key: Option<String>,
    pub api_base: Option<String>,
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            provider: AiProvider::Local,
            model: "bge-small-en-v1.5".to_string(),
            api_key: None,
            api_base: None,
        }
    }
}

/// LLM (Ask / synthesis) model configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider: AiProvider,
    pub model: String,
    pub api_key: Option<String>,
    pub api_base: Option<String>,
    pub temperature: f32,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            provider: AiProvider::Local,
            model: "llama3.2".to_string(),
            api_key: None,
            api_base: None,
            temperature: 0.7,
        }
    }
}

/// Internal storage for both configs.
struct AiConfigStore {
    embedding: Option<EmbeddingConfig>,
    llm: Option<LlmConfig>,
}

impl Default for AiConfigStore {
    fn default() -> Self {
        Self {
            embedding: None,
            llm: None,
        }
    }
}

static AI_CONFIG: RwLock<AiConfigStore> = RwLock::new(AiConfigStore {
    embedding: None,
    llm: None,
});

/// Set the global embedding configuration.
pub fn set_embedding_config(config: EmbeddingConfig) {
    let mut store = AI_CONFIG.write().unwrap();
    store.embedding = Some(config);
}

/// Get the current embedding configuration.
pub fn get_embedding_config() -> Option<EmbeddingConfig> {
    let store = AI_CONFIG.read().unwrap();
    store.embedding.clone()
}

/// Set the global LLM (Ask) configuration.
pub fn set_llm_config(config: LlmConfig) {
    let mut store = AI_CONFIG.write().unwrap();
    store.llm = Some(config);
}

/// Get the current LLM configuration.
pub fn get_llm_config() -> Option<LlmConfig> {
    let store = AI_CONFIG.read().unwrap();
    store.llm.clone()
}

/// Clear all AI configuration (useful for resets).
pub fn clear_config() {
    let mut store = AI_CONFIG.write().unwrap();
    store.embedding = None;
    store.llm = None;
}
