const REPORT_PHOTO_HELPER_CONFIG = {
  sheetName: '活動報告',
  headerRow: 1,
  thumbnailSize: 'w1600'
};

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: 'report-photo-helper is ready'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const params = (e && e.parameter) || {};
    const driveShareUrl = cleanString_(params.imageUrl);
    const imageAlt = cleanString_(params.imageAlt);
    const reportId = cleanString_(params.reportId);
    const reportDate = cleanString_(params.reportDate);
    const reportTitle = cleanString_(params.reportTitle);

    if (!driveShareUrl) {
      throw new Error('imageUrl が空です。');
    }
    if (!reportId && !(reportDate && reportTitle)) {
      throw new Error('reportId または reportDate + reportTitle が必要です。');
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error('このスクリプトは活動報告スプレッドシートに紐づけて配置してください。');
    }

    const sheet = REPORT_PHOTO_HELPER_CONFIG.sheetName
      ? spreadsheet.getSheetByName(REPORT_PHOTO_HELPER_CONFIG.sheetName)
      : spreadsheet.getActiveSheet();

    if (!sheet) {
      throw new Error('活動報告シートが見つかりません。sheetName を確認してください。');
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow <= REPORT_PHOTO_HELPER_CONFIG.headerRow) {
      throw new Error('活動報告シートにデータ行がありません。');
    }

    const values = sheet
      .getRange(
        REPORT_PHOTO_HELPER_CONFIG.headerRow,
        1,
        lastRow - REPORT_PHOTO_HELPER_CONFIG.headerRow + 1,
        lastColumn
      )
      .getDisplayValues();
    const headers = values[0];
    const rows = values.slice(1);
    const headerIndexMap = buildHeaderIndexMap_(headers);

    const driveShareUrlColumn = findHeaderIndex_(headerIndexMap, [
      '画像url',
      'driveshareurl',
      'shareurl'
    ]);
    const imageFileIdColumn = findHeaderIndex_(headerIndexMap, [
      'imagefileid',
      'fileid'
    ]);
    const derivedImageUrlColumn = findHeaderIndex_(headerIndexMap, [
      'imageurl',
      'thumbnailurl'
    ]);
    const imageAltColumn = findHeaderIndex_(headerIndexMap, [
      '画像説明',
      'imagealt',
      'alt',
      '画像alt',
      '代替テキスト'
    ]);
    const previewImageColumn = findHeaderIndex_(headerIndexMap, [
      'previewimage',
      'preview',
      'プレビュー'
    ]);
    const reportIdColumn = findHeaderIndex_(headerIndexMap, ['識別子', 'id']);
    const reportDateColumn = findHeaderIndex_(headerIndexMap, ['年月日', '日付', 'date']);
    const reportTitleColumn = findHeaderIndex_(headerIndexMap, ['タイトル', 'title']);

    if (driveShareUrlColumn < 0) {
      throw new Error('画像Url 列が見つかりません。');
    }

    const rowIndex = rows.findIndex(function (row) {
      if (reportIdColumn >= 0 && reportId) {
        return cleanString_(row[reportIdColumn]) === reportId;
      }

      return reportDateColumn >= 0
        && reportTitleColumn >= 0
        && cleanString_(row[reportDateColumn]) === reportDate
        && cleanString_(row[reportTitleColumn]) === reportTitle;
    });

    if (rowIndex < 0) {
      throw new Error('一致する活動報告行が見つかりません。年月日とタイトル、または識別子を確認してください。');
    }

    const targetRow = REPORT_PHOTO_HELPER_CONFIG.headerRow + 1 + rowIndex;
    const imageFileId = extractDriveFileId_(driveShareUrl);
    const derivedImageUrl = imageFileId
      ? buildThumbnailImageUrl_(imageFileId)
      : '';

    sheet.getRange(targetRow, driveShareUrlColumn + 1).setValue(driveShareUrl);

    if (imageFileIdColumn >= 0) {
      sheet.getRange(targetRow, imageFileIdColumn + 1).setValue(imageFileId);
    }

    if (derivedImageUrlColumn >= 0) {
      sheet.getRange(targetRow, derivedImageUrlColumn + 1).setValue(derivedImageUrl);
    }

    if (imageAltColumn >= 0 && imageAlt) {
      sheet.getRange(targetRow, imageAltColumn + 1).setValue(imageAlt);
    }

    if (previewImageColumn >= 0) {
      const previewFormula = buildPreviewFormula_(
        targetRow,
        imageFileIdColumn,
        derivedImageUrlColumn
      );
      if (previewFormula) {
        sheet.getRange(targetRow, previewImageColumn + 1).setFormula(previewFormula);
      }
    }

    SpreadsheetApp.flush();

    return buildPostMessageHtml_({
      ok: true,
      message: '活動報告シート ' + targetRow + ' 行目の画像情報を更新しました。',
      imageUrl: driveShareUrl,
      imageFileId: imageFileId,
      derivedImageUrl: derivedImageUrl,
      rowNumber: targetRow
    });
  } catch (error) {
    return buildPostMessageHtml_({
      ok: false,
      message: error && error.message ? error.message : '更新に失敗しました。'
    });
  }
}

