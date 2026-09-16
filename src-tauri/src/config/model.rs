//! 配置数据模型
//!
//! 定义应用配置涉及的全部数据结构（API Key、请求地址、模型、挂件显示、
//! 开机自启、台词管理等）及其默认值与规范化（`normalize`）逻辑。

use serde::{Deserialize, Serialize};

/// DeepSeek 官方 API 默认根地址（可被用户自定义覆盖）。
const DEFAULT_BASE_URL: &str = "https://api.deepseek.com/anthropic";

/// OpenAI Codex 默认根地址（可被用户自定义覆盖）。
const DEFAULT_CODEX_BASE_URL: &str = "https://api.deepseek.com";

// ---------------------------------------------------------------------------
// 数据模型
// ---------------------------------------------------------------------------

/// 单个模型系列的配置：模型名称 + 上下文窗口大小。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelEntry {
    /// 模型名称（用户可自定义，如 `deepseek-chat`）。
    pub name: String,
    /// 上下文窗口大小（token 数）。
    pub context_window: u32,
}

impl ModelEntry {
    /// 构造单个模型项。
    fn new(name: &str, context_window: u32) -> Self {
        Self {
            name: name.to_string(),
            context_window,
        }
    }
}

/// 用户自定义的额外模型槽位。
///
/// 写入 Claude 配置时会生成 `ANTHROPIC_DEFAULT_<KEY>_MODEL`（KEY 由 `key` 规范化而来），
/// 因此不再局限于主模型 / Haiku / Sonnet / Opus 四档。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSlot {
    /// 槽位 key（用于生成环境变量名，写入前会被规范化）。
    #[serde(default)]
    pub key: String,
    /// 展示名（仅用于界面）。
    #[serde(default)]
    pub label: String,
    /// 模型名称。
    #[serde(default)]
    pub name: String,
    /// 上下文窗口大小（token 数）。
    #[serde(default)]
    pub context_window: u32,
    /// 是否写入客户端配置（关掉则只保存不落盘）。
    #[serde(default = "default_true")]
    pub enabled: bool,
}

/// 额外写入 Claude 配置的环境变量键值对。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvPair {
    /// 变量名。
    #[serde(default)]
    pub key: String,
    /// 变量值。
    #[serde(default)]
    pub value: String,
}

/// 一套可切换的完整配置（类似 cc-switch 的 provider 配置）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    /// 唯一 id。
    #[serde(default)]
    pub id: String,
    /// 展示名。
    #[serde(default)]
    pub name: String,
    /// 该配置使用的 API Key。
    #[serde(default)]
    pub api_key: String,
    /// Claude 请求根地址。
    #[serde(default = "default_base_url")]
    pub base_url: String,
    /// Codex 请求根地址。
    #[serde(default = "default_codex_base_url")]
    pub codex_base_url: String,
    /// Claude 模型配置。
    #[serde(default)]
    pub models: ModelConfig,
    /// Codex 模型配置。
    #[serde(default)]
    pub codex_models: ModelConfig,
    /// Codex 推理强度。
    #[serde(default = "default_reasoning_effort")]
    pub codex_reasoning_effort: String,
    /// Codex 线协议。
    #[serde(default = "default_wire_api")]
    pub codex_wire_api: String,
    /// Codex 是否禁用响应存储。
    #[serde(default = "default_true")]
    pub codex_disable_response_storage: bool,
}

/// Haiku / Sonnet / Opus 三个系列的默认调用模型配置。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    /// 主模型（默认调用模型，映射 ANTHROPIC_MODEL / Codex model）。
    pub primary: ModelEntry,
    /// 快速轻量档（Haiku）。
    pub haiku: ModelEntry,
    /// 均衡档（Sonnet）。
    pub sonnet: ModelEntry,
    /// 旗舰推理档（Opus）。
    pub opus: ModelEntry,
    /// 额外槽位（用户可增删；旧配置无此字段时为空）。
    #[serde(default)]
    pub extra_slots: Vec<ModelSlot>,
}

