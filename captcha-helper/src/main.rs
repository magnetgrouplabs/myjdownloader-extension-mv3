use crossbeam::channel::{self, Sender};
use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};
use std::time::Duration;
use url::Url;

// ============================================================================
// Constants
// ============================================================================

const ALLOWED_SKIP_TYPES: [&str; 4] = ["hoster", "package", "all", "single"];
const MAX_SITE_KEY_LENGTH: usize = 256;

// ============================================================================
// Security Helpers
// ============================================================================

fn validate_callback_url(url: &str) -> Result<String, String> {
    let parsed = Url::parse(url).map_err(|e| format!("Invalid URL: {}", e))?;

    // Only allow http/https schemes
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http/https schemes allowed".to_string());
    }

    // Only allow localhost/127.0.0.1/[::1]
    let host = parsed.host_str().ok_or("Missing host")?;
    if host != "localhost" && host != "127.0.0.1" && !host.starts_with("127.") && host != "[::1]" {
        return Err("Only localhost callbacks allowed".to_string());
    }

    Ok(url.to_string())
}

fn validate_skip_type(skip_type: &str) -> String {
    if ALLOWED_SKIP_TYPES.contains(&skip_type) {
        skip_type.to_string()
    } else {
        "single".to_string()
    }
}

fn validate_site_key(key: &str) -> Result<String, String> {
    if key.is_empty() {
        return Err("Site key cannot be empty".to_string());
    }
    if key.len() > MAX_SITE_KEY_LENGTH {
        return Err(format!(
            "Site key too long (max {} chars)",
            MAX_SITE_KEY_LENGTH
        ));
    }
    // Alphanumeric, dash, underscore only
    if !key
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Invalid site key format".to_string());
    }
    Ok(key.to_string())
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

fn escape_js(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\'', "\\'")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

#[derive(Debug, Serialize, Deserialize)]
struct Request {
    action: String,
    #[serde(rename = "siteKey")]
    site_key: Option<String>,
    #[serde(rename = "siteKeyType")]
    site_key_type: Option<String>,
    #[serde(rename = "challengeType")]
    challenge_type: Option<String>,
    #[serde(rename = "callbackUrl")]
    callback_url: Option<String>,
    #[serde(rename = "captchaId")]
    captcha_id: Option<String>,
    hoster: Option<String>,
    #[serde(rename = "v3action")]
    v3action: Option<String>,
    enterprise: Option<bool>,
    #[serde(rename = "siteUrl")]
    site_url: Option<String>,
    #[serde(rename = "siteDomain")]
    site_domain: Option<String>,
    #[serde(rename = "skipType")]
    skip_type: Option<String>,
    test: Option<bool>,
}

#[derive(Debug, Clone)]
struct CaptchaJob {
    site_key: String,
    site_key_type: Option<String>,
    challenge_type: Option<String>,
    callback_url: String,
    hoster: Option<String>,
    v3action: Option<String>,
    enterprise: Option<bool>,
    test: bool,
}

#[derive(Debug, Serialize)]
struct Response {
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    skip_type: Option<String>,
}

#[derive(Debug, Clone)]
enum CaptchaResult {
    Solved(String),
    Skipped(String),
    Cancelled,
    Timeout,
}

fn main() {
    loop {
        match read_message() {
            Ok(message) => match serde_json::from_slice::<Request>(&message) {
                Ok(request) => {
                    let response = handle_request(request);
                    let response_json = serde_json::to_vec(&response).unwrap();
                    let _ = write_message(&response_json);
                }
                Err(e) => {
                    let response = Response {
                        status: "error".to_string(),
                        token: None,
                        version: None,
                        error: Some(format!("Invalid request: {}", e)),
                        skip_type: None,
                    };
                    let _ = write_message(&serde_json::to_vec(&response).unwrap());
                }
            },
            Err(_) => {
                return;
            }
        }
    }
}