function cleanString_(value) {
  return String(value || '').trim();
}

function normalizeHeader_(value) {
  return cleanString_(value).toLowerCase();
}

function buildHeaderIndexMap_(headers) {
  return headers.reduce(function (acc, header, index) {
    acc[normalizeHeader_(header)] = index;
    return acc;
  }, {});
}

function findHeaderIndex_(headerIndexMap, candidates) {
  for (var i = 0; i < candidates.length; i += 1) {
    var key = normalizeHeader_(candidates[i]);
    if (Object.prototype.hasOwnProperty.call(headerIndexMap, key)) {
      return headerIndexMap[key];
    }
  }
  return -1;
}

function extractDriveFileId_(value) {
  var text = cleanString_(value);
  if (!text) {
    return '';
  }

  var markdownMatch = text.match(/\((https?:\/\/[^)]+)\)/i);
  if (markdownMatch && markdownMatch[1]) {
    text = markdownMatch[1];
  }

  var patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/thumbnail\?id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/
  ];

  for (var i = 0; i < patterns.length; i += 1) {
    var match = text.match(patterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
}

function buildThumbnailImageUrl_(fileId) {
  if (!fileId) {
    return '';
  }
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=' + REPORT_PHOTO_HELPER_CONFIG.thumbnailSize;
}

function buildPreviewFormula_(targetRow, imageFileIdColumn, derivedImageUrlColumn) {
  if (imageFileIdColumn >= 0) {
    var imageFileIdCell = columnToLetter_(imageFileIdColumn + 1) + targetRow;
    return '=IF(' + imageFileIdCell + '="","",IMAGE("https://drive.google.com/thumbnail?id="&' + imageFileIdCell + '&"&sz=' + REPORT_PHOTO_HELPER_CONFIG.thumbnailSize + '"))';
  }

  if (derivedImageUrlColumn >= 0) {
    var imageUrlCell = columnToLetter_(derivedImageUrlColumn + 1) + targetRow;
    return '=IF(' + imageUrlCell + '="","",IMAGE(' + imageUrlCell + '))';
  }

  return '';
}

function columnToLetter_(columnNumber) {
  var letter = '';
  var current = columnNumber;

  while (current > 0) {
    var remainder = (current - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    current = Math.floor((current - 1) / 26);
  }

  return letter;
}

function buildPostMessageHtml_(payload) {
  var serialized = JSON.stringify(Object.assign({
    type: 'report-photo-helper-result'
  }, payload));
  var escapedPayload = serialized
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");

  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><body><script>' +
    "window.top.postMessage(JSON.parse('" + escapedPayload + "'), '*');" +
    '</script><p>' + escapeHtml_(payload.message || '') + '</p></body></html>'
  );
}

function escapeHtml_(value) {
  return cleanString_(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
