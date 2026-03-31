/**
 * background.js - Service Worker
 * 設定の管理とタブ間の通信を担当
 */

chrome.runtime.onInstalled.addListener(() => {
  // デフォルト設定を保存
  chrome.storage.local.get(
    ['soundEnabled', 'compassEnabled', 'translateEnabled', 'translateTarget', 'translateSource'],
    (stored) => {
      const defaults = {
        soundEnabled: true,
        compassEnabled: true,
        translateEnabled: true,
        translateTarget: 'ja',
        translateSource: 'auto',
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
