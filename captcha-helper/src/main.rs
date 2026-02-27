use myjd_captcha_helper::{handle_request, read_message, write_message, Request, Response};

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
