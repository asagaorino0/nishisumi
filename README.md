# nishisumi

大阪中小企業家同友会 西成住之江支部 ポータルサイト

## ファイル構成

- `index.html`: トップページ。Google スプレッドシート CSV を優先し、未設定時は `data/events.json` を読み込みます。年間スケジュールも同じイベントシートから自動表示します
- `admin.html`: イベント運用ガイドとデータ確認ページ
- `data/site-config.json`: Google スプレッドシートの CSV URL 設定
- `data/events.json`: フォールバック用イベントデータ
- `data/events-sheet-template.csv`: Google スプレッドシート作成用テンプレート
- `data/groups.json`: グループ紹介のフォールバック用データ
- `data/groups-sheet-template.csv`: グループ紹介シートのテンプレート
- `data/reports.json`: 活動報告のフォールバック用データ
- `data/reports-sheet-template.csv`: 活動報告シートのテンプレート
- `report.html`: 活動報告ページ
- `group.html`: 小グループ会ページ
- `github_update_guide.html`: 担当者向け更新手順

## ローカル確認

このサイトは静的HTMLなので、ビルドは不要です。`fetch()` で `data/*.json` を読むため、`file://` ではなくローカルサーバー経由で開いてください。

```bash
npm run dev
```

起動後に以下をブラウザで開きます。

- `http://localhost:8000/`
- `http://localhost:8000/report.html`
- `http://localhost:8000/group.html`
- `http://localhost:8000/admin.html`

`npm` を使わない場合は、同じことを次でも実行できます。

```bash
python3 -m http.server 8000
```

## 運用メモ

日々の更新は Google スプレッドシートを更新する運用を想定しています。イベント一覧、グループ紹介、活動報告はそれぞれ別シートで管理できます。トップページの「2026年度 年間スケジュール」もイベント一覧シートの内容を使って自動更新されます。

初回セットアップ:

1. Google スプレッドシートを作成する
2. イベント列を用意する（`date` / `category` / `group` / `round` / `title` / `detail` / `url` / `visible`）
3. イベント用シートを CSV としてウェブ公開する
4. `data/site-config.json` の `sheetCsvUrl` にその URL を設定する
5. グループ紹介もシート管理したい場合は、別シートを CSV としてウェブ公開する
6. `data/site-config.json` の `groupSheetCsvUrl` にその URL を設定する
7. 活動報告もシート管理したい場合は、別シートを CSV としてウェブ公開する
8. `data/site-config.json` の `reportSheetCsvUrl` にその URL を設定する

### Google スプレッドシート公開URLの取り方

1. Google スプレッドシートを開く
2. `ファイル` → `共有` → `ウェブに公開` を開く
3. 左のプルダウンは `ドキュメント全体` のままにする
4. 右のプルダウンを `ウェブページ` から `カンマ区切りの値（.csv）` に変える
5. `公開する` を押す
6. 表示されたリンクをコピーする
7. `data/site-config.json` の `sheetCsvUrl` に貼り付ける

設定例:

```json
{
  "sheetCsvUrl": "https://docs.google.com/spreadsheets/d/XXXXX/pub?output=csv",
  "fallbackJsonUrl": "./data/events.json",
  "groupSheetCsvUrl": "https://docs.google.com/spreadsheets/d/XXXXX/pub?gid=123456789&single=true&output=csv",
  "fallbackGroupsUrl": "./data/groups.json",
  "reportSheetCsvUrl": "https://docs.google.com/spreadsheets/d/XXXXX/pub?gid=987654321&single=true&output=csv",
  "fallbackReportsUrl": "./data/reports.json",
  "reportDriveFolderUrl": "https://drive.google.com/drive/folders/XXXXX",
  "reportSheetEditUrl": "https://docs.google.com/spreadsheets/d/XXXXX/edit#gid=987654321"
}
```

日々の更新:

1. Google スプレッドシートにイベントを追加・修正する
2. グループ紹介を変える場合はグループ紹介シートを更新する
3. 活動報告を追加する場合は活動報告シートを更新する
4. 数分待って公開ページを確認する

写真リンク入力を少し楽にする運用:

1. `data/site-config.json` の `reportDriveFolderUrl` に画像保存先フォルダURLを入れる
2. `data/site-config.json` の `reportSheetEditUrl` に活動報告シートの編集URLを入れる
3. `report.html` で写真がないカードの `📸 写真をここに差し替え` を押す
4. 別タブで `admin.html` の補助画面が開き、Driveアップロードとスプシ貼り付けの手順が表示される
5. そこから Drive フォルダと活動報告スプシを開く
6. Drive 共有リンクを `driveShareUrl`、写真説明文を `imageAlt` に貼る

補足:

- `data/site-config.json` の `sheetCsvUrl` が空の場合は `data/events.json` を表示します
- `data/site-config.json` の `groupSheetCsvUrl` が空の場合は `data/groups.json` を表示します
- `data/site-config.json` の `reportSheetCsvUrl` が空の場合は `data/reports.json` を表示します
- `admin.html` で現在どのデータ元を読んでいるか確認できます
- `group` は `G1` 〜 `G4`、`round` は `1` 〜 `4` を入れると `group.html` の予定欄にも反映されます
- グループ紹介シートの列は `group` / `number` / `name` / `leader` / `memberCount` / `manager` / `visible` を使えます
- 活動報告シートの列は `date` / `category` / `title` / `text` / `place` / `keywords` / `imageUrl` / `imageAlt` / `visible` を使えます
- 活動報告シートでは補助列として `driveShareUrl` / `imageFileId` / `previewImage` を追加しても大丈夫です。サイト側は余分な列を無視します
- `reportDriveFolderUrl` は「画像をアップロードするDriveフォルダを開くためのURL」です。サイトから直接保存はしません
- `reportSheetEditUrl` は「活動報告シートの編集画面URL」です。公開CSVのURLとは別に、編集用URLを設定してください
- 画像はシートに直接挿入せず、Drive の共有リンクを `driveShareUrl` に貼る運用がおすすめです。テンプレートの式で `imageFileId` と `imageUrl` を自動生成します。`imageUrl` は `https://drive.google.com/thumbnail?id=FILE_ID&sz=w1600` 形式がおすすめです
- Drive 側は「リンクを知っている全員が閲覧可」にしてください。`imageUrl` には Markdown 形式の `[...](...)` ではなく、画像URLそのものを入れてください
- `previewImage` は `imageUrl` ではなく `imageFileId` から直接生成すると安定します。テンプレートでは `=IMAGE("https://drive.google.com/thumbnail?id="&imageFileIdセル&"&sz=w1600")` を使っています
- `reports-sheet-template.csv` は 2行目に説明用の補助行が入っています。不要なら削除して構いません
- ボタン文言は日付で自動切替します。`linkLabel` 列は不要です
