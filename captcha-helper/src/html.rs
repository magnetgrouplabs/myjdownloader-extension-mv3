use crate::escape::{escape_html, escape_js};
use crate::CaptchaJob;

pub fn generate_captcha_html(job: &CaptchaJob, version: &str) -> String {
    if job.test {
        return generate_test_captcha_html(job, version);
    }

    let challenge_type = job.challenge_type.as_deref().unwrap_or("recaptchav2");
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
        const VERSION = "{}";
        
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
        version,
        v3_execute,
        script_url
    )
}

pub fn generate_test_captcha_html(job: &CaptchaJob, version: &str) -> String {
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
            <button class="solve-btn" onclick="solveCaptcha()">&#10003; I'm not a robot</button>
        </div>
        <p class="info">This is a test window (v{}). Clicking the button will generate a fake token to test the extension integration.</p>
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
        captcha_name, captcha_name, hoster, version
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_job() -> CaptchaJob {
        CaptchaJob {
            site_key: "test-site-key-123".to_string(),
            site_key_type: Some("normal".to_string()),
            challenge_type: Some("recaptchav2".to_string()),
            callback_url: "http://localhost:8080/captcha?id=123".to_string(),
            hoster: Some("TestHoster".to_string()),
            v3action: None,
            enterprise: Some(false),
            test: false,
        }
    }

    #[test]
    fn test_generate_captcha_html_escapes_hoster() {
        let mut job = create_test_job();
        job.hoster = Some("<script>alert('XSS')</script>".to_string());
        let html = generate_captcha_html(&job, "0.1.0");
        assert!(html.contains("&lt;script&gt;"));
        assert!(!html.contains("<script>alert"));
    }

    #[test]
    fn test_generate_captcha_html_escapes_site_key() {
        let mut job = create_test_job();
        job.site_key = "key-with-dash_and_underscore".to_string();
        let html = generate_captcha_html(&job, "0.1.0");
        assert!(html.contains("key-with-dash_and_underscore"));
    }

    #[test]
    fn test_generate_captcha_html_recaptcha_v2() {
        let job = create_test_job();
        let html = generate_captcha_html(&job, "0.1.0");
        assert!(html.contains("google.com/recaptcha/api.js"));
        assert!(html.contains("g-recaptcha"));
    }

    #[test]
    fn test_generate_captcha_html_recaptcha_enterprise() {
        let mut job = create_test_job();
        job.enterprise = Some(true);
        let html = generate_captcha_html(&job, "0.1.0");
        assert!(html.contains("google.com/recaptcha/enterprise.js"));
        assert!(html.contains("grecaptcha.enterprise"));
    }

    #[test]
    fn test_generate_captcha_html_hcaptcha() {
        let mut job = create_test_job();
        job.challenge_type = Some("HCaptchaChallenge".to_string());
        let html = generate_captcha_html(&job, "0.1.0");
        assert!(html.contains("hcaptcha.com/1/api.js"));
        assert!(html.contains("h-captcha"));
    }

    #[test]
    fn test_generate_captcha_html_invisible() {
        let mut job = create_test_job();
        job.site_key_type = Some("INVISIBLE".to_string());
        let html = generate_captcha_html(&job, "0.1.0");
        assert!(html.contains("data-size=\"invisible\""));
        assert!(html.contains("I'm not a robot"));
    }

    #[test]
    fn test_generate_captcha_html_v3_action() {
        let mut job = create_test_job();
        job.challenge_type = Some("recaptchav3".to_string());
        job.v3action = Some("submit".to_string());
        let html = generate_captcha_html(&job, "0.1.0");
        assert!(html.contains("action: \"submit\""));
    }

    #[test]
    fn test_generate_test_captcha_html() {
        let mut job = create_test_job();
        job.test = true;
        let html = generate_captcha_html(&job, "0.1.0");
        assert!(html.contains("TEST MODE"));
        assert!(html.contains("solveCaptcha()"));
    }

    #[test]
    fn test_generate_captcha_html_contains_csp() {
        let job = create_test_job();
        let html = generate_captcha_html(&job, "0.1.0");
        assert!(html.contains("Content-Security-Policy"));
        assert!(html.contains("google.com"));
        assert!(html.contains("hcaptcha.com"));
    }

    #[test]
    fn test_generate_captcha_html_includes_version() {
        let job = create_test_job();
        let html = generate_captcha_html(&job, "1.2.3");
        assert!(html.contains("1.2.3"));
    }

    #[test]
    fn test_generate_test_html_escapes_hoster() {
        let mut job = create_test_job();
        job.test = true;
        job.hoster = Some("<script>alert('XSS')</script>".to_string());
        let html = generate_test_captcha_html(&job, "0.1.0");
        assert!(html.contains("&lt;script&gt;"));
        assert!(!html.contains("<script>alert"));
    }
}