impl Default for ModelConfig {
    /// 返回 Claude / Codex 共用的默认模型配置。
    fn default() -> Self {
        Self {
            primary: ModelEntry::new("deepseek-v4-flash", 1_000_000),
            haiku: ModelEntry::new("deepseek-v4-flash", 1_000_000),
            sonnet: ModelEntry::new("deepseek-v4-flash", 1_000_000),
            opus: ModelEntry::new("deepseek-v4-flash", 1_000_000),
            extra_slots: Vec::new(),
        }
    }
}

/// 挂件显示配置（与旧 DSH 插件的 `.dshw-size.json` 一一对应）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetConfig {
    /// 尺寸倍率 0.6–2.5。
    pub scale: f64,
    /// 是否开启音效。
    pub sound: bool,
    /// 音量 0.0–1.0。
    pub vol: f64,
    /// 音效组：`duck`（小黄鸭）/ `fx1`（音效1）或自定义音频文件路径。
    pub sound_set: String,
    /// 自定义音效文件路径列表。
    #[serde(default)]
    pub custom_sounds: Vec<String>,
    /// 气泡颜色（十六进制，如 `#203170`）。
    #[serde(default = "default_bubble_color")]
    pub bubble_color: String,
    /// 随机眨眼最小间隔（秒）。
    #[serde(default = "default_blink_interval_min_sec")]
    pub blink_interval_min_sec: u32,
    /// 随机眨眼最大间隔（秒）。
    #[serde(default = "default_blink_interval_max_sec")]
    pub blink_interval_max_sec: u32,
    /// 是否启用余额不足疲惫模式。
    #[serde(default = "default_exhausted_mode_enabled")]
    pub exhausted_mode_enabled: bool,
    /// 余额不足疲惫模式阈值（元）。
    #[serde(default = "default_exhausted_balance_threshold")]
    pub exhausted_balance_threshold: f64,
    /// 是否播放事件音效（余额变化 / 获取失败）。
    ///
    /// 思路参考 `MerZlin/dsh-pet-indesktop` 的「Agent 联动音效」：把事件音与按压音分开，
    /// 这里落到本挂件真正拥有的事件上（余额变化、请求失败）。
    #[serde(default = "default_event_sounds")]
    pub event_sounds: bool,
    /// 是否启用动作动效（跳/转圈/点头/受惊/呼吸/摇摆等，全部由现有素材合成）。
    #[serde(default = "default_actions")]
    pub actions: bool,
    /// 是否启用随机小动作彩蛋（闲暇时偶尔来一个）。
    #[serde(default = "default_random_actions")]
    pub random_actions: bool,
}

impl Default for WidgetConfig {
    /// 返回挂件显示配置默认值。
    fn default() -> Self {
        Self {
            scale: 1.0,
            sound: true,
            vol: 0.8,
            sound_set: "duck".to_string(),
            custom_sounds: Vec::new(),
            bubble_color: "#203170".to_string(),
            blink_interval_min_sec: 4,
            blink_interval_max_sec: 6,
            exhausted_mode_enabled: true,
            exhausted_balance_threshold: 5.0,
            event_sounds: true,
            actions: true,
            random_actions: true,
        }
    }
}

/// 单条台词：文本 + 分类标签 + 权重 + 开关。
///
/// 为兼容旧配置（`lines: ["..."]` 纯字符串数组），反序列化同时接受字符串与对象两种形态；
/// 序列化统一输出对象形态，前端只需处理一种结构。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogueLine {
    /// 台词文本，支持占位符 `{balance}` / `{today}` / `{time}` / `{date}` / `{period}` / `{mood}`。
    pub text: String,
    /// 分类标签（如 `daily` / `greet` / `peak` / `offpeak` / `night`）；留空表示通用。
    #[serde(default)]
    pub tags: Vec<String>,
    /// 抽取权重（越大越容易被选中）。
    #[serde(default = "default_dialogue_weight")]
    pub weight: u32,
    /// 是否启用。
    #[serde(default = "default_true")]
    pub enabled: bool,
}

impl<'de> Deserialize<'de> for DialogueLine {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Repr {
            Text(String),
            Full {
                #[serde(default)]
                text: String,
                #[serde(default)]
                tags: Vec<String>,
                #[serde(default = "default_dialogue_weight")]
                weight: u32,
                #[serde(default = "default_true")]
                enabled: bool,
            },
        }

