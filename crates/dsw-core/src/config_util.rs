//! 配置相关的纯逻辑。
//!
//! 这里放「写入客户端配置前必须做的规范化」：用户填的槽位名可能是 `fast-vision`、
//! `视觉`、`a__b`，写进 Claude 环境变量前必须变成合法片段；Codex 的推理强度与线协议
//! 也必须是白名单内的值，避免把脏值写进用户的配置文件。

/// 把槽位 key 规范成环境变量片段。
///
/// 规则：只保留 ASCII 字母与数字（转大写），其它字符折叠为单个下划线，首尾下划线裁掉；
/// 若结果为空（例如全是中文）则回退为 `SLOT`。
///
/// 例：`fast-vision` → `FAST_VISION`；`a__b` → `A_B`；`视觉` → `SLOT`。
pub fn sanitize_slot_key(raw: &str) -> String {
    let mut out = String::new();
    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_uppercase());
        } else if !out.is_empty() && !out.ends_with('_') {
            out.push('_');
        }
    }
    while out.ends_with('_') {
        out.pop();
    }
    if out.is_empty() {
        "SLOT".to_string()
    } else {
        out
    }
}

/// 规范 Codex 推理强度；非法值回退为 `high`。
///
/// 取值与 Codex CLI 一致：`minimal` / `low` / `medium` / `high`。
pub fn normalize_reasoning_effort(raw: &str) -> &'static str {
    match raw.trim().to_ascii_lowercase().as_str() {
        "minimal" => "minimal",
        "low" => "low",
        "medium" => "medium",
        _ => "high",
    }
}

/// 规范 Codex 线协议；非法值回退为 `chat`。
pub fn normalize_wire_api(raw: &str) -> &'static str {
    match raw.trim().to_ascii_lowercase().as_str() {
        "responses" => "responses",
        _ => "chat",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_ascii_alnum_and_uppercases() {
        assert_eq!(sanitize_slot_key("vision"), "VISION");
        assert_eq!(sanitize_slot_key("Fast2"), "FAST2");
    }

    #[test]
    fn folds_separators_into_single_underscore() {
        assert_eq!(sanitize_slot_key("fast-vision"), "FAST_VISION");
        assert_eq!(sanitize_slot_key("a__b"), "A_B");
        assert_eq!(sanitize_slot_key("a - b"), "A_B");
    }

    #[test]
    fn trims_leading_and_trailing_separators() {
        assert_eq!(sanitize_slot_key("-fast-"), "FAST");
        assert_eq!(sanitize_slot_key("__x__"), "X");
    }

    #[test]
    fn falls_back_when_no_ascii_available() {
        assert_eq!(sanitize_slot_key("视觉"), "SLOT");
        assert_eq!(sanitize_slot_key(""), "SLOT");
        assert_eq!(sanitize_slot_key("---"), "SLOT");
    }

    #[test]
    fn normalizes_codex_effort() {
        assert_eq!(normalize_reasoning_effort("low"), "low");
        assert_eq!(normalize_reasoning_effort(" Medium "), "medium");
        assert_eq!(normalize_reasoning_effort("minimal"), "minimal");
        assert_eq!(normalize_reasoning_effort("high"), "high");
        assert_eq!(normalize_reasoning_effort("turbo"), "high");
        assert_eq!(normalize_reasoning_effort(""), "high");
    }

    #[test]
    fn normalizes_codex_wire_api() {
        assert_eq!(normalize_wire_api("chat"), "chat");
        assert_eq!(normalize_wire_api(" Responses "), "responses");
        assert_eq!(normalize_wire_api("websocket"), "chat");
    }
}
