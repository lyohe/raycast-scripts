# Menu Bar Command Template

Raycast Extension API の `MenuBarExtra` を使って、macOS のメニューバーにアイコン付きのカスタムメニューを表示するテンプレートです。メニューバーのアイコンは `@raycast/api` の built-in `Icon` を使っています。

このテンプレートは Script Command ではありません。`templates/` 配下に置いているため、通常の `scripts/` ディレクトリを Raycast に登録していても読み込まれません。また、拡張としてインストールした場合も `disabledByDefault: true` にしているため、コマンドはデフォルトでオフです。

## 動作確認

```bash
cd templates/menu-bar-command
npm install
npm run dev
```

1. Raycast Settings > Extensions で `Menu Bar Command Template` を開く。
2. `Status Bar Menu Template` 行の `Enabled` チェックボックスをオンにする。
3. 右ペインの `Activate` を押すか、Raycast の root search から `Status Bar Menu Template` を実行する。
4. macOS のメニューバーにアイコンが表示され、クリックするとサブメニューを含むメニューが開く。

`Activate` が灰色で押せない場合は、`Status Bar Menu Template` 行の `Enabled` チェックボックスがオフになっていないか確認してください。`disabledByDefault: true` のため、初回はこのチェックがオフになります。

メニューバーから一時的に消したい場合は、メニュー内の `Quit Template Menu` を選びます。再表示するには Raycast の root search から `Status Bar Menu Template` を実行してください。

検証が終わったら `npm run dev` を停止し、Raycast Settings > Extensions でこのコマンドを無効にしてください。