fn handle_request(request: Request) -> Response {
    match request.action.as_str() {
        "status" => Response {
            status: "ok".to_string(),
            token: None,
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            error: None,
            skip_type: None,
        },
        "captcha_new" => {
            // Validate site key
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

            // Validate callback URL
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

fn handle_captcha(job: CaptchaJob) -> Response {
    let (tx, rx) = channel::bounded::<CaptchaResult>(1);
    let callback_url = job.callback_url.clone();

    // Run WebView on Windows
    #[cfg(windows)]
    {
        match run_webview_window(job, tx) {
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

    // Wait for result with 5-minute timeout
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

fn handle_skip(callback_url: &str, skip_type: &str) -> Response {
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

// ============================================================================
// WebView Implementation using wry + tao
// ============================================================================

#[cfg(windows)]
fn run_webview_window(job: CaptchaJob, result_tx: Sender<CaptchaResult>) -> Result<(), String> {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use tao::dpi::LogicalSize;
    use tao::event::{Event, WindowEvent};
    use tao::event_loop::{ControlFlow, EventLoop};
    use tao::window::WindowBuilder;
    use wry::WebViewBuilder;

    let hoster = job.hoster.clone().unwrap_or_else(|| "Unknown".to_string());
    let callback_url = job.callback_url.clone();
    let html = generate_captcha_html(&job);

    let (tx, rx) = channel::bounded::<(String, Option<String>)>(1);
    let event_loop = EventLoop::new();

    let window = WindowBuilder::new()
        .with_title(format!("CAPTCHA - {}", hoster))
        .with_inner_size(LogicalSize::new(500, 650))
        .build(&event_loop)
        .map_err(|e| format!("Failed to create window: {:?}", e))?;

    let callback_url_for_ipc = callback_url.clone();
    let callback_url_for_close = callback_url.clone();
    let done = Arc::new(AtomicBool::new(false));
    let done_for_handler = done.clone();
    let done_for_loop = done.clone();

    let _webview = WebViewBuilder::new(&window)
        .with_html(&html)
        .with_devtools(cfg!(debug_assertions))
        .with_ipc_handler(move |request| {
            if done_for_handler.load(Ordering::SeqCst) {
                return;
            }
            let body = request.body();
            if let Ok(msg) = serde_json::from_str::<serde_json::Value>(body) {
                let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");

                match msg_type {
                    "token" => {
                        let token = msg.get("token").and_then(|v| v.as_str()).unwrap_or("");
                        let _ = tx.send(("token".to_string(), Some(token.to_string())));
                        done_for_handler.store(true, Ordering::SeqCst);
                    }
                    "skip" => {
                        let skip_type = msg
                            .get("skipType")
                            .and_then(|v| v.as_str())
                            .unwrap_or("single");
                        let url =
                            format!("{}&do=skip&skiptype={}", callback_url_for_ipc, skip_type);
                        let _ = http_get(&url);
                        let _ = tx.send(("skip".to_string(), Some(skip_type.to_string())));
                        done_for_handler.store(true, Ordering::SeqCst);
                    }
                    _ => {}
                }
            }
        })
        .build()
        .map_err(|e| format!("Failed to build webview: {:?}", e))?;

    // Note: event_loop.run() on Windows terminates the process when ControlFlow::Exit is set.
    // We must send the response BEFORE exiting the event loop.
    event_loop.run(move |event, _, control_flow| {
        match event {
            Event::MainEventsCleared => {
                if let Ok((msg_type, data)) = rx.try_recv() {
                    let result = match msg_type.as_str() {
                        "token" => CaptchaResult::Solved(data.unwrap_or_default()),
                        "skip" => CaptchaResult::Skipped(data.unwrap_or_default()),
                        _ => CaptchaResult::Skipped("unknown".to_string()),
                    };

                    // Send result back to main thread (for cleanup)
                    let _ = result_tx.send(result.clone());

                    // Build and send the response BEFORE exiting
                    let response = match result {
                        CaptchaResult::Solved(token) => Response {
                            status: "solved".to_string(),
                            token: Some(token),
                            version: None,
                            error: None,
                            skip_type: None,
                        },
                        CaptchaResult::Skipped(skip_type) => Response {
                            status: "skipped".to_string(),
                            token: None,
                            version: None,
                            error: None,
                            skip_type: Some(skip_type),
                        },
                        _ => Response {
                            status: "error".to_string(),
                            token: None,
                            version: None,
                            error: Some("Unknown result".to_string()),
                            skip_type: None,
                        },
                    };

                    let response_json = serde_json::to_vec(&response).unwrap();
                    let _ = write_message(&response_json);
                    *control_flow = ControlFlow::Exit;
                    return;
                }
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                if !done_for_loop.load(Ordering::SeqCst) {
                    let url = format!("{}&do=skip&skiptype=hoster", callback_url_for_close);
                    let _ = http_get(&url);
                    let _ = result_tx.send(CaptchaResult::Skipped("hoster".to_string()));

                    let response = Response {
                        status: "skipped".to_string(),
                        token: None,
                        version: None,
                        error: None,
                        skip_type: Some("hoster".to_string()),
                    };
                    let response_json = serde_json::to_vec(&response).unwrap();
                    let _ = write_message(&response_json);
                }
                *control_flow = ControlFlow::Exit;
            }
            Event::WindowEvent {
                event: WindowEvent::Destroyed,
                ..
            } => {
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        }
        *control_flow = ControlFlow::Poll;
    });
}

// ============================================================================
// HTML Generation
// ============================================================================

fn generate_captcha_html(job: &CaptchaJob) -> String {
    if job.test {
        return generate_test_captcha_html(job);
    }

    let challenge_type = job.challenge_type.as_deref().unwrap_or("recaptchav2");
    // Escape user-controlled values to prevent XSS
    let site_key = escape_html(&job.site_key);
    let site_key_type = job.site_key_type.as_deref().unwrap_or("normal");
    let enterprise = job.enterprise.unwrap_or(false);
    let v3action = job.v3action.as_deref().unwrap_or("");
    let v3action_escaped = escape_js(v3action);
    let hoster = escape_html(job.hoster.as_deref().unwrap_or("Unknown"));

    let (script_url, widget_class, render_ns) = match challenge_type {
        "HCaptchaChallenge" => (
            "https://hcaptcha.com/1/api.js?render=explicit&onload=onCaptchaLoad",
            "h-captcha",
            "hcaptcha",
        ),
        _ => {
            if enterprise {
                (
                    "https://www.google.com/recaptcha/enterprise.js?render=explicit&onload=onCaptchaLoad",
                    "g-recaptcha",
                    "grecaptcha.enterprise",
                )
            } else {
                (
                    "https://www.google.com/recaptcha/api.js?render=explicit&onload=onCaptchaLoad",
                    "g-recaptcha",
                    "grecaptcha",
                )
            }
        }
    };

    let data_size = if site_key_type == "INVISIBLE" {
        "invisible"
    } else {
        "normal"
    };

    let invisible_button = if site_key_type == "INVISIBLE" {
        r#"<button id="submit-btn" class="invisible-btn" onclick="executeCaptcha()">I'm not a robot</button>"#
    } else {
        ""
    };

    let v3_execute = if !v3action.is_empty() {
        format!(
            r#"function executeCaptcha() {{ {}.execute({{action: "{}"}}).then(function(token) {{ sendToken(token); }}); }}"#,
            render_ns, v3action_escaped
        )
    } else if site_key_type == "INVISIBLE" {
        format!(
            r#"function executeCaptcha() {{ {}.execute(); }}"#,
            render_ns
        )
    } else {
        String::new()
    };

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://hcaptcha.com https://*.hcaptcha.com">
    <title>CAPTCHA - {}</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
            color: white; 
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        .container {{ max-width: 500px; width: 100%; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .header h1 {{ margin: 0 0 10px 0; font-size: 24px; }}
        .hoster {{ color: #eebb1b; font-weight: bold; font-size: 16px; }}
        .captcha-box {{ 
            background: white; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0;
            display: flex;
            justify-content: center;
            min-height: 100px;
        }}
        .invisible-btn {{
            background: #4285f4;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 10px 0;
        }}
        .invisible-btn:hover {{ background: #3367d6; }}
        .buttons {{ 
            display: flex; 
            justify-content: space-between; 
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 20px; 
            padding: 15px; 
            background: rgba(255,255,255,0.1); 
            border-radius: 8px; 
        }}
        .btn {{ 
            padding: 10px 15px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 13px;
            transition: opacity 0.2s;
        }}
        .btn:hover {{ opacity: 0.8; }}
        .btn-skip {{ background: #e94560; color: white; }}
        .btn-cancel {{ background: #666; color: white; }}
        .status {{ margin-top: 20px; padding: 10px; text-align: center; }}
        .hidden {{ display: none; }}
        .error {{ color: #f44336; background: #ffebee; padding: 10px; border-radius: 4px; margin: 10px 0; }}
        .loading {{ color: #4fc3f7; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CAPTCHA Verification</h1>
            <p>Please solve to continue downloads with:</p>
            <p class="hoster">{}</p>
        </div>
        <div class="captcha-box" id="captcha-box">
            <div id="captcha-widget" class="{}" data-sitekey="{}" data-callback="onResponse" data-size="{}"></div>
        </div>
        <div id="loading" class="loading">Loading CAPTCHA...</div>
        {}
        <div class="buttons" id="buttons">
            <div>
                <button class="btn btn-skip" onclick="skip('hoster')">Skip Hoster</button>
                <button class="btn btn-skip" onclick="skip('package')">Skip Package</button>
                <button class="btn btn-skip" onclick="skip('all')">Skip All</button>
            </div>
            <button class="btn btn-cancel" onclick="skip('single')">Cancel</button>
        </div>
        <div class="status hidden" id="status">Submitting...</div>
    </div>
    <script>
        const RENDER_NS = "{}";
        
        window.onerror = function(msg, url, line, col, error) {{
            console.error('JS Error:', msg, url, line, col, error);
            document.getElementById('loading').innerHTML = '<div class="error">Error: ' + msg + '</div>';
        }};
        
        function sendToken(token) {{
            document.getElementById('status').classList.remove('hidden');
            document.getElementById('buttons').classList.add('hidden');
            document.getElementById('loading').textContent = 'Token received! Closing...';
            document.getElementById('captcha-box').style.display = 'none';
            try {{
                window.ipc.postMessage(JSON.stringify({{type: "token", token: token}}));
            }} catch(e) {{
                console.error('IPC error:', e);
                document.getElementById('loading').innerHTML = '<div class="error">IPC Error: ' + e + '</div>';
            }}
        }}
        
        function onResponse(token) {{
            sendToken(token);
        }}
        
        function skip(type) {{
            try {{
                window.ipc.postMessage(JSON.stringify({{type: "skip", skipType: type}}));
            }} catch(e) {{
                console.error('IPC error:', e);
            }}
        }}
        
        {}
        
        function onCaptchaLoad() {{
            console.log('CAPTCHA script loaded, RENDER_NS=' + RENDER_NS);
            document.getElementById('loading').textContent = 'Rendering widget...';
            setTimeout(function() {{
                try {{
                    if (RENDER_NS === 'hcaptcha' && typeof hcaptcha !== 'undefined') {{
                        console.log('Rendering hCaptcha');
                        hcaptcha.render('captcha-widget');
                        document.getElementById('loading').style.display = 'none';
                    }} else if (RENDER_NS === 'grecaptcha.enterprise' && typeof grecaptcha !== 'undefined' && typeof grecaptcha.enterprise !== 'undefined') {{
                        console.log('Rendering grecaptcha.enterprise');
                        grecaptcha.enterprise.render('captcha-widget');
                        document.getElementById('loading').style.display = 'none';
                    }} else if (RENDER_NS === 'grecaptcha' && typeof grecaptcha !== 'undefined' && typeof grecaptcha.render === 'function') {{
                        console.log('Rendering grecaptcha');
                        grecaptcha.render('captcha-widget');
                        document.getElementById('loading').style.display = 'none';
                    }} else {{
                        console.error('CAPTCHA library not loaded. RENDER_NS=' + RENDER_NS + ' hcaptcha=' + (typeof hcaptcha) + ' grecaptcha=' + (typeof grecaptcha));
                        document.getElementById('loading').innerHTML = '<div class="error">CAPTCHA library failed to load. RENDER_NS=' + RENDER_NS + '</div>';
                    }}
                }} catch(e) {{
                    console.error('Render error:', e);
                    document.getElementById('loading').innerHTML = '<div class="error">Render error: ' + e + '</div>';
                }}
            }}, 100);
        }}
    </script>
    <script src="{}" async defer onerror="document.getElementById('loading').innerHTML='<div class=error>Failed to load CAPTCHA script</div>'"></script>
</body>
</html>"#,
        hoster,
        hoster,
        widget_class,
        site_key,
        data_size,
        invisible_button,
        render_ns,
        v3_execute,
        script_url
    )
}

fn generate_test_captcha_html(job: &CaptchaJob) -> String {
    // Escape user-controlled values to prevent XSS
    let hoster = escape_html(job.hoster.as_deref().unwrap_or("Test Mode"));
    let challenge_type = job.challenge_type.as_deref().unwrap_or("recaptchav2");
    let captcha_name = match challenge_type {
        "HCaptchaChallenge" => "hCaptcha",
        "recaptchav3" => "reCAPTCHA v3",
        _ => "reCAPTCHA v2",
    };

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CAPTCHA Test - {}</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
            color: white; 
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        .container {{ max-width: 500px; width: 100%; text-align: center; }}
        .header {{ margin-bottom: 30px; }}
        .header h1 {{ margin: 0 0 10px 0; font-size: 24px; }}
        .hoster {{ color: #eebb1b; font-weight: bold; font-size: 16px; }}
        .test-badge {{ 
            background: #4caf50; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 4px; 
            font-size: 12px; 
            font-weight: bold;
            margin-left: 10px;
        }}
        .captcha-box {{ 
            background: white; 
            border-radius: 8px; 
            padding: 40px 20px; 
            margin: 20px 0;
        }}
        .captcha-type {{ color: #666; margin-bottom: 20px; font-size: 14px; }}
        .solve-btn {{ 
            background: #4caf50; 
            color: white; 
            border: none; 
            padding: 20px 40px; 
            font-size: 18px; 
            border-radius: 8px; 
            cursor: pointer;
            font-weight: bold;
            transition: all 0.2s;
        }}
        .solve-btn:hover {{ background: #45a049; transform: scale(1.05); }}
        .solve-btn:active {{ transform: scale(0.98); }}
        .buttons {{ 
            display: flex; 
            justify-content: space-between; 
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 20px; 
            padding: 15px; 
            background: rgba(255,255,255,0.1); 
            border-radius: 8px; 
        }}
        .btn {{ 
            padding: 10px 15px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 13px;
            transition: opacity 0.2s;
        }}
        .btn:hover {{ opacity: 0.8; }}
        .btn-skip {{ background: #e94560; color: white; }}
        .btn-cancel {{ background: #666; color: white; }}
        .status {{ margin-top: 20px; padding: 15px; border-radius: 8px; }}
        .success {{ background: #4caf50; color: white; }}
        .hidden {{ display: none; }}
        .info {{ color: #4fc3f7; margin-top: 20px; font-size: 13px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CAPTCHA Verification <span class="test-badge">TEST MODE</span></h1>
            <p>Simulating {}</p>
            <p class="hoster">{}</p>
        </div>
        <div class="captcha-box">
            <p class="captcha-type">Click the button to simulate solving the CAPTCHA</p>
            <button class="solve-btn" onclick="solveCaptcha()">✓ I'm not a robot</button>
        </div>
        <p class="info">This is a test window. Clicking the button will generate a fake token to test the extension integration.</p>
        <div class="buttons" id="buttons">
            <div>
                <button class="btn btn-skip" onclick="skip('hoster')">Skip Hoster</button>
                <button class="btn btn-skip" onclick="skip('package')">Skip Package</button>
                <button class="btn btn-skip" onclick="skip('all')">Skip All</button>
            </div>
            <button class="btn btn-cancel" onclick="skip('single')">Cancel</button>
        </div>
        <div class="status hidden" id="status"></div>
    </div>
    <script>
        function solveCaptcha() {{
            // Generate a fake token
            var fakeToken = 'TEST_TOKEN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 40);
            sendToken(fakeToken);
        }}
        
        function sendToken(token) {{
            document.getElementById('status').textContent = 'Token generated: ' + token.substring(0, 30) + '...';
            document.getElementById('status').classList.remove('hidden');
            document.getElementById('status').classList.add('success');
            document.getElementById('buttons').classList.add('hidden');
            document.querySelector('.captcha-box').innerHTML = '<h2 style="color:#4caf50;margin:0">CAPTCHA Solved!</h2><p style="color:#666">Window will close...</p>';
            try {{
                window.ipc.postMessage(JSON.stringify({{type: "token", token: token}}));
            }} catch(e) {{
                document.getElementById('status').textContent = 'IPC Error: ' + e;
                document.getElementById('status').classList.remove('success');
            }}
        }}
        
        function skip(type) {{
            try {{
                window.ipc.postMessage(JSON.stringify({{type: "skip", skipType: type}}));
            }} catch(e) {{
                console.error('IPC error:', e);
            }}
        }}
    </script>
</body>
</html>"#,
        captcha_name, captcha_name, hoster
    )
}

// ============================================================================
// HTTP and Native Messaging Utilities
// ============================================================================

fn http_get(url: &str) -> Result<String, String> {
    use std::io::Read;

    let response = ureq::get(url)
        .set(
            "X-Myjd-Appkey",
            &format!("myjd-captcha-helper-{}", env!("CARGO_PKG_VERSION")),
        )
        .timeout(Duration::from_secs(10))
        .call()
        .map_err(|e| format!("HTTP error: {}", e))?;

    // Limit response body to 64KB
    let max_size = 64 * 1024;
    let mut body = Vec::new();
    let mut reader = response.into_reader();
    let mut chunk = [0u8; 8192];

    loop {
        let bytes_read = reader
            .read(&mut chunk)
            .map_err(|e| format!("Read error: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..bytes_read]);
        if body.len() > max_size {
            return Err("Response too large (max 64KB)".to_string());
        }
    }

    String::from_utf8(body).map_err(|e| format!("UTF-8 error: {}", e))
}

fn read_message() -> io::Result<Vec<u8>> {
    let mut len_buf = [0u8; 4];
    io::stdin().read_exact(&mut len_buf)?;
    let len = u32::from_le_bytes(len_buf) as usize;

    if len > 1024 * 1024 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Message too large",
        ));
    }

    let mut msg_buf = vec![0u8; len];
    io::stdin().read_exact(&mut msg_buf)?;
    Ok(msg_buf)
}

fn write_message(msg: &[u8]) -> io::Result<()> {
    let len = (msg.len() as u32).to_le_bytes();
    let stdout = io::stdout();
    let mut handle = stdout.lock();
    handle.write_all(&len)?;
    handle.write_all(msg)?;
    handle.flush()?;
    Ok(())
}
