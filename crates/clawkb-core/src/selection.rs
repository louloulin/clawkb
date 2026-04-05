//! Selection AI — global text selection AI actions.
//!
//! When user selects text anywhere and triggers Cmd+Shift+K,
//! ClawKB can: explain, translate, rewrite, or ask about the selection.

use crate::llm::synthesize_with_config;
use crate::ai_config::get_llm_config;

/// Result of a selection AI action.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SelectionResult {
    pub action: String,
    pub input: String,
    pub output: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Perform an AI action on selected text.
pub fn selection_ai(action: &str, text: &str) -> SelectionResult {
    let config = match get_llm_config() {
        Some(c) => c,
        None => {
            return SelectionResult {
                action: action.to_string(),
                input: text.to_string(),
                output: String::new(),
                success: false,
                error: Some("No LLM configured. Please set up AI model in Settings.".to_string()),
            };
        }
    };

    let prompt = match action {
        "explain" => build_explain_prompt(text),
        "translate" => build_translate_prompt(text),
        "rewrite" => build_rewrite_prompt(text),
        "summarize" => build_summarize_prompt(text),
        "ask" => build_ask_prompt(text),
        _ => {
            return SelectionResult {
                action: action.to_string(),
                input: text.to_string(),
                output: String::new(),
                success: false,
                error: Some(format!("Unknown action: {}", action)),
            };
        }
    };

    match synthesize_with_config(&prompt, &[], Some(config.temperature)) {
        Ok(Some(response)) => SelectionResult {
            action: action.to_string(),
            input: text.to_string(),
            output: response,
            success: true,
            error: None,
        },
        Ok(None) => SelectionResult {
            action: action.to_string(),
            input: text.to_string(),
            output: String::new(),
            success: false,
            error: Some("LLM not available. Please configure an AI model in Settings.".to_string()),
        },
        Err(e) => SelectionResult {
            action: action.to_string(),
            input: text.to_string(),
            output: String::new(),
            success: false,
            error: Some(e.to_string()),
        },
    }
}

fn build_explain_prompt(text: &str) -> String {
    format!(
        "请解释以下文本，用简洁明了的语言帮助理解。如果文本是中文则用中文回答，如果是英文则用英文回答。\n\n文本：\n{}\n\n解释：",
        text
    )
}

fn build_translate_prompt(text: &str) -> String {
    // Detect language and translate to the opposite
    let has_chinese = text.chars().any(|c| {
        let code = c as u32;
        (0x4E00..=0x9FFF).contains(&code)
            || (0x3000..=0x303F).contains(&code)
            || (0xFF00..=0xFFEF).contains(&code)
    });

    let target = if has_chinese { "英文" } else { "中文" };
    format!(
        "请将以下文本翻译成{}，保持原文的风格和语气，只返回翻译结果：\n\n文本：\n{}\n\n翻译：",
        target,
        text
    )
}

fn build_rewrite_prompt(text: &str) -> String {
    format!(
        "请将以下文本改写，使其表达更清晰、更流畅，同时保持原意。只返回改写后的文本：\n\n原文：\n{}\n\n改写：",
        text
    )
}

fn build_summarize_prompt(text: &str) -> String {
    format!(
        "请用简洁的语言总结以下文本的核心要点，用bullet points列出：\n\n文本：\n{}\n\n总结：",
        text
    )
}

fn build_ask_prompt(text: &str) -> String {
    format!(
        "基于以下文本内容，回答相关问题。如没有问题，请给出文本的主要观点：\n\n文本：\n{}\n\n回答：",
        text
    )
}
