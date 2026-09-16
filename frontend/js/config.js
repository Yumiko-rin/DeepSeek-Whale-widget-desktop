// 小鲸鱼余额挂件 · 配置窗口脚本
//
// 负责配置页的加载、表单回填、静默保存，以及与挂件窗口的实时同步。
// 重点覆盖：
// - 模型配置与供应商切换
// - 挂件显示设置与自定义音效
// - 台词列表编辑与调度参数
// - 余额展示、更新检查与弹窗交互

(function () {
  const invoke =
    window.__TAURI__ && window.__TAURI__.core
      ? window.__TAURI__.core.invoke
      : null;
  if (!invoke) return;

  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  const apiKeyEl = document.getElementById("apiKey");
  const baseUrlEl = document.getElementById("baseUrl");
  const autostartEl = document.getElementById("autostart");
  const toggleKeyEl = document.getElementById("toggleKey");
  const widgetScaleEl = document.getElementById("widgetScale");
  const widgetScaleValEl = document.getElementById("widgetScaleVal");
  const widgetSoundSetEl = document.getElementById("widgetSoundSet");
  const widgetVolEl = document.getElementById("widgetVol");
  const widgetVolPctEl = document.getElementById("widgetVolPct");
  const eventSoundsEl = document.getElementById("eventSounds");
  const actionsEl = document.getElementById("actions");
  const randomActionsEl = document.getElementById("randomActions");
  const moodFiltersEl = document.getElementById("moodFilters");
  const modelCatalogEl = document.getElementById("modelCatalog");
  const addSlotEl = document.getElementById("addSlot");
  const extraSlotsEl = document.getElementById("extraSlots");
  const codexOptionsEl = document.getElementById("codexOptions");
  const codexEffortEl = document.getElementById("codexEffort");
  const codexWireApiEl = document.getElementById("codexWireApi");
  const codexDisableStorageEl = document.getElementById("codexDisableStorage");
  const profileNameEl = document.getElementById("profileName");
  const saveProfileEl = document.getElementById("saveProfile");
  const deleteProfileEl = document.getElementById("deleteProfile");
  const profileSelectEl = document.getElementById("profileSelect");
  const blinkIntervalMinSecEl = document.getElementById("blinkIntervalMinSec");
  const blinkIntervalMaxSecEl = document.getElementById("blinkIntervalMaxSec");
  const exhaustedModeEnabledEl = document.getElementById(
    "exhaustedModeEnabled",
  );
  const exhaustedBalanceThresholdEl = document.getElementById(
    "exhaustedBalanceThreshold",
  );
  const addCustomSoundEl = document.getElementById("addCustomSound");
  const dialogueContextEl = document.getElementById("dialogueContext");
  const dialogueNoRepeatEl = document.getElementById("dialogueNoRepeat");
  const globalColorEl = document.getElementById("globalColor");
  const bubbleColorEl = document.getElementById("bubbleColor");
  const resetColorEl = document.getElementById("resetColor");
  const checkUpdateEl = document.getElementById("checkUpdate");
  const tutorialEl = document.getElementById("tutorial");
  const modalOverlayEl = document.getElementById("modalOverlay");
  const tipModalEl = document.getElementById("tipModal");
  const tipMsgEl = document.getElementById("tipMsg");
  const tipOkEl = document.getElementById("tipOk");
  const confirmModalEl = document.getElementById("confirmModal");
  const confirmMsgEl = document.getElementById("confirmMsg");
  const confirmYesEl = document.getElementById("confirmYes");
  const confirmNoEl = document.getElementById("confirmNo");
  const dialogueListEl = document.getElementById("dialogueList");
  const addLineEl = document.getElementById("addLine");
  const resetLinesEl = document.getElementById("resetLines");
  const dialogueModeEl = document.getElementById("dialogueMode");
  const dialogueIntervalEl = document.getElementById("dialogueInterval");
  const dialogueJitterEl = document.getElementById("dialogueJitter");
  const dialogueJitterValEl = document.getElementById("dialogueJitterVal");
  const toggleDialogueEl = document.getElementById("toggleDialogue");
  const dialogueCardEl = document.getElementById("dialogueCard");
  const availableBalanceEl = document.getElementById("availableBalance");
  const todayUsageEl = document.getElementById("todayUsage");
  const provClaudeEl = document.getElementById("provClaude");
  const provCodexEl = document.getElementById("provCodex");

  const SCALE_MIN = 0.6;
  const SCALE_MAX = 2.5;
  const LEVEL_MIN = 1;
  const LEVEL_MAX = 20;

  // 数字档位 -> 实际缩放倍率。
  function numToScale(v) {
    return (
      SCALE_MIN +
      ((v - LEVEL_MIN) * (SCALE_MAX - SCALE_MIN)) / (LEVEL_MAX - LEVEL_MIN)
    );
  }
  function scaleToNum(s) {
    return Math.round(
      LEVEL_MIN +
        ((s - SCALE_MIN) * (LEVEL_MAX - LEVEL_MIN)) / (SCALE_MAX - SCALE_MIN),
    );
  }

  let config = null;
  let saveTimer = null;
  let widgetSaveTimer = null;
  let activeProvider = "claude"; // 'claude' | 'codex'
  let autostartPending = false;
  let blinkRangeLastChanged = null;
  let balanceRequestSeq = 0;
  let lastSavedBalanceSource = null;

  const DEFAULT_LINES = [
    "喵~主人又忘记喂我啦！",
    "哼，摸头要收费的哦！",
    "尾巴不是给你拽的啦！",
    "罐头呢？我闻到了！",
    "抱抱可以，但先给小鱼干~",
    "喵喵喵？你居然不理我？",
    "毛线球不是用来玩的吗？",
    "太阳晒够了，该撸我了~",
    "窗外的鸟好吵，还是主人好~",
    "喵~不许看别的鲸！",
    "好模型... ↓",
    "好女孩...↓",
    "不知道用户有什么用，先赶走吧~",
    "我...我...我也要挣钱吗？",
    "我去吃饭啦，测完叫我",
    "压力一只蓝色大肥鱼？！",
    "DeepSleep...",
    "坏了...用户彻底怒了！",
    "你目录里的dsh是什么...大烧货吗...?",
    "恭喜你实现token自由！token全跑了！",
    "真当我是便宜货啊...",
    "这个凶是什么意思呀...",
    "哦鲸鲸...",
  ];
  let dialogueSaveTimer = null;

  // 读取当前激活供应商对应的模型表。
  function currentModels() {
    return activeProvider === "codex" ? config.codexModels : config.models;
  }

  // 读取当前激活供应商对应的 Base URL。
  function currentBaseUrl() {
    return activeProvider === "codex" ? config.codexBaseUrl : config.baseUrl;
  }

  // 配置页通用静默保存：合并高频输入，避免逐字触发 IPC。
  function debouncedSave() {
    if (!config) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      const previousBalanceSource = lastSavedBalanceSource;
      invoke("save_config", { cfg: config })
        .then(function (saved) {
          config = saved;
          const nextBalanceSource = getBalanceSourceSnapshot(saved);
          const shouldRefreshBalance = hasBalanceSourceChanged(
            previousBalanceSource,
            nextBalanceSource,
          );
          lastSavedBalanceSource = nextBalanceSource;
          if (shouldRefreshBalance) {
            refreshBalance().catch(function (err) {
              console.error("保存后刷新余额失败", err);
            });
          }
        })
        .catch(function (err) {
          console.error("保存配置失败", err);
        });
    }, 400);
  }

  // 挂件显示配置静默保存：只提交 widget 子配置。
  function saveWidgetDebounced() {
    if (!config || !config.widget) return;
    if (widgetSaveTimer) clearTimeout(widgetSaveTimer);
    widgetSaveTimer = setTimeout(function () {
      invoke("save_widget_config", { widget: config.widget })
        .then(function (saved) {
          config.widget = saved;
        })
        .catch(function (err) {
          console.error("保存挂件配置失败", err);
        });
    }, 400);
  }

  // 台词配置静默保存：列表编辑时避免频繁落盘。
  function saveDialogueDebounced() {
    if (!config || !config.dialogue) return;
    if (dialogueSaveTimer) clearTimeout(dialogueSaveTimer);
    dialogueSaveTimer = setTimeout(function () {
      invoke("save_dialogue", { dialogue: config.dialogue })
        .then(function (saved) {
          config.dialogue = saved;
        })
        .catch(function (err) {
          console.error("保存台词失败", err);
        });
    }, 400);
  }

  function getBalanceSourceSnapshot(cfg) {
    return {
      apiKey: String((cfg && cfg.apiKey) || "").trim(),
      baseUrl: String((cfg && cfg.baseUrl) || "")
        .trim()
        .replace(/\/+$/, ""),
    };
  }

  function hasBalanceSourceChanged(previous, next) {
    if (!previous) return false;
    return previous.apiKey !== next.apiKey || previous.baseUrl !== next.baseUrl;
  }

  function renderBalancePayload(payload) {
    if (payload && payload.ok) {
      availableBalanceEl.textContent =
        "¥ " + Number(payload.totalBalance || 0).toFixed(2);
      todayUsageEl.textContent =
        "¥ " + Number(payload.todayUsage || 0).toFixed(2);
      return;
    }
    availableBalanceEl.textContent = "--";
    todayUsageEl.textContent = "--";
  }

  // 拉取余额概览并刷新配置页顶部摘要。
  function refreshBalance() {
    const requestSeq = ++balanceRequestSeq;
    return invoke("get_balance")
      .then(function (payload) {
        if (requestSeq !== balanceRequestSeq) return payload;
        renderBalancePayload(payload);
        return payload;
      })
      .catch(function (err) {
        if (requestSeq === balanceRequestSeq) {
          renderBalancePayload(null);
        }
        throw err;
      });
  }
  refreshBalance();
  setInterval(refreshBalance, 30000);

  // 将用户导入的自定义音效补充到下拉选项中。
  function restoreSoundOptions(w) {
    const custom = w && Array.isArray(w.customSounds) ? w.customSounds : [];
    const known = {};
    for (let i = 0; i < widgetSoundSetEl.options.length; i++) {
      known[widgetSoundSetEl.options[i].value] = true;
    }
    custom.forEach(function (path) {
      if (known[path]) return;
      const name = path.split(/[\\/]/).pop() || path;
      const opt = document.createElement("option");
      opt.value = path;
      opt.textContent = name;
      widgetSoundSetEl.appendChild(opt);
      known[path] = true;
    });
    const soundSet = typeof w.soundSet === "string" ? w.soundSet : "duck";
    widgetSoundSetEl.value = known[soundSet] ? soundSet : "duck";
  }

  // 把 widget 配置同步到表单控件。
  function applyWidgetToUi(w) {
    if (!w) return;
    config.widget = w;
    const level = scaleToNum(typeof w.scale === "number" ? w.scale : 1.5);
    widgetScaleEl.value = String(level);
    widgetScaleValEl.textContent = String(level);
    restoreSoundOptions(w);
    if (eventSoundsEl) eventSoundsEl.checked = w.eventSounds !== false;
    if (actionsEl) actionsEl.checked = w.actions !== false;
    if (randomActionsEl) randomActionsEl.checked = w.randomActions !== false;
    if (moodFiltersEl) moodFiltersEl.checked = w.moodFilters !== false;
    const hue = hueFromHex(w.bubbleColor || "#203170");
    bubbleColorEl.value = String(hue);
    const vol = typeof w.vol === "number" ? w.vol : 0.9;
    widgetVolEl.value = String(vol);
    widgetVolPctEl.textContent = Math.round(vol * 100) + "%";
    const blinkMin = Math.max(
      1,
      Math.floor(Number(w.blinkIntervalMinSec) || 4),
    );
    const blinkMax = Math.max(
      blinkMin,
      Math.floor(Number(w.blinkIntervalMaxSec) || 6),
    );
    w.blinkIntervalMinSec = blinkMin;
    w.blinkIntervalMaxSec = blinkMax;
    blinkIntervalMinSecEl.value = String(blinkMin);
    blinkIntervalMaxSecEl.value = String(blinkMax);
    blinkRangeLastChanged = null;
    w.exhaustedModeEnabled = w.exhaustedModeEnabled !== false;
    exhaustedModeEnabledEl.checked = w.exhaustedModeEnabled;
    const threshold =
      Math.round(Math.max(0, Number(w.exhaustedBalanceThreshold)) * 100) / 100;
    w.exhaustedBalanceThreshold = isFinite(threshold) ? threshold : 5;
    exhaustedBalanceThresholdEl.value = String(w.exhaustedBalanceThreshold);
  }

  function parseBlinkIntervalInputValue(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (!text) return null;
    const value = Math.floor(Number(text));
    if (!isFinite(value)) return null;
    return Math.max(1, value);
  }

  function isBlinkRangeInput(el) {
    return el === blinkIntervalMinSecEl || el === blinkIntervalMaxSecEl;
  }

  function saveBlinkRangeIfReady() {
    if (!config || !config.widget) return;
    const min = parseBlinkIntervalInputValue(blinkIntervalMinSecEl.value);
    const max = parseBlinkIntervalInputValue(blinkIntervalMaxSecEl.value);
    if (min === null || max === null || max < min) return;
    config.widget.blinkIntervalMinSec = min;
    config.widget.blinkIntervalMaxSec = max;
    saveWidgetDebounced();
  }

  function finalizeBlinkRange(changed) {
    if (!config || !config.widget) return;
    if (isBlinkRangeInput(document.activeElement)) return;

    let min = parseBlinkIntervalInputValue(blinkIntervalMinSecEl.value);
    let max = parseBlinkIntervalInputValue(blinkIntervalMaxSecEl.value);

    if (min === null) {
      min = Math.max(
        1,
        Math.floor(Number(config.widget.blinkIntervalMinSec) || 4),
      );
    }
    if (max === null) {
      max = Math.max(
        min,
        Math.floor(Number(config.widget.blinkIntervalMaxSec) || 6),
      );
    }
    if (changed === "min" && max < min) max = min;
    if (changed === "max" && min > max) min = max;

    config.widget.blinkIntervalMinSec = min;
    config.widget.blinkIntervalMaxSec = max;
    blinkIntervalMinSecEl.value = String(min);
    blinkIntervalMaxSecEl.value = String(max);
    saveWidgetDebounced();
  }

  // 归一化一条台词（兼容旧的纯字符串形态）。
  function normalizeLine(raw) {
    if (typeof raw === "string") {
      return { text: raw, tags: [], weight: 1, enabled: true };
    }
    if (raw && typeof raw === "object") {
      return {
        text: typeof raw.text === "string" ? raw.text : "",
        tags: Array.isArray(raw.tags) ? raw.tags.slice() : [],
        weight:
          typeof raw.weight === "number" && raw.weight > 0
            ? Math.floor(raw.weight)
            : 1,
        enabled: raw.enabled !== false,
      };
    }
    return { text: "", tags: [], weight: 1, enabled: true };
  }

  // 渲染台词列表编辑区（文本 + 分类 + 权重 + 启用）。
  function renderDialogueList() {
    if (!dialogueListEl || !config || !config.dialogue) return;
    dialogueListEl.innerHTML = "";
    const raw = config.dialogue.lines || [];
    // 首次渲染时把旧的纯字符串统一成对象，保证后续编辑结构一致。
    if (
      raw.some(function (l) {
        return typeof l === "string";
      })
    ) {
      config.dialogue.lines = raw.map(normalizeLine);
    }
    const lines = config.dialogue.lines || [];
    lines.forEach(function (line, idx) {
      const row = document.createElement("div");
      row.className = "dialogue-row";

      const enabled = document.createElement("input");
      enabled.type = "checkbox";
      enabled.checked = line.enabled !== false;
      enabled.title = "是否启用";
      enabled.addEventListener("change", function (e) {
        lines[idx].enabled = e.target.checked;
        saveDialogueDebounced();
      });

      const input = document.createElement("input");
      input.type = "text";
      input.className = "dialogue-input";
      input.value = line.text || "";
      input.placeholder = "台词…（可用 {balance} {today} {time} {period}）";
      input.addEventListener("input", function (e) {
        lines[idx].text = e.target.value;
        saveDialogueDebounced();
      });

      const tags = document.createElement("input");
      tags.type = "text";
      tags.className = "dialogue-tags";
      tags.value = (line.tags || []).join(",");
      tags.placeholder = "分类";
      tags.title = "逗号分隔：daily / greet / peak / offpeak / night / low / rich";
      tags.addEventListener("input", function (e) {
        lines[idx].tags = e.target.value
          .split(",")
          .map(function (t) {
            return t.trim();
          })
          .filter(function (t) {
            return t;
          });
        saveDialogueDebounced();
      });

      const weight = document.createElement("input");
      weight.type = "number";
      weight.className = "dialogue-weight";
      weight.min = "1";
      weight.step = "1";
      weight.value = String(line.weight || 1);
      weight.title = "权重（越大越容易被抽中）";
      weight.addEventListener("input", function (e) {
        lines[idx].weight = Math.max(1, Math.floor(Number(e.target.value) || 1));
        saveDialogueDebounced();
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "toggle-eye dialogue-del";
      del.textContent = "删除";
      del.addEventListener("click", function () {
        lines.splice(idx, 1);
        renderDialogueList();
        saveDialogueDebounced();
      });

      row.appendChild(enabled);
      row.appendChild(input);
      row.appendChild(tags);
      row.appendChild(weight);
      row.appendChild(del);
      dialogueListEl.appendChild(row);
    });
  }

  // 表情台词字段（与 Rust 侧 MoodLines 对齐）。
  var MOOD_FIELDS = [
    { key: "angry", label: "生气" },
    { key: "shy", label: "害羞" },
    { key: "disappointed", label: "失落" },
    { key: "back", label: "回弹" },
    { key: "lonely", label: "孤独轮播" },
    { key: "exhausted", label: "疲惫轮播" },
  ];

  // 渲染表情台词编辑区（每行一条）。
  function renderMoodLines(moodLines) {
    MOOD_FIELDS.forEach(function (field) {
      var el = document.getElementById("mood-" + field.key);
      if (!el) return;
      var list =
        moodLines && Array.isArray(moodLines[field.key]) ? moodLines[field.key] : [];
      el.value = list.join("\n");
    });
  }

  // 把台词配置同步到表单，并在缺省时补默认值。
  function applyDialogueToUi(dlg) {
    if (!dlg)
      dlg = {
        lines: DEFAULT_LINES.slice(),
        mode: "random",
        intervalMin: 5,
        jitter: 0,
      };
    config.dialogue = dlg;
    if (dialogueModeEl)
      dialogueModeEl.value =
        dlg.mode === "carousel" || dlg.mode === "random" ? dlg.mode : "random";
    if (dialogueIntervalEl)
      dialogueIntervalEl.value = String(dlg.intervalMin || 5);
    if (dialogueJitterEl) dialogueJitterEl.value = String(dlg.jitter || 0);
    if (dialogueJitterValEl)
      dialogueJitterValEl.textContent = (dlg.jitter || 0) + "%";
    if (dialogueContextEl) dialogueContextEl.checked = dlg.contextMode !== false;
    if (dialogueNoRepeatEl)
      dialogueNoRepeatEl.value = String(
        typeof dlg.noRepeat === "number" ? dlg.noRepeat : 3,
      );
    renderDialogueList();
    renderMoodLines(dlg.moodLines);
  }

  // 展开台词卡片，便于新增/重置后直接继续编辑。
  function expandDialogue() {
    if (dialogueCardEl) dialogueCardEl.classList.remove("collapsed");
    if (toggleDialogueEl) toggleDialogueEl.textContent = "收起";
  }

  // —— 模型预设（模型名 + 上下文窗口）——
  // 窗口大小取自本项目内置默认值；deepseek-v4-pro 的窗口未核实，用 0 表示「不自动填充」。
  var MODEL_CATALOG = [
    { name: "deepseek-v4-flash", window: 1000000 },
    { name: "deepseek-flash", window: 1000000 },
    { name: "deepseek-v4-flash-vision-exp", window: 1000000 },
    { name: "deepseek-v4-pro", window: 0 },
  ];

  function catalogWindow(name) {
    for (var i = 0; i < MODEL_CATALOG.length; i++) {
      if (MODEL_CATALOG[i].name === name) return MODEL_CATALOG[i].window;
    }
    return 0;
  }

  // 填充模型名下拉候选（datalist 仅作建议，仍可自由输入）。
  function fillModelCatalog() {
    if (!modelCatalogEl) return;
    modelCatalogEl.innerHTML = "";
    MODEL_CATALOG.forEach(function (item) {
      const opt = document.createElement("option");
      opt.value = item.name;
      if (item.window > 0) opt.label = item.window + " token";
      modelCatalogEl.appendChild(opt);
    });
  }

  // 渲染额外槽位编辑区。
  function renderExtraSlots() {
    if (!extraSlotsEl || !config) return;
    const slots = currentModels().extraSlots || [];
    extraSlotsEl.innerHTML = "";
    if (!slots.length) {
      const empty = document.createElement("div");
      empty.className = "slot-empty";
      empty.textContent = "（暂无额外槽位；写入 Claude 配置时为 ANTHROPIC_DEFAULT_<KEY>_MODEL）";
      extraSlotsEl.appendChild(empty);
      return;
    }
    slots.forEach(function (slot, idx) {
      const row = document.createElement("div");
      row.className = "slot-row";

      const enabled = document.createElement("input");
      enabled.type = "checkbox";
      enabled.checked = slot.enabled !== false;
      enabled.title = "是否写入客户端配置";
      enabled.addEventListener("change", function (e) {
        slots[idx].enabled = e.target.checked;
        debouncedSave();
      });

      const key = document.createElement("input");
      key.type = "text";
      key.className = "slot-key";
      key.placeholder = "key";
      key.value = slot.key || "";
      key.addEventListener("input", function (e) {
        slots[idx].key = e.target.value.trim();
        debouncedSave();
      });

      const name = document.createElement("input");
      name.type = "text";
      name.className = "model-input";
      name.placeholder = "模型名称";
      name.setAttribute("list", "modelCatalog");
      name.value = slot.name || "";
      name.addEventListener("input", function (e) {
        const value = e.target.value.trim();
        slots[idx].name = value;
        const presetWindow = catalogWindow(value);
        if (presetWindow > 0) {
          slots[idx].contextWindow = presetWindow;
          ctx.value = String(presetWindow);
        }
        debouncedSave();
      });

      const ctx = document.createElement("input");
      ctx.type = "number";
      ctx.className = "model-ctx";
      ctx.min = "1";
      ctx.step = "1";
      ctx.value = slot.contextWindow || "";
      ctx.addEventListener("input", function (e) {
        slots[idx].contextWindow = Math.max(1, Math.floor(Number(e.target.value) || 0));
        debouncedSave();
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "toggle-eye slot-del";
      del.textContent = "删除";
      del.addEventListener("click", function () {
        slots.splice(idx, 1);
        renderExtraSlots();
        debouncedSave();
      });

      row.appendChild(enabled);
      row.appendChild(key);
      row.appendChild(name);
      row.appendChild(ctx);
      row.appendChild(del);
      extraSlotsEl.appendChild(row);
    });
  }

  // Codex 专属写入项：仅在 Codex 供应商下显示。
  function applyCodexOptions() {
    if (!config) return;
    if (codexEffortEl) codexEffortEl.value = config.codexReasoningEffort || "high";
    if (codexWireApiEl) codexWireApiEl.value = config.codexWireApi || "chat";
    if (codexDisableStorageEl) {
      codexDisableStorageEl.checked = config.codexDisableResponseStorage !== false;
    }
    if (codexOptionsEl) codexOptionsEl.hidden = activeProvider !== "codex";
  }

  // 多套配置方案列表。
  function renderProfiles() {
    if (!profileSelectEl || !config) return;
    const profiles = config.profiles || [];
    profileSelectEl.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = profiles.length ? "（未选择）" : "（暂无方案，先「另存为」）";
    profileSelectEl.appendChild(none);
    profiles.forEach(function (p) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      profileSelectEl.appendChild(opt);
    });
    profileSelectEl.value = config.activeProfile || "";
  }

  // 渲染当前供应商的模型配置。
  function renderModels() {
    if (!config) return;
    baseUrlEl.value = currentBaseUrl() || "";
    document.querySelectorAll(".model-row").forEach(function (row) {
      const key = row.dataset.model;
      const m = currentModels()[key];
      row.querySelector('[data-field="name"]').value = (m && m.name) || "";
      row.querySelector('[data-field="contextWindow"]').value =
        (m && m.contextWindow) || "";
    });
    provClaudeEl.classList.toggle("active", activeProvider === "claude");
    provCodexEl.classList.toggle("active", activeProvider === "codex");
    renderExtraSlots();
    applyCodexOptions();
    renderProfiles();
  }

  function switchProvider(provider) {
    if (activeProvider === provider) return;
    activeProvider = provider;
    renderModels();
  }
  provClaudeEl.addEventListener("click", function () {
    switchProvider("claude");
  });
  provCodexEl.addEventListener("click", function () {
    switchProvider("codex");
  });

  fillModelCatalog();

  // 首次加载完整配置并回填全部表单。
  invoke("get_config")
    .then(function (cfg) {
      config = cfg;
      lastSavedBalanceSource = getBalanceSourceSnapshot(cfg);
      apiKeyEl.value = cfg.apiKey || "";
      autostartEl.checked = !!cfg.autostart;
      const ghue = hueFromHex(cfg.globalColor || "#203170");
      globalColorEl.value = String(ghue);
      applyGlobalColor(cfg.globalColor || "#203170");
      applyWidgetToUi(cfg.widget || {});
      applyDialogueToUi(cfg.dialogue);
      renderModels();
    })
    .catch(function (err) {
      console.error("加载配置失败", err);
    });

  // 接收配置窗口外部更新，保持表单与挂件显示同步。
  if (window.__TAURI__ && window.__TAURI__.event) {
    window.__TAURI__.event.listen("widget-config-changed", function (e) {
      if (!config) return;
      applyWidgetToUi(e.payload);
    });
  }

  apiKeyEl.addEventListener("input", function (e) {
    config.apiKey = e.target.value.trim();
    debouncedSave();
  });

  baseUrlEl.addEventListener("input", function (e) {
    const v = e.target.value.trim();
    if (activeProvider === "codex") config.codexBaseUrl = v;
    else config.baseUrl = v;
    debouncedSave();
  });

  toggleKeyEl.addEventListener("click", function () {
    const showing = apiKeyEl.type === "text";
    apiKeyEl.type = showing ? "password" : "text";
    toggleKeyEl.textContent = showing ? "显示" : "隐藏";
  });

  document.querySelectorAll(".model-row").forEach(function (row) {
    const key = row.dataset.model;
    row
      .querySelector('[data-field="name"]')
      .addEventListener("input", function (e) {
        const m = currentModels()[key];
        const value = e.target.value.trim();
        if (m) m.name = value;
        // 命中预设时自动带出上下文窗口（仍可手动改回）。
        const presetWindow = catalogWindow(value);
        if (presetWindow > 0 && m && m.contextWindow !== presetWindow) {
          m.contextWindow = presetWindow;
          const ctxInput = row.querySelector('[data-field="contextWindow"]');
          if (ctxInput) ctxInput.value = String(presetWindow);
        }
        debouncedSave();
      });
    row
      .querySelector('[data-field="contextWindow"]')
      .addEventListener("input", function (e) {
        const v = Math.max(1, Math.floor(Number(e.target.value) || 0));
        const m = currentModels()[key];
        if (m) m.contextWindow = v;
        debouncedSave();
      });
  });

  // —— 额外槽位 / Codex 写入项 / 配置方案 的交互 ——
  if (addSlotEl)
    addSlotEl.addEventListener("click", function () {
      if (!config) return;
      const models = currentModels();
      if (!Array.isArray(models.extraSlots)) models.extraSlots = [];
      models.extraSlots.push({
        key: "",
        label: "",
        name: "",
        contextWindow: 1000000,
        enabled: true,
      });
      renderExtraSlots();
      debouncedSave();
    });

  if (codexEffortEl)
    codexEffortEl.addEventListener("change", function (e) {
      config.codexReasoningEffort = e.target.value;
      debouncedSave();
    });

  if (codexWireApiEl)
    codexWireApiEl.addEventListener("change", function (e) {
      config.codexWireApi = e.target.value;
      debouncedSave();
    });

  if (codexDisableStorageEl)
    codexDisableStorageEl.addEventListener("change", function (e) {
      config.codexDisableResponseStorage = e.target.checked;
      debouncedSave();
    });

  if (profileSelectEl)
    profileSelectEl.addEventListener("change", function (e) {
      const id = e.target.value;
      if (!id) return;
      invoke("apply_profile", { id: id })
        .then(function (cfg) {
          config = cfg;
          lastSavedBalanceSource = getBalanceSourceSnapshot(cfg);
          apiKeyEl.value = cfg.apiKey || "";
          baseUrlEl.value = currentBaseUrl() || "";
          applyWidgetToUi(cfg.widget || {});
          renderModels();
          showTip("已切换到「" + (cfg.activeProfile || id) + "」");
        })
        .catch(function (err) {
          console.error("切换配置失败", err);
          showTip("切换配置失败");
        });
    });

  if (saveProfileEl)
    saveProfileEl.addEventListener("click", function () {
      const name = profileNameEl ? profileNameEl.value.trim() : "";
      invoke("save_profile", { name: name })
        .then(function (cfg) {
          config = cfg;
          renderProfiles();
          showTip("已保存配置方案");
        })
        .catch(function (err) {
          console.error("保存配置失败", err);
          showTip("保存配置失败");
        });
    });

  if (deleteProfileEl)
    deleteProfileEl.addEventListener("click", function () {
      const id = profileSelectEl ? profileSelectEl.value : "";
      if (!id) {
        showTip("请先选择一个方案");
        return;
      }
      invoke("delete_profile", { id: id })
        .then(function (cfg) {
          config = cfg;
          renderProfiles();
          showTip("已删除配置方案");
        })
        .catch(function (err) {
          console.error("删除配置失败", err);
          showTip("删除配置失败");
        });
    });

  // 滑杆档位映射为实际缩放倍率后再保存。
  widgetScaleEl.addEventListener("input", function (e) {
    const level = Math.max(
      LEVEL_MIN,
      Math.min(LEVEL_MAX, Math.round(Number(e.target.value) || LEVEL_MIN)),
    );
    config.widget.scale = Math.round(numToScale(level) * 10) / 10;
    widgetScaleValEl.textContent = String(level);
    saveWidgetDebounced();
  });

  widgetSoundSetEl.addEventListener("change", function (e) {
    config.widget.soundSet = e.target.value;
    saveWidgetDebounced();
  });

  if (eventSoundsEl)
    eventSoundsEl.addEventListener("change", function (e) {
      config.widget.eventSounds = e.target.checked;
      saveWidgetDebounced();
    });

  if (actionsEl)
    actionsEl.addEventListener("change", function (e) {
      config.widget.actions = e.target.checked;
      saveWidgetDebounced();
    });

  if (randomActionsEl)
    randomActionsEl.addEventListener("change", function (e) {
      config.widget.randomActions = e.target.checked;
      saveWidgetDebounced();
    });

  if (moodFiltersEl)
    moodFiltersEl.addEventListener("change", function (e) {
      config.widget.moodFilters = e.target.checked;
      saveWidgetDebounced();
    });

  // 新增台词后直接聚焦最后一项，便于连续录入。
  if (addLineEl)
    addLineEl.addEventListener("click", function () {
      if (!config || !config.dialogue) return;
      expandDialogue();
      config.dialogue.lines.push("");
      renderDialogueList();
      saveDialogueDebounced();
      const inputs = dialogueListEl.querySelectorAll(".dialogue-input");
      if (inputs.length) inputs[inputs.length - 1].focus();
    });

  // 一键恢复默认台词集合（默认文案以 Rust 侧为唯一数据源）。
  if (resetLinesEl)
    resetLinesEl.addEventListener("click", function () {
      if (!config) return;
      expandDialogue();
      invoke("reset_dialogue")
        .then(function (dlg) {
          applyDialogueToUi(dlg);
          saveDialogueDebounced();
          showTip("已恢复默认台词（含分类与表情台词）");
        })
        .catch(function (err) {
          console.error("恢复默认台词失败", err);
          // 兜底：用界面内置列表，至少不让按钮失效。
          if (!config.dialogue) return;
          config.dialogue.lines = DEFAULT_LINES.slice();
          renderDialogueList();
          saveDialogueDebounced();
        });
    });

  if (dialogueModeEl)
    dialogueModeEl.addEventListener("change", function (e) {
      if (!config || !config.dialogue) return;
      config.dialogue.mode = e.target.value;
      saveDialogueDebounced();
    });

  if (dialogueIntervalEl)
    dialogueIntervalEl.addEventListener("input", function (e) {
      if (!config || !config.dialogue) return;
      const v = Math.max(1, Math.floor(Number(e.target.value) || 1));
      config.dialogue.intervalMin = v;
      dialogueIntervalEl.value = String(v);
      saveDialogueDebounced();
    });

  if (dialogueJitterEl)
    dialogueJitterEl.addEventListener("input", function (e) {
      if (!config || !config.dialogue) return;
      const v = Math.max(
        0,
        Math.min(100, Math.round(Number(e.target.value) || 0)),
      );
      config.dialogue.jitter = v;
      dialogueJitterValEl.textContent = v + "%";
      saveDialogueDebounced();
    });

  if (dialogueContextEl)
    dialogueContextEl.addEventListener("change", function (e) {
      if (!config || !config.dialogue) return;
      config.dialogue.contextMode = e.target.checked;
      saveDialogueDebounced();
    });

  if (dialogueNoRepeatEl)
    dialogueNoRepeatEl.addEventListener("input", function (e) {
      if (!config || !config.dialogue) return;
      config.dialogue.noRepeat = Math.max(
        0,
        Math.floor(Number(e.target.value) || 0),
      );
      saveDialogueDebounced();
    });

  // 表情台词：每个 textarea 一行一条。
  MOOD_FIELDS.forEach(function (field) {
    var el = document.getElementById("mood-" + field.key);
    if (!el) return;
    el.addEventListener("input", function (e) {
      if (!config || !config.dialogue) return;
      if (!config.dialogue.moodLines) config.dialogue.moodLines = {};
      config.dialogue.moodLines[field.key] = e.target.value
        .split("\n")
        .map(function (t) {
          return t.trim();
        })
        .filter(function (t) {
          return t;
        });
      saveDialogueDebounced();
    });
  });

  if (toggleDialogueEl)
    toggleDialogueEl.addEventListener("click", function () {
      const collapsed = dialogueCardEl.classList.toggle("collapsed");
      toggleDialogueEl.textContent = collapsed ? "展开" : "收起";
    });

  // 色相滑杆 -> Hex 主题色。
  function hexFromHue(hue) {
    // 简单 HSL(hue, 62%, 42%) → rgb → hex（中等偏浅饱和度）。
    const s = 0.62,
      l = 0.42;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
      g = 0,
      b = 0;
    if (hue < 60) {
      r = c;
      g = x;
    } else if (hue < 120) {
      r = x;
      g = c;
    } else if (hue < 180) {
      g = c;
      b = x;
    } else if (hue < 240) {
      g = x;
      b = c;
    } else if (hue < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    const to = function (v) {
      return Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, "0");
    };
    return "#" + to(r) + to(g) + to(b);
  }

  // Hex 主题色 -> 色相滑杆值。
  function hueFromHex(hex) {
    if (!hex) return 220;
    const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex));
    if (!m) return 220;
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d === 0) h = 0;
    else if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    return h;
  }

  // 把全局主题色写回 CSS 变量，驱动配置页配色。
  function applyGlobalColor(color) {
    document.documentElement.style.setProperty("--primary", color);
    document.documentElement.style.setProperty("--text", color);
    document.documentElement.style.setProperty("--primary-2", color);
    document.documentElement.style.setProperty("--muted", color);
    document.documentElement.style.setProperty("--border", color + "26");
  }

  if (addCustomSoundEl)
    addCustomSoundEl.addEventListener("click", function () {
      invoke("pick_audio_file")
        .then(function (path) {
          if (!path) return;
          config.widget.customSounds = config.widget.customSounds || [];
          if (config.widget.customSounds.indexOf(path) === -1)
            config.widget.customSounds.push(path);
          const name = path.split(/[\\/]/).pop() || path;
          const opt = document.createElement("option");
          opt.value = path;
          opt.textContent = name;
          widgetSoundSetEl.appendChild(opt);
          widgetSoundSetEl.value = path;
          config.widget.soundSet = path;
          saveWidgetDebounced();
        })
        .catch(function (err) {
          console.error("选择音效失败", err);
        });
    });

  // 配置页主色实时预览并静默保存。
  if (globalColorEl)
    globalColorEl.addEventListener("input", function (e) {
      const hue = Number(e.target.value) || 0;
      const color = hexFromHue(hue);
      config.globalColor = color;
      applyGlobalColor(color);
      debouncedSave();
    });

  if (bubbleColorEl)
    bubbleColorEl.addEventListener("input", function (e) {
      const hue = Number(e.target.value) || 0;
      const color = hexFromHue(hue);
      config.widget.bubbleColor = color;
      saveWidgetDebounced();
    });

  const DEFAULT_COLOR = "#203170";
  // 同步重置全局主题色与气泡描边色。
  if (resetColorEl)
    resetColorEl.addEventListener("click", function () {
      config.globalColor = DEFAULT_COLOR;
      config.widget.bubbleColor = DEFAULT_COLOR;
      const defaultHue = hueFromHex(DEFAULT_COLOR);
      if (globalColorEl) globalColorEl.value = String(defaultHue);
      if (bubbleColorEl) bubbleColorEl.value = String(defaultHue);
      applyGlobalColor(DEFAULT_COLOR);
      debouncedSave();
      saveWidgetDebounced();
    });

  widgetVolEl.addEventListener("input", function (e) {
    const v =
      Math.round(Math.min(1, Math.max(0, Number(e.target.value))) * 100) / 100;
    config.widget.vol = v;
    widgetVolPctEl.textContent = Math.round(v * 100) + "%";
    saveWidgetDebounced();
  });

  if (blinkIntervalMinSecEl)
    blinkIntervalMinSecEl.addEventListener("input", function () {
      blinkRangeLastChanged = "min";
      saveBlinkRangeIfReady();
    });

  if (blinkIntervalMaxSecEl)
    blinkIntervalMaxSecEl.addEventListener("input", function () {
      blinkRangeLastChanged = "max";
      saveBlinkRangeIfReady();
    });

  if (blinkIntervalMinSecEl)
    blinkIntervalMinSecEl.addEventListener("blur", function () {
      const changed = blinkRangeLastChanged || "min";
      setTimeout(function () {
        finalizeBlinkRange(changed);
      }, 0);
    });

  if (blinkIntervalMaxSecEl)
    blinkIntervalMaxSecEl.addEventListener("blur", function () {
      const changed = blinkRangeLastChanged || "max";
      setTimeout(function () {
        finalizeBlinkRange(changed);
      }, 0);
    });

  if (exhaustedModeEnabledEl)
    exhaustedModeEnabledEl.addEventListener("change", function (e) {
      config.widget.exhaustedModeEnabled = !!e.target.checked;
      saveWidgetDebounced();
    });

  if (exhaustedBalanceThresholdEl)
    exhaustedBalanceThresholdEl.addEventListener("input", function (e) {
      const v =
        Math.round(Math.max(0, Number(e.target.value) || 0) * 100) / 100;
      config.widget.exhaustedBalanceThreshold = v;
      exhaustedBalanceThresholdEl.value = String(v);
      saveWidgetDebounced();
    });

  autostartEl.addEventListener("change", function (e) {
    if (!config || autostartPending) {
      e.target.checked = !!(config && config.autostart);
      return;
    }
    const enabled = e.target.checked;
    autostartPending = true;
    autostartEl.disabled = true;
    invoke("set_autostart", { enabled: enabled })
      .then(function (actual) {
        const next = !!actual;
        config.autostart = next;
        autostartEl.checked = next;
        if (enabled && !next) {
          showTip("开机自启未生效，可能已被系统或安全软件拦截。");
        }
        if (!enabled && next) {
          showTip("开机自启仍处于开启状态，请检查系统启动项或安全软件。");
        }
      })
      .catch(function (err) {
        e.target.checked = !enabled;
        console.error("设置开机自启失败", err);
        showTip("设置开机自启失败，请稍后重试。");
      })
      .finally(function () {
        autostartPending = false;
        autostartEl.disabled = false;
      });
  });

  // 统一关闭提示/确认弹窗。
  function hideModal() {
    modalOverlayEl.hidden = true;
    tipModalEl.hidden = true;
    confirmModalEl.hidden = true;
  }

  // 展示单确认按钮的提示弹窗。
  function showTip(message) {
    tipMsgEl.textContent = message;
    confirmModalEl.hidden = true;
    tipModalEl.hidden = false;
    modalOverlayEl.hidden = false;
  }

  // 展示带确认操作的弹窗。
  function showConfirm(message) {
    confirmMsgEl.textContent = message;
    tipModalEl.hidden = true;
    confirmModalEl.hidden = false;
    modalOverlayEl.hidden = false;
  }

  tipOkEl.addEventListener("click", hideModal);
  confirmNoEl.addEventListener("click", hideModal);

  modalOverlayEl.addEventListener("click", function (e) {
    if (e.target === modalOverlayEl) hideModal();
  });

  confirmYesEl.addEventListener("click", function () {
    hideModal();
    invoke("open_external", {
      url: "https://github.com/Yumiko-rin/DeepSeek-Whale-widget-desktop/releases/latest",
    }).catch(function (err) {
      console.error("打开外部链接失败", err);
    });
  });

  if (tutorialEl)
    tutorialEl.addEventListener("click", function (e) {
      e.preventDefault();
      invoke("open_external", {
        url: "https://github.com/Yumiko-rin/DeepSeek-Whale-widget-desktop#readme",
      }).catch(function (err) {
        console.error("打开外部链接失败", err);
      });
    });

  // 检查更新后根据结果切换提示或确认弹窗（有新版 / 已最新 / 本地版本更新三种关系）。
  checkUpdateEl.addEventListener("click", function () {
    invoke("check_update")
      .then(function (res) {
        if (!res || typeof res.hasUpdate !== "boolean") {
          showTip("检查更新失败");
          return;
        }
        const cur = res.currentVersion || "?";
        const latest = res.latestVersion || "?";
        if (res.hasUpdate) {
          showConfirm(
            "发现新版本 v" + latest + "（当前 v" + cur + "），是否前往下载？",
          );
        } else if (res.upToDate) {
          showTip("当前已是最新版本 v" + cur);
        } else {
          showTip(
            "你使用的是较新的本地版本 v" + cur + "（线上最新 v" + latest + "）",
          );
        }
      })
      .catch(function (err) {
        console.error("检查更新失败", err);
        showTip("检查更新失败");
      });
  });
})();
