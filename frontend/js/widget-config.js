// 小鲸鱼余额挂件 · 显示配置与台词调度模块
//
// 负责应用挂件显示配置（缩放/音量/音效/气泡颜色）、保存配置、
// 以及台词配置的应用与定时调度。
// 依赖：core.js（DSW.invoke/DSW.state/DSW.flags/DSW.C）、
//       audio.js（DSW.audio，运行时调用）、balance.js（DSW.balance.clamp）、
//       bubble.js（DSW.bubble.showDialogueLine，运行时调用）。

window.DSW = window.DSW || {};

(function (DSW) {
  "use strict";

  if (DSW.widgetConfig) return;

  var C = DSW.C;
  var state = DSW.state;
  var flags = DSW.flags;
  var EXHAUSTED_LINES = [
    "额度快见底了，省着点花喵…",
    "本鲸已经有点转不动了…",
    "余额薄得像尾巴尖了…",
    "再这样下去要喝西北风啦…",
    "我闻到贫穷的海风了喵。",
    "今天先克制一点点，好吗？",
    "钱包在打喷嚏，是真的。",
    "余额快瘦成一条线了…",
    "本鲸的工作餐要保不住了。",
    "别再连点了，额度会哭的。",
    "这个数额，看着有点心慌…",
    "再冲动消费，本鲸就躺平了。",
    "现在适合精打细算模式。",
    "我已经自动切到省电表情了。",
    "先缓一缓，明天再战也行。",
    "余额这么低，本鲸都不敢翻身。",
    "这点额度，只够我眨两次眼…",
    "理智一点，别让账单追上来。",
    "本鲸建议你先补充一点预算。",
    "再不回点血，就真要疲惫了喵。",
  ];

  function clampInt(v, fallback, min) {
    var num = Math.floor(Number(v));
    if (!isFinite(num)) return fallback;
    return Math.max(min || 0, num);
  }

  function clampThreshold(v) {
    var num = Math.round(Math.max(0, Number(v)) * 100) / 100;
    return isFinite(num) ? num : 5;
  }

  function canShowAutoSpeech() {
    return !(
      flags.clickBubbleActive ||
      flags.bubbleShown ||
      flags.pressing ||
      (flags.drag && flags.drag.active)
    );
  }

  function applyBlinkConfig(minSec, maxSec) {
    var min = clampInt(minSec, 4, 1);
    var max = clampInt(maxSec, 6, 1);
    flags.blinkIntervalMinSec = min;
    flags.blinkIntervalMaxSec = Math.max(min, max);
  }

  function applyExhaustedConfig(enabled, threshold) {
    flags.exhaustedModeEnabled = enabled !== false;
    flags.exhaustedBalanceThreshold = clampThreshold(threshold);
  }

  // 应用缩放（通过 Tauri 触发窗口 resize）。
  function applyScale(v) {
    const next =
      Math.round(Math.min(C.MAX_SCALE, Math.max(C.MIN_SCALE, Number(v))) * 10) / 10;
    if (next === state.scale) return;
    state.scale = next;
    if (DSW.invoke) DSW.invoke("resize_widget", { scale: next }).catch(function () {});
  }

  // 应用音量。
  function applyVol(v) {
    const next = Math.round(Math.min(1, Math.max(0, Number(v))) * 100) / 100;
    flags.soundVol = next;
    flags.soundOn = next > 0;
    try {
      if (flags.pressAudio) flags.pressAudio.volume = next;
      if (flags.releaseAudio) flags.releaseAudio.volume = next;
    } catch (err) {}
  }

  // 应用音效组配置。
  function applySoundSetFromConfig(v) {
    if (C.SOUND_SETS[v]) flags.soundSet = v;
    else if (typeof v === "string" && v)
      flags.soundSet = v; // 自定义音频文件路径（单文件同时用于按下/松开）
    else flags.soundSet = "duck";
    DSW.audio.applySoundSet();
  }

  // 应用气泡描边/文字颜色。
  function applyBubbleColor(color) {
    if (!color) return;
    document
      .querySelectorAll(".dshwv-bshape, .dshwv-b1, .dshwv-b2")
      .forEach(function (el) {
        el.setAttribute("stroke", color);
      });
    const textEl = document.querySelector(".dshwv-text");
    if (textEl) textEl.style.color = color;
  }

  // 应用挂件显示配置。
  function applyWidgetConfig(w) {
    if (!w) return;
    if (
      typeof w.scale === "number" &&
      w.scale >= C.MIN_SCALE - 0.1 &&
      w.scale <= C.MAX_SCALE + 0.1
    ) {
      if (Math.abs(w.scale - state.scale) > 0.001) applyScale(w.scale);
    }
    if (typeof w.vol === "number") {
      applyVol(w.vol);
    }
    if (typeof w.soundSet === "string") {
      applySoundSetFromConfig(w.soundSet);
    }
    if (typeof w.bubbleColor === "string") {
      flags.bubbleColor = w.bubbleColor;
      applyBubbleColor(w.bubbleColor);
    }
    if (Array.isArray(w.customSounds)) flags.customSounds = w.customSounds;
    flags.soundOn = w.sound !== false;
    // 事件音效总开关（缺省开启，兼容旧配置）。
    flags.eventSounds = w.eventSounds !== false;
    // 动作动效与随机小动作（缺省开启）。
    flags.actions = w.actions !== false;
    flags.randomActions = w.randomActions !== false;
    if (DSW.actions) DSW.actions.setEnabled(flags.actions);
    applyBlinkConfig(w.blinkIntervalMinSec, w.blinkIntervalMaxSec);
    applyExhaustedConfig(w.exhaustedModeEnabled, w.exhaustedBalanceThreshold);
    if (DSW.expression && DSW.expression.handleWidgetConfigChange) {
      DSW.expression.handleWidgetConfigChange();
    }
  }

  // 保存挂件显示配置到后端。
  function saveConfig() {
    if (!DSW.invoke) return;
    DSW.invoke("save_widget_config", {
      widget: {
        scale: state.scale,
        sound: flags.soundOn,
        vol: flags.soundVol,
        soundSet: flags.soundSet,
        bubbleColor: flags.bubbleColor,
        customSounds: flags.customSounds,
        blinkIntervalMinSec: flags.blinkIntervalMinSec,
        blinkIntervalMaxSec: flags.blinkIntervalMaxSec,
        exhaustedModeEnabled: flags.exhaustedModeEnabled,
        exhaustedBalanceThreshold: flags.exhaustedBalanceThreshold,
        eventSounds: flags.eventSounds,
        actions: flags.actions,
        randomActions: flags.randomActions,
      },
    }).catch(function () {});
  }

  // 归一化一条台词：兼容旧的纯字符串与新的对象（文本 + 分类 + 权重 + 开关）两种形态。
  function normalizeDialogueLine(raw) {
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
    return null;
  }

  // 占位符插值：{balance} {today} {time} {date} {period} {mood}
  function interpolate(text) {
    if (!text || text.indexOf("{") === -1) return text;
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    var now = new Date();
    var map = {
      balance:
        state.balance === null || state.balance === undefined
          ? "--"
          : DSW.balance.fmt(state.balance, state.currency),
      today:
        state.todayUsage === null || state.todayUsage === undefined
          ? "--"
          : DSW.balance.fmt(state.todayUsage, state.currency),
      time: pad(now.getHours()) + ":" + pad(now.getMinutes()),
      date:
        now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()),
      period: state.isPeak ? "高峰时段" : "空闲时段",
      mood: flags.mood,
    };
    return text.replace(/\{(\w+)\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(map, key) ? String(map[key]) : whole;
    });
  }

  // 当前情境标签，供「按情境选句」筛选与加权。
  function contextTags() {
    var tags = [state.isPeak ? "peak" : "offpeak"];
    var hour = new Date().getHours();
    if (hour >= 23 || hour < 6) tags.push("night");
    var balance = Number(state.balance);
    if (isFinite(balance)) {
      if (balance < flags.exhaustedBalanceThreshold) tags.push("low");
      else if (balance >= 50) tags.push("rich");
    }
    return tags;
  }

  // 通用分类：任何情境都可出现，不会被情境筛选剔除。
  var UNIVERSAL_TAGS = ["daily", "greet"];

  // 按权重抽一条（使用带情境加成的权重）。
  function pickWeighted(pool) {
    if (!pool.length) return null;
    var total = 0;
    pool.forEach(function (line) {
      total += lineWeight(line);
    });
    var roll = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      roll -= lineWeight(pool[i]);
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // 命中当前情境的分类获得权重加成，让「深夜 / 谷价 / 余额低」这类台词更容易出现。
  function lineWeight(line) {
    var base = Math.max(1, line.weight || 1);
    if (!flags.dialogueContextMode || !line.tags || !line.tags.length) return base;
    var situation = contextTags();
    var hit = line.tags.some(function (t) {
      return situation.indexOf(t) !== -1;
    });
    return hit ? base * 3 : base;
  }

  // 可用台词池：未分类，或命中「情境 ∪ 通用」分类的启用台词。
  function availableLines() {
    var enabled = flags.dialogueLines.filter(function (line) {
      return line.enabled !== false;
    });
    if (!flags.dialogueContextMode) return enabled;
    var tags = contextTags().concat(UNIVERSAL_TAGS);
    var matched = enabled.filter(function (line) {
      if (!line.tags || !line.tags.length) return true; // 未分类＝通用
      return line.tags.some(function (t) {
        return tags.indexOf(t) !== -1;
      });
    });
    return matched.length ? matched : enabled;
  }

  // 应用台词配置。
  function applyDialogueConfig(dlg) {
    if (!dlg) return;
    const list = Array.isArray(dlg.lines) ? dlg.lines : [];
    flags.dialogueLines = list.map(normalizeDialogueLine).filter(function (line) {
      return line && line.text;
    });
    flags.dialogueMode =
      dlg.mode === "carousel" || dlg.mode === "random" ? dlg.mode : "random";
    flags.dialogueIntervalMin =
      typeof dlg.intervalMin === "number" && dlg.intervalMin >= 1
        ? dlg.intervalMin
        : 5;
    flags.dialogueJitter =
      typeof dlg.jitter === "number" ? DSW.balance.clamp(dlg.jitter, 0, 100) : 0;
    flags.dialogueContextMode = dlg.contextMode !== false;
    flags.dialogueNoRepeat =
      typeof dlg.noRepeat === "number" && dlg.noRepeat >= 0
        ? Math.floor(dlg.noRepeat)
        : 3;
    flags.moodLines = dlg.moodLines || null;
    flags.dialogueIndex = 0;
    flags.recentLines = [];
    // 新配置生效后重新排期，避免沿用旧 timer。
    scheduleNextDialogue();
  }

  // 计算下一条台词的延迟毫秒数。
  function nextDialogueDelayMs() {
    const base = flags.dialogueIntervalMin * 60000;
    const jitterFrac = (flags.dialogueJitter / 100) * 0.8;
    const min = base * (1 - jitterFrac);
    const delay = min + Math.random() * (base - min);
    return Math.round(delay);
  }

  // 选择下一条台词（random / carousel），并遵守「最近 N 条不重复」。
  function pickDialogueLine() {
    var pool = availableLines();
    if (!pool.length) return null;
    var limit = flags.dialogueNoRepeat || 0;
    var recent = flags.recentLines || [];
    if (limit > 0 && pool.length > 1) {
      var filtered = pool.filter(function (line) {
        return recent.indexOf(line.text) === -1;
      });
      if (filtered.length) pool = filtered;
    }
    var line =
      flags.dialogueMode === "random"
        ? pickWeighted(pool)
        : pool[flags.dialogueIndex % pool.length];
    if (!line) return null;
    if (flags.dialogueMode !== "random") {
      flags.dialogueIndex = (flags.dialogueIndex + 1) % pool.length;
    }
    recent.push(line.text);
    while (recent.length > Math.max(0, limit)) recent.shift();
    flags.recentLines = recent;
    return interpolate(line.text);
  }

  // 即时反馈用：从全部启用台词里按权重取一条。
  function pickRandomDialogueLine() {
    var enabled = flags.dialogueLines.filter(function (line) {
      return line.enabled !== false;
    });
    var line = pickWeighted(enabled);
    return line ? interpolate(line.text) : null;
  }

  // 取表情台词（angry / shy / disappointed / lonely / exhausted / back），供 expression.js 使用。
  function pickMoodLine(kind, fallback) {
    var pool =
      flags.moodLines && Array.isArray(flags.moodLines[kind])
        ? flags.moodLines[kind]
        : null;
    if (!pool || !pool.length) return fallback || null;
    return interpolate(pool[Math.floor(Math.random() * pool.length)]);
  }

  // 暂停台词调度。
  function pauseDialogue() {
    if (flags.dialogueTimer) {
      clearTimeout(flags.dialogueTimer);
      flags.dialogueTimer = null;
    }
  }

  function pickExhaustedPromptLine() {
    // 优先用可编辑的配置台词，缺失时回落到内置默认。
    var pool =
      flags.moodLines && Array.isArray(flags.moodLines.exhausted) && flags.moodLines.exhausted.length
        ? flags.moodLines.exhausted
        : EXHAUSTED_LINES;
    if (!pool.length) return null;
    var text = pool[flags.exhaustedPromptIndex % pool.length];
    flags.exhaustedPromptIndex =
      (flags.exhaustedPromptIndex + 1) % pool.length;
    return interpolate(text);
  }

  function pauseExhaustedPrompts() {
    if (flags.exhaustedPromptTimer) {
      clearTimeout(flags.exhaustedPromptTimer);
      flags.exhaustedPromptTimer = null;
    }
  }

  function scheduleNextExhaustedPrompt(delayMs) {
    pauseExhaustedPrompts();
    if (
      !DSW.expression ||
      !DSW.expression.isExhaustedModeActive ||
      !DSW.expression.isExhaustedModeActive()
    ) {
      return;
    }
    flags.exhaustedPromptTimer = setTimeout(function () {
      flags.exhaustedPromptTimer = null;
      if (
        !DSW.expression ||
        !DSW.expression.isExhaustedModeActive ||
        !DSW.expression.isExhaustedModeActive()
      ) {
        return;
      }
      if (!canShowAutoSpeech()) {
        scheduleNextExhaustedPrompt(1000);
        return;
      }
      var line = pickExhaustedPromptLine();
      if (line) DSW.bubble.showDialogueLine(line);
      scheduleNextExhaustedPrompt(C.EXHAUSTED_PROMPT_INTERVAL_MS);
    }, typeof delayMs === "number" ? delayMs : C.EXHAUSTED_PROMPT_INTERVAL_MS);
  }

  function syncExhaustedPromptSchedule() {
    if (
      DSW.expression &&
      DSW.expression.isExhaustedModeActive &&
      DSW.expression.isExhaustedModeActive()
    ) {
      if (!flags.exhaustedPromptTimer) {
        scheduleNextExhaustedPrompt(C.EXHAUSTED_PROMPT_INTERVAL_MS);
      }
      return;
    }
    pauseExhaustedPrompts();
  }

  // 调度下一条台词。
  function scheduleNextDialogue() {
    if (flags.dialogueTimer) {
      clearTimeout(flags.dialogueTimer);
      flags.dialogueTimer = null;
    }
    if (!flags.dialogueLines.length) return;
    const delay = nextDialogueDelayMs();
    flags.dialogueTimer = setTimeout(function () {
      flags.dialogueTimer = null;
      // 有用户交互或气泡占用时顺延，不抢占当前反馈。
      if (!canShowAutoSpeech()) {
        scheduleNextDialogue();
        return;
      }
      const line = pickDialogueLine();
      if (line) DSW.bubble.showDialogueLine(line);
      scheduleNextDialogue();
    }, delay);
  }

  DSW.widgetConfig = {
    applyScale: applyScale,
    applyVol: applyVol,
    applySoundSetFromConfig: applySoundSetFromConfig,
    applyBubbleColor: applyBubbleColor,
    applyWidgetConfig: applyWidgetConfig,
    saveConfig: saveConfig,
    applyDialogueConfig: applyDialogueConfig,
    nextDialogueDelayMs: nextDialogueDelayMs,
    pickDialogueLine: pickDialogueLine,
    pickRandomDialogueLine: pickRandomDialogueLine,
    pickMoodLine: pickMoodLine,
    interpolate: interpolate,
    pauseDialogue: pauseDialogue,
    pickExhaustedPromptLine: pickExhaustedPromptLine,
    pauseExhaustedPrompts: pauseExhaustedPrompts,
    scheduleNextExhaustedPrompt: scheduleNextExhaustedPrompt,
    syncExhaustedPromptSchedule: syncExhaustedPromptSchedule,
    scheduleNextDialogue: scheduleNextDialogue,
  };
})(window.DSW);
