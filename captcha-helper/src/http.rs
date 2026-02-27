use std::io::Read;
use std::time::Duration;

pub fn http_get(url: &str) -> Result<String, String> {
    let response = ureq::get(url)
        .set(
            "X-Myjd-Appkey",
            &format!("myjd-captcha-helper-{}", env!("CARGO_PKG_VERSION")),
        )
        .timeout(Duration::from_secs(10))
        .call()
        .map_err(|e| format!("HTTP error: {}", e))?;

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

#[cfg(test)]
mod tests {
    // Integration tests for http_get are in tests/integration_test.rs
    // Unit tests would require mocking ureq which is not straightforward
    // The function is covered by integration tests with mockito
}
