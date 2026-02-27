use crate::http::http_get;
use crate::validation::{validate_callback_url, validate_site_key, validate_skip_type};
use crossbeam::channel;
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Serialize, Deserialize)]
pub struct Request {
    pub action: String,
    #[serde(rename = "siteKey")]
    pub site_key: Option<String>,
    #[serde(rename = "siteKeyType")]
    pub site_key_type: Option<String>,
    #[serde(rename = "challengeType")]
    pub challenge_type: Option<String>,
    #[serde(rename = "callbackUrl")]
    pub callback_url: Option<String>,
    #[serde(rename = "captchaId")]
    pub captcha_id: Option<String>,
    pub hoster: Option<String>,
    #[serde(rename = "v3action")]
    pub v3action: Option<String>,
    pub enterprise: Option<bool>,
    #[serde(rename = "siteUrl")]
    pub site_url: Option<String>,
    #[serde(rename = "siteDomain")]
    pub site_domain: Option<String>,
    #[serde(rename = "skipType")]
    pub skip_type: Option<String>,
    pub test: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct CaptchaJob {
    pub site_key: String,
    pub site_key_type: Option<String>,
    pub challenge_type: Option<String>,
    pub callback_url: String,
    pub hoster: Option<String>,
    pub v3action: Option<String>,
    pub enterprise: Option<bool>,
    pub test: bool,
}

#[derive(Debug, Serialize)]
pub struct Response {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_type: Option<String>,
}

#[derive(Debug, Clone)]
pub enum CaptchaResult {
    Solved(String),
    Skipped(String),
    Cancelled,
    Timeout,
}

pub fn handle_request(request: Request) -> Response {
    match request.action.as_str() {
        "status" => Response {
            status: "ok".to_string(),
            token: None,
            version: Some(VERSION.to_string()),
            error: None,
            skip_type: None,
        },
        "captcha_new" => {
            let site_key = match validate_site_key(&request.site_key.unwrap_or_default()) {
                Ok(key) => key,
                Err(e) => {
                    return Response {
                        status: "error".to_string(),
                        token: None,
                        version: None,
                        error: Some(e),
                        skip_type: None,
                    };
                }
            };

            let callback_url =
                match validate_callback_url(&request.callback_url.unwrap_or_default()) {
                    Ok(url) => url,
                    Err(e) => {
                        return Response {
                            status: "error".to_string(),
                            token: None,
                            version: None,
                            error: Some(e),
                            skip_type: None,
                        };
                    }
                };

            let job = CaptchaJob {
                site_key,
                site_key_type: request.site_key_type,
                challenge_type: request.challenge_type,
                callback_url,
                hoster: request.hoster,
                v3action: request.v3action,
                enterprise: request.enterprise,
                test: request.test.unwrap_or(false),
            };
            handle_captcha(job)
        }
        "skip" => {
            let callback_url =
                match validate_callback_url(&request.callback_url.unwrap_or_default()) {
                    Ok(url) => url,
                    Err(e) => {
                        return Response {
                            status: "error".to_string(),
                            token: None,
                            version: None,
                            error: Some(e),
                            skip_type: None,
                        };
                    }
                };
            let skip_type =
                validate_skip_type(&request.skip_type.unwrap_or_else(|| "single".to_string()));
            handle_skip(&callback_url, &skip_type)
        }
        "cancel" => {
            let callback_url =
                match validate_callback_url(&request.callback_url.unwrap_or_default()) {
                    Ok(url) => url,
                    Err(e) => {
                        return Response {
                            status: "error".to_string(),
                            token: None,
                            version: None,
                            error: Some(e),
                            skip_type: None,
                        };
                    }
                };
            handle_skip(&callback_url, "single")
        }
        _ => Response {
            status: "error".to_string(),
            token: None,
            version: None,
            error: Some(format!("Unknown action: {}", request.action)),
            skip_type: None,
        },
    }
}

pub fn handle_captcha(job: CaptchaJob) -> Response {
    let (tx, rx) = channel::bounded::<CaptchaResult>(1);
    let callback_url = job.callback_url.clone();

    #[cfg(windows)]
    {
        match crate::webview::run_webview_window(job, tx) {
            Ok(_) => {}
            Err(e) => {
                return Response {
                    status: "error".to_string(),
                    token: None,
                    version: None,
                    error: Some(format!("WebView error: {}", e)),
                    skip_type: None,
                };
            }
        }
    }

    #[cfg(not(windows))]
    {
        return Response {
            status: "error".to_string(),
            token: None,
            version: None,
            error: Some("CAPTCHA solving only supported on Windows".to_string()),
            skip_type: None,
        };
    }

    match rx.recv_timeout(Duration::from_secs(300)) {
        Ok(CaptchaResult::Solved(token)) => Response {
            status: "solved".to_string(),
            token: Some(token),
            version: None,
            error: None,
            skip_type: None,
        },
        Ok(CaptchaResult::Skipped(skip_type)) => Response {
            status: "skipped".to_string(),
            token: None,
            version: None,
            error: None,
            skip_type: Some(skip_type),
        },
        Ok(CaptchaResult::Cancelled) => Response {
            status: "cancelled".to_string(),
            token: None,
            version: None,
            error: None,
            skip_type: None,
        },
        Ok(CaptchaResult::Timeout) => {
            let _ = http_get(&format!("{}&do=skip&skiptype=hoster", callback_url));
            Response {
                status: "timeout".to_string(),
                token: None,
                version: None,
                error: Some("CAPTCHA timed out after 5 minutes".to_string()),
                skip_type: Some("hoster".to_string()),
            }
        }
        Err(_) => {
            let _ = http_get(&format!("{}&do=skip&skiptype=hoster", callback_url));
            Response {
                status: "timeout".to_string(),
                token: None,
                version: None,
                error: Some("CAPTCHA timed out after 5 minutes".to_string()),
                skip_type: Some("hoster".to_string()),
            }
        }
    }
}

pub fn handle_skip(callback_url: &str, skip_type: &str) -> Response {
    let url = format!("{}&do=skip&skiptype={}", callback_url, skip_type);
    match http_get(&url) {
        Ok(_) => Response {
            status: "ok".to_string(),
            token: None,
            version: None,
            error: None,
            skip_type: Some(skip_type.to_string()),
        },
        Err(e) => Response {
            status: "error".to_string(),
            token: None,
            version: None,
            error: Some(format!("Skip failed: {}", e)),
            skip_type: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_handle_request_status() {
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
    }

    #[test]
    fn test_handle_request_unknown_action() {
        let request = Request {
            action: "unknown".to_string(),
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
    fn test_handle_request_captcha_new_invalid_site_key() {
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
    fn test_handle_request_captcha_new_invalid_callback_url() {
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
    fn test_handle_request_skip_invalid_url() {
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
    }

    #[test]
    fn test_handle_request_cancel_invalid_url() {
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
    }

    #[test]
    fn test_response_serialization() {
        let response = Response {
            status: "solved".to_string(),
            token: Some("test-token-123".to_string()),
            version: None,
            error: None,
            skip_type: None,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"status\":\"solved\""));
        assert!(json.contains("\"token\":\"test-token-123\""));
        assert!(!json.contains("version"));
    }

    #[test]
    fn test_request_deserialization() {
        let json = r#"{"action":"status"}"#;
        let request: Request = serde_json::from_str(json).unwrap();
        assert_eq!(request.action, "status");
        assert!(request.site_key.is_none());
    }

    #[test]
    fn test_request_deserialization_with_all_fields() {
        let json = r#"{
            "action":"captcha_new",
            "siteKey":"test-key",
            "siteKeyType":"normal",
            "challengeType":"recaptchav2",
            "callbackUrl":"http://localhost:8080/captcha",
            "captchaId":"123",
            "hoster":"TestHoster",
            "v3action":"submit",
            "enterprise":true,
            "siteUrl":"https://example.com",
            "siteDomain":"example.com",
            "skipType":"hoster",
            "test":true
        }"#;
        let request: Request = serde_json::from_str(json).unwrap();
        assert_eq!(request.action, "captcha_new");
        assert_eq!(request.site_key, Some("test-key".to_string()));
        assert_eq!(request.site_key_type, Some("normal".to_string()));
        assert_eq!(request.challenge_type, Some("recaptchav2".to_string()));
        assert_eq!(
            request.callback_url,
            Some("http://localhost:8080/captcha".to_string())
        );
        assert_eq!(request.captcha_id, Some("123".to_string()));
        assert_eq!(request.hoster, Some("TestHoster".to_string()));
        assert_eq!(request.v3action, Some("submit".to_string()));
        assert_eq!(request.enterprise, Some(true));
        assert_eq!(request.site_url, Some("https://example.com".to_string()));
        assert_eq!(request.site_domain, Some("example.com".to_string()));
        assert_eq!(request.skip_type, Some("hoster".to_string()));
        assert_eq!(request.test, Some(true));
    }
}