        Ok(match Repr::deserialize(deserializer)? {
            Repr::Text(text) => DialogueLine {
                text,
                tags: Vec::new(),
                weight: default_dialogue_weight(),
                enabled: true,
            },
            Repr::Full {
                text,
                tags,
                weight,
                enabled,
            } => DialogueLine {
                text,
                tags,
                weight,
                enabled,
            },
        })
    }
}

/// 表情台词：把原先写死在代码里的文案变成可编辑配置。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodLines {
    /// 连点触发生气时的提示。
    #[serde(default = "default_angry_lines")]
    pub angry: Vec<String>,
    /// 悬浮触发害羞时的提示。
    #[serde(default = "default_shy_lines")]
    pub shy: Vec<String>,
    /// 长时间无交互进入失落时的提示。
    #[serde(default = "default_disappointed_lines")]
    pub disappointed: Vec<String>,
    /// 失落状态下的轮播语录。
    #[serde(default = "default_lonely_lines")]
    pub lonely: Vec<String>,
    /// 疲惫（余额不足）模式下的轮播语录。
    #[serde(default = "default_exhausted_lines")]
    pub exhausted: Vec<String>,
    /// 用户重新互动时的回弹提示。
    #[serde(default = "default_back_lines")]
    pub back: Vec<String>,
}

impl Default for MoodLines {
    fn default() -> Self {
        Self {
            angry: default_angry_lines(),
            shy: default_shy_lines(),
            disappointed: default_disappointed_lines(),
            lonely: default_lonely_lines(),
            exhausted: default_exhausted_lines(),
            back: default_back_lines(),
        }
    }
}

/// 台词管理配置。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogueConfig {
    /// 台词列表（兼容旧的纯字符串数组）。
    #[serde(default = "default_dialogue_lines")]
    pub lines: Vec<DialogueLine>,
    /// 播放模式：`carousel`（轮播）/ `random`（随机）。
    #[serde(default = "default_dialogue_mode")]
    pub mode: String,
    /// 每句台词基础间隔（分钟）。
    #[serde(default = "default_dialogue_interval")]
    pub interval_min: u32,
    /// 波动幅度（0–100，步长 1%）。
    #[serde(default)]
    pub jitter: u32,
    /// 是否按情境选句（结合余额档位 / 峰谷 / 时段筛选分类）。
    #[serde(default = "default_true")]
    pub context_mode: bool,
    /// 最近多少条内不重复。
    #[serde(default = "default_no_repeat")]
    pub no_repeat: u32,
    /// 表情台词（生气 / 害羞 / 失落 / 疲惫 / 回弹）。
    #[serde(default)]
    pub mood_lines: MoodLines,
}

impl Default for DialogueConfig {
    /// 返回台词管理默认配置。
    fn default() -> Self {
        Self {
            lines: default_dialogue_lines(),
            mode: default_dialogue_mode(),
            interval_min: default_dialogue_interval(),
            jitter: 0,
            context_mode: true,
            no_repeat: default_no_repeat(),
            mood_lines: MoodLines::default(),
        }
    }
}

/// 挂件位置配置：逻辑坐标 + 水平方向。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetPosition {
    /// 挂件左上角逻辑 X 坐标。
    pub x: f64,
    /// 挂件左上角逻辑 Y 坐标。
    pub y: f64,
    /// 水平方向：`left` / `right` / `none`。
    pub h: String,
}

impl Default for WidgetPosition {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            h: "right".to_string(),
        }
    }
}

/// 构造一条默认台词（分类 `daily`，权重 1，启用）。
fn daily_line(text: &str) -> DialogueLine {
    DialogueLine {
        text: text.to_string(),
        tags: vec!["daily".to_string()],
        weight: 1,
        enabled: true,
    }
}

