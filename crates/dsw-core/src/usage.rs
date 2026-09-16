//! 用量汇总
//!
//! 账本里存的是「今日用量 + 逐日归档」，这里把它汇总成看板需要的数据。
//! 刻意不做日期运算：ISO 日期串（`YYYY-MM-DD`）按字典序比较等价于按时间比较，
//! 因此「最近 N 天」只需由调用方传入闭区间下界。

use std::collections::BTreeMap;

/// 单日用量。
#[derive(Debug, Clone, PartialEq)]
pub struct UsageDay {
    /// 日期（`YYYY-MM-DD`）。
    pub date: String,
    /// 当日用量。
    pub amount: f64,
}

/// 用量看板数据。
#[derive(Debug, Clone, PartialEq)]
pub struct UsageSummary {
    /// 今日已用。
    pub today: f64,
    /// 最近 7 天合计（含今日）。
    pub last_7: f64,
    /// 最近 30 天合计（含今日）。
    pub last_30: f64,
    /// 有记录的天数（金额 > 0 的天，含今日）。
    pub recorded_days: usize,
    /// 日均：按「有记录的天数」计算，不把没花钱的日子算进去。
    pub average: f64,
    /// 逐日明细，**按日期倒序**（最新在前）。
    pub days: Vec<UsageDay>,
}

/// 汇总用量。
///
/// - `today` / `today_usage`：当天日期与当天累计用量（当天尚未归档进 `history`）；
/// - `history`：逐日归档用量，键为 `YYYY-MM-DD`；
/// - `cutoff_7` / `cutoff_30`：最近 7 / 30 天的**闭区间下界**（同为 `YYYY-MM-DD`）。
pub fn summarize(
    today: &str,
    today_usage: f64,
    history: &BTreeMap<String, f64>,
    cutoff_7: &str,
    cutoff_30: &str,
) -> UsageSummary {
    let mut days: Vec<UsageDay> = history
        .iter()
        .filter(|(_, amount)| **amount > 0.0)
        .map(|(date, amount)| UsageDay {
            date: date.clone(),
            amount: *amount,
        })
        .collect();
    if today_usage > 0.0 {
        days.push(UsageDay {
            date: today.to_string(),
            amount: today_usage,
        });
    }
    days.sort_by(|a, b| b.date.cmp(&a.date));

    let sum_since = |cutoff: &str| -> f64 {
        let archived: f64 = history
            .iter()
            .filter(|(date, _)| date.as_str() >= cutoff)
            .map(|(_, amount)| *amount)
            .sum();
        // 今日用量不在 history 里，需单独判断是否落在窗口内。
        archived + if today >= cutoff { today_usage } else { 0.0 }
    };

    let recorded_days = days.len();
    let total: f64 = days.iter().map(|day| day.amount).sum();
    let average = if recorded_days > 0 {
        total / recorded_days as f64
    } else {
        0.0
    };

    UsageSummary {
        today: today_usage,
        last_7: sum_since(cutoff_7),
        last_30: sum_since(cutoff_30),
        recorded_days,
        average,
        days,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn history(pairs: &[(&str, f64)]) -> BTreeMap<String, f64> {
        pairs
            .iter()
            .map(|(d, v)| (d.to_string(), *v))
            .collect()
    }

    #[test]
    fn empty_ledger_gives_zeros() {
        let summary = summarize("2026-09-16", 0.0, &history(&[]), "2026-09-10", "2026-08-18");
        assert_eq!(summary.today, 0.0);
        assert_eq!(summary.last_7, 0.0);
        assert_eq!(summary.last_30, 0.0);
        assert_eq!(summary.recorded_days, 0);
        assert_eq!(summary.average, 0.0);
        assert!(summary.days.is_empty());
    }

    #[test]
    fn includes_today_and_sorts_newest_first() {
        let h = history(&[("2026-09-14", 2.0), ("2026-09-15", 3.0)]);
        let summary = summarize("2026-09-16", 1.5, &h, "2026-09-10", "2026-08-18");
        assert_eq!(summary.today, 1.5);
        let dates: Vec<&str> = summary.days.iter().map(|d| d.date.as_str()).collect();
        assert_eq!(dates, vec!["2026-09-16", "2026-09-15", "2026-09-14"]);
        assert_eq!(summary.recorded_days, 3);
    }

    #[test]
    fn cuts_windows_by_cutoff() {
        let h = history(&[
            ("2026-09-15", 1.0), // 近 7 天
            ("2026-09-10", 2.0), // 近 7 天（闭区间下界）
            ("2026-09-09", 4.0), // 只在近 30 天
            ("2026-08-18", 8.0), // 近 30 天（闭区间下界）
            ("2026-08-17", 16.0), // 窗口外，但仍会出现在明细里
        ]);
        let summary = summarize("2026-09-16", 0.5, &h, "2026-09-10", "2026-08-18");
        // 近 7 天 = 1 + 2 + 0.5（今日）
        assert!((summary.last_7 - 3.5).abs() < 1e-9);
        // 近 30 天 = 1 + 2 + 4 + 8 + 0.5
        assert!((summary.last_30 - 15.5).abs() < 1e-9);
        // 明细保留账本里的全部归档（账本自身只保留 30 天）
        assert_eq!(summary.days.len(), 6);
    }

    #[test]
    fn ignores_zero_amount_days() {
        let h = history(&[("2026-09-15", 0.0), ("2026-09-14", 2.0)]);
        let summary = summarize("2026-09-16", 0.0, &h, "2026-09-10", "2026-08-18");
        assert_eq!(summary.recorded_days, 1);
        assert_eq!(summary.days.len(), 1);
        assert_eq!(summary.days[0].date, "2026-09-14");
    }

    #[test]
    fn today_outside_window_is_not_counted() {
        // 理论上不会发生（今日必然在 7 天窗口内），这里钉住「窗口外不计入」的行为不被误改。
        let h = history(&[("2026-09-15", 1.0)]);
        let summary = summarize("2026-09-16", 3.0, &h, "2026-09-20", "2026-09-01");
        // 7 天窗口下界在今日之后：归档与今日都不计入。
        assert_eq!(summary.last_7, 0.0);
        // 30 天窗口下界在今日之前：归档 1.0 + 今日 3.0。
        assert!((summary.last_30 - 4.0).abs() < 1e-9);
    }

    #[test]
    fn average_uses_recorded_days() {
        let h = history(&[("2026-09-14", 1.0), ("2026-09-15", 3.0)]);
        let summary = summarize("2026-09-16", 2.0, &h, "2026-09-10", "2026-08-18");
        // (1 + 3 + 2) / 3 天
        assert!((summary.average - 2.0).abs() < 1e-9);
    }
}
