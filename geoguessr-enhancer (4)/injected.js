/**
 * injected.js v5.1
 * - コンテキストの壁を越えてDOM属性から設定を読み込む
 * - GeoGuessr特有の音声URLパターンマッチングを強化
 * - Data URLのArrayBuffer変換対応
 * - ArrayBufferの再利用(detached)エラーを修正
 */
(function () {
  'use strict';

  // content.js が DOM に保存した設定を読み込む（Isolated World対策）
  function cfg() {
    try {
      const data = document.documentElement.getAttribute('data-geo-enhancer');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }
  
  function soundEnabled() { return cfg().soundEnabled !== false; }
  function customSoundUrl() { return cfg().customSoundUrl || null; }

  function log(...a) {
    console.log('%c[GeoEnhancer]', 'color:#4f8ef7;font-weight:bold', ...a);
  }

  // GeoGuessrのサウンドと思われるURLキーワード（広すぎたパターンを絞り込み）
  const GUESS_SOUND_PATTERNS = [
    /guess/i, /result/i, /ding/i
  ];

  function isAudioUrl(url) {
    if (typeof url !== 'string') return false;
    // 1. 拡張子チェック
    if (/\.(mp3|ogg|wav|webm|aac|m4a|opus)(\?.*)?$/i.test(url)) return true;
    // 2. キーワードチェック (GeoGuessr対応)
    return GUESS_SOUND_PATTERNS.some(p => p.test(url));
  }

  // カスタム音声 ArrayBuffer キャッシュ
  let customBufCache = null;
  let customBufUrl = null;

  async function getCustomBuf() {
    const cu = customSoundUrl();
    if (!cu) return null;
    if (customBufCache && customBufUrl === cu) {
      // ★修正: ArrayBuffer は一度デコードすると空(detached)になるため、必ずコピーを返す
      return customBufCache.slice(0);
    }
    try {
      // Data URL も通常のURLも fetch で ArrayBuffer に変換可能
      const res = await window.__origFetch(cu);
      customBufCache = await res.arrayBuffer();
      customBufUrl = cu;
      log('カスタム音声キャッシュ完了');
      // ★修正: 初回も念のためコピーを返す
      return customBufCache.slice(0);
    } catch(e) {
      log('カスタム音声読込エラー:', e);
      return null;
    }
  }

  // ============================================================
  // fetch の上書き
  // ============================================================
  const origFetch = window.fetch;
  window.__origFetch = origFetch; // 内部用

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input
      : (input instanceof URL ? input.href : input?.url || '');

    if (url && isAudioUrl(url)) {
      log('🎵 音声fetch検出:', url);
      const cu = soundEnabled() ? customSoundUrl() : null;
      if (cu) {
        log('→ カスタム音声に置き換え実行');
        return origFetch(cu, init);
      }
    }
    return origFetch.apply(this, arguments);
  };

  // ============================================================
  // Web Audio API: decodeAudioData を横取り
  // ============================================================
  const ACtx = window.AudioContext || window.webkitAudioContext;
  if (ACtx) {
    const origDecode = ACtx.prototype.decodeAudioData;

    ACtx.prototype.decodeAudioData = function (arrayBuffer, successCb, errorCb) {
      if (!soundEnabled() || !customSoundUrl()) {
        return origDecode.apply(this, arguments);
      }

      log('🎵 decodeAudioData 検出');
      const ctx = this;
      const promise = getCustomBuf().then(customBuf => {
        const buf = customBuf || arrayBuffer;
        log('→ カスタム音声でデコード完了');
        if (successCb) return origDecode.call(ctx, buf, successCb, errorCb);
        return origDecode.call(ctx, buf);
      });
      return promise;
    };
    log('Web Audio API パッチ完了');
  }

  // ============================================================
  // HTMLAudioElement / MediaElement の上書き
  // ============================================================
  const OrigAudio = window.Audio;
  window.Audio = function (src) {
    const audio = new OrigAudio();
    if (src) {
      if (soundEnabled() && isAudioUrl(src)) {
        const cu = customSoundUrl();
        if (cu) { log('🎵 Audio() 置き換え:', src); src = cu; }
      }
      audio.src = src;
    }
    return audio;
  };
  window.Audio.prototype = OrigAudio.prototype;
  Object.setPrototypeOf(window.Audio, OrigAudio);

  // play() メソッドもフックして再生直前に差し替える
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    if (soundEnabled() && this.src && isAudioUrl(this.src)) {
      const cu = customSoundUrl();
      if (cu && this.src !== cu) {
        log('🎵 play() 直前に src 置き換え:', this.src);
        this.src = cu;
      }
    }
    return origPlay.apply(this, arguments);
  };

  const srcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  if (srcDesc?.set) {
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      get: srcDesc.get,
      set(val) {
        if (val && soundEnabled() && isAudioUrl(val)) {
          const cu = customSoundUrl();
          if (cu) { log('🎵 src setter 置き換え:', val); val = cu; }
        }
        srcDesc.set.call(this, val);
      },
      configurable: true,
    });
  }

  // ============================================================
  // Howler.js の上書き
  // ============================================================
  let howlerPatched = false;
  function patchHowler() {
    if (howlerPatched || !window.Howl) return;
    howlerPatched = true;
    const OrigHowl = window.Howl;
    window.Howl = function (opts) {
      if (opts?.src) {
        // Howlerのsrcは配列の場合がある
        const srcArray = Array.isArray(opts.src) ? opts.src : [opts.src];
        const isAudio = srcArray.some(s => isAudioUrl(s));
        
        if (isAudio && soundEnabled()) {
          const cu = customSoundUrl();
          if (cu) {
            log('🎵 Howl検出:', opts.src);
            opts = { ...opts, src: [cu] }; 
            log('→ Howl 置き換え完了'); 
          }
        }
      }
      return new OrigHowl(opts);
    };
    window.Howl.prototype = OrigHowl.prototype;
    log('Howler.js パッチ完了');
  }
  const ht = setInterval(patchHowler, 200);
  setTimeout(() => clearInterval(ht), 15000);

  log('injected.js v5.1 準備完了 ✓');
})();