/// 返回默认台词列表。
fn default_dialogue_lines() -> Vec<DialogueLine> {
    vec![
        daily_line("喵~主人又忘记喂我啦！"),
        daily_line("哼，摸头要收费的哦！"),
        daily_line("尾巴不是给你拽的啦！"),
        daily_line("罐头呢？我闻到了！"),
        daily_line("抱抱可以，但先给小鱼干~"),
        daily_line("喵喵喵？你居然不理我？"),
        daily_line("毛线球不是用来玩的吗？"),
        daily_line("太阳晒够了，该撸我了~"),
        daily_line("窗外的鸟好吵，还是主人好~"),
        daily_line("喵~不许看别的鲸！"),
        daily_line("好模型... ↓"),
        daily_line("好女孩...↓"),
        daily_line("不知道用户有什么用，先赶走吧~"),
        daily_line("我...我...我也要挣钱吗？"),
        daily_line("我去吃饭啦，测完叫我"),
        daily_line("压力一只蓝色大肥鱼？！"),
        daily_line("DeepSleep..."),
        daily_line("坏了...用户彻底怒了！"),
        daily_line("你目录里的dsh是什么...大烧货吗...?"),
        daily_line("恭喜你实现token自由！token全跑了！"),
        daily_line("真当我是便宜货啊..."),
        daily_line("这个凶是什么意思呀..."),
        daily_line("哦鲸鲸..."),
    ]
}

/// 默认台词权重。
fn default_dialogue_weight() -> u32 {
    1
}

/// 默认「最近 N 条不重复」。
fn default_no_repeat() -> u32 {
    3
}

/// 生气的默认提示（原为代码内写死）。
fn default_angry_lines() -> Vec<String> {
    vec!["你再摸人家就生气了喵 (╬ Ò﹏Ó)".to_string()]
}

/// 害羞的默认提示（原为代码内写死）。
fn default_shy_lines() -> Vec<String> {
    vec!["主人摸本鲸头了喵 (≧◡≦)♡".to_string()]
}

/// 进入失落时的默认提示（原为代码内写死）。
fn default_disappointed_lines() -> Vec<String> {
    vec!["鲸鲸没人要了喵 (╥﹏╥)".to_string()]
}

/// 重新互动时的默认回弹提示（原为代码内写死）。
fn default_back_lines() -> Vec<String> {
    vec!["你终于想起本鲸了喵 (=￣ω￣=)".to_string()]
}

/// 失落轮播的默认语录（原为代码内写死的 18 条）。
fn default_lonely_lines() -> Vec<String> {
    vec![
        "主人不理我，好寂寞…".to_string(),
        "喵…都不看本鲸一眼…".to_string(),
        "等了你好久好久…".to_string(),
        "尾巴都垂下来了…".to_string(),
        "罐头不香了吗…".to_string(),
        "你忘了本鲸在这里了吗…".to_string(),
        "太阳落山了，你还没来…".to_string(),
        "连呼噜都没力气…".to_string(),
        "本鲸趴门口等了好久…".to_string(),
        "你鼠标路过也不摸我…".to_string(),
        "喵…本鲸心里空空的…".to_string(),
        "窗台好冷，主人不在…".to_string(),
        "我给空气翻肚皮…".to_string(),
        "本鲸叫了三声，没人应…".to_string(),
        "你的影子都走了…".to_string(),
        "本鲸的人生突然好灰暗…".to_string(),
        "你连本鲸尾巴尖都没碰过…".to_string(),
        "主人…本鲸还在等你回家呢。".to_string(),
    ]
}

/// 疲惫轮播的默认语录（原为代码内写死的 20 条）。
fn default_exhausted_lines() -> Vec<String> {
    vec![
        "额度快见底了，省着点花喵…".to_string(),
        "本鲸已经有点转不动了…".to_string(),
        "余额薄得像尾巴尖了…".to_string(),
        "再这样下去要喝西北风啦…".to_string(),
        "我闻到贫穷的海风了喵。".to_string(),
        "今天先克制一点点，好吗？".to_string(),
        "钱包在打喷嚏，是真的。".to_string(),
        "余额快瘦成一条线了…".to_string(),
        "本鲸的工作餐要保不住了。".to_string(),
        "别再连点了，额度会哭的。".to_string(),
        "这个数额，看着有点心慌…".to_string(),
        "再冲动消费，本鲸就躺平了。".to_string(),
        "现在适合精打细算模式。".to_string(),
        "我已经自动切到省电表情了。".to_string(),
        "先缓一缓，明天再战也行。".to_string(),
        "余额这么低，本鲸都不敢翻身。".to_string(),
        "这点额度，只够我眨两次眼…".to_string(),
        "理智一点，别让账单追上来。".to_string(),
        "本鲸建议你先补充一点预算。".to_string(),
        "再不回点血，就真要疲惫了喵。".to_string(),
    ]
}

