/**
 * content.js v4.1
 * - injected.js を注入してAudio API横取り
 * - 方位磁針: CSSインジェクション方式に変更し、Reactとの競合バグを解消
 * - チャット翻訳: API通信を background.js に委譲しCORSエラー(OPTIONS)を回避
 */
(function () {
  'use strict';

  let settings = {
    soundEnabled: true,
    customSoundUrl: null,
    compassEnabled: true,
    customCompassUrl: null,
    translateEnabled: true,
    translateTarget: 'ja',
    translateSource: 'auto',
    translateEngine: 'mymemory',
    geminiApiKey: '',
    openaiApiKey: '',
    lmStudioUrl: 'http://localhost:1234'
  };

  // ---- ストレージ読み込み ----
  chrome.storage.local.get(null, (stored) => {
    settings = { ...settings, ...stored };
    if (!settings.customSoundUrl)
      settings.customSoundUrl = chrome.runtime.getURL('assets/custom-sound.mp3');
    if (!settings.customCompassUrl)
      settings.customCompassUrl = chrome.runtime.getURL('assets/custom-compass.png');
    
    syncToPage();
    updateCompassStyle();
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const [k, { newValue }] of Object.entries(changes)) settings[k] = newValue;
    syncToPage();
    updateCompassStyle();
  });

  function syncToPage() {
    const data = {
      soundEnabled: settings.soundEnabled,
      customSoundUrl: settings.customSoundUrl,
    };
    document.documentElement.setAttribute('data-geo-enhancer', JSON.stringify(data));
  }

  // ---- injected.js を注入 ----
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('injected.js');
  s.onload = function () { this.remove(); };
  (document.head || document.documentElement).prepend(s);

  // ================================================================
  // 方位磁針の置き換え (CSSインジェクション方式)
  // ================================================================
  function updateCompassStyle() {
    let styleEl = document.getElementById('geo-enhancer-compass-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'geo-enhancer-compass-style';
      document.head.appendChild(styleEl);
    }

    if (!settings.compassEnabled) {
      styleEl.textContent = '';
      return;
    }

    const url = settings.customCompassUrl;
    styleEl.textContent = `
      [data-qa="compass"] img, div[class*="compass_compass"] img, div[class*="Compass_compass"] img,
      button[class*="compass_compass"] img, button[class*="Compass_compass"] img {
        content: url("${url}") !important; object-fit: contain !important;
      }
      [data-qa="compass"] svg, div[class*="compass_compass"] svg, div[class*="Compass_compass"] svg,
      button[class*="compass_compass"] svg, button[class*="Compass_compass"] svg {
        opacity: 0 !important; 
      }
      [data-qa="compass"]:not(img), div[class*="compass_compass"]:not(img), div[class*="Compass_compass"]:not(img),
      button[class*="compass_compass"]:not(img), button[class*="Compass_compass"]:not(img) {
        background-image: url("${url}") !important; background-size: contain !important;
        background-repeat: no-repeat !important; background-position: center !important;
      }
    `;
  }

  // ================================================================
  // チャット翻訳
  // ================================================================
  const tlCache = new Map();

  async function translate(text, src, tgt) {
    const key = `${settings.translateEngine}|${src}|${tgt}|${text}`;
    if (tlCache.has(key)) return tlCache.get(key);
    
    return new Promise((resolve) => {
      // API通信はすべて background.js に任せる（CORS回避のため）
      chrome.runtime.sendMessage({
        type: 'TRANSLATE',
        text: text,
        src: src,
        tgt: tgt,
        settings: settings
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          resolve("⚠️ 拡張機能内部のエラーが発生しました");
          return;
        }
        
        if (response && response.result) {
          // エラー文でない場合のみキャッシュに保存する
          if (!response.result.startsWith("⚠️")) {
            tlCache.set(key, response.result);
          }
          resolve(response.result);
        } else {
          resolve("⚠️ 翻訳に失敗しました");
        }
      });
    });
  }

  function addTranslateBtn(msgEl) {
    if (!settings.translateEnabled) return;
    
    if (msgEl.dataset.geoTl === '1' || msgEl.querySelector('.geo-enhancer-tl-container') || msgEl.parentElement?.closest('[data-geo-tl="1"]')) {
      return;
    }
    
    msgEl.dataset.geoTl = '1';

    let textEl = msgEl;
    const candidates = Array.from(msgEl.querySelectorAll('p, span, div, strong, em'))
      .filter(el => el.children.length === 0 && el.textContent.trim().length > 0);
    
    if (candidates.length > 0) textEl = candidates[candidates.length - 1];

    const original = textEl.textContent.trim();
    if (!original || original.length < 1) return;

    const actionContainer = document.createElement('div');
    actionContainer.className = 'geo-enhancer-tl-container';
    Object.assign(actionContainer.style, { marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' });

    const btn = document.createElement('button');
    btn.innerHTML = '🌐 <span style="font-size: 11px;">翻訳</span>';
    Object.assign(btn.style, {
      background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '4px', color: 'inherit', cursor: 'pointer', fontSize: '12px',
      padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px',
      width: 'fit-content', transition: 'background 0.2s', fontFamily: 'inherit'
    });
    
    btn.onmouseover = () => btn.style.background = 'rgba(255, 255, 255, 0.2)';
    btn.onmouseout = () => btn.style.background = 'rgba(255, 255, 255, 0.1)';

    const out = document.createElement('div');
    Object.assign(out.style, {
      display: 'none', background: 'rgba(0, 0, 0, 0.25)', borderLeft: '3px solid #4f8ef7',   
      padding: '6px 10px', borderRadius: '0 4px 4px 0', fontSize: '0.9em',
      color: '#e2e8f0', lineHeight: '1.4', wordBreak: 'break-word', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    });

    let showing = false;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (showing) { 
        out.style.display = 'none'; 
        btn.innerHTML = '🌐 <span style="font-size: 11px;">翻訳</span>';
        showing = false; 
        return; 
      }
      
      btn.innerHTML = '⏳ <span style="font-size: 11px;">翻訳中...</span>';
      const resultText = await translate(original, settings.translateSource || 'auto', settings.translateTarget || 'ja');
      
      out.textContent = resultText;
      out.style.display = 'block';
      btn.innerHTML = '🌐 <span style="font-size: 11px;">閉じる</span>';
      showing = true;
    });

    actionContainer.appendChild(btn);
    actionContainer.appendChild(out);
    msgEl.appendChild(actionContainer);
  }

  const CHAT_SELECTORS = [
    'div[class*="chat-message"]', 'div[class*="ChatMessage"]', 
    'div[class*="chat_message"]', 'div[class*="message-item"]', 
    'div[class*="MessageItem"]', '[data-qa="chat-message"]',
  ];

  function scanChat(root = document) {
    if (!settings.translateEnabled) return;
    root.querySelectorAll(CHAT_SELECTORS.join(', ')).forEach(addTranslateBtn);
  }

  // ================================================================
  // 送信チャットの翻訳 (相互翻訳) - ガラス風UI
  // ================================================================
  function addTranslateInputBtn(inputEl) {
    if (!settings.translateEnabled) return;
    // 重複追加防止と、テキスト入力欄以外は除外
    if (inputEl.dataset.geoTlInput === '1' || (inputEl.type !== 'text' && inputEl.tagName !== 'TEXTAREA')) return;
    inputEl.dataset.geoTlInput = '1';

    const container = document.createElement('div');
    container.className = 'geo-enhancer-input-tl-container';
    
    // Apple風のすりガラスデザイン (Glassmorphism)
    Object.assign(container.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '8px',
      marginTop: '8px',
      padding: '6px 12px',
      width: 'max-content',
      marginLeft: 'auto', // 右寄せに配置
      background: 'rgba(40, 40, 45, 0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
      zIndex: '100'
    });

    const langSelect = document.createElement('select');
    Object.assign(langSelect.style, {
      background: 'transparent',
      color: '#e2e8f0',
      border: 'none',
      fontSize: '12px',
      fontWeight: '600',
      outline: 'none',
      cursor: 'pointer',
      padding: '2px',
      fontFamily: 'inherit'
    });
    
    const langs = { 'en': '英語', 'zh': '中国語', 'ko': '韓国語', 'fr': 'フランス語', 'es': 'スペイン語', 'de': 'ドイツ語', 'ja': '日本語' };
    for (const [code, name] of Object.entries(langs)) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = name;
      if (code === 'en') opt.selected = true; // デフォルトは英語
      opt.style.color = '#000';
      langSelect.appendChild(opt);
    }

    const btn = document.createElement('button');
    btn.innerHTML = '✨ 翻訳して入力';
    Object.assign(btn.style, {
      background: 'linear-gradient(135deg, rgba(10, 132, 255, 0.9), rgba(0, 85, 255, 0.9))',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#ffffff',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600',
      padding: '6px 14px',
      transition: 'all 0.2s ease',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    });
    
    // ホバー時の浮き上がりアニメーション
    btn.onmouseover = () => {
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      btn.style.background = 'linear-gradient(135deg, rgba(20, 142, 255, 1), rgba(10, 95, 255, 1))';
    };
    btn.onmouseout = () => {
      btn.style.transform = 'none';
      btn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
      btn.style.background = 'linear-gradient(135deg, rgba(10, 132, 255, 0.9), rgba(0, 85, 255, 0.9))';
    };

    let isTranslating = false;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isTranslating) return;

      const text = inputEl.value.trim();
      if (!text) return;

      isTranslating = true;
      const origHtml = btn.innerHTML;
      btn.innerHTML = '⏳ 翻訳中...';

      const targetLang = langSelect.value;
      const resultText = await translate(text, 'auto', targetLang);

      if (!resultText.startsWith('⚠️')) {
        // Reactの内部ステートに強制的に反映させるための処理
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        
        if (inputEl.tagName === 'INPUT' && nativeInputValueSetter) {
          nativeInputValueSetter.call(inputEl, resultText);
        } else if (inputEl.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
          nativeTextAreaValueSetter.call(inputEl, resultText);
        } else {
          inputEl.value = resultText;
        }
        // inputイベントを発火させてGeoGuessr側に文字が入力されたことを認識させる
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }

      btn.innerHTML = origHtml;
      isTranslating = false;
    });

    container.appendChild(langSelect);
    container.appendChild(btn);

    // 入力欄のすぐ下に追加
    const wrapper = inputEl.parentElement;
    if (wrapper) {
      wrapper.insertAdjacentElement('afterend', container);
    }
  }

  const INPUT_SELECTORS = [
    'input[placeholder*="message" i]', 'textarea[placeholder*="message" i]',
    'input[placeholder*="chat" i]', 'textarea[placeholder*="chat" i]',
    'div[class*="chat"] input[type="text"]'
  ];

  function scanInput(root = document) {
    if (!settings.translateEnabled) return;
    root.querySelectorAll(INPUT_SELECTORS.join(', ')).forEach(addTranslateInputBtn);
  }

  new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      scanChat();
      scanInput();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', () => { scanChat(); scanInput(); })
    : (() => { scanChat(); scanInput(); })();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SETTINGS_UPDATED') {
      Object.assign(settings, msg.settings);
      syncToPage();
      updateCompassStyle();
    }
  });
})();