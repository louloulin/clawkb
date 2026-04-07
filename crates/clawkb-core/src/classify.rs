//! Auto-classification module for imported documents.
//!
//! Analyzes document content and path to automatically infer tags and categories.

/// Keyword patterns for document type detection.
const TYPE_PATTERNS: &[(&str, &str)] = &[
    // Meeting-related
    ("meeting", "meeting"),
    ("会议", "meeting"),
    ("会议纪要", "meeting"),
    ("minutes", "meeting"),
    ("agenda", "meeting"),
    ("议程", "meeting"),
    ("与会", "meeting"),
    // Report-related
    ("report", "report"),
    ("报告", "report"),
    ("月度报告", "monthly-report"),
    ("季度报告", "quarterly-report"),
    ("年度报告", "annual-report"),
    ("周报", "weekly-report"),
    ("报告书", "report"),
    // Research-related
    ("research", "research"),
    ("研究", "research"),
    ("论文", "research-paper"),
    ("研究论文", "research-paper"),
    ("实验", "experiment"),
    ("analysis", "analysis"),
    ("分析", "analysis"),
    // Project-related
    ("project", "project"),
    ("项目", "project"),
    ("项目计划", "project"),
    ("项目文档", "project"),
    ("proposal", "proposal"),
    ("提案", "proposal"),
    // Finance/business
    ("invoice", "invoice"),
    ("发票", "invoice"),
    ("合同", "contract"),
    ("contract", "contract"),
    ("报价", "quotation"),
    ("预算", "budget"),
    ("budget", "budget"),
    // Personal
    ("笔记", "note"),
    ("note", "note"),
    ("journal", "journal"),
    ("日记", "journal"),
    ("todolist", "todo"),
    ("todo", "todo"),
    ("任务", "todo"),
    // Reference/docs
    ("manual", "manual"),
    ("手册", "manual"),
    ("指南", "guide"),
    ("guide", "guide"),
    ("documentation", "documentation"),
    ("docs", "documentation"),
    ("specification", "spec"),
    ("规范", "spec"),
    // Data
    ("data", "data"),
    ("数据集", "data"),
    ("dataset", "data"),
    ("statistics", "statistics"),
    ("统计", "statistics"),
];

/// Detect document type from content using keyword matching.
pub fn detect_type_tags(content: &str) -> Vec<String> {
    let content_lower = content.to_lowercase();
    let mut tags = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for (keyword, tag) in TYPE_PATTERNS {
        if content_lower.contains(keyword) {
            if seen.insert(tag.to_string()) {
                tags.push(tag.to_string());
            }
        }
    }

    // Limit to avoid too many auto-tags
    tags.truncate(3);
    tags
}

/// Extract tags from file path (folder names become tags).
/// E.g., "/Users/work/reports/2024/summary.pdf" → ["work", "reports", "2024"]
pub fn extract_path_tags(path: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // Split by path separators
    let parts: Vec<&str> = if path.contains('/') {
        path.split('/').collect()
    } else if path.contains('\\') {
        path.split('\\').collect()
    } else {
        return tags;
    };

    for part in parts {
        // Skip empty parts, common noise, and file extensions
        if part.is_empty()
            || part == "~"
            || part == "."
            || part == ".."
            || part == "Desktop"
            || part == "Documents"
            || part == "Downloads"
            || part == "home"
            || part == "Users"
            || part == "tmp"
            || part == "temp"
        {
            continue;
        }

        // Skip if it looks like a filename (has extension)
        let is_file = part.contains('.');
        if is_file {
            continue;
        }

        // Clean the tag: lowercase, replace spaces/dashes with underscores
        let tag = part
            .trim()
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect::<String>();

        if !tag.is_empty() && !tag.chars().all(|c| c.is_ascii_digit()) && seen.insert(tag.clone()) {
            tags.push(tag);
        }
    }

    // Limit path tags to avoid cluttering
    tags.truncate(4);
    tags
}

