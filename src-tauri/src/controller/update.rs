//! 版本检查与外部链接命令
//!
//! 检查更新（调用 service::update）与打开外部链接。

use crate::model::UpdateCheckResult;

/// 检查更新：请求远端版本清单，与当前版本字符串比较。
#[tauri::command]
pub async fn check_update() -> Result<UpdateCheckResult, String> {
    crate::service::update::check_update_version().await
}

/// 用系统默认浏览器打开外部链接。
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    if url.trim().is_empty() {
        return Err("链接为空".to_string());
    }
    open_in_browser(&url)
}

/// 按平台调用系统默认浏览器。
///
/// 原先硬编码 `explorer`（仅 Windows 存在），导致 macOS / Linux 上「检查更新」「使用教程」
/// 两个按钮点了没反应；这里按平台分派。
fn open_in_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("cmd");
        // `start` 是 cmd 的内建命令；第一个参数当窗口标题，留空才不会把 URL 当标题。
        c.args(["/C", "start", "", url]);
        c
    };

    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut c = std::process::Command::new("open");
        c.arg(url);
        c
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut cmd = {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(url);
        c
    };

    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("打开浏览器失败: {}", e))
}
