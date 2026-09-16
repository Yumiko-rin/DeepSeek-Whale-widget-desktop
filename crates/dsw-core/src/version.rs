//! 版本号比较
//!
//! 只做「够用且可预测」的数值比较，不引入 semver 依赖。

/// 去掉用于展示的 `v` / `V` 前缀与首尾空白。
pub fn normalize_version(raw: &str) -> String {
    raw.trim().trim_start_matches(['v', 'V']).to_string()
}

/// 把版本字符串解析成可比较的数字段。
///
/// 规则：
/// - 忽略前缀 `v` / `V` 与首尾空白；
/// - 忽略 `-` 之后的预发布段与 `+` 之后的构建元数据；
/// - 按 `.` 分段，每段取开头连续的十进制数字（取不到数字则记 0）。
///
/// 例：`v1.0.1` → `[1, 0, 1]`；`1.0.1-rc1` → `[1, 0, 1]`；`garbage` → `[0]`。
pub fn parse_version(raw: &str) -> Vec<u64> {
    let trimmed = raw.trim().trim_start_matches(['v', 'V']);
    let core = trimmed.split(['-', '+']).next().unwrap_or("");
    core.split('.')
        .map(|seg| {
            let digits: String = seg.chars().take_while(|c| c.is_ascii_digit()).collect();
            digits.parse::<u64>().unwrap_or(0)
        })
        .collect()
}

/// `latest` 是否比 `current` 新（缺失的段按 0 补齐，因此 `1.0` 等于 `1.0.0`）。
pub fn is_newer(latest: &str, current: &str) -> bool {
    let a = parse_version(latest);
    let b = parse_version(current);
    for i in 0..a.len().max(b.len()) {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        if x != y {
            return x > y;
        }
    }
    false
}

/// 由「当前版本 / 远端版本」计算 `(是否已是最新, 是否有新版可更新)`。
///
/// 三种关系各自对应清晰的结果：
/// - 相等（含 `1.0` 与 `1.0.0` 这类补齐后相等）→ `(true, false)`；
/// - 远端更新 → `(false, true)`；
/// - 本地版本更新（例如自编译的开发版）→ `(false, false)`，前端据此给出不同提示。
pub fn evaluate_versions(current: &str, latest: &str) -> (bool, bool) {
    let has_update = is_newer(latest, current);
    let up_to_date = !has_update && !is_newer(current, latest);
    (up_to_date, has_update)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_version_segments() {
        assert_eq!(parse_version("1.2.3"), vec![1, 2, 3]);
        assert_eq!(parse_version("v2.0"), vec![2, 0]);
        assert_eq!(parse_version("  V1.0.1  "), vec![1, 0, 1]);
        // 预发布段与构建元数据不参与比较。
        assert_eq!(parse_version("1.0.1-rc1"), vec![1, 0, 1]);
        assert_eq!(parse_version("1.0.1+build.5"), vec![1, 0, 1]);
        // 完全取不到数字时退化为 0，不 panic。
        assert_eq!(parse_version("garbage"), vec![0]);
        assert_eq!(parse_version(""), vec![0]);
    }

    #[test]
    fn normalizes_display_version() {
        assert_eq!(normalize_version("v1.0.1"), "1.0.1");
        assert_eq!(normalize_version("  V2.3.4 "), "2.3.4");
        assert_eq!(normalize_version("1.0.0"), "1.0.0");
    }

    #[test]
    fn detects_newer_remote_versions() {
        assert!(is_newer("1.0.1", "1.0.0"));
        assert!(is_newer("1.1.0", "1.0.9"));
        assert!(is_newer("2.0.0", "1.9.9"));
        assert!(is_newer("v1.0.1", "1.0.0"));
        assert!(is_newer("1.0.0.1", "1.0.0"));
    }

    #[test]
    fn treats_equal_versions_as_not_newer() {
        assert!(!is_newer("1.0.0", "1.0.0"));
        // 缺失的段按 0 补齐。
        assert!(!is_newer("1.0", "1.0.0"));
        assert!(!is_newer("1.0.1+build.5", "1.0.1"));
        assert!(!is_newer("1.0.1-rc1", "1.0.1"));
    }

    #[test]
    fn does_not_flag_older_remote_versions() {
        assert!(!is_newer("1.0.0", "1.0.1"));
        assert!(!is_newer("1.0.0", "2.0.0"));
        assert!(!is_newer("", "1.0.0"));
    }

    #[test]
    fn evaluates_all_three_relations() {
        // 已是最新。
        assert_eq!(evaluate_versions("1.0.1", "1.0.1"), (true, false));
        assert_eq!(evaluate_versions("1.0", "1.0.0"), (true, false));
        // 有新版。
        assert_eq!(evaluate_versions("1.0.1", "1.0.2"), (false, true));
        assert_eq!(evaluate_versions("1.0.1", "1.1.0"), (false, true));
        // 本地版本更新（开发版），既不算最新也不提示更新。
        assert_eq!(evaluate_versions("1.0.2", "1.0.1"), (false, false));
    }
}