/// 返回默认台词播放模式。
fn default_dialogue_mode() -> String {
    "random".to_string()
}

/// 返回默认台词播放间隔（分钟）。
fn default_dialogue_interval() -> u32 {
    5
}

/// 应用顶层配置。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// DeepSeek API Key（用于官方余额接口）。
    #[serde(default)]
    pub api_key: String,
    /// Claude（Anthropic）请求根地址。
    #[serde(default = "default_base_url")]
    pub base_url: String,
    /// OpenAI Codex 请求根地址。
    #[serde(default = "default_codex_base_url")]
    pub codex_base_url: String,
    /// Claude 模型配置。
    #[serde(default)]
    pub models: ModelConfig,
    /// OpenAI Codex 模型配置。
    #[serde(default)]
    pub codex_models: ModelConfig,
    /// 挂件显示配置。
    #[serde(default)]
    pub widget: WidgetConfig,
    /// 是否开机自启。
    #[serde(default)]
    pub autostart: bool,
    /// 全局颜色（配置界面文字/按钮边框等，十六进制）。
    #[serde(default = "default_global_color")]
    pub global_color: String,
    /// 台词管理配置。
    #[serde(default)]
    pub dialogue: DialogueConfig,
    /// 挂件上次保存的位置与朝向。
    #[serde(default)]
    pub widget_position: Option<WidgetPosition>,
    /// Codex 推理强度：`minimal` / `low` / `medium` / `high`（此前写死为 high）。
    #[serde(default = "default_reasoning_effort")]
    pub codex_reasoning_effort: String,
    /// Codex 线协议：`chat` / `responses`（此前写死为 chat）。
    #[serde(default = "default_wire_api")]
    pub codex_wire_api: String,
    /// Codex 是否禁用响应存储（此前写死为 true）。
    #[serde(default = "default_true")]
    pub codex_disable_response_storage: bool,
    /// 额外写入 Claude 配置的环境变量（高级选项）。
    #[serde(default)]
    pub claude_extra_env: Vec<EnvPair>,
    /// 多套可切换配置（一键切换站点 / Key / 模型组合）。
    #[serde(default)]
    pub profiles: Vec<Profile>,
    /// 当前激活的配置 id（为空表示直接使用顶层字段）。
    #[serde(default)]
    pub active_profile: String,
}

/// 返回默认 Codex 推理强度。
fn default_reasoning_effort() -> String {
    "high".to_string()
}

/// 返回默认 Codex 线协议。
fn default_wire_api() -> String {
    "chat".to_string()
}

/// 布尔字段默认值：true。
fn default_true() -> bool {
    true
}

/// 返回默认 Claude 请求根地址。
fn default_base_url() -> String {
    DEFAULT_BASE_URL.to_string()
}

/// 返回默认 Codex 请求根地址。
fn default_codex_base_url() -> String {
    DEFAULT_CODEX_BASE_URL.to_string()
}

/// 返回默认气泡颜色。
fn default_bubble_color() -> String {
    "#203170".to_string()
}

/// 返回随机眨眼最小间隔默认值（秒）。
fn default_blink_interval_min_sec() -> u32 {
    4
}

/// 返回随机眨眼最大间隔默认值（秒）。
fn default_blink_interval_max_sec() -> u32 {
    6
}

/// 返回疲惫模式默认开关。
fn default_exhausted_mode_enabled() -> bool {
    true
}

/// 返回疲惫模式默认阈值（元）。
fn default_exhausted_balance_threshold() -> f64 {
    5.0
}

/// 事件音效默认开启（旧配置无此字段时保持原有行为：有声音）。
fn default_event_sounds() -> bool {
    true
}

/// 动作动效默认开启（旧配置无此字段时按开启处理）。
fn default_actions() -> bool {
    true
}

/// 随机小动作彩蛋默认开启。
fn default_random_actions() -> bool {
    true
}

/// 返回默认全局颜色。
fn default_global_color() -> String {
    "#203170".to_string()
}

