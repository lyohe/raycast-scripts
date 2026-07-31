# Codex Sessions

ローカルのCodexセッションを作成日時の新しい順に一覧表示し、選択したセッションをCodexアプリで開くRaycast Extensionです。

一覧にはセッション名、ワークスペース、作成日時、Codex App Serverが返す状態を表示します。セッション名がない場合は、最初のユーザーメッセージを表示します。

## 必要なもの

- macOS
- Raycast
- Codex CLI 0.146.0以降
- Codexアプリ

既定ではHomebrew Cask版の `/opt/homebrew/bin/codex` を使用します。別の場所にCLIをインストールしている場合は、Raycast Settingsの `Codex CLI Path` を変更してください。

## 動作確認

```bash
cd extensions/codex-sessions
npm install
npm run dev
```

Raycastのroot searchから `List Codex Sessions` を実行してください。セッションを選択してEnterを押すと、`codex://threads/<thread-id>` のディープリンクでCodexアプリが開きます。

## 状態表示について

`実行中`、`承認待ち`、`入力待ち`、`待機中`、`エラー`、`保存済み`を表示します。Extensionが起動するApp Serverとは別のプロセスで実行中のセッションは、`保存済み`と表示される場合があります。
