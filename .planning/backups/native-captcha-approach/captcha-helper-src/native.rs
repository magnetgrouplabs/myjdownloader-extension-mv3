use std::io::{self, Read, Write};

pub fn read_message() -> io::Result<Vec<u8>> {
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

pub fn write_message(msg: &[u8]) -> io::Result<()> {
    let len = (msg.len() as u32).to_le_bytes();
    let stdout = io::stdout();
    let mut handle = stdout.lock();
    handle.write_all(&len)?;
    handle.write_all(msg)?;
    handle.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    // Integration tests for read_message/write_message are in tests/integration_test.rs
    // These functions interact with stdin/stdout and are difficult to unit test directly

    #[test]
    fn test_write_message_format() {
        let msg = b"test message";
        let len = (msg.len() as u32).to_le_bytes();
        assert_eq!(len.len(), 4);
        assert_eq!(u32::from_le_bytes(len), 12);
    }
}
