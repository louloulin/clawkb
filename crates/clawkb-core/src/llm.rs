//! LLM Synthesis — calls external LLM APIs to generate answers from retrieved context.
//!
//! This module provides a unified interface for multiple LLM providers
//! (Ollama, OpenAI, Anthropic, DeepSeek) and a convenient `synthesize_with_config()`
//! function that selects the provider based on the current `ai_config`.

use crate::ai_config::{get_llm_config, AiProvider};
use crate::ask::ContextFragment;
use crate::error::{KbError, Result};

/// A context fragment with text content used for synthesis.
#[derive(Debug, Clone)]
pub struct SynthesisContext {
    /// The retrieved text chunks.
    pub chunks: Vec<String>,
    /// Citation metadata for each chunk.
    pub citations: Vec<(usize, String)>,
}

/// Trait for LLM providers that can synthesize an answer from context.
pub trait LlmProvider: Send + Sync {
    /// Synthesize an answer from the retrieved context chunks.
    fn synthesize(
        &self,
        question: &str,
        context: &SynthesisContext,
        temperature: f32,
    ) -> Result<String>;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (works for OpenAI, DeepSeek, and custom endpoints)
// ---------------------------------------------------------------------------

pub struct OpenAiProvider {
    pub api_key: Option<String>,
    pub model: String,
    pub api_base: String,
}

impl OpenAiProvider {
    pub fn new(api_key: Option<String>, model: String, api_base: Option<String>) -> Self {
        Self {
            api_key,
            model,
            api_base: api_base.unwrap_or_else(|| "https://api.openai.com/v1".to_string()),
        }
    }

    fn build_context_prompt(&self, question: &str, context: &SynthesisContext) -> String {
        let mut prompt = String::from("You are a helpful AI assistant. Use the following context to answer the question.\n\n");
        prompt.push_str("## Context:\n");
        for (i, chunk) in context.chunks.iter().enumerate() {
            prompt.push_str(&format!("[{}] {}\n\n", i + 1, chunk));
        }
        prompt.push_str("## Question:\n");
        prompt.push_str(question);
        prompt.push_str("\n\n## Answer:\n");
        prompt
    }

    fn call_api(&self, prompt: &str, temperature: f32) -> Result<String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| KbError::Config(e.to_string()))?;

        let body = serde_json::json!({
            "model": self.model,
            "prompt": prompt,
            "temperature": temperature,
            "stream": false,
            "max_tokens": 1024,
        });

        let mut request = client
            .post(format!("{}/completions", self.api_base))
            .header("Content-Type", "application/json");

        if let Some(ref key) = self.api_key {
            request = request.header("Authorization", format!("Bearer {}", key));
        }

        let response = request
            .json(&body)
            .send()
            .map_err(|e| KbError::Config(format!("HTTP error: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body_text = response.text().unwrap_or_default();
            return Err(KbError::Config(format!(
                "OpenAI API error {}: {}",
                status, body_text
            )));
        }

        let resp_json: serde_json::Value = response
            .json()
            .map_err(|e| KbError::Config(format!("JSON parse error: {}", e)))?;

        // Support both /completions and /chat/completions response formats.
        let text = resp_json["choices"][0]["text"]
            .as_str()
            .or_else(|| resp_json["choices"][0]["message"]["content"].as_str())
            .ok_or_else(|| KbError::Config("Unexpected response format from LLM API".to_string()))?
            .to_string();

        Ok(text)
    }
}

impl LlmProvider for OpenAiProvider {
    fn synthesize(
        &self,
        question: &str,
        context: &SynthesisContext,
        temperature: f32,
    ) -> Result<String> {
        let prompt = self.build_context_prompt(question, context);
        self.call_api(&prompt, temperature)
    }
}

// ---------------------------------------------------------------------------
// Anthropic Claude provider
// ---------------------------------------------------------------------------

pub struct AnthropicProvider {
    pub api_key: String,
    pub model: String,
}

impl AnthropicProvider {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        Self {
            api_key,
            model: model.unwrap_or_else(|| "claude-3-haiku-20240307".to_string()),
        }
    }

