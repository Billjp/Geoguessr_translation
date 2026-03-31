# GeoGuessr Enhancer JP

Chromium系ブラウザ（Chrome / Edge / Brave等）向けの GeoGuessr 拡張機能です。

## 機能

| 機能 | 説明 |
|------|------|
| 🔊 音声置き換え | ゲス時の「チーン」音を任意のMP3/OGG/WAVに変更 |
| 🧭 方位磁針置き換え | 方位磁針画像を任意のPNG/SVG/GIFに変更 |
| 💬 チャット翻訳 | チャットメッセージに🌐ボタンを追加、クリックで翻訳 |

## インストール方法

1. このZIPを展開する
2. Chromeで `chrome://extensions` を開く
3. 右上の **「デベロッパーモード」** をONにする
4. **「パッケージ化されていない拡張機能を読み込む」** をクリック
5. 展開したフォルダを選択する

## カスタムアセットの追加方法

### 独自の音声ファイルを使う
- 拡張機能ポップアップの「🎧 音声を選択」からMP3/OGG/WAVを選択
- またはデフォルトで使用される `assets/custom-sound.mp3` を差し替え

### 独自の方位磁針画像を使う
- 拡張機能ポップアップの「🖼️ 画像を選択」からPNG/SVG/GIFを選択
- またはデフォルトで使用される `assets/custom-compass.png` を差し替え

## フォルダ構成

```
geoguessr-enhancer/
├── manifest.json      # 拡張機能の定義
├── background.js      # サービスワーカー（設定の初期化）
├── content.js         # メインスクリプト（方位磁針・チャット翻訳）
├── injected.js        # ページコンテキスト注入（Audio APIの横取り）
├── popup.html         # 設定UI
├── popup.js           # 設定UIのロジック
└── assets/
    ├── icon16.png     # 拡張機能アイコン
    ├── icon48.png
    ├── icon128.png
    ├── custom-sound.mp3    # デフォルト置き換え音声（無音プレースホルダー）
    └── custom-compass.png  # デフォルト置き換え方位磁針
```

## 音声URLパターンの調整

GeoGuessrのバージョンアップで音声ファイルのURLが変わる場合は、
`injected.js` の `GUESS_SOUND_PATTERNS` 配列を編集してください。

実際のURLはChrome DevTools → Networkタブ → Mediaフィルター で確認できます。

```javascript
const GUESS_SOUND_PATTERNS = [
  /guess/i,
  /result/i,
  /ding/i,
  // ここに実際のURLパターンを追加
];
```

## 翻訳について

翻訳には [MyMemory API](https://mymemory.translated.net/) を使用しています。
APIキー不要で無料（1日あたり5,000文字まで）。
大量に使う場合はメールアドレス登録で制限が緩和されます。

## 注意事項

- GeoGuessrのUIは随時変更されるため、セレクタが機能しなくなる場合があります
- その際は `content.js` の `COMPASS_SELECTORS` / `CHAT_MESSAGE_SELECTORS` を更新してください
- 拡張機能はローカルで動作し、音声・画像データはブラウザのストレージに保存されます
