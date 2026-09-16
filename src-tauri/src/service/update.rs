//! 版本检查服务
//!
//! 通过本项目自己的 GitHub Releases 接口读取最新版本（`tag_name`），
//! 版本比较交给纯逻辑 crate `dsw-core`（可在无 Tauri 环境下直接单测），
//! 结果供 `controller::update` 的 `check_update` 命令调用。

use crate::model::UpdateCheckResult;
use dsw_core::version::{evaluate_versions, normalize_version};
use serde_json::Value;
use std::time::Duration;

/// 远端版本清单地址：本项目仓库的 latest release。
const VERSION_URL: &str =
    "https://api.github.com/repos/Yumiko-rin/DeepSeek-Whale-widget-desktop/releases/latest";

/// 请求远端版本清单并与当前版本比较，返回版本检查结果。
pub async fn check_update_version() -> Result<UpdateCheckResult, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {}", e))?;

    let resp = client
        .get(VERSION_URL)
        .header("Accept", "application/vnd.github+json")
        // GitHub API 必须带 User-Agent，否则直接返回 403。
        .header("User-Agent", "DS-Desktop-Whale-Update-Check")
        .send()
        .await
        .map_err(|e| format!("版本检查请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("版本检查请求失败: HTTP {}", resp.status().as_u16()));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("读取版本响应失败: {}", e))?;

    // GitHub Releases 用 tag_name；同时兼容自建清单里的 latestVersion 字段。
    let raw_latest = body
        .get("tag_name")
        .or_else(|| body.get("latestVersion"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| "版本接口返回结构异常".to_string())?;

    let latest_version = normalize_version(raw_latest);
    let (up_to_date, has_update) = evaluate_versions(&current_version, &latest_version);

    Ok(UpdateCheckResult {
        current_version,
        latest_version,
        up_to_date,
        has_update,
    })
}