    fn build_context_text(&self, context: &SynthesisContext) -> String {
        context
            .chunks
            .iter()
            .enumerate()
            .map(|(i, chunk)| format!("[{}] {}", i + 1, chunk))
            .collect::<Vec<_>>()
            .join("\n\n")
    }

    fn call_api(&self, question: &str, context_text: &str, temperature: f32) -> Result<String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| KbError::Config(e.to_string()))?;

        let body = serde_json::json!({
            "model": self.model,
            "max_tokens": 1024,
            "temperature": temperature,
            "messages": [{
                "role": "user",
                "content": format!(
                    "You are a helpful AI assistant. Use the following context to answer the question.\n\n\
                     ## Context:\n{}\n\n\
                     ## Question:\n{}\n\n\
                     ## Answer:",
                    context_text, question
                )
            }]
        });

        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .map_err(|e| KbError::Config(format!("HTTP error: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body_text = response.text().unwrap_or_default();
            return Err(KbError::Config(format!(
                "Anthropic API error {}: {}",
                status, body_text
            )));
        }

        let resp_json: serde_json::Value = response
            .json()
            .map_err(|e| KbError::Config(format!("JSON parse error: {}", e)))?;

        let text = resp_json["content"][0]["text"]
            .as_str()
            .ok_or_else(|| KbError::Config("Unexpected Anthropic response format".to_string()))?
            .to_string();

        Ok(text)
    }
}

impl LlmProvider for AnthropicProvider {
    fn synthesize(
        &self,
        question: &str,
        context: &SynthesisContext,
        temperature: f32,
    ) -> Result<String> {
        let context_text = self.build_context_text(context);
        self.call_api(question, &context_text, temperature)
    }
}

// ---------------------------------------------------------------------------
// Ollama provider (local)
//
// Note: Ollama uses the `/api/generate` endpoint which accepts a `model` field
// and a `prompt` field. The prompt is a raw string (not a chat format).
// ---------------------------------------------------------------------------

pub struct OllamaProvider {
    pub model: String,
    pub api_base: String,
}

impl OllamaProvider {
    pub fn new(model: Option<String>, api_base: Option<String>) -> Self {
        Self {
            model: model.unwrap_or_else(|| "llama3.2".to_string()),
            api_base: api_base.unwrap_or_else(|| "http://localhost:11434".to_string()),
        }
    }

    fn build_prompt(&self, question: &str, context: &SynthesisContext) -> String {
        let context_text = context
            .chunks
            .iter()
            .enumerate()
            .map(|(i, chunk)| format!("[{}] {}", i + 1, chunk))
            .collect::<Vec<_>>()
            .join("\n\n");

        format!(
            "You are a helpful AI assistant. Use the following context to answer the question \
             in a clear and concise manner. If the context does not contain enough information \
             to answer the question, say so.\n\n\
             ## Context:\n{}\n\n\
             ## Question:\n{}\n\n\
             ## Answer:",
            context_text, question
        )
    }

    fn call_api(&self, prompt: &str, temperature: f32) -> Result<String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| KbError::Config(e.to_string()))?;

        let body = serde_json::json!({
            "model": self.model,
            "prompt": prompt,
            "stream": false,
            "temperature": temperature,
            "options": {
                "temperature": temperature,
                "num_predict": 1024,
            }
        });

        let response = client
            .post(format!("{}/api/generate", self.api_base))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .map_err(|e| KbError::Config(format!("Ollama HTTP error: {}. Is Ollama running?", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body_text = response.text().unwrap_or_default();
            return Err(KbError::Config(format!("Ollama error {}: {}", status, body_text)));
        }

        let resp_json: serde_json::Value = response
            .json()
            .map_err(|e| KbError::Config(format!("JSON parse error: {}", e)))?;

        // Ollama returns { "response": "..." }
        let text = resp_json["response"]
            .as_str()
            .ok_or_else(|| KbError::Config("Unexpected Ollama response format".to_string()))?
            .to_string();

        Ok(text)
    }
}

impl LlmProvider for OllamaProvider {
    fn synthesize(
        &self,
        question: &str,
        context: &SynthesisContext,
        temperature: f32,
    ) -> Result<String> {
        let prompt = self.build_prompt(question, context);
        self.call_api(&prompt, temperature)
    }
}

