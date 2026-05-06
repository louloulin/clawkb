#[cfg(test)]
mod web_boundary_tests {
    use clawkb_core::web::extract_title;
    use clawkb_core::web::strip_html;

    // === extract_title boundary tests ===

    #[test]
    fn extract_title_normal() {
        let html = r#"<!DOCTYPE html><html><head><title>Hello World</title></head></html>"#;
        assert_eq!(extract_title(html), Some("Hello World".to_string()));
    }

    #[test]
    fn extract_title_no_title_tag() {
        let html = "<html><body>No title here</body></html>";
        assert_eq!(extract_title(html), None);
    }

    #[test]
    fn extract_title_empty() {
        assert_eq!(extract_title(""), None);
    }

    #[test]
    fn extract_title_only_start_tag() {
        let html = "<title>Open but not closed";
        assert_eq!(extract_title(html), None);
    }

    #[test]
    fn extract_title_only_end_tag() {
        let html = "Closed but not opened</title>";
        assert_eq!(extract_title(html), None);
    }

    #[test]
    fn extract_title_case_insensitive() {
        let html = "<TITLE>Case Insensitive</TITLE>";
        assert_eq!(extract_title(html), Some("Case Insensitive".to_string()));
    }

    #[test]
    fn extract_title_whitespace_trimmed() {
        let html = "<title>  Spaced Title  </title>";
        assert_eq!(extract_title(html), Some("Spaced Title".to_string()));
    }

    #[test]
    fn extract_title_unicode_content() {
        let html = "<title>中文标题 Chinese タイトル</title>";
        assert_eq!(extract_title(html), Some("中文标题 Chinese タイトル".to_string()));
    }

    #[test]
    fn extract_title_malformed_overlapping() {
        // <title> inside the opening tag should not be matched
        let html = "<title><title>Nested</title></title>";
        assert_eq!(extract_title(html), Some("Nested".to_string()));
    }

    #[test]
    fn extract_title_adjacent_tags() {
        let html = "<title>A</title><title>B</title>";
        // Should return the first one
        assert_eq!(extract_title(html), Some("A".to_string()));
    }

    #[test]
    fn extract_title_at_start_of_content() {
        let html = "<title>First</title><body>content</body>";
        assert_eq!(extract_title(html), Some("First".to_string()));
    }

    // === strip_html boundary tests ===

    #[test]
    fn strip_html_simple_text() {
        assert_eq!(strip_html("Hello World"), "Hello World");
    }

    #[test]
    fn strip_html_removes_tags() {
        assert_eq!(strip_html("<p>Paragraph</p>"), "Paragraph");
    }

    #[test]
    fn strip_html_removes_nested_tags() {
        assert_eq!(
            strip_html("<div><p>Nested <strong>bold</strong> text</p></div>"),
            "Nested bold text"
        );
    }

    #[test]
    fn strip_html_script_content_removed() {
        let html = "<script>alert('xss')</script>Safe text";
        assert_eq!(strip_html(html), "Safe text");
    }

    #[test]
    fn strip_html_style_content_removed() {
        let html = "<style>.class { color: red }</style>Visible content";
        assert_eq!(strip_html(html), "Visible content");
    }

    #[test]
    fn strip_html_empty() {
        assert_eq!(strip_html(""), "");
    }

    #[test]
    fn strip_html_only_tags() {
        assert_eq!(strip_html("<div><span><p></p></span></div>"), "");
    }

    #[test]
    fn strip_html_mixed_content_and_tags() {
        assert_eq!(
            strip_html("Text1 <b>Bold</b> Text2 <i>Italic</i> Text3"),
            "Text1 Bold Text2 Italic Text3"
        );
    }

    #[test]
    fn strip_html_newlines_preserved() {
        assert_eq!(
            strip_html("Line1<br>Line2\nLine3"),
            "Line1\nLine2\nLine3"
        );
    }

    #[test]
    fn strip_html_unicode() {
        assert_eq!(
            strip_html("<p>中文内容</p><span>Hello 世界</span>"),
            "中文内容Hello 世界"
        );
    }

    #[test]
    fn strip_html_multiline_script() {
        let html = "<script>\n  const x = 1;\n  // comment\n</script>Plain text";
        assert_eq!(strip_html(html), "Plain text");
    }

    #[test]
    fn strip_html_attributes_preserved() {
        // Only tags are removed, content inside attributes is not exposed
        let html = r#"<a href="http://evil.com">Safe link</a>"#;
        assert_eq!(strip_html(html), "Safe link");
    }

    #[test]
    fn strip_html_entity_decoding() {
        // strip_html doesn't decode entities, just removes tags
        let html = "A &amp; B &lt; C &gt; D";
        assert_eq!(strip_html(html), "A &amp; B &lt; C &gt; D");
    }
}
