// 小鲸鱼余额挂件 · 情绪滤镜模块
//
// 用 CSS filter 在**不新增任何美术素材**的前提下，给现有 9 张表情图加上情绪色调：
// 害羞脸红、生气涨红、失落发灰、疲惫褪色、深夜困倦、余额告急偏冷。
// 纯代码实现、可商用，且与 actions.js 的动作动效互相独立、可叠加。
//
// 设计克制：只改色调 / 明度 / 饱和度，不做夸张变形——变形交给 actions.js。
//
// 依赖：core.js（DSW.flags）、dom.js（DSW.dom）。

window.DSW = window.DSW || {};

(function (DSW) {
  "use strict";

  if (DSW.moodFilter) return;

  var flags = DSW.flags;
  var flashTimer = null;

  // 情绪 → 滤镜值。
  var FILTERS = {
    none: "",
    happy: "saturate(1.25) brightness(1.06)",
    angry: "saturate(1.45) contrast(1.08) hue-rotate(-8deg)",
    shy: "sepia(0.32) saturate(1.5) hue-rotate(-14deg) brightness(1.05)",
    disappointed: "saturate(0.72) brightness(0.95)",
    exhausted: "saturate(0.55) brightness(0.9) contrast(0.96) hue-rotate(8deg)",
    sleepy: "contrast(0.92) brightness(0.96) saturate(0.9)",
    low: "saturate(0.8) brightness(0.95) hue-rotate(10deg)",
  };

  function target() {
    return DSW.dom ? DSW.dom.img : null;
  }

  function enabled() {
    return flags.moodFilters !== false && !!target();
  }

  function setFilter(name) {
    var el = target();
    if (!el) return false;
    try {
      el.style.filter = FILTERS[name] || "";
      return true;
    } catch (err) {
      return false;
    }
  }

  // 当前状态对应的滤镜名。
  function currentName(mood, exhausted) {
    if (exhausted) return "exhausted";
    if (mood === "angry") return "angry";
    if (mood === "shy") return "shy";
    if (mood === "disappointed") return "disappointed";
    var hour = new Date().getHours();
    if (hour >= 23 || hour < 6) return "sleepy";
    return "none";
  }

  // 应用状态滤镜（由 expression.js 在表情切换时调用）。
  function apply(mood, exhausted) {
    if (!enabled()) return false;
    return setFilter(currentName(mood, exhausted));
  }

  // 一次性情绪闪光（例如余额变化时的「开心」），到时自动回到状态滤镜。
  function flash(name, ms) {
    if (!enabled()) return false;
    if (flashTimer) {
      clearTimeout(flashTimer);
      flashTimer = null;
    }
    setFilter(name);
    flashTimer = setTimeout(function () {
      flashTimer = null;
      if (DSW.expression && DSW.expression.syncVisualState) {
        DSW.expression.syncVisualState();
      } else {
        apply(flags.mood, flags.exhaustedMode);
      }
    }, typeof ms === "number" ? ms : 800);
    return true;
  }

  // 设置界面开关。
  function setEnabled(on) {
    flags.moodFilters = on !== false;
    if (!flags.moodFilters) {
      if (flashTimer) {
        clearTimeout(flashTimer);
        flashTimer = null;
      }
      setFilter("none");
      return;
    }
    apply(flags.mood, flags.exhaustedMode);
  }

  DSW.moodFilter = {
    apply: apply,
    flash: flash,
    setEnabled: setEnabled,
    isEnabled: function () {
      return flags.moodFilters !== false;
    },
  };
})(window.DSW);
