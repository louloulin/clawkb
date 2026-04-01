use serde::{Deserialize, Serialize};

/// A citation reference from an AI answer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskCitation {
    pub index: usize,
    pub frame_id: String,
    pub uri: String,
    pub score: Option<f32>,
}


/// A context fragment retrieved during ask.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextFragment {
    pub rank: usize,
    pub frame_id: String,
    pub uri: String,
    pub title: Option<String>,
    pub score: Option<f32>,
    pub text: String,
}

/// Result from an AI ask query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskResult {
    /// The synthesized answer (None when context_only=true)
    pub answer: Option<String>,
    /// Citation references
    pub citations: Vec<AskCitation>,
    /// Retrieved context fragments
    pub context: Vec<ContextFragment>,
    /// Which retriever was used (lex/semantic/hybrid)
    pub retriever: String,
    /// Whether this was a context-only query
    pub context_only: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ask_result_serialization() {
        let result = AskResult {
            answer: Some("Test answer".to_string()),
            citations: vec![AskCitation {
                index: 0,
                frame_id: "f-1".to_string(),
                uri: "doc.md".to_string(),
                score: Some(0.95),
            }],
            context: vec![ContextFragment {
                rank: 1,
                frame_id: "f-1".to_string(),
                uri: "doc.md".to_string(),
                title: Some("Test Doc".to_string()),
                score: Some(0.9),
                text: "This is the test content.".to_string(),
            }],
            retriever: "hybrid".to_string(),
            context_only: false,
        };

        let json = serde_json::to_string(&result).unwrap();
        let r2: AskResult = serde_json::from_str(&json).unwrap();
        assert_eq!(result.answer, r2.answer);
        assert_eq!(result.citations.len(), 1);
        assert_eq!(result.context.len(), 1);
        assert_eq!(result.retriever, "hybrid");
        assert!(!result.context_only);
    }

    #[test]
    fn test_context_only_result() {
        let result = AskResult {
            answer: None,
            citations: vec![],
            context: vec![ContextFragment {
                rank: 1,
                frame_id: "f-2".to_string(),
                uri: "note.md".to_string(),
                title: None,
                score: None,
                text: "Context text.".to_string(),
            }],
            retriever: "lex".to_string(),
            context_only: true,
        };
        assert!(result.answer.is_none());
        assert!(result.citations.is_empty());
        assert_eq!(result.context.len(), 1);
        assert!(result.context_only);
    }
}
