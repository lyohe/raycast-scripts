# Garbage Menu

Raycast Extension API の `MenuBarExtra` を使って、選択した日のごみ収集予定を macOS のメニューバーに表示します。既定の表示対象は明日です。

この機能は Script Command ではありません。`extensions/` 配下に置いているため、通常の `scripts/` ディレクトリを Raycast に登録していても読み込まれません。また、拡張としてインストールした場合も `disabledByDefault: true` にしているため、コマンドはデフォルトでオフです。

## データ

既定では、このリポジトリの `data/garbage-calendar.local.tsv` を自動検出します。この実データは住所推測につながるため `.gitignore` 対象です。

TSV の形式は `data/garbage-calendar.sample.tsv` と同じです。

## 動作確認

```bash
cd extensions/garbage-menu
npm install
npm run dev
```

1. Raycast Settings > Extensions で `Garbage Menu` を開く。
2. `Tomorrow Garbage` 行の `Enabled` チェックボックスをオンにする。
3. 右ペインの `Activate` を押すか、Raycast の root search から `Tomorrow Garbage` を実行する。
4. macOS のメニューバーに `明日: 可燃` のような予定が表示される。

`Activate` が灰色で押せない場合は、`Tomorrow Garbage` 行の `Enabled` チェックボックスがオフになっていないか確認してください。`disabledByDefault: true` のため、初回はこのチェックがオフになります。

既定のTSVを自動検出できない場合は、Raycast Preferences の `Calendar TSV Path` に実データの絶対パスを指定してください。

表示は1時間ごとに再読込されます。

メニュー内の各日付を選ぶと、メニューバーの表示対象をその相対日に切り替えます。たとえば `今日` を選ぶと、以後のバックグラウンド更新でもその時点の今日の予定が表示されます。

メニューバーから一時的に消したい場合は、メニュー内の `Quit Garbage Menu` を選びます。再表示するには Raycast の root search から `Tomorrow Garbage` を実行してください。

検証が終わったら `npm run dev` を停止し、Raycast Settings > Extensions でこのコマンドを無効にしてください。
