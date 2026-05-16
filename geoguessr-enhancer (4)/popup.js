/**
 * popup.js
 * ポップアップの設定UIロジック (API連携版)
 */
(async function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const soundEnabled   = $('soundEnabled'); const soundContent   = $('soundContent');
  const soundPickBtn   = $('soundPickBtn'); const soundFile      = $('soundFile');
  const soundFileName  = $('soundFileName'); const soundReset     = $('soundReset');

  const compassEnabled = $('compassEnabled'); const compassContent = $('compassContent');
  const compassPickBtn = $('compassPickBtn'); const compassFile    = $('compassFile');
  const compassFileName= $('compassFileName'); const compassReset   = $('compassReset');

  const translateEnabled= $('translateEnabled'); const translateContent= $('translateContent');
  const translateSource = $('translateSource'); const translateTarget = $('translateTarget');
  
  // 新規追加: 翻訳エンジン設定
  const translateEngine = $('translateEngine');
  const apiSettingsWrap = $('apiSettingsWrap');
  const geminiSettings  = $('geminiSettings');
  const openaiSettings  = $('openaiSettings');
  const lmstudioSettings= $('lmstudioSettings');
  
  const geminiApiKey = $('geminiApiKey');
  const openaiApiKey = $('openaiApiKey');
  const lmStudioUrl  = $('lmStudioUrl');

  const statusText = $('statusText');
  const saveToast  = $('saveToast');

  // ---- 設定の読み込み ----
  const stored = await chrome.storage.local.get([
    'soundEnabled', 'customSoundUrl', 'customSoundName',
    'compassEnabled', 'customCompassUrl', 'customCompassName',
    'translateEnabled', 'translateSource', 'translateTarget',
    'translateEngine', 'geminiApiKey', 'openaiApiKey', 'lmStudioUrl'
  ]);

  soundEnabled.checked    = stored.soundEnabled    !== false;
  compassEnabled.checked  = stored.compassEnabled  !== false;
  translateEnabled.checked= stored.translateEnabled !== false;

  if (stored.customSoundName) {
    soundFileName.textContent = stored.customSoundName;
    soundFileName.classList.add('set');
  }
  if (stored.customCompassName) {
    compassFileName.textContent = stored.customCompassName;
    compassFileName.classList.add('set');
  }

  translateSource.value = stored.translateSource || 'auto';
  translateTarget.value = stored.translateTarget || 'ja';
  translateEngine.value = stored.translateEngine || 'mymemory';
  
  geminiApiKey.value = stored.geminiApiKey || '';
  openaiApiKey.value = stored.openaiApiKey || '';
  lmStudioUrl.value = stored.lmStudioUrl || 'http://localhost:1234';

  updateDisabled();
  updateEngineUI();

  function showToast() {
    saveToast.classList.add('show');
    setTimeout(() => saveToast.classList.remove('show'), 1800);
  }

  function updateDisabled() {
    soundContent.classList.toggle('disabled', !soundEnabled.checked);
    compassContent.classList.toggle('disabled', !compassEnabled.checked);
    translateContent.classList.toggle('disabled', !translateEnabled.checked);
  }

  function updateEngineUI() {
    const engine = translateEngine.value;
    apiSettingsWrap.style.display = engine === 'mymemory' ? 'none' : 'block';
    geminiSettings.classList.toggle('active', engine === 'gemini');
    openaiSettings.classList.toggle('active', engine === 'openai');
    lmstudioSettings.classList.toggle('active', engine === 'lmstudio');
  }

  async function saveSettings(updates) {
    await chrome.storage.local.set(updates);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('geoguessr.com')) {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: updates }).catch(() => {});
      }
    } catch (_) {}
    showToast();
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- トグルイベント ----
  soundEnabled.addEventListener('change', () => { updateDisabled(); saveSettings({ soundEnabled: soundEnabled.checked }); });
  compassEnabled.addEventListener('change', () => { updateDisabled(); saveSettings({ compassEnabled: compassEnabled.checked }); });
  translateEnabled.addEventListener('change', () => { updateDisabled(); saveSettings({ translateEnabled: translateEnabled.checked }); });

  // ---- 音声・画像ファイルイベント ----
  soundPickBtn.addEventListener('click', () => soundFile.click());
  soundFile.addEventListener('change', async () => {
    const file = soundFile.files[0]; if (!file) return;
    const dataUrl = await fileToDataURL(file);
    soundFileName.textContent = file.name; soundFileName.classList.add('set');
    await saveSettings({ customSoundUrl: dataUrl, customSoundName: file.name });
  });
  soundReset.addEventListener('click', async () => {
    soundFileName.textContent = 'デフォルト音声を使用'; soundFileName.classList.remove('set'); soundFile.value = '';
    await saveSettings({ customSoundUrl: null, customSoundName: null });
  });

  compassPickBtn.addEventListener('click', () => compassFile.click());
  compassFile.addEventListener('change', async () => {
    const file = compassFile.files[0]; if (!file) return;
    const dataUrl = await fileToDataURL(file);
    compassFileName.textContent = file.name; compassFileName.classList.add('set');
    await saveSettings({ customCompassUrl: dataUrl, customCompassName: file.name });
  });
  compassReset.addEventListener('click', async () => {
    compassFileName.textContent = 'デフォルト画像を使用'; compassFileName.classList.remove('set'); compassFile.value = '';
    await saveSettings({ customCompassUrl: null, customCompassName: null });
  });

  // ---- 翻訳API・言語イベント ----
  translateSource.addEventListener('change', () => saveSettings({ translateSource: translateSource.value }));
  translateTarget.addEventListener('change', () => saveSettings({ translateTarget: translateTarget.value }));
  translateEngine.addEventListener('change', () => {
    updateEngineUI();
    saveSettings({ translateEngine: translateEngine.value });
  });

  const saveApiInputs = (e) => {
    const updates = {};
    updates[e.target.id] = e.target.value.trim();
    saveSettings(updates);
  };
  geminiApiKey.addEventListener('change', saveApiInputs);
  openaiApiKey.addEventListener('change', saveApiInputs);
  lmStudioUrl.addEventListener('change', saveApiInputs);

  // ---- ステータス確認 ----
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('geoguessr.com')) {
      statusText.textContent = '✓ geoguessr.com で有効';
      statusText.style.color = '#3ecf8e';
    } else {
      statusText.textContent = 'GeoGuessrを開いてください';
      statusText.style.color = '#f59e0b';
    }
  } catch (_) {}
})();