impl Default for AppConfig {
    /// 返回应用完整默认配置。
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: DEFAULT_BASE_URL.to_string(),
            codex_base_url: DEFAULT_CODEX_BASE_URL.to_string(),
            models: ModelConfig::default(),
            codex_models: ModelConfig::default(),
            widget: WidgetConfig::default(),
            autostart: false,
            global_color: "#203170".to_string(),
            dialogue: DialogueConfig::default(),
            widget_position: None,
            codex_reasoning_effort: default_reasoning_effort(),
            codex_wire_api: default_wire_api(),
            codex_disable_response_storage: true,
            claude_extra_env: Vec::new(),
            profiles: Vec::new(),
            active_profile: String::new(),
        }
    }
}

impl AppConfig {
    /// 规范化字段：去除首尾空白；空地址回落默认值；非法倍率/音量钳制到合法区间。
    pub fn normalize(&mut self) {
        self.api_key = self.api_key.trim().to_string();

        let base = self.base_url.trim().trim_end_matches('/').to_string();
        self.base_url = if base.is_empty() {
            DEFAULT_BASE_URL.to_string()
        } else {
            base
        };

        let codex_base = self.codex_base_url.trim().trim_end_matches('/').to_string();
        self.codex_base_url = if codex_base.is_empty() {
            DEFAULT_CODEX_BASE_URL.to_string()
        } else {
            codex_base
        };

        for entry in [
            &mut self.models.primary,
            &mut self.models.haiku,
            &mut self.models.sonnet,
            &mut self.models.opus,
            &mut self.codex_models.primary,
            &mut self.codex_models.haiku,
            &mut self.codex_models.sonnet,
            &mut self.codex_models.opus,
        ] {
            entry.name = entry.name.trim().to_string();
        }

        if self.global_color.trim().is_empty() {
            self.global_color = "#203170".to_string();
        } else {
            self.global_color = self.global_color.trim().to_string();
        }
        if self.widget.bubble_color.trim().is_empty() {
            self.widget.bubble_color = "#203170".to_string();
        } else {
            self.widget.bubble_color = self.widget.bubble_color.trim().to_string();
        }
        self.widget.custom_sounds.retain(|s| !s.trim().is_empty());

        let w = &mut self.widget;
        if !(0.6..=2.5).contains(&w.scale) {
            w.scale = 1.5;
        }
        if !(0.0..=1.0).contains(&w.vol) {
            w.vol = 0.9;
        }
        w.sound = w.sound || w.vol > 0.0;
        let is_preset = w.sound_set == "duck" || w.sound_set == "fx1";
        let is_custom =
            !w.sound_set.is_empty() && w.custom_sounds.iter().any(|s| s == &w.sound_set);
        if !is_preset && !is_custom {
            w.sound_set = "duck".to_string();
        }
        if w.blink_interval_min_sec < 1 {
            w.blink_interval_min_sec = default_blink_interval_min_sec();
        }
        if w.blink_interval_max_sec < 1 {
            w.blink_interval_max_sec = default_blink_interval_max_sec();
        }
        if w.blink_interval_max_sec < w.blink_interval_min_sec {
            w.blink_interval_max_sec = w.blink_interval_min_sec;
        }
        if !w.exhausted_balance_threshold.is_finite() || w.exhausted_balance_threshold < 0.0 {
            w.exhausted_balance_threshold = default_exhausted_balance_threshold();
        }

        // 台词：过滤空文本、权重下限 1，校验播放模式，钳制间隔与波动幅度。
        self.dialogue.lines.retain(|line| !line.text.trim().is_empty());
        for line in self.dialogue.lines.iter_mut() {
            line.text = line.text.trim().to_string();
            if line.weight < 1 {
                line.weight = 1;
            }
        }
        if self.dialogue.mode != "carousel" && self.dialogue.mode != "random" {
            self.dialogue.mode = "random".to_string();
        }
        if self.dialogue.interval_min < 1 {
            self.dialogue.interval_min = 1;
        }
        if self.dialogue.jitter > 100 {
            self.dialogue.jitter = 100;
        }
        if self.dialogue.no_repeat > 50 {
            self.dialogue.no_repeat = 50;
        }

        if let Some(position) = &mut self.widget_position {
            if !position.x.is_finite() || !position.y.is_finite() {
                self.widget_position = None;
            } else {
                position.h = position.h.trim().to_string();
                if position.h != "left" && position.h != "right" && position.h != "none" {
                    position.h = "right".to_string();
                }
            }
        }
    }
}
