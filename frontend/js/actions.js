// 小鲸鱼余额挂件 · 动作动效模块
//
// 设计原则：**所有动效都由现有素材合成**（Web Animations API 变换 + Web Audio 合成音），
// 不引入任何外部动画/音频素材，因此没有版权负担、可商用。
//
// 动效清单：
// - 一次性：hop（跳）/ spin（转圈）/ nod（点头）/ wobble（受惊摇晃）/ settle（落地回弹）
// - 循环：breathe（待机呼吸）/ sway（拖拽摇摆）/ shake（生气抖动）/ sink（疲惫下沉）
// - 随机小动作：闲暇时偶尔来一个，作为彩蛋
//
// 目标元素是角色本体 `DSW.dom.img`（不含气泡）：气泡文字不应跟着旋转/抖动，
// 同时避免与 Q 弹按压（audio.js 对 body 的 transform）互相覆盖。
//
// 依赖：core.js（DSW.flags）、dom.js（DSW.dom）。

window.DSW = window.DSW || {};

(function (DSW) {
  "use strict";

  if (DSW.actions) return;

  var flags = DSW.flags;

  var currentLoop = null; // 当前循环动画
  var loopName = null; // 当前循环名
  var randomTimer = null; // 随机小动作计时器

  // 一次性动作关键帧。
  var KEYFRAMES = {
    hop: [
      { transform: "translateY(0) scaleY(1)" },
      { transform: "translateY(-13%) scaleY(1.06)", offset: 0.35 },
      { transform: "translateY(0) scaleY(0.94)", offset: 0.72 },
      { transform: "translateY(0) scaleY(1)" },
    ],
    spin: [
      { transform: "rotate(0deg) scale(1)" },
      { transform: "rotate(180deg) scale(0.9)", offset: 0.5 },
      { transform: "rotate(360deg) scale(1)" },
    ],
    nod: [
      { transform: "rotate(0deg)" },
      { transform: "rotate(7deg)", offset: 0.3 },
      { transform: "rotate(-3deg)", offset: 0.62 },
      { transform: "rotate(0deg)" },
    ],
    wobble: [
      { transform: "rotate(0deg) translateX(0)" },
      { transform: "rotate(-7deg) translateX(-3%)", offset: 0.22 },
      { transform: "rotate(6deg) translateX(3%)", offset: 0.5 },
      { transform: "rotate(-4deg) translateX(-2%)", offset: 0.74 },
      { transform: "rotate(0deg) translateX(0)" },
    ],
    settle: [
      { transform: "scale(1)" },
      { transform: "scale(1.12, 0.88)", offset: 0.3 },
      { transform: "scale(0.96, 1.05)", offset: 0.62 },
      { transform: "scale(1)" },
    ],
  };

  // 循环动作关键帧（direction: alternate 往复）。
  var LOOPS = {
    breathe: [{ transform: "scale(1)" }, { transform: "scale(1.035)" }],
    sway: [{ transform: "rotate(-3.5deg)" }, { transform: "rotate(3.5deg)" }],
    shake: [{ transform: "rotate(-5deg)" }, { transform: "rotate(5deg)" }],
    sink: [
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(2.5%) scale(0.975)" },
    ],
  };

  var DURATION = { hop: 480, spin: 700, nod: 520, wobble: 620, settle: 420 };

  var LOOP_OPTS = {
    breathe: { duration: 2600, easing: "ease-in-out" },
    sway: { duration: 900, easing: "ease-in-out" },
    shake: { duration: 260, easing: "linear" },
    sink: { duration: 2400, easing: "ease-in-out" },
  };

  function target() {
    return DSW.dom ? DSW.dom.img : null;
  }

  function enabled() {
    var el = target();
    return flags.actions !== false && !!el && typeof el.animate === "function";
  }

  // 播放一次性动作。
  function play(name) {
    if (!enabled()) return false;
    var keys = KEYFRAMES[name];
    if (!keys) return false;
    try {
      var anim = target().animate(keys, {
        duration: DURATION[name] || 480,
        easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        iterations: 1,
      });
      if (anim && anim.finished && anim.finished.catch) {
        anim.finished.catch(function () {});
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  // 停止当前循环动作。
  function stopLoop() {
    if (currentLoop) {
      try {
        currentLoop.cancel();
      } catch (err) {}
      currentLoop = null;
    }
    loopName = null;
  }

  // 启动循环动作（同名重复调用不重启动画）。
  function startLoop(name) {
    if (!enabled()) return false;
    var keys = LOOPS[name];
    var opt = LOOP_OPTS[name];
    if (!keys || !opt) return false;
    if (loopName === name && currentLoop) return true;
    stopLoop();
    try {
      currentLoop = target().animate(keys, {
        duration: opt.duration,
        easing: opt.easing,
        iterations: Infinity,
        direction: "alternate",
      });
      loopName = name;
      return true;
    } catch (err) {
      currentLoop = null;
      loopName = null;
      return false;
    }
  }

  // 待机呼吸：只在没有更「重」的循环占用时启用。
  function startAmbient() {
    if (!enabled()) return false;
    if (loopName === "shake" || loopName === "sink" || loopName === "sway") return false;
    return startLoop("breathe");
  }

  // 表情状态 → 循环动作。
  function syncMoodLoop(mood, exhausted) {
    if (!enabled()) return;
    if (exhausted) {
      startLoop("sink");
      return;
    }
    if (mood === "angry") {
      startLoop("shake");
      return;
    }
    startLoop("breathe");
  }

  // 拖拽期间的摇摆循环；松手时落地回弹。
  function dragLoop(active) {
    if (!enabled()) return;
    if (active) {
      startLoop("sway");
      return;
    }
    stopLoop();
    play("settle");
    startAmbient();
  }

  // 随机小动作彩蛋（3–8 分钟一次；拖拽中跳过）。
  function scheduleRandom() {
    if (randomTimer) {
      clearTimeout(randomTimer);
      randomTimer = null;
    }
    if (!enabled() || flags.randomActions === false) return;
    var delay = (3 + Math.random() * 5) * 60000;
    randomTimer = setTimeout(function () {
      randomTimer = null;
      if (enabled() && flags.randomActions !== false && !(flags.drag && flags.drag.active)) {
        var pool = ["hop", "spin", "nod", "wobble"];
        play(pool[Math.floor(Math.random() * pool.length)]);
      }
      scheduleRandom();
    }, delay);
  }

  // 设置界面开关。
  function setEnabled(on) {
    flags.actions = on !== false;
    if (!flags.actions) {
      stopLoop();
      if (randomTimer) {
        clearTimeout(randomTimer);
        randomTimer = null;
      }
      return;
    }
    startAmbient();
    scheduleRandom();
  }

  DSW.actions = {
    play: play,
    startLoop: startLoop,
    stopLoop: stopLoop,
    startAmbient: startAmbient,
    syncMoodLoop: syncMoodLoop,
    dragLoop: dragLoop,
    scheduleRandom: scheduleRandom,
    setEnabled: setEnabled,
    isEnabled: function () {
      return flags.actions !== false;
    },
    currentLoop: function () {
      return loopName;
    },
  };
})(window.DSW);