/// Infer tags from filename.
/// E.g., "Q4_2024_financial_report.pdf" → ["q4", "2024", "financial", "report"]
pub fn extract_filename_tags(filename: &str) -> Vec<String> {
    let name = std::path::Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);

    let mut tags = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // Split on common separators
    let segments: Vec<&str> = name
        .split(|c: char| c == '-' || c == '_' || c == ' ' || c == '.' || c == '@')
        .filter(|s| !s.is_empty())
        .collect();

    for seg in segments {
        let seg_lower = seg.to_lowercase();

        let is_all_digits = seg_lower.chars().all(|c| c.is_ascii_digit());
        let is_year_like = seg_lower.len() == 4;
        let is_mixed_short_token = seg_lower.len() <= 2
            && seg_lower.chars().any(|c| c.is_ascii_alphabetic())
            && seg_lower.chars().any(|c| c.is_ascii_digit());

        // Skip most pure numbers, but keep year-like filename tokens such as 2024.
        if is_all_digits && !is_year_like {
            continue;
        }

        // Skip common noise words
        let skip_words = ["final", "draft", "v1", "v2", "v3", "copy", "copy2",
                          "new", "old", "backup", "latest", "rev", "edit"];
        if skip_words.contains(&seg_lower.as_str()) {
            continue;
        }

        // Skip very short segments unless they are meaningful mixed tokens such as q4.
        if seg_lower.len() <= 2 && !is_mixed_short_token {
            continue;
        }

        if seen.insert(seg_lower.clone()) {
            tags.push(seg_lower);
        }
    }

    tags.truncate(4);
    tags
}

/// Combine all auto-classification results into a unified tag list.
/// Returns (auto_tags, classification_summary).
pub fn classify_document(
    content: &str,
    file_path: &str,
    existing_tags: &[&str],
) -> (Vec<String>, String) {
    let type_tags = detect_type_tags(content);
    let path_tags = extract_path_tags(file_path);
    let name_tags = extract_filename_tags(file_path);

    // Combine all tags, deduplicate, filter existing
    let existing: std::collections::HashSet<_> = existing_tags.iter().map(|s| s.to_lowercase()).collect();
    let mut auto_tags: Vec<String> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // Priority: content types > filename > path
    for tag in type_tags.iter().chain(&name_tags).chain(&path_tags) {
        if !existing.contains(tag) && seen.insert(tag.clone()) {
            auto_tags.push(tag.clone());
        }
    }

    let summary = if auto_tags.is_empty() {
        "no-auto-tags".to_string()
    } else {
        format!(
            "type={} path={} name={}",
            type_tags.join("+"),
            path_tags.join("+"),
            name_tags.join("+")
        )
    };

    (auto_tags, summary)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_type_tags_meeting() {
        let content = "会议时间: 2024-01-15\n与会人员: 张三, 李四\n会议议题: 产品规划讨论";
        let tags = detect_type_tags(content);
        assert!(tags.contains(&"meeting".to_string()));
    }

    #[test]
    fn test_detect_type_tags_report() {
        let content = "本报告总结了2024年第一季度的财务数据..." ;
        let tags = detect_type_tags(content);
        assert!(tags.iter().any(|t| t.contains("report") || t.contains("quarterly")));
    }

    #[test]
    fn test_extract_path_tags() {
        let path = "/Users/work/Projects/memvid/docs/architecture.md";
        let tags = extract_path_tags(path);
        assert!(tags.contains(&"work".to_string()));
        assert!(tags.contains(&"projects".to_string()));
        assert!(tags.contains(&"docs".to_string()));
        // Should NOT include these:
        assert!(!tags.contains(&"users".to_string()));
    }

    #[test]
    fn test_extract_filename_tags() {
        let name = "Q4_2024_financial_report_final.pdf";
        let tags = extract_filename_tags(name);
        assert!(tags.contains(&"q4".to_string()));
        assert!(tags.contains(&"2024".to_string()));
        assert!(tags.contains(&"financial".to_string()));
        assert!(tags.contains(&"report".to_string()));
        // Should NOT include "final" (noise word)
        assert!(!tags.contains(&"final".to_string()));
    }

    #[test]
    fn test_classify_document() {
        let content = "项目会议纪要：讨论 memvid-core 架构优化方案。";
        let path = "/Users/work/Projects/memvid/meetings/2024-01-15.md";
        let (tags, summary) = classify_document(content, path, &["rust"]);
        assert!(tags.contains(&"meeting".to_string()));
        assert!(!tags.contains(&"rust".to_string())); // should not duplicate existing
        assert!(!summary.is_empty());
    }
}
