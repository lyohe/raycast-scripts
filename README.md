# raycast-scripts

自分用の [Raycast Script Commands](https://github.com/raycast/script-commands) を集めるリポジトリ。動作環境として macOS と Raycast が必要です。

## 使い方

```bash
git clone git@github.com:lyohe/raycast-scripts.git

cd raycast-scripts

# Python スクリプトを使用する場合は依存パッケージをインストール
pip install -r scripts/requirements.txt
```

Raycast の Settings から Script を格納するディレクトリとして `./scripts` を追加する。

![Image](https://github.com/user-attachments/assets/8dea0819-7ec4-4639-896f-25cc349bf65c)

## テンプレート

### Menu Bar Command Template

`templates/menu-bar-command` に、macOS のメニューバーへアイコン付きカスタムメニューを表示する Raycast Extension API 用テンプレートがあります。

このテンプレートは `scripts/` 配下に置いていないため普段は読み込まれません。拡張として動かす場合もコマンドは `disabledByDefault: true` でデフォルトオフです。動作確認時だけ `templates/menu-bar-command` で `npm install && npm run dev` を実行し、Raycast Settings > Extensions で `Status Bar Menu Template` 行の `Enabled` チェックボックスをオンにしてから `Activate` してください。

## Raycast Extensions

### Garbage Menu

`extensions/garbage-menu` に、選択した日のごみ収集予定を macOS のメニューバーへ表示する Raycast Extension API 用カスタムメニューがあります。既定の表示対象は明日です。

このカスタムメニューは `scripts/` 配下に置いていないため普段は読み込まれません。拡張として動かす場合もコマンドは `disabledByDefault: true` でデフォルトオフです。動作確認時だけ `extensions/garbage-menu` で `npm install && npm run dev` を実行し、Raycast Settings > Extensions で `Tomorrow Garbage` 行の `Enabled` チェックボックスをオンにしてから `Activate` してください。

## スクリプト一覧

### 📊 CSV/TSV to Markdown Table
CSVまたはTSVデータをMarkdownのテーブル形式に変換します。クリップボードから読み込み、変換結果をクリップボードに出力します。

### 🆔 New UUID v7
RFC 9562準拠のUUID v7を生成します。タイムスタンプベースで時系列順にソート可能なUUIDです。

### 📺 New YouTube-like ID
YouTube動画IDのような11文字のランダムIDを生成します。使用文字：A-Z、a-z、0-9、-、_

### 😀 Random Emoji
`data/emoji.txt`からUnicode Emoji v17.0のfully-qualified絵文字をランダムに選択してクリップボードに出力します。複数絵文字に分解表示されうるZWJ sequenceなどは除外しています。

### 💬 Random Topic
ランダムな会話トピックを選択します。`data/random-topic.txt`からトピックを読み込んでクリップボードに出力します。

### 🔐 SHA-1 Clipboard
クリップボードのテキストをSHA-1でハッシュし、16進ダイジェストをクリップボードに出力します。

### 🔒 SHA-256 Clipboard
クリップボードのテキストをSHA-256でハッシュし、16進ダイジェストをクリップボードに出力します。

### 🎵 Play/Pause Apple Music
Apple Music の再生/停止をトグルします。再生中は停止、停止/一時停止中は再生します。

### 📄 URL to Markdown Converter
クリップボードにコピーしたURLのWebページをMarkdown形式に変換します。LLMへの入力用に最適化された形式で出力します。

### 🌐 Get External IPv4
`https://api.ipify.org`から実行マシンのexternal IPv4を取得してクリップボードに出力します。

### 🖧 Get Local IPv4
デフォルトネットワークインターフェースのローカルIPv4を取得してクリップボードに出力します。

### 📁 Open Downloads Folder
ダウンロードフォルダを Finder で開きます。

### 🧼 URL Purifier
長いURLのトラッキングパラメータを除去してクリーンなリンクに変換します。URLは引数またはクリップボードから読み込み、変換結果をクリップボードに出力します。

## 注意点

予告なしに破壊的変更を加える可能性があります。
