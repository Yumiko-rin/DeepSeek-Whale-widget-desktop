//! 版本检查结果模型
//!
//! 前端读取 currentVersion / latestVersion / upToDate / hasUpdate。

use serde::Serialize;

/// 版本检查结果（前端读取 currentVersion / latestVersion / upToDate / hasUpdate）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    /// 当前应用版本。
    pub current_version: String,
    /// 远端返回的最新版本。
    pub latest_version: String,
    /// 当前版本是否已是最新。
    pub up_to_date: bool,
    /// 远端是否有比当前更新的版本。
    ///
    /// 与 `up_to_date` 互补但不等价：本地版本比远端更新时两者都是 `false`，
    /// 前端据此区分「有新版可更新」与「你用的是更新的本地版本」。
    pub has_update: bool,
}
