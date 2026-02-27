use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crossbeam::channel::Sender;
use tao::dpi::LogicalSize;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use tao::window::WindowBuilder;
use wry::WebViewBuilder;

use crate::captcha::{CaptchaJob, CaptchaResult, Response};
use crate::html::generate_captcha_html;
use crate::http::http_get;
use crate::native::write_message;

pub fn run_webview_window(job: CaptchaJob, result_tx: Sender<CaptchaResult>) -> Result<(), String> {
    let hoster = job.hoster.clone().unwrap_or_else(|| "Unknown".to_string());
    let callback_url = job.callback_url.clone();
    let html = generate_captcha_html(&job, crate::VERSION);

    let (tx, rx) = crossbeam::channel::bounded::<(String, Option<String>)>(1);
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

    event_loop.run(move |event, _, control_flow| {
        match event {
            Event::MainEventsCleared => {
                if let Ok((msg_type, data)) = rx.try_recv() {
                    let result = match msg_type.as_str() {
                        "token" => CaptchaResult::Solved(data.unwrap_or_default()),
                        "skip" => CaptchaResult::Skipped(data.unwrap_or_default()),
                        _ => CaptchaResult::Skipped("unknown".to_string()),
                    };

                    let _ = result_tx.send(result.clone());

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
