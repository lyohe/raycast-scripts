# Apple Music Playlists

Apple Music のローカル／非公開プレイリストを Raycast 上で検索し、選択したプレイリストを再生するExtensionです。

Raycastの検索欄に文字を入力するとプレイリスト名がインクリメンタルに絞り込まれ、Enterで再生します。プレイリストフォルダは一覧から除外し、通常のプレイリストとスマートプレイリストを表示します。

## 動作確認

```bash
cd extensions/apple-music-playlists
npm install
npm run dev
```

Raycastのroot searchから `Search Apple Music Playlists` を実行してください。

初回実行時は、macOSからRaycastによるMusicの操作許可を求められる場合があります。その場合は許可してください。あとから変更する場合は、macOSの「システム設定 > プライバシーとセキュリティ > オートメーション」で設定できます。

検証が終わったら `npm run dev` を停止してください。
