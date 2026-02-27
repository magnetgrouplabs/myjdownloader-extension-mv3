use url::Url;

const ALLOWED_SKIP_TYPES: [&str; 4] = ["hoster", "package", "all", "single"];
const MAX_SITE_KEY_LENGTH: usize = 256;

pub fn validate_callback_url(url: &str) -> Result<String, String> {
    let parsed = Url::parse(url).map_err(|e| format!("Invalid URL: {}", e))?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http/https schemes allowed".to_string());
    }

    let host = parsed.host_str().ok_or("Missing host")?;
    if host != "localhost" && host != "127.0.0.1" && !host.starts_with("127.") && host != "[::1]" {
        return Err("Only localhost callbacks allowed".to_string());
    }

    Ok(url.to_string())
}

pub fn validate_skip_type(skip_type: &str) -> String {
    if ALLOWED_SKIP_TYPES.contains(&skip_type) {
        skip_type.to_string()
    } else {
        "single".to_string()
    }
}

pub fn validate_site_key(key: &str) -> Result<String, String> {
    if key.is_empty() {
        return Err("Site key cannot be empty".to_string());
    }
    if key.len() > MAX_SITE_KEY_LENGTH {
        return Err(format!(
            "Site key too long (max {} chars)",
            MAX_SITE_KEY_LENGTH
        ));
    }
    if !key
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Invalid site key format".to_string());
    }
    Ok(key.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_callback_url_localhost() {
        assert!(validate_callback_url("http://localhost:8080/captcha?id=123").is_ok());
        assert!(validate_callback_url("https://localhost/captcha").is_ok());
    }

    #[test]
    fn test_validate_callback_url_127_0_0_1() {
        assert!(validate_callback_url("http://127.0.0.1:8080/captcha?id=123").is_ok());
        assert!(validate_callback_url("http://127.0.0.1/captcha").is_ok());
    }

    #[test]
    fn test_validate_callback_url_127_subnet() {
        assert!(validate_callback_url("http://127.0.1.1:8080/captcha").is_ok());
        assert!(validate_callback_url("http://127.255.255.255/captcha").is_ok());
    }

    #[test]
    fn test_validate_callback_url_ipv6_localhost() {
        assert!(validate_callback_url("http://[::1]:8080/captcha").is_ok());
    }

    #[test]
    fn test_validate_callback_url_rejects_external() {
        assert!(validate_callback_url("http://example.com/captcha").is_err());
        assert!(validate_callback_url("http://192.168.1.1/captcha").is_err());
        assert!(validate_callback_url("http://10.0.0.1/captcha").is_err());
    }

    #[test]
    fn test_validate_callback_url_rejects_invalid_scheme() {
        assert!(validate_callback_url("ftp://localhost/captcha").is_err());
        assert!(validate_callback_url("file:///etc/passwd").is_err());
    }

    #[test]
    fn test_validate_callback_url_rejects_invalid_url() {
        assert!(validate_callback_url("not a url").is_err());
        assert!(validate_callback_url("").is_err());
    }

    #[test]
    fn test_validate_skip_type_valid() {
        assert_eq!(validate_skip_type("hoster"), "hoster");
        assert_eq!(validate_skip_type("package"), "package");
        assert_eq!(validate_skip_type("all"), "all");
        assert_eq!(validate_skip_type("single"), "single");
    }

    #[test]
    fn test_validate_skip_type_invalid_defaults_to_single() {
        assert_eq!(validate_skip_type("invalid"), "single");
        assert_eq!(validate_skip_type(""), "single");
        assert_eq!(validate_skip_type("HOSTER"), "single"); // Case sensitive
        assert_eq!(validate_skip_type("hoster; DROP TABLE"), "single");
    }

    #[test]
    fn test_validate_site_key_valid() {
        assert!(validate_site_key("6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-").is_ok());
        assert!(validate_site_key("abc123").is_ok());
        assert!(validate_site_key("test_key-123").is_ok());
    }

    #[test]
    fn test_validate_site_key_rejects_empty() {
        assert!(validate_site_key("").is_err());
    }

    #[test]
    fn test_validate_site_key_rejects_too_long() {
        let long_key = "a".repeat(257);
        assert!(validate_site_key(&long_key).is_err());
    }

    #[test]
    fn test_validate_site_key_accepts_max_length() {
        let max_key = "a".repeat(256);
        assert!(validate_site_key(&max_key).is_ok());
    }

    #[test]
    fn test_validate_site_key_rejects_invalid_chars() {
        assert!(validate_site_key("key with spaces").is_err());
        assert!(validate_site_key("key<script>").is_err());
        assert!(validate_site_key("key'or'1'='1").is_err());
        assert!(validate_site_key("key\"onclick").is_err());
    }
}
