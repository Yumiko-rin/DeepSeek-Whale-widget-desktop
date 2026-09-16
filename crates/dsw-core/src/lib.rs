//! DS Desktop Whale 的纯逻辑内核。
//!
//! 这里只放**不依赖 Tauri / WebView2 / 网络**的纯函数，好处是：
//!
//! - `cargo test -p dsw-core` 不需要链接 Tauri，任何平台都能直接跑
//!   （Windows 上 Tauri 的测试二进制会依赖 `WebView2Loader.dll`，难以在 CI 之外验证）；
//! - 记账、峰谷判定、预算与版本比较这类「算错了很隐蔽」的逻辑，可以逐个用例钉住。

pub mod config_util;
pub mod usage;
pub mod version;
