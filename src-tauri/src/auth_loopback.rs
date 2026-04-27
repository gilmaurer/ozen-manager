use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

const PORT: u16 = 1421;
const TIMEOUT_SECS: u64 = 300; // 5 minutes to complete sign-in

fn extract_code(request_line: &str) -> Option<String> {
    // request_line looks like "GET /auth/callback?code=abc&foo=bar HTTP/1.1"
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }
    let path_and_query = parts[1];
    let query = path_and_query.splitn(2, '?').nth(1)?;
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        if it.next() == Some("code") {
            if let Some(v) = it.next() {
                return Some(v.to_string());
            }
        }
    }
    None
}

#[tauri::command]
pub async fn start_auth_listener(app: AppHandle) -> Result<u16, String> {
    // Bind on a background thread; the blocking accept loop lives there.
    std::thread::spawn(move || {
        let listener = match TcpListener::bind(("127.0.0.1", PORT)) {
            Ok(l) => l,
            Err(e) => {
                let _ = app.emit("auth-code-error", format!("bind failed: {}", e));
                return;
            }
        };
        // Give ourselves a deadline.
        let _ = listener.set_nonblocking(false);
        let deadline = std::time::Instant::now() + Duration::from_secs(TIMEOUT_SECS);

        for stream in listener.incoming() {
            if std::time::Instant::now() > deadline {
                let _ = app.emit("auth-code-error", "timeout waiting for auth code".to_string());
                break;
            }
            let mut stream = match stream {
                Ok(s) => s,
                Err(e) => {
                    let _ = app.emit("auth-code-error", format!("accept failed: {}", e));
                    break;
                }
            };

            let mut reader = BufReader::new(&stream);
            let mut request_line = String::new();
            if reader.read_line(&mut request_line).is_err() {
                continue;
            }

            let code = extract_code(&request_line);

            let body = match &code {
                Some(_) => "<html><body style='font-family:sans-serif;text-align:center;padding:40px;background:#0f1115;color:#e6e8ee;'><h2>ההתחברות הושלמה</h2><p>אפשר לסגור את החלון הזה ולחזור לאפליקציה.</p></body></html>",
                None => "<html><body style='font-family:sans-serif;text-align:center;padding:40px;background:#0f1115;color:#e6e8ee;'><h2>שגיאה</h2><p>לא התקבל קוד הרשאה.</p></body></html>",
            };
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = stream.write_all(response.as_bytes());
            let _ = stream.flush();

            match code {
                Some(c) => {
                    let _ = app.emit("auth-code-received", c);
                }
                None => {
                    let _ = app.emit("auth-code-error", "no code in request".to_string());
                }
            }
            break;
        }
    });

    Ok(PORT)
}
