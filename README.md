# 小鲸鱼余额挂件 · 独立桌面版

> DeepSeek Balance Whale Widget · Standalone Desktop Edition（Windows / macOS / Linux）

一个基于 [Tauri v2](https://tauri.app) 的跨平台桌面挂件：在屏幕角落常驻一只 Q 版小鲸鱼，实时展示 DeepSeek 账户余额与今日已用，并支持本地记账。**不依赖 DSH（DeepSeek Harness）、不需要浏览器插件、不经过任何中转服务。**

A cross-platform desktop widget built with Tauri v2. It keeps a cute whale pinned to the corner of your screen, showing your DeepSeek account balance and today's usage in real time, with local usage tracking. No browser extension, no DSH runtime and no third-party relay required.

---

## 下载 · Download

到本仓库的 [Releases](https://github.com/Yumiko-rin/DeepSeek-Whale-widget-desktop/releases) 页面按系统下载：

| 系统 | 文件 | 说明 |
| --- | --- | --- |
| Windows 10/11 x64 | `DS.Desktop.Whale_1.0.0_x64-setup.exe` | NSIS 安装包，当前用户安装，免管理员 |
| Windows 10/11 x64 便携版 | `DS.Desktop.Whale_1.0.0_x64-portable.exe` | 免安装，双击即用 |
| macOS（Apple Silicon） | `*_aarch64.dmg` / `*.app` | 拖入「应用程序」即可 |
| macOS（Intel） | `*_x64.dmg` / `*.app` | 同上 |
| Linux x64 | `*.deb` / `*.AppImage` | `sudo dpkg -i` 安装，或给 AppImage 加执行权限后直接运行 |

macOS / Linux 版本由 GitHub Actions 在对应系统上自动构建并发布（见 [`.github/workflows/release.yml`](.github/workflows/release.yml)），推 `v*` 标签即触发。

> 发布包未做代码签名：macOS 首次打开请「右键 → 打开」；Windows 可能提示 SmartScreen，选择「仍要运行」。

---

## 功能特性 · Features

- **余额实时展示**：默认每 60 秒自动刷新，余额变化时带数字滚动动画。
- **今日已用记账**：通过余额差值自动记账，跨天自动归档。
- **拖拽吸附**：按住拖动，松手后按四分之一区域自动吸附屏幕四边；左吸附自动镜像翻转。
- **互动表情**：生气、失落、害羞等多种表情自动切换。
- **模型配置**：类似cc-swtich，允许用户自定义claude/codex模型与token上下文。
- **自定义音效**：允许用户自定义点击音效。
- **自定义台词**：允许用户自定义气泡展示台词。

---

## 环境要求 · Requirements

| 系统 | 运行时要求 |
| --- | --- |
| Windows 10 / 11 | 自带 WebView2（缺失时安装包会引导安装） |
| macOS 10.15+ | 系统自带 WKWebView |
| Linux | `webkit2gtk-4.1`（Debian/Ubuntu：`libwebkit2gtk-4.1-0`）；托盘需要 `libayatana-appindicator3` |

从源码构建还需要 [Node.js](https://nodejs.org) 与 [Rust](https://www.rust-lang.org)（`rust-version = "1.77"`）。

Runtime requirements: WebView2 on Windows, WKWebView on macOS, and `webkit2gtk-4.1` (+ `libayatana-appindicator3` for the tray) on Linux. Node.js and Rust are only needed when building from source.

---

## 安装与运行 · Install & Run

### 直接运行 · Ready-to-run

`npm run build` 的产物位于 `src-tauri/target/release/`：

| 系统 | 产物 |
| --- | --- |
| Windows | `bundle/nsis/DS Desktop Whale_1.0.0_x64-setup.exe`（安装包，当前用户模式免管理员）、`DS Desktop Whale.exe`（便携版） |
| macOS | `bundle/dmg/DS Desktop Whale_1.0.0_<arch>.dmg`、`bundle/macos/DS Desktop Whale.app` |
| Linux | `bundle/deb/*.deb`、`bundle/appimage/*.AppImage` |

### 从源码构建 · Build from source

```bash
# 安装前端依赖
npm install

# 开发运行（启动挂件）
npm run dev

# 打包发布（按当前系统生成安装包）
npm run build

# 指定目标平台（需已安装对应 Rust target）
npm run build -- --target aarch64-apple-darwin --bundles app,dmg
```

---

## 首次配置 · First-run Setup

1. 首次启动时（未配置 API Key）会自动弹出「小鲸鱼设置」窗口。
2. 在 **基础配置 → DeepSeek API Key** 填入官方 API Key（形如 `sk-…`）。
3. 「请求地址」默认 `https://api.deepseek.com/anthropic`，一般无需修改。
4. 保存后挂件随即开始拉取余额。

> 随时可打开设置：右键系统托盘图标 → 打开配置，或在挂件汉堡菜单中点击「打开配置」。

1. On first launch (no API key configured) the settings window pops up automatically.
2. Fill in your official DeepSeek API key (`sk-…`) under **基础配置 → DeepSeek API Key**.
3. The default request URL is `https://api.deepseek.com/anthropic`; usually no change needed.
4. After saving, the widget starts fetching the balance.

---

## 数据存储 · Data Storage

所有配置与记账数据保存在当前用户目录，不经过任何第三方平台：

All config and usage data is stored locally in the user directory:

```
%APPDATA%\DS Desktop Whale\           # Windows
~/Library/Application Support/DS Desktop Whale/   # macOS
~/.config/DS Desktop Whale/           # Linux
├── config.json    # API Key / 请求地址 / 模型 / 挂件显示 / 开机自启
└── usage.json     # 小鲸鱼记账数据（含近 30 天历史归档）
```

API Key 仅保存在本机 `config.json`，程序直接请求 DeepSeek 官方接口。

The API key is stored only in the local `config.json`; the app talks to the DeepSeek API directly.

---

## 技术栈 · Tech Stack

- **架构**：Tauri v2（Rust 后端 + 系统 WebView 前端：Windows WebView2 / macOS WKWebView / Linux WebKitGTK）
- **前端**：纯 HTML / CSS / JS，无前端框架
- **后端**：Rust（`edition 2021`）
- **Architecture**: Tauri v2 (Rust backend + WebView2 frontend)
- **Frontend**: vanilla HTML / CSS / JS, no framework
- **Backend**: Rust (edition 2021)

## 常见问题 · FAQ

- **挂件显示「未配置 DeepSeek API Key」**：打开设置填写 API Key 后自动恢复。
- **关闭挂件**：右键托盘图标 → 退出。

---

## 致谢 · Acknowledgments

本项目由原 DSH 插件 [DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 独立化改造而来，感谢原作者 [MeteorNOX](https://github.com/MeteorNOX) 的创意与实现。许可证请以原仓库为准。

This project is derived from the original DSH extension [DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget). Thanks to [MeteorNOX](https://github.com/MeteorNOX) for the original idea and implementation. Please refer to the original repository for licensing.