// ---------------------------------------------------------------------------
// Synthesis with current config
// ---------------------------------------------------------------------------

/// Synthesize an answer using the currently configured LLM provider.
/// Returns `Ok(None)` if no LLM is configured.
pub fn synthesize_with_config(
    question: &str,
    context_fragments: &[ContextFragment],
    temperature: Option<f32>,
) -> Result<Option<String>> {
    let config = match get_llm_config() {
        Some(c) => c,
        None => return Ok(None),
    };

    let temperature = temperature.unwrap_or(config.temperature);

    let chunks: Vec<String> = context_fragments
        .iter()
        .map(|f| f.text.clone())
        .collect();

    let citations: Vec<(usize, String)> = context_fragments
        .iter()
        .enumerate()
        .map(|(i, f)| (i + 1, f.uri.clone()))
        .collect();

    let ctx = SynthesisContext { chunks, citations };

    let answer = match config.provider {
        AiProvider::Local | AiProvider::Custom => {
            // Try Ollama first for local/custom, falling back to OpenAI format.
            let ollama = OllamaProvider::new(Some(config.model.clone()), config.api_base.clone());
            match ollama.synthesize(question, &ctx, temperature) {
                Ok(text) => text,
                Err(e) => {
                    tracing::warn!("Ollama synthesis failed, trying OpenAI format: {}", e);
                    let openai = OpenAiProvider::new(
                        config.api_key.clone(),
                        config.model.clone(),
                        config.api_base.clone(),
                    );
                    openai.synthesize(question, &ctx, temperature)?
                }
            }
        }
        AiProvider::OpenAI => {
            let openai = OpenAiProvider::new(
                config.api_key.clone(),
                config.model.clone(),
                config.api_base.clone(),
            );
            openai.synthesize(question, &ctx, temperature)?
        }
        AiProvider::Anthropic => {
            let api_key = config.api_key.unwrap_or_default();
            let claude = AnthropicProvider::new(api_key, Some(config.model.clone()));
            claude.synthesize(question, &ctx, temperature)?
        }
        AiProvider::DeepSeek => {
            // DeepSeek uses OpenAI-compatible format with custom base URL.
            let base = config.api_base.clone().unwrap_or_else(|| "https://api.deepseek.com".to_string());
            let openai = OpenAiProvider::new(
                config.api_key.clone(),
                config.model.clone(),
                Some(base),
            );
            openai.synthesize(question, &ctx, temperature)?
        }
    };

    Ok(Some(answer))
}

/// Test connection to the currently configured LLM.
/// Returns `Ok(())` if the provider is reachable and responds.
pub fn test_llm_connection() -> Result<()> {
    let config = match get_llm_config() {
        Some(c) => c,
        None => return Err(KbError::Config("No LLM configured".to_string())),
    };

    let temp = 0.0;
    let dummy_context = SynthesisContext {
        chunks: vec!["This is a test.".to_string()],
        citations: vec![],
    };

    match config.provider {
        AiProvider::Local | AiProvider::Custom => {
            let ollama = OllamaProvider::new(Some(config.model.clone()), config.api_base.clone());
            ollama.synthesize("Reply with exactly: OK", &dummy_context, temp)?;
        }
        AiProvider::OpenAI => {
            let openai = OpenAiProvider::new(config.api_key, config.model, config.api_base);
            openai.synthesize("Reply with exactly: OK", &dummy_context, temp)?;
        }
        AiProvider::Anthropic => {
            let api_key = config.api_key.unwrap_or_default();
            let claude = AnthropicProvider::new(api_key, Some(config.model));
            claude.synthesize("Reply with exactly: OK", &dummy_context, temp)?;
        }
        AiProvider::DeepSeek => {
            let base = config.api_base.unwrap_or_else(|| "https://api.deepseek.com".to_string());
            let openai = OpenAiProvider::new(config.api_key, config.model, Some(base));
            openai.synthesize("Reply with exactly: OK", &dummy_context, temp)?;
        }
    }

    Ok(())
}
