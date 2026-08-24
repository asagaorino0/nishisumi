const REPORT_PHOTO_HELPER_CONFIG = {
  sheetName: '活動報告',
  scheduleSheetName: 'スケジュール',
  headerRow: 1,
  thumbnailSize: 'w1600'
};

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var resource = cleanString_(params.resource).toLowerCase();
    var includeHidden = cleanString_(params.includeHidden).toLowerCase() === 'true';

    if (resource === 'reports') {
      return jsonResponse_({
        ok: true,
        reports: getReportsPayload_(includeHidden)
      });
    }

    if (resource === 'events') {
      return jsonResponse_({
        ok: true,
        events: getEventsPayload_()
      });
    }

    if (resource === 'all') {
      return jsonResponse_({
        ok: true,
        reports: getReportsPayload_(includeHidden),
        events: getEventsPayload_()
      });
    }

    return jsonResponse_({
      ok: true,
      message: 'report-photo-helper is ready'
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      message: error && error.message ? error.message : 'データ取得に失敗しました。'
    });
  }
}

function doPost(e) {
  try {
    const params = (e && e.parameter) || {};
    const driveShareUrl = cleanString_(params.imageUrl);
    const imageAlt = cleanString_(params.imageAlt);
    const reportPlace = cleanString_(params.place);
    const reportText = cleanString_(params.text);
    const reportKeywords = cleanString_(params.keywords);
    const reportVisible = cleanString_(params.visible);
    const reportId = normalizeReportMatchValue_(params.reportId);
    const reportDate = normalizeReportMatchValue_(params.reportDate);
    const reportTitle = normalizeReportMatchValue_(params.reportTitle);
    const hasImageUpdate = Boolean(driveShareUrl);
    const hasTextUpdate = Boolean(reportPlace || reportText || reportKeywords || reportVisible);

    if (!reportId && !(reportDate && reportTitle)) {
      throw new Error('reportId または reportDate + reportTitle が必要です。');
    }
    if (!hasImageUpdate && !hasTextUpdate) {
      throw new Error('更新内容が空です。');
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
    const reportPlaceColumn = findHeaderIndex_(headerIndexMap, [
      '場所',
      'place',
      'location',
      'venue',
      '会場'
    ]);
    const reportTextColumn = findHeaderIndex_(headerIndexMap, [
      '内容',
      'text',
      'body',
      'report',
      '本文',
      '詳細'
    ]);
    const reportKeywordsColumn = findHeaderIndex_(headerIndexMap, [
      'タグ',
      'keywords',
      'tags',
      'キーワード'
    ]);
    const reportVisibleColumn = findHeaderIndex_(headerIndexMap, [
      '公開/非公開',
      'visible',
      '公開'
    ]);
    const reportIdColumn = findHeaderIndex_(headerIndexMap, ['識別子', 'id']);
    const reportDateColumn = findHeaderIndex_(headerIndexMap, ['年月日', '日付', 'date']);
    const reportTitleColumn = findHeaderIndex_(headerIndexMap, ['タイトル', 'title']);

    if (hasImageUpdate && driveShareUrlColumn < 0) {
      throw new Error('画像Url 列が見つかりません。');
    }
    if (reportText && reportTextColumn < 0) {
      throw new Error('内容 列が見つかりません。');
    }
    if (reportKeywords && reportKeywordsColumn < 0) {
      throw new Error('タグ 列が見つかりません。');
    }
    if (reportVisible && reportVisibleColumn < 0) {
      throw new Error('公開/非公開 列が見つかりません。');
    }

    const rowIndex = rows.findIndex(function (row) {
      if (reportIdColumn >= 0 && reportId) {
        return normalizeReportMatchValue_(row[reportIdColumn]) === reportId;
      }

      return reportDateColumn >= 0
        && reportTitleColumn >= 0
        && normalizeReportMatchValue_(row[reportDateColumn]) === reportDate
        && normalizeReportMatchValue_(row[reportTitleColumn]) === reportTitle;
    });

    if (rowIndex < 0) {
      throw new Error('一致する活動報告行が見つかりません。年月日とタイトル、または識別子を確認してください。');
    }

    const targetRow = REPORT_PHOTO_HELPER_CONFIG.headerRow + 1 + rowIndex;
    const skippedFields = [];
    let imageFileId = '';
    let derivedImageUrl = '';

    if (hasImageUpdate) {
      imageFileId = extractDriveFileId_(driveShareUrl);
      derivedImageUrl = imageFileId
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
    }

    if (reportPlaceColumn >= 0 && reportPlace) {
      sheet.getRange(targetRow, reportPlaceColumn + 1).setValue(reportPlace);
    } else if (reportPlace && reportPlaceColumn < 0) {
      skippedFields.push('場所');
    }

    if (reportTextColumn >= 0 && reportText) {
      sheet.getRange(targetRow, reportTextColumn + 1).setValue(reportText);
    }

    if (reportKeywordsColumn >= 0 && reportKeywords) {
      sheet.getRange(targetRow, reportKeywordsColumn + 1).setValue(reportKeywords);
    }

    if (reportVisibleColumn >= 0 && reportVisible) {
      sheet.getRange(targetRow, reportVisibleColumn + 1).setValue(reportVisible);
    }

    SpreadsheetApp.flush();

    let message = '活動報告シート ' + targetRow + ' 行目を更新しました。';
    if (skippedFields.length > 0) {
      message += ' ' + skippedFields.join('・') + ' は活動報告シートに列がないため反映していません。';
    }

    return buildPostMessageHtml_({
      ok: true,
      message: message,
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

function normalizeReportMatchValue_(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
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

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('このスクリプトは対象スプレッドシートに紐づけて配置してください。');
  }
  return spreadsheet;
}

function getSheetRows_(sheetName) {
  var spreadsheet = getSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(sheetName + ' シートが見つかりません。');
  }

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < REPORT_PHOTO_HELPER_CONFIG.headerRow) {
    return [];
  }

  return sheet
    .getRange(
      REPORT_PHOTO_HELPER_CONFIG.headerRow,
      1,
      lastRow - REPORT_PHOTO_HELPER_CONFIG.headerRow + 1,
      lastColumn
    )
    .getDisplayValues();
}

function getSheetRecords_(sheetName) {
  var rows = getSheetRows_(sheetName);
  if (!rows.length) {
    return [];
  }

  var headers = rows[0].map(function (header) {
    return normalizeHeader_(header);
  });

  return rows.slice(1)
    .filter(function (row) {
      return row.some(function (cell) {
        return cleanString_(cell) !== '';
      });
    })
    .map(function (row) {
      var record = {};
      headers.forEach(function (header, index) {
        record[header] = row[index] || '';
      });
      return record;
    });
}

function getReportsPayload_(includeHidden) {
  return getSheetRecords_(REPORT_PHOTO_HELPER_CONFIG.sheetName)
    .map(function (record) {
      var visible = pickRecordValue_(record, ['visible', '公開', '公開/非公開']);
      if (!includeHidden && isHiddenValue_(visible)) {
        return null;
      }

      var date = pickRecordValue_(record, ['date', '日付', '年月日']);
      var title = pickRecordValue_(record, ['title', 'タイトル']);
      return {
        id: pickRecordValue_(record, ['id', '識別子']) || buildReportIdentifier_(date, title),
        date: date,
        categoryLabel: pickRecordValue_(record, ['category', '区分', '種別']) || '活動報告',
        title: title,
        text: pickRecordValue_(record, ['text', 'body', 'report', '本文', '内容', '詳細']),
        place: pickRecordValue_(record, ['place', 'location', 'venue', '会場', '場所']),
        keywords: parseKeywords_(pickRecordValue_(record, ['keywords', 'tags', 'キーワード', 'タグ'])),
        imageUrl: pickRecordValue_(record, ['imageurl', 'image', 'photo', '画像url', '写真url']),
        imageAlt: pickRecordValue_(record, ['imagealt', 'alt', '画像alt', '代替テキスト', '画像説明']),
        visible: visible || ''
      };
    })
    .filter(function (item) {
      return item && item.date && item.title;
    });
}

function getEventsPayload_() {
  return getSheetRecords_(REPORT_PHOTO_HELPER_CONFIG.scheduleSheetName)
    .map(function (record) {
      return {
        date: pickRecordValue_(record, ['date', '日付', '年月日']),
        index: pickRecordValue_(record, ['index', 'round', 'インデックス', '回']),
        category: pickRecordValue_(record, ['category', '区分', '種別']),
        group: pickRecordValue_(record, ['group', 'グループ', '小グループ']),
        title: pickRecordValue_(record, ['title', 'タイトル']),
        place: pickRecordValue_(record, ['place', '場所', 'location', 'venue', '会場']),
        time: pickRecordValue_(record, ['time', '時間']),
        detail: pickRecordValue_(record, ['detail', '詳細', 'place', '場所']),
        url: pickRecordValue_(record, ['url', 'e.doyu_url', 'リンクurl', 'linkurl', 'リンク']),
        linkLabel: pickRecordValue_(record, ['linklabel', 'リンク文字', 'button', 'ボタン文字']),
        latestGuideVisible: isTruthyValue_(pickRecordValue_(record, ['latestguidevisible', '直近のイベント案内表示', 'visible', '公開']))
      };
    })
    .filter(function (item) {
      return item.date && item.title;
    })
    .sort(function (a, b) {
      var dateCompare = cleanString_(a.date).localeCompare(cleanString_(b.date));
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return cleanString_(a.title).localeCompare(cleanString_(b.title), 'ja');
    });
}

function pickRecordValue_(record, keys) {
  for (var i = 0; i < keys.length; i += 1) {
    var key = normalizeHeader_(keys[i]);
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      var value = cleanString_(record[key]);
      if (value) {
        return value;
      }
    }
  }
  return '';
}

function isHiddenValue_(value) {
  var normalized = cleanString_(value).toLowerCase();
  return normalized === '0'
    || normalized === 'false'
    || normalized === 'no'
    || normalized === '非公開';
}

function isTruthyValue_(value) {
  var normalized = cleanString_(value).toLowerCase();
  return normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === '公開';
}

function parseKeywords_(value) {
  return cleanString_(value)
    .split(/[,\n、/／]+/)
    .map(function (item) {
      return cleanString_(item);
    })
    .filter(Boolean);
}

function buildReportIdentifier_(date, title) {
  return normalizeReportMatchValue_(date) + '__' + normalizeReportMatchValue_(title);
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
