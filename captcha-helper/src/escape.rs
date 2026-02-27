pub fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

pub fn escape_js(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\'', "\\'")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_html_basic() {
        assert_eq!(escape_html("hello"), "hello");
        assert_eq!(escape_html(""), "");
    }

    #[test]
    fn test_escape_html_ampersand() {
        assert_eq!(escape_html("a&b"), "a&amp;b");
        assert_eq!(escape_html("&&"), "&amp;&amp;");
    }

    #[test]
    fn test_escape_html_angle_brackets() {
        assert_eq!(escape_html("<script>"), "&lt;script&gt;");
        assert_eq!(escape_html("a<b>c"), "a&lt;b&gt;c");
    }

    #[test]
    fn test_escape_html_quotes() {
        assert_eq!(escape_html("\"test\""), "&quot;test&quot;");
        assert_eq!(escape_html("'test'"), "&#x27;test&#x27;");
    }

    #[test]
    fn test_escape_html_combined() {
        assert_eq!(
            escape_html("<script>alert('XSS')</script>"),
            "&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;"
        );
    }

    #[test]
    fn test_escape_js_basic() {
        assert_eq!(escape_js("hello"), "hello");
        assert_eq!(escape_js(""), "");
    }

    #[test]
    fn test_escape_js_backslash() {
        assert_eq!(escape_js("a\\b"), "a\\\\b");
        assert_eq!(escape_js("\\\\"), "\\\\\\\\");
    }

    #[test]
    fn test_escape_js_quotes() {
        assert_eq!(escape_js("\"test\""), "\\\"test\\\"");
        assert_eq!(escape_js("'test'"), "\\'test\\'");
    }

    #[test]
    fn test_escape_js_newlines() {
        assert_eq!(escape_js("line1\nline2"), "line1\\nline2");
        assert_eq!(escape_js("line1\r\nline2"), "line1\\r\\nline2");
    }

    #[test]
    fn test_escape_js_tabs() {
        assert_eq!(escape_js("col1\tcol2"), "col1\\tcol2");
    }

    #[test]
    fn test_escape_js_combined() {
        assert_eq!(escape_js("alert('XSS')\n"), "alert(\\'XSS\\')\\n");
    }
}
