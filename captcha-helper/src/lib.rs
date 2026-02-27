mod captcha;
mod escape;
mod http;
mod html;
mod native;
mod validation;

#[cfg(windows)]
mod webview;

pub use captcha::{handle_request, handle_skip, CaptchaJob, CaptchaResult, Request, Response, VERSION};
pub use escape::{escape_html, escape_js};
pub use http::http_get;
pub use html::{generate_captcha_html, generate_test_captcha_html};
pub use native::{read_message, write_message};
pub use validation::{validate_callback_url, validate_skip_type, validate_site_key};