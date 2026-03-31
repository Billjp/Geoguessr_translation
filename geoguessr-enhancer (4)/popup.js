/**
 * popup.js
 * ポップアップの設定UIロジック
 */
(async function () {
  'use strict';

  // ---- 要素取得 ----
  const $ = (id) => document.getElementById(id);

  const soundEnabled   = $('soundEnabled');
  const soundContent   = $('soundContent');
  const soundPickBtn   = $('soundPickBtn');
  const soundFile      = $('soundFile');
  const soundFileName  = $('soundFileName');
  const soundReset     = $('soundReset');

  const compassEnabled = $('compassEnabled');
  const compassContent = $('compassContent');
  const compassPickBtn = $('compassPickBtn');
  const compassFile    = $('compassFile');
  const compassFileName= $('compassFileName');
  const compassReset   = $('compassReset');

  const translateEnabled= $('translateEnabled');
  const translateContent= $('translateContent');
  const translateSource = $('translateSource');
  const translateTarget = $('translateTarget');

  const statusText = $('statusText');
  const saveToast  = $('saveToast');

  // ---- 設定の読み込み ----
  const stored = await chrome.storage.local.get([
    'soundEnabled', 'customSoundUrl', 'customSoundName',
    'compassEnabled', 'customCompassUrl', 'customCompassName',
    'translateEnabled', 'translateSource', 'translateTarget',
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

  updateDisabled();

  // ---- 保存通知 ----
  function showToast() {
    saveToast.classList.add('show');
    setTimeout(() => saveToast.classList.remove('show'), 1800);
  }

  // ---- セクション無効化 ----
  function updateDisabled() {
    soundContent.classList.toggle('disabled', !soundEnabled.checked);
    compassContent.classList.toggle('disabled', !compassEnabled.checked);
    translateContent.classList.toggle('disabled', !translateEnabled.checked);
  }

  // ---- 設定を保存して content.js に通知 ----
  async function saveSettings(updates) {
    await chrome.storage.local.set(updates);

    // アクティブなGeoGuessrタブにメッセージ送信
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('geoguessr.com')) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: updates,
        }).catch(() => {}); // タブがまだ読み込まれていなくてもエラーにしない
      }
    } catch (_) {}

    showToast();
  }

  // ---- ファイルをBase64 DataURLに変換 ----
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- トグルイベント ----
  soundEnabled.addEventListener('change', () => {
    updateDisabled();
    saveSettings({ soundEnabled: soundEnabled.checked });
  });

  compassEnabled.addEventListener('change', () => {
    updateDisabled();
    saveSettings({ compassEnabled: compassEnabled.checked });
  });

  translateEnabled.addEventListener('change', () => {
    updateDisabled();
    saveSettings({ translateEnabled: translateEnabled.checked });
  });

  // ---- 音声ファイル選択 ----
  soundPickBtn.addEventListener('click', () => soundFile.click());

  soundFile.addEventListener('change', async () => {
    const file = soundFile.files[0];
    if (!file) return;

    const dataUrl = await fileToDataURL(file);
    soundFileName.textContent = file.name;
    soundFileName.classList.add('set');

    await saveSettings({
      customSoundUrl: dataUrl,
      customSoundName: file.name,
    });
  });

  soundReset.addEventListener('click', async () => {
    soundFileName.textContent = 'デフォルト音声を使用';
    soundFileName.classList.remove('set');
    soundFile.value = '';
    await saveSettings({ customSoundUrl: null, customSoundName: null });
  });

  // ---- 方位磁針画像選択 ----
  compassPickBtn.addEventListener('click', () => compassFile.click());

  compassFile.addEventListener('change', async () => {
    const file = compassFile.files[0];
    if (!file) return;

    const dataUrl = await fileToDataURL(file);
    compassFileName.textContent = file.name;
    compassFileName.classList.add('set');

    await saveSettings({
      customCompassUrl: dataUrl,
      customCompassName: file.name,
    });
  });

  compassReset.addEventListener('click', async () => {
    compassFileName.textContent = 'デフォルト画像を使用';
    compassFileName.classList.remove('set');
    compassFile.value = '';
    await saveSettings({ customCompassUrl: null, customCompassName: null });
  });

  // ---- 翻訳設定 ----
  translateSource.addEventListener('change', () => {
    saveSettings({ translateSource: translateSource.value });
  });

  translateTarget.addEventListener('change', () => {
    saveSettings({ translateTarget: translateTarget.value });
  });

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
