# Open Ports Menu

Raycast Extension API の `MenuBarExtra` を使って、macOS の listening TCP port をメニューバーから確認します。

この機能は Script Command ではありません。`extensions/` 配下に置いているため、通常の `scripts/` ディレクトリを Raycast に登録していても読み込まれません。また、拡張としてインストールした場合も `disabledByDefault: true` にしているため、コマンドはデフォルトでオフです。

## 動作確認

```bash
cd extensions/open-ports-menu
npm install
npm run dev
```

1. Raycast Settings > Extensions で `Open Ports Menu` を開く。
2. `Open Ports Menu` 行の `Enabled` チェックボックスをオンにする。
3. 右ペインの `Activate` を押すか、Raycast の root search から `Open Ports Menu` を実行する。
4. macOS のメニューバーに `Ports: 5` のような件数が表示される。

表示は1分ごとに再読込されます。メニュー内の `Refresh` から手動更新もできます。

メニューバーから一時的に消したい場合は、メニュー内の `Quit Open Ports Menu` を選びます。再表示するには Raycast の root search から `Open Ports Menu` を実行してください。

この extension は確認用です。プロセスを kill する操作は入れていません。
