const REPORT_SHEET_NAME = '活動報告';
const DRIVE_FOLDER_ID = 'PASTE_DRIVE_FOLDER_ID_HERE';
const ADMIN_KEY = '';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    validatePayload_(payload);

    if (ADMIN_KEY && payload.operatorKey !== ADMIN_KEY) {
      return jsonResponse_({ ok: false, error: '管理キーが一致しません。' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REPORT_SHEET_NAME);
    if (!sheet) {
      throw new Error(`シート "${REPORT_SHEET_NAME}" が見つかりません。`);
    }

    const headerValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const headers = headerValues.map((value) => normalizeHeader_(value));
    const rowIndex = findReportRow_(sheet, headers, payload);
    if (!rowIndex) {
      throw new Error('対象の活動報告行が見つかりませんでした。id 列、または date + title を確認してください。');
    }

    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const bytes = Utilities.base64Decode(payload.base64Data);
    const blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', payload.fileName || 'report-photo');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const driveShareUrl = file.getUrl();
    const imageUrl = `https://lh3.googleusercontent.com/d/${file.getId()}`;
    const imageAlt = String(payload.imageAlt || '').trim();

    updateReportCells_(sheet, headers, rowIndex, {
      driveShareUrl,
      imageFileId: file.getId(),
      imageUrl,
      imageAlt
    });

    SpreadsheetApp.flush();

    return jsonResponse_({
      ok: true,
      rowIndex,
      driveShareUrl,
      imageFileId: file.getId(),
      imageUrl,
      imageAlt
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message || '予期しないエラーが発生しました。'
    });
  }
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('送信データが不正です。');
  }
  if (!String(payload.base64Data || '').trim()) {
    throw new Error('画像データがありません。');
  }
  if (!String(payload.fileName || '').trim()) {
    throw new Error('ファイル名がありません。');
  }
  if (!String(payload.reportId || payload.reportDate || '').trim()) {
    throw new Error('対象の活動報告情報が不足しています。');
  }
}

function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase();
}

function findReportRow_(sheet, headers, payload) {
  const values = sheet.getDataRange().getDisplayValues();
  const idIndex = headers.indexOf('id');
  const dateIndex = headers.indexOf('date');
  const titleIndex = headers.indexOf('title');

  for (let row = 1; row < values.length; row += 1) {
    const currentRow = values[row];
    const rowId = idIndex >= 0 ? String(currentRow[idIndex] || '').trim() : '';
    const rowDate = dateIndex >= 0 ? String(currentRow[dateIndex] || '').trim() : '';
    const rowTitle = titleIndex >= 0 ? String(currentRow[titleIndex] || '').trim() : '';

    if (rowId && rowId === String(payload.reportId || '').trim()) {
      return row + 1;
    }
    if (rowDate === String(payload.reportDate || '').trim() && rowTitle === String(payload.reportTitle || '').trim()) {
      return row + 1;
    }
  }

  return 0;
}

function updateReportCells_(sheet, headers, rowIndex, valuesByKey) {
  Object.entries(valuesByKey).forEach(([key, value]) => {
    const columnIndex = headers.indexOf(normalizeHeader_(key));
    if (columnIndex >= 0) {
      sheet.getRange(rowIndex, columnIndex + 1).setValue(value);
    }
  });
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
