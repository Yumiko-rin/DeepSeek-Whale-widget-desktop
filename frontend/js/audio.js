// 小鲸鱼余额挂件 · 音效模块
//
// 负责按下/松开音效的播放、预设与自定义音频的加载与切换。
// 依赖：core.js（DSW.invoke/DSW.flags/DSW.C）、dom.js（DSW.dom）。

window.DSW = window.DSW || {};

(function (DSW) {
  "use strict";

  if (DSW.audio) return;

  var C = DSW.C;
  var flags = DSW.flags;

  // 预设音效源路径集合（用于区分预设与自定义路径）。
  var PRESET_SRCS = [];
  for (const k in C.SOUND_SETS) {
    if (C.SOUND_SETS[k].press) PRESET_SRCS.push(C.SOUND_SETS[k].press);
    if (C.SOUND_SETS[k].release) PRESET_SRCS.push(C.SOUND_SETS[k].release);
  }
  // 事件音效同样是内置资源，不能走自定义文件的 convertFileSrc 路径。
  for (const evName in C.EVENT_SOUNDS) PRESET_SRCS.push(C.EVENT_SOUNDS[evName]);

  // 将路径转换为可播放的音频源。
  function toAudioSrc(p) {
    if (!p) return p;
    if (/^(https?:|data:)/i.test(p)) return p;
    if (PRESET_SRCS.indexOf(p) !== -1) return p;
    const convertFileSrc =
      window.__TAURI__ && window.__TAURI__.core
        ? window.__TAURI__.core.convertFileSrc
        : null;
    if (convertFileSrc) {
      try {
        return convertFileSrc(p);
      } catch (err) {}
    }
    return p;
  }

  // 加载自定义音频文件（优先走 IPC 读取）。
  function loadCustomAudio(path, audio) {
    if (DSW.invoke) {
      DSW.invoke("read_audio_file", { path: path })
        .then(function (dataUrl) {
          if (dataUrl) audio.src = dataUrl;
        })
        .catch(function () {
          audio.src = toAudioSrc(path);
        });
    } else {
      audio.src = toAudioSrc(path);
    }
  }

  // 依据当前音效配置创建 Audio 实例。
  function applySoundSet() {
    try {
      const preset = C.SOUND_SETS[flags.soundSet];
      if (preset) {
        // 单发音效组（release 为 null）只播按下音，等价于自定义单文件的行为。
        flags.singleFileSound = !preset.release;
        flags.pressAudio = new Audio(toAudioSrc(preset.press));
        flags.pressAudio.preload = "auto";
        flags.pressAudio.volume = flags.soundVol;
        if (preset.release) {
          flags.releaseAudio = new Audio(toAudioSrc(preset.release));
          flags.releaseAudio.preload = "auto";
          flags.releaseAudio.volume = flags.soundVol;
        } else {
          flags.releaseAudio = null;
        }
      } else if (typeof flags.soundSet === "string" && flags.soundSet) {
        // 自定义单文件：仅按下播放一次，无松开音效。
        flags.singleFileSound = true;
        flags.releaseAudio = null;
        flags.pressAudio = new Audio();
        flags.pressAudio.preload = "auto";
        flags.pressAudio.volume = flags.soundVol;
        loadCustomAudio(flags.soundSet, flags.pressAudio);
      } else {
        flags.singleFileSound = false;
        flags.pressAudio = null;
        flags.releaseAudio = null;
      }
    } catch (err) {}
  }

  // 播放按下音效，并重置与松开音效相关的状态。
  function playPress() {
    if (!flags.pressAudio || !flags.soundOn) return;
    try {
      if (flags.releaseTimer) {
        clearTimeout(flags.releaseTimer);
        flags.releaseTimer = null;
      }
      if (flags.releaseAudio) {
        flags.releaseAudio.pause();
        flags.releaseAudio.currentTime = 0;
      }
      flags.pressEnded = false;
      flags.releasePlayed = false;
      flags.pressAudio.onended = function () {
        flags.pressEnded = true;
        if (!flags.singleFileSound && !flags.pressing && !flags.releasePlayed) playRelease();
      };
      flags.pressAudio.currentTime = 0;
      const p = flags.pressAudio.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (err) {}
  }

  // 播放松开音效，避免重复触发。
  function playRelease() {
    if (flags.releasePlayed || !flags.releaseAudio || !flags.soundOn) return;
    flags.releasePlayed = true;
    try {
      flags.releaseAudio.currentTime = 0;
      const p = flags.releaseAudio.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (err) {}
  }

  // 按下：Q 弹变形 + 播放按下音效。
  function pressDown() {
    DSW.dom.body.style.transform = C.SQUISH;
    flags.pressing = true;
    if (DSW.expression && DSW.expression.cancelBlink) {
      DSW.expression.cancelBlink(false);
    }
    if (DSW.expression && DSW.expression.syncVisualState) {
      DSW.expression.syncVisualState();
    } else {
      DSW.dom.img.src = C.IMG_URL_PRESS;
    }
    playPress();
  }

  // 松开：恢复形态 + 播放松开音效。
  function pressUp() {
    DSW.dom.body.style.transform = "scaleY(1) scaleX(1)";
    flags.pressing = false;
    if (DSW.expression && DSW.expression.syncVisualState) {
      DSW.expression.syncVisualState();
      if (DSW.expression.scheduleNextBlink) DSW.expression.scheduleNextBlink();
    } else {
      DSW.dom.img.src = C.IMG_URL;
    }
    if (flags.singleFileSound) return;
    if (flags.pressEnded) {
      playRelease();
      return;
    }
    // 按下音效尚未播完时，尽量在尾段衔接松开音效。
    let durKnown = false;
    let remainMs = 0;
    try {
      const dur = flags.pressAudio ? flags.pressAudio.duration : 0;
      if (isFinite(dur) && dur > 0) {
        durKnown = true;
        remainMs = (dur - flags.pressAudio.currentTime) * 1000;
      }
    } catch (err) {}
    if (durKnown) {
      flags.releaseTimer = setTimeout(
        function () {
          flags.releaseTimer = null;
          playRelease();
        },
        Math.max(0, remainMs - 100),
      );
    }
  }

  // —— 事件音效 ——
  // 与按压音效分开：按压音表达「被摸」，事件音表达「发生了什么」。
  var eventAudios = {};

  function ensureEventAudios() {
    if (Object.keys(eventAudios).length) return;
    for (const name in C.EVENT_SOUNDS) {
      try {
        var audio = new Audio(toAudioSrc(C.EVENT_SOUNDS[name]));
        audio.preload = "auto";
        eventAudios[name] = audio;
      } catch (err) {}
    }
  }

  // 播放事件音效（start / done / error），受总开关与音量控制。
  function playEvent(name) {
    if (!flags.soundOn || flags.eventSounds === false) return;
    ensureEventAudios();
    var audio = eventAudios[name];
    if (!audio) return;
    try {
      audio.volume = flags.soundVol;
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (err) {}
  }

  // —— 合成音效（零素材） ——
  // 用 Web Audio 现场合成短音，避免引入任何第三方音频素材（无版权负担）。
  var audioCtx = null;

  function audioContext() {
    if (audioCtx) return audioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtx = new AC();
    } catch (err) {
      audioCtx = null;
    }
    return audioCtx;
  }

  // 合成音规格：波形、起止频率、时长、峰值增益。
  var SYNTH = {
    pop: { type: "sine", from: 620, to: 1240, dur: 0.14, gain: 0.5 },
    whoosh: { type: "triangle", from: 900, to: 240, dur: 0.26, gain: 0.34 },
    ding: { type: "sine", from: 1180, to: 1560, dur: 0.42, gain: 0.32 },
  };

  // 播放合成音效（pop / whoosh / ding）。
  function playSynth(name) {
    if (!flags.soundOn) return false;
    var spec = SYNTH[name];
    if (!spec) return false;
    var ctx = audioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      var t0 = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.from, t0);
      if (spec.to !== spec.from) {
        osc.frequency.exponentialRampToValueAtTime(spec.to, t0 + spec.dur);
      }
      var peak = Math.max(0.0001, Math.min(1, flags.soundVol) * spec.gain);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + spec.dur + 0.02);
      return true;
    } catch (err) {
      return false;
    }
  }

  DSW.audio = {
    toAudioSrc: toAudioSrc,
    loadCustomAudio: loadCustomAudio,
    applySoundSet: applySoundSet,
    playPress: playPress,
    playRelease: playRelease,
    playEvent: playEvent,
    playSynth: playSynth,
    pressDown: pressDown,
    pressUp: pressUp,
  };
})(window.DSW);
