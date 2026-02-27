use myjd_captcha_helper::{handle_request, http_get, Request, VERSION};

#[test]
fn test_status_action() {
    let request = Request {
        action: "status".to_string(),
        site_key: None,
        site_key_type: None,
        challenge_type: None,
        callback_url: None,
        captcha_id: None,
        hoster: None,
        v3action: None,
        enterprise: None,
        site_url: None,
        site_domain: None,
        skip_type: None,
        test: None,
    };
    let response = handle_request(request);
    assert_eq!(response.status, "ok");
    assert_eq!(response.version, Some(VERSION.to_string()));
    assert!(response.token.is_none());
    assert!(response.error.is_none());
}

#[test]
fn test_skip_validates_url_rejects_external() {
    let request = Request {
        action: "skip".to_string(),
        site_key: None,
        site_key_type: None,
        challenge_type: None,
        callback_url: Some("http://evil.com/captcha".to_string()),
        captcha_id: None,
        hoster: None,
        v3action: None,
        enterprise: None,
        site_url: None,
        site_domain: None,
        skip_type: Some("hoster".to_string()),
        test: None,
    };
    let response = handle_request(request);
    assert_eq!(response.status, "error");
    assert!(response.error.unwrap().contains("localhost"));
}

#[test]
fn test_skip_validates_url_rejects_invalid_scheme() {
    let request = Request {
        action: "skip".to_string(),
        site_key: None,
        site_key_type: None,
        challenge_type: None,
        callback_url: Some("ftp://localhost/captcha".to_string()),
        captcha_id: None,
        hoster: None,
        v3action: None,
        enterprise: None,
        site_url: None,
        site_domain: None,
        skip_type: Some("hoster".to_string()),
        test: None,
    };
    let response = handle_request(request);
    assert_eq!(response.status, "error");
}

#[test]
fn test_cancel_validates_url_rejects_external() {
    let request = Request {
        action: "cancel".to_string(),
        site_key: None,
        site_key_type: None,
        challenge_type: None,
        callback_url: Some("http://evil.com/captcha".to_string()),
        captcha_id: None,
        hoster: None,
        v3action: None,
        enterprise: None,
        site_url: None,
        site_domain: None,
        skip_type: None,
        test: None,
    };
    let response = handle_request(request);
    assert_eq!(response.status, "error");
    assert!(response.error.unwrap().contains("localhost"));
}

#[test]
fn test_captcha_new_validates_site_key() {
    let request = Request {
        action: "captcha_new".to_string(),
        site_key: Some("".to_string()),
        site_key_type: None,
        challenge_type: None,
        callback_url: Some("http://localhost:8080/captcha".to_string()),
        captcha_id: None,
        hoster: None,
        v3action: None,
        enterprise: None,
        site_url: None,
        site_domain: None,
        skip_type: None,
        test: None,
    };
    let response = handle_request(request);
    assert_eq!(response.status, "error");
    assert!(response.error.unwrap().contains("Site key"));
}

#[test]
fn test_captcha_new_validates_callback_url() {
    let request = Request {
        action: "captcha_new".to_string(),
        site_key: Some("valid-key-123".to_string()),
        site_key_type: None,
        challenge_type: None,
        callback_url: Some("http://evil.com/captcha".to_string()),
        captcha_id: None,
        hoster: None,
        v3action: None,
        enterprise: None,
        site_url: None,
        site_domain: None,
        skip_type: None,
        test: None,
    };
    let response = handle_request(request);
    assert_eq!(response.status, "error");
    assert!(response.error.unwrap().contains("localhost"));
}

#[test]
fn test_unknown_action_returns_error() {
    let request = Request {
        action: "invalid_action".to_string(),
        site_key: None,
        site_key_type: None,
        challenge_type: None,
        callback_url: None,
        captcha_id: None,
        hoster: None,
        v3action: None,
        enterprise: None,
        site_url: None,
        site_domain: None,
        skip_type: None,
        test: None,
    };
    let response = handle_request(request);
    assert_eq!(response.status, "error");
    assert!(response.error.unwrap().contains("Unknown action"));
}

#[test]
fn test_http_get_with_mock_server() {
    let mut server = mockito::Server::new();
    let mock = server
        .mock("GET", "/captcha")
        .with_status(200)
        .with_body("OK")
        .create();

    let url = format!("{}/captcha", server.url());

    let result = http_get(&url);
    mock.assert();
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "OK");
}

#[test]
fn test_http_get_with_error_status() {
    let mut server = mockito::Server::new();
    let mock = server
        .mock("GET", "/captcha")
        .with_status(500)
        .with_body("Internal Server Error")
        .create();

    let url = format!("{}/captcha", server.url());

    let result = http_get(&url);
    mock.assert();
    assert!(result.is_err());
}

#[test]
fn test_http_get_sends_custom_header() {
    let mut server = mockito::Server::new();
    let mock = server
        .mock("GET", "/captcha")
        .match_header(
            "X-Myjd-Appkey",
            mockito::Matcher::Regex(r"myjd-captcha-helper-.*".to_string()),
        )
        .with_status(200)
        .with_body("OK")
        .create();

    let url = format!("{}/captcha", server.url());

    let result = http_get(&url);
    mock.assert();
    assert!(result.is_ok());
}

#[test]
fn test_skip_action_default_skip_type() {
    let request = Request {
        action: "skip".to_string(),
        site_key: None,
        site_key_type: None,
        challenge_type: None,
        callback_url: None,
        captcha_id: None,
        hoster: None,
        v3action: None,
        enterprise: None,
        site_url: None,
        site_domain: None,
        skip_type: None,
        test: None,
    };
    let response = handle_request(request);
    assert_eq!(response.status, "error");
    assert!(response.error.unwrap().contains("Invalid URL"));
}

#[test]
fn test_skip_action_with_skip_type_validation() {
    let request = Request {
        action: "skip".to_string(),
        site_key: None,
        site_key_type: None,
        challenge_type: None,
        callback_url: None,
        captcha_id: None,
        hoster: None,
        v3action: None,
        enterprise: None,
        site_url: None,
        site_domain: None,
        skip_type: Some("invalid_type".to_string()),
        test: None,
    };
    let response = handle_request(request);
    assert_eq!(response.status, "error");
}

#[test]
fn test_http_get_timeout_on_slow_server() {
    let mut server = mockito::Server::new();
    let mock = server
        .mock("GET", "/slow")
        .with_status(200)
        .with_chunked_body(|_w| {
            std::thread::sleep(std::time::Duration::from_secs(15));
            Ok(())
        })
        .create();

    let url = format!("{}/slow", server.url());

    let result = http_get(&url);
    mock.assert();
    assert!(result.is_err());
}

#[test]
fn test_http_get_rejects_large_response() {
    let mut server = mockito::Server::new();
    let large_body = "x".repeat(100 * 1024);
    let mock = server
        .mock("GET", "/large")
        .with_status(200)
        .with_body(&large_body)
        .create();

    let url = format!("{}/large", server.url());

    let result = http_get(&url);
    mock.assert();
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("too large"));
}
