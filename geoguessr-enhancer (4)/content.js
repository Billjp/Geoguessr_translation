/**
 * content.js v3.2
 * - injected.js を注入してAudio API横取り
 * - 方位磁針: CSSインジェクション方式に変更し、Reactとの競合バグを解消
 * - チャット翻訳: UIを見やすく改善・名前ではなく本文を正確に翻訳するように修正
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

  // Isolated World (content.js) から Page Context (injected.js) へ設定を渡す
  function syncToPage() {
    const data = {
      soundEnabled: settings.soundEnabled,
      customSoundUrl: settings.customSoundUrl,
    };
    // DOMの属性を使ってデータを共有する
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
      [data-qa="compass"] img,
      div[class*="compass_compass"] img,
      div[class*="Compass_compass"] img,
      button[class*="compass_compass"] img,
      button[class*="Compass_compass"] img {
        content: url("${url}") !important;
        object-fit: contain !important;
      }
      
      [data-qa="compass"] svg,
      div[class*="compass_compass"] svg,
      div[class*="Compass_compass"] svg,
      button[class*="compass_compass"] svg,
      button[class*="Compass_compass"] svg {
        opacity: 0 !important; 
      }

      [data-qa="compass"]:not(img),
      div[class*="compass_compass"]:not(img),
      div[class*="Compass_compass"]:not(img),
      button[class*="compass_compass"]:not(img),
      button[class*="Compass_compass"]:not(img) {
        background-image: url("${url}") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
      }
    `;
    console.log('[GeoEnhancer] 方位磁針スタイル更新完了 (CSS Injection)');
  }

  // ================================================================
  // チャット翻訳
  // ================================================================
  const tlCache = new Map();

  async function translate(text, src, tgt) {
    const key = `${src}|${tgt}|${text}`;
    if (tlCache.has(key)) return tlCache.get(key);
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent((src === 'auto' ? 'autodetect' : src) + '|' + tgt)}`
      );
      const d = await res.json();
      const result = d?.responseData?.translatedText || text;
      tlCache.set(key, result);
      return result;
    } catch { return "翻訳エラーが発生しました"; }
  }

  function addTranslateBtn(msgEl) {
    if (!settings.translateEnabled) return;
    
    // ★修正ポイント: 重複（二重表示）を防ぐため、入れ子の要素を除外
    // 1. 自身が既に処理済みか
    // 2. 子要素に既に翻訳ボタンがあるか（外側の要素として処理済み）
    // 3. 祖先要素が既に処理済みか（内側の要素として二重に処理しようとしているのを防ぐ）
    if (
      msgEl.dataset.geoTl === '1' || 
      msgEl.querySelector('.geo-enhancer-tl-container') ||
      msgEl.parentElement?.closest('[data-geo-tl="1"]')
    ) {
      return;
    }
    
    msgEl.dataset.geoTl = '1';

    // ★修正ポイント: 名前ではなく、本文を正確に抽出する
    let textEl = msgEl;
    // 子要素を持たないテキスト要素（一番深い階層の要素）を全て取得
    const candidates = Array.from(msgEl.querySelectorAll('p, span, div, strong, em'))
      .filter(el => el.children.length === 0 && el.textContent.trim().length > 0);
    
    if (candidates.length > 0) {
      // チャットは [名前, 本文] の順に並んでいるため、最後尾の要素を「本文」とみなす
      textEl = candidates[candidates.length - 1];
    }

    const original = textEl.textContent.trim();
    // 短すぎるテキストや空の場合は無視
    if (!original || original.length < 1) return;

    // --- UI要素の作成 ---
    const actionContainer = document.createElement('div');
    actionContainer.className = 'geo-enhancer-tl-container';
    Object.assign(actionContainer.style, {
      marginTop: '6px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    });

    const btn = document.createElement('button');
    btn.innerHTML = '🌐 <span style="font-size: 11px;">翻訳</span>';
    Object.assign(btn.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '4px',
      color: 'inherit',
      cursor: 'pointer',
      fontSize: '12px',
      padding: '2px 8px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      width: 'fit-content',
      transition: 'background 0.2s',
      fontFamily: 'inherit'
    });
    
    // ホバーエフェクト
    btn.onmouseover = () => btn.style.background = 'rgba(255, 255, 255, 0.2)';
    btn.onmouseout = () => btn.style.background = 'rgba(255, 255, 255, 0.1)';

    const out = document.createElement('div');
    Object.assign(out.style, {
      display: 'none',
      background: 'rgba(0, 0, 0, 0.25)', 
      borderLeft: '3px solid #4f8ef7',   
      padding: '6px 10px',
      borderRadius: '0 4px 4px 0',
      fontSize: '0.9em',
      color: '#e2e8f0',
      lineHeight: '1.4',
      wordBreak: 'break-word',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
      const resultText = await translate(
        original, settings.translateSource || 'auto', settings.translateTarget || 'ja'
      );
      
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

  new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    // 増殖バグを防ぐため、まとめて1回だけスキャンする
    if (shouldScan) scanChat();
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', () => scanChat())
    : scanChat();

  // メッセージ受信
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SETTINGS_UPDATED') {
      Object.assign(settings, msg.settings);
      syncToPage();
      updateCompassStyle();
    }
  });

  console.log('[GeoEnhancer] content.js v3.2 準備完了 ✓');
})();