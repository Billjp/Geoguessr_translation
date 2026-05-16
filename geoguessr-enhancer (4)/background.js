/**
 * background.js - Service Worker
 * 設定の管理と、各種翻訳APIへのプロキシ（CORS回避）を担当
 */

chrome.runtime.onInstalled.addListener(() => {
  // デフォルト設定を保存
  chrome.storage.local.get(
    [
      'soundEnabled', 'compassEnabled', 'translateEnabled', 
      'translateTarget', 'translateSource', 'translateEngine',
      'geminiApiKey', 'openaiApiKey', 'lmStudioUrl'
    ],
    (stored) => {
      const defaults = {
        soundEnabled: true,
        compassEnabled: true,
        translateEnabled: true,
        translateTarget: 'ja',
        translateSource: 'auto',
        translateEngine: 'mymemory',
        geminiApiKey: '',
        openaiApiKey: '',
        lmStudioUrl: 'http://localhost:1234',
        customSoundUrl: null,
        customCompassUrl: null,
      };
      const toSet = {};
      for (const [key, val] of Object.entries(defaults)) {
        if (stored[key] === undefined) toSet[key] = val;
      }
      if (Object.keys(toSet).length > 0) {
        chrome.storage.local.set(toSet);
      }
    }
  );
});

// ================================================================
// 翻訳API通信処理（CORS回避のためBackgroundで実行）
// ================================================================
const langMap = {
  'ja': 'Japanese', 'en': 'English', 'zh': 'Chinese', 'ko': 'Korean',
  'fr': 'French', 'de': 'German', 'es': 'Spanish', 'pt': 'Portuguese', 'ru': 'Russian'
};

async function translateWithMyMemory(text, src, tgt) {
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent((src === 'auto' ? 'autodetect' : src) + '|' + tgt)}`);
  const d = await res.json();
  return d?.responseData?.translatedText || text;
}

async function translateWithGemini(text, tgt, apiKey) {
  const targetLang = langMap[tgt] || tgt;
  const prompt = `Translate the following text into ${targetLang}. Output ONLY the translated text without any explanation or quotes.\n\nText: ${text}`;
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  if (!res.ok) throw new Error('Gemini API Error');
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

async function translateWithOpenAI(text, tgt, apiKey) {
  const targetLang = langMap[tgt] || tgt;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are a translator. Translate the user's text into ${targetLang}. Output ONLY the translation without any quotes or explanations.` },
        { role: "user", content: text }
      ],
      temperature: 0.3
    })
  });
  if (!res.ok) throw new Error('OpenAI API Error');
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function translateWithLMStudio(text, tgt, baseUrl) {
  const targetLang = langMap[tgt] || tgt;
  let url = baseUrl.replace(/\/+$/, '');
  if (!url.startsWith('http')) url = 'http://' + url;
  url += '/v1/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: "system", content: `You are a translator. Translate the user's text into ${targetLang}. Output ONLY the translation without any quotes or explanations.` },
        { role: "user", content: text }
      ],
      temperature: 0.3
    })
  });
  
  if (!res.ok) throw new Error(`LM Studio API Error (${res.status})`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// content.jsからの翻訳リクエストを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TRANSLATE') {
    const { text, src, tgt, settings } = request;
    
    // 非同期処理を実行
    (async () => {
      try {
        let result = text;
        if (settings.translateEngine === 'gemini') {
          if (!settings.geminiApiKey) throw new Error("Gemini APIキーが未設定");
          result = await translateWithGemini(text, tgt, settings.geminiApiKey);
        } else if (settings.translateEngine === 'openai') {
          if (!settings.openaiApiKey) throw new Error("OpenAI APIキーが未設定");
          result = await translateWithOpenAI(text, tgt, settings.openaiApiKey);
        } else if (settings.translateEngine === 'lmstudio') {
          if (!settings.lmStudioUrl) throw new Error("LM Studio URLが未設定");
          result = await translateWithLMStudio(text, tgt, settings.lmStudioUrl);
        } else {
          result = await translateWithMyMemory(text, src, tgt);
        }
        sendResponse({ result });
      } catch (e) {
        console.error('Translation error:', e);
        sendResponse({ result: "⚠️ 翻訳エラー: " + e.message });
      }
    })();
    
    return true; // 非同期でsendResponseを返すために必須
  }
});