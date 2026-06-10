# nishisumi

大阪中小企業家同友会 西成住之江支部 ポータルサイト

## ファイル構成

- `index.html`: トップページ。Google スプレッドシート CSV を優先し、未設定時は `data/events.json` を読み込みます
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
- `apps_script_report_photo_upload.gs`: 活動報告写真アップロード用の Google Apps Script サンプル
- `local_preview_server.py`: `localhost` で静的表示と写真アップロードのモックをまとめて試すためのローカルサーバー

## 運用メモ

日々の更新は Google スプレッドシートを更新する運用を想定しています。イベント一覧、グループ紹介、活動報告はそれぞれ別シートで管理できます。

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
  "reportUploadWebhookUrl": "https://script.google.com/macros/s/XXXXX/exec"
}
```

日々の更新:

1. Google スプレッドシートにイベントを追加・修正する
2. グループ紹介を変える場合はグループ紹介シートを更新する
3. 活動報告を追加する場合は活動報告シートを更新する
4. 数分待って公開ページを確認する

活動報告写真の管理画面アップロード:

1. Google スプレッドシートと同じブックに `apps_script_report_photo_upload.gs` の内容を貼り付ける
2. `プロジェクトの設定` → `スクリプト プロパティ` に `DRIVE_FOLDER_ID` を登録する
3. 必要なら `REPORT_SHEET_NAME` と `ADMIN_KEY` も `スクリプト プロパティ` に登録する
4. `デプロイ` → `新しいデプロイ` → `ウェブアプリ` で公開する
5. 発行された URL を `data/site-config.json` の `reportUploadWebhookUrl` に設定する
6. `admin.html` の「活動報告の写真差し替え」から対象行と画像を選んで送信する

localhost での試し方:

1. このフォルダで `python3 local_preview_server.py` を実行する
2. `http://127.0.0.1:8000/admin.html` を開く
3. `localhost` では `reportUploadWebhookUrl` が空でも自動で `/mock/report-upload` を使う
4. 写真を送ると `mock_uploads/` に保存され、管理画面上では送信成功と保存先URLを確認できる
5. 本番の Drive / Sheets 更新ではないので、Apps Script 導入前のUI確認や送信動作確認に使う

補足:

- `data/site-config.json` の `sheetCsvUrl` が空の場合は `data/events.json` を表示します
- `data/site-config.json` の `groupSheetCsvUrl` が空の場合は `data/groups.json` を表示します
- `data/site-config.json` の `reportSheetCsvUrl` が空の場合は `data/reports.json` を表示します
- `admin.html` で現在どのデータ元を読んでいるか確認できます
- `group` は `G1` 〜 `G4`、`round` は `1` 〜 `4` を入れると `group.html` の予定欄にも反映されます
- グループ紹介シートの列は `group` / `number` / `name` / `leader` / `memberCount` / `manager` / `visible` を使えます
- 活動報告シートの列は `date` / `category` / `title` / `text` / `place` / `keywords` / `imageUrl` / `imageAlt` / `visible` を使えます
- 活動報告シートでは `id` 列を追加しておくと、管理画面からの写真差し替え対象をより安全に特定できます。未設定でも `date + title` で照合します
- 活動報告シートでは補助列として `driveShareUrl` / `imageFileId` / `previewImage` を追加しても大丈夫です。サイト側は余分な列を無視します
- 画像はシートに直接挿入せず、Drive の共有リンクを `driveShareUrl` に貼る運用がおすすめです。テンプレートの式で `imageFileId` と `imageUrl` を自動生成します。`imageUrl` は `https://lh3.googleusercontent.com/d/FILE_ID` 形式です
- Drive 側は「リンクを知っている全員が閲覧可」にしてください。`imageUrl` には Markdown 形式の `[...](...)` ではなく、画像URLそのものを入れてください
- `previewImage` は `imageUrl` ではなく `imageFileId` から直接生成すると安定します。テンプレートでは `=IMAGE("https://lh3.googleusercontent.com/d/"&imageFileIdセル)` を使っています
- `reports-sheet-template.csv` は 2行目に説明用の補助行が入っています。不要なら削除して構いません
- ボタン文言は日付で自動切替します。`linkLabel` 列は不要です
- `admin.html` の写真差し替えフォームは静的HTMLなので、実際の書き込み先には Apps Script などのWebhookが必要です
- `localhost` では `local_preview_server.py` がモックWebhookも兼ねます。`reportUploadWebhookUrl` が空なら自動で `http://127.0.0.1:8000/mock/report-upload` ではなく、開いているオリジンの `/mock/report-upload` を使います
- Apps Script 版では `DRIVE_FOLDER_ID` を `スクリプト プロパティ` に入れる前提です。`REPORT_SHEET_NAME` は未設定なら `活動報告` を使います
