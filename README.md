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

## スクリプト一覧

### 📊 CSV/TSV to Markdown Table
CSVまたはTSVデータをMarkdownのテーブル形式に変換します。クリップボードから読み込み、変換結果をクリップボードに出力します。

### 🆔 New UUID v7
RFC 9562準拠のUUID v7を生成します。タイムスタンプベースで時系列順にソート可能なUUIDです。

### 📺 New YouTube-like ID
YouTube動画IDのような11文字のランダムIDを生成します。使用文字：A-Z、a-z、0-9、-、_

### 💬 Random Topic
ランダムな会話トピックを選択します。`data/random-topic.txt`からトピックを読み込んでクリップボードに出力します。

### 📄 URL to Markdown Converter
クリップボードにコピーしたURLのWebページをMarkdown形式に変換します。LLMへの入力用に最適化された形式で出力します。

### 🧼 URL Purifier
長いURLのトラッキングパラメータを除去してクリーンなリンクに変換します。URLは引数またはクリップボードから読み込み、変換結果をクリップボードに出力します。

## 注意点

予告なしに破壊的変更を加える可能性があります。
