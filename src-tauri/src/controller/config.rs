//! 配置相关命令
//!
//! 读取/保存应用配置、挂件显示配置与台词配置。

use crate::config::{AppConfig, DialogueConfig, Profile, WidgetConfig};
use tauri::{AppHandle, Emitter};

const BALANCE_REFRESH_REQUESTED_EVENT: &str = "balance-refresh-requested";

fn balance_source_changed(previous: &AppConfig, next: &AppConfig) -> bool {
    previous.api_key.trim() != next.api_key.trim()
        || previous.base_url.trim().trim_end_matches('/')
            != next.base_url.trim().trim_end_matches('/')
}

/// 把当前配置写进 Claude / Codex 的客户端配置文件（失败只记日志，不阻断主流程）。
fn write_client_configs(cfg: &AppConfig) {
    if let Err(e) = crate::service::claude_config::write_claude_settings(cfg) {
        log::error!("写入 Claude 配置失败: {}", e);
    }
    if let Err(e) = crate::service::codex_config::write_codex_settings(cfg) {
        log::error!("写入 Codex 配置失败: {}", e);
    }
}

/// 当前毫秒时间戳，用作新配置的 id。
fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// 用顶层字段生成一份配置快照。
fn snapshot_profile(cfg: &AppConfig, id: String, name: String) -> Profile {
    Profile {
        id,
        name,
        api_key: cfg.api_key.clone(),
        base_url: cfg.base_url.clone(),
        codex_base_url: cfg.codex_base_url.clone(),
        models: cfg.models.clone(),
        codex_models: cfg.codex_models.clone(),
        codex_reasoning_effort: cfg.codex_reasoning_effort.clone(),
        codex_wire_api: cfg.codex_wire_api.clone(),
        codex_disable_response_storage: cfg.codex_disable_response_storage,
    }
}

/// 读取完整应用配置。
#[tauri::command]
pub fn get_config() -> AppConfig {
    let mut cfg = crate::config::get_config();
    if let Ok(actual) = crate::service::autostart::is_autostart_enabled() {
        if cfg.autostart != actual {
            cfg.autostart = actual;
            let _ = crate::config::mutate_config(|c| c.autostart = actual);
        }
    }
    cfg
}

/// 保存完整应用配置（写盘 + 刷新缓存）。
#[tauri::command]
pub fn save_config(app: AppHandle, cfg: AppConfig) -> Result<AppConfig, String> {
    let previous = crate::config::get_config();
    let saved = crate::config::update_config(cfg)?;
    write_client_configs(&saved);
    if balance_source_changed(&previous, &saved) {
        let _ = app.emit(BALANCE_REFRESH_REQUESTED_EVENT, true);
    }
    Ok(saved)
}

/// 切换到指定配置：把该配置的字段复制到顶层，写盘并同步客户端配置文件。
#[tauri::command]
pub fn apply_profile(app: AppHandle, id: String) -> Result<AppConfig, String> {
    let previous = crate::config::get_config();
    let profile = previous
        .profiles
        .iter()
        .find(|p| p.id == id)
        .cloned()
        .ok_or_else(|| format!("找不到配置: {}", id))?;

    let mut next = previous.clone();
    next.api_key = profile.api_key.clone();
    next.base_url = profile.base_url.clone();
    next.codex_base_url = profile.codex_base_url.clone();
    next.models = profile.models.clone();
    next.codex_models = profile.codex_models.clone();
    next.codex_reasoning_effort = profile.codex_reasoning_effort.clone();
    next.codex_wire_api = profile.codex_wire_api.clone();
    next.codex_disable_response_storage = profile.codex_disable_response_storage;
    next.active_profile = profile.id.clone();

    let saved = crate::config::update_config(next)?;
    write_client_configs(&saved);
    if balance_source_changed(&previous, &saved) {
        let _ = app.emit(BALANCE_REFRESH_REQUESTED_EVENT, true);
    }
    Ok(saved)
}

/// 把当前顶层配置另存为一份配置；同名则覆盖该配置。
#[tauri::command]
pub fn save_profile(app: AppHandle, name: String) -> Result<AppConfig, String> {
    let mut cfg = crate::config::get_config();
    let trimmed = name.trim();
    let label = if trimmed.is_empty() {
        "未命名配置".to_string()
    } else {
        trimmed.to_string()
    };
    let id = cfg
        .profiles
        .iter()
        .find(|p| p.name == label)
        .map(|p| p.id.clone())
        .unwrap_or_else(|| format!("p{}", now_millis()));

    let snapshot = snapshot_profile(&cfg, id.clone(), label);
    match cfg.profiles.iter_mut().find(|p| p.id == id) {
        Some(existing) => *existing = snapshot,
        None => cfg.profiles.push(snapshot),
    }
    cfg.active_profile = id;

    let saved = crate::config::update_config(cfg)?;
    write_client_configs(&saved);
    let _ = app.emit(BALANCE_REFRESH_REQUESTED_EVENT, true);
    Ok(saved)
}

/// 删除一份配置；若删除的是当前激活项，则清空 activeProfile。
#[tauri::command]
pub fn delete_profile(_app: AppHandle, id: String) -> Result<AppConfig, String> {
    let mut cfg = crate::config::get_config();
    cfg.profiles.retain(|p| p.id != id);
    if cfg.active_profile == id {
        cfg.active_profile.clear();
    }
    crate::config::update_config(cfg)
}

/// 快速保存挂件显示配置（汉堡菜单实时调整时使用）。
#[tauri::command]
pub fn save_widget_config(app: AppHandle, widget: WidgetConfig) -> Result<WidgetConfig, String> {
    let cfg = crate::config::mutate_config(|c| c.widget = widget)?;
    // 广播给挂件窗口，使其实时应用来自配置窗口的显示设置。
    let _ = app.emit("widget-config-changed", &cfg.widget);
    Ok(cfg.widget)
}

/// 保存台词管理配置（写盘 + 广播给挂件窗口）。
#[tauri::command]
pub fn save_dialogue(app: AppHandle, dialogue: DialogueConfig) -> Result<DialogueConfig, String> {
    let cfg = crate::config::mutate_config(|c| c.dialogue = dialogue)?;
    let _ = app.emit("dialogue-changed", &cfg.dialogue);
    Ok(cfg.dialogue)
}
