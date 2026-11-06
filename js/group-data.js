// Shared roster loading and counting for the home and small-group pages.
(() => {
  const groupMeta = { G1: true, G2: true, G3: true, G4: true };
    const defaultGroupCards = {
      G1: { number: 'GROUP 1', name: 'グループ1', leader: '宮高 豪', leaderDetail: null, memberCount: '約20名', manager: '－', managerDetails: [], members: [], memberDetails: [], memberTotalCount: 0, leaderCount: 0 },
      G2: { number: 'GROUP 2', name: 'グループ2', leader: '松塲 謙一', leaderDetail: null, memberCount: '22名', manager: '濵中・牛丸', managerDetails: [], members: [], memberDetails: [], memberTotalCount: 0, leaderCount: 0 },
      G3: { number: 'GROUP 3', name: 'グループ3', leader: '松浦 貴嗣', leaderDetail: null, memberCount: '約20名', manager: '中村 俊介', managerDetails: [], members: [], memberDetails: [], memberTotalCount: 0, leaderCount: 0 },
      G4: { number: 'GROUP 4', name: 'グループ4', leader: '清水 修吉', leaderDetail: null, memberCount: '約20名', manager: '－', managerDetails: [], members: [], memberDetails: [], memberTotalCount: 0, leaderCount: 0 }
    };
    function parseCsv(text) {
      const rows = [];
      let current = '';
      let row = [];
      let inQuotes = false;

      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];
        if (char === '"') {
          if (inQuotes && next === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current);
          current = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
          if (char === '\r' && next === '\n') {
            i += 1;
          }
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
        } else {
          current += char;
        }
      }

      if (current.length > 0 || row.length > 0) {
        row.push(current);
        rows.push(row);
      }

      return rows;
    }

    function normalizeHeader(value) {
      return String(value || '')
        .replace(/^[\uFEFF\u200B-\u200D\u2060]+/, '')
        .trim()
        .toLowerCase();
    }

    function pickValue(record, keys) {
      for (const key of keys) {
        const normalizedKey = normalizeHeader(key);
        if (Object.prototype.hasOwnProperty.call(record, normalizedKey)) {
          return String(record[normalizedKey] || '').trim();
        }
      }
      return '';
    }

    function normalizeMemberList(value) {
      if (Array.isArray(value)) {
        return value
          .map((item) => String(item || '').trim())
          .filter(Boolean);
      }

      return String(value || '')
        .split(/[\n,、，]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function extractSpreadsheetId(value) {
      const match = String(value || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : '';
    }

    function extractPublishedSheetBaseUrl(value) {
      const match = String(value || '').match(/^(https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[^/]+\/pub)\?/);
      return match ? match[1] : '';
    }

    function buildPublishedSheetQueryBaseUrl(baseUrl) {
      return String(baseUrl || '').replace(/\/pub$/, '/gviz/tq');
    }

    function buildPublishedHtmlUrl(baseUrl) {
      return String(baseUrl || '').replace(/\/pub$/, '/pubhtml');
    }

    async function loadGroupsFromSheet(csvUrl) {
      const response = await fetch(csvUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch published group Google Sheet CSV');
      }
      return parseGroupsFromRows(parseCsv(await response.text()));
    }

    async function loadGroupsFromJson(jsonUrl) {
      const response = await fetch(jsonUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch fallback groups.json');
      }
      const data = await response.json();
      return Object.entries(data.groups || {}).reduce((acc, [groupKey, groupInfo]) => {
        const normalizedGroupKey = String(groupKey || '').toUpperCase();
        if (!groupMeta[normalizedGroupKey]) {
          return acc;
        }

        acc[normalizedGroupKey] = {
          number: String(groupInfo.number || `GROUP ${normalizedGroupKey.slice(1)}`),
          name: String(groupInfo.name || `グループ${normalizedGroupKey.slice(1)}`),
          leader: String(groupInfo.leader || ''),
          memberCount: String(groupInfo.memberCount || ''),
          manager: String(groupInfo.manager || ''),
          members: normalizeMemberList(groupInfo.members || groupInfo.memberNames || ''),
          memberDetails: Array.isArray(groupInfo.memberDetails) ? groupInfo.memberDetails : [],
          memberTotalCount: Number(groupInfo.memberTotalCount || 0),
          leaderCount: Number(groupInfo.leaderCount || 0)
        };
        return acc;
      }, {});
    }

    function parseMemberRosterFromRows(rows) {
      if (!Array.isArray(rows) || rows.length < 2) {
        return { members: [], memberDetails: [], managers: [], memberTotalCount: 0, leaderCount: 0 };
      }

      const headers = rows[0].map((header) => normalizeHeader(header));
      const roster = rows.slice(1)
        .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
        .reduce((acc, row) => {
          const record = {};
          headers.forEach((header, index) => {
            record[header] = row[index] ?? '';
          });

          const visible = pickValue(record, ['visible', '公開']);
          if (visible && ['0', 'false', 'no', '非公開'].includes(visible.toLowerCase())) {
            return acc;
          }

          const name = pickValue(record, ['name', 'membername', 'member', '氏名', '名前', 'メンバー名']);
          const kana = pickValue(record, ['namekana', 'kana', '名前カナ', '氏名カナ']);
          const company = pickValue(record, ['company', '会社', 'companyname', '勤務先']);
          const userDirectoryUrl = pickValue(record, ['userdirectory', 'directoryurl', 'ユーザ名簿', 'ユーザー名簿']);
          const managerValue = pickValue(record, ['manager', 'organizer', '幹事']);
          const normalizedManagerValue = managerValue.toLowerCase();
          const isLeader = ['leader', 'リーダー'].includes(normalizedManagerValue);
          const isManager = !!(
            name
            && managerValue
            && !isLeader
            && !['0', 'false', 'no', 'off', '×', '-', 'ー'].includes(normalizedManagerValue)
          );

          if (name) {
            acc.allMembers.push(name);
          }

          if (
            name
            && !isLeader
            && !isManager
          ) {
            acc.members.push(name);
            acc.memberDetails.push({ name, kana, company, userDirectoryUrl });
          }

          if (name && isLeader) {
            acc.leaderCount += 1;
            if (!acc.leaderDetail) {
              acc.leaderDetail = { name, kana, company, userDirectoryUrl };
            }
          }

          if (isManager) {
            acc.managers.push(name);
            acc.managerDetails.push({ name, kana, company, userDirectoryUrl });
          }

          return acc;
        }, { members: [], memberDetails: [], managers: [], managerDetails: [], allMembers: [], leaderCount: 0, leaderDetail: null });

      return {
        members: roster.members,
        memberDetails: roster.memberDetails,
        managers: [...new Set(roster.managers)],
        managerDetails: roster.managerDetails.filter((manager, index, array) =>
          array.findIndex((item) => item.name === manager.name) === index
        ),
        memberTotalCount: roster.members.length + roster.leaderCount + [...new Set(roster.managers)].length,
        leaderCount: roster.leaderCount,
        leaderDetail: roster.leaderDetail
      };
    }

    async function loadMemberNamesFromSheet(csvUrlOrUrls) {
      const candidates = Array.isArray(csvUrlOrUrls) ? csvUrlOrUrls : [csvUrlOrUrls];
      let lastError = null;

      for (const csvUrl of candidates) {
        if (!csvUrl) {
          continue;
        }

        try {
          const response = await fetch(csvUrl, { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`Failed to fetch group members CSV: ${response.status}`);
          }
          return parseMemberRosterFromRows(parseCsv(await response.text()));
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Failed to fetch published group members Google Sheet CSV');
    }

    function gvizTableToRows(table) {
      const headers = Array.isArray(table && table.cols)
        ? table.cols.map((col) => String((col && (col.label || col.id)) || ''))
        : [];
      const bodyRows = Array.isArray(table && table.rows)
        ? table.rows.map((row) => (
          Array.isArray(row && row.c)
            ? row.c.map((cell) => (cell && typeof cell.v !== 'undefined' ? String(cell.v) : ''))
            : []
        ))
        : [];
      return headers.length ? [headers, ...bodyRows] : bodyRows;
    }

    async function loadMemberNamesViaJsonp(spreadsheetId, options) {
      if (!spreadsheetId || (!options.gid && !options.sheetName)) {
        throw new Error('Missing spreadsheet JSONP settings');
      }

      const callbackName = `groupMembersJsonp_${Math.random().toString(36).slice(2)}`;

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const cleanup = () => {
          delete window[callbackName];
          script.remove();
        };

        const timer = window.setTimeout(() => {
          cleanup();
          reject(new Error('JSONP timeout'));
        }, 10000);

        window[callbackName] = (response) => {
          window.clearTimeout(timer);
          cleanup();

          if (response && response.status && response.status !== 'ok') {
            const errorMessage = response.errors && response.errors.length
              ? String(response.errors[0].detailed_message || response.errors[0].message || response.status)
              : String(response.status);
            reject(new Error(errorMessage));
            return;
          }

          try {
            resolve(parseMemberRosterFromRows(gvizTableToRows(response.table)));
          } catch (error) {
            reject(error);
          }
        };

        script.onerror = () => {
          window.clearTimeout(timer);
          cleanup();
          reject(new Error('JSONP script load failed'));
        };

        script.src = buildGvizJsonpUrl(spreadsheetId, options, callbackName);
        document.head.appendChild(script);
      });
    }

    async function loadPublishedSheetGidMap(baseUrl) {
      if (!baseUrl) {
        return {};
      }

      const response = await fetch(buildPublishedHtmlUrl(baseUrl), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch published sheet HTML: ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = [...doc.querySelectorAll('a[href*="gid="]')];

      return links.reduce((acc, link) => {
        const text = String(link.textContent || '').trim();
        const href = String(link.getAttribute('href') || '');
        const match = href.match(/gid=([0-9]+)/);
        if (!text || !match) {
          return acc;
        }
        acc[text] = match[1];
        return acc;
      }, {});
    }

    function buildSheetCsvUrlFromName(spreadsheetId, sheetName) {
      return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    }

    function buildPublishedSheetCsvUrlFromName(baseUrl, sheetName) {
      return `${baseUrl}?single=true&output=csv&sheet=${encodeURIComponent(sheetName)}`;
    }

    function buildPublishedSheetCsvUrlFromGid(baseUrl, gid) {
      return `${baseUrl}?gid=${encodeURIComponent(gid)}&single=true&output=csv`;
    }

    function buildPublishedSheetQueryUrlFromName(baseUrl, sheetName) {
      return `${buildPublishedSheetQueryBaseUrl(baseUrl)}?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    }

    function buildPublishedSheetQueryUrlFromGid(baseUrl, gid) {
      return `${buildPublishedSheetQueryBaseUrl(baseUrl)}?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
    }

    function buildGvizJsonpUrl(spreadsheetId, options, callbackName) {
      const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
      url.searchParams.set('tqx', `out:json;responseHandler:${callbackName}`);
      if (options.gid) {
        url.searchParams.set('gid', options.gid);
      }
      if (options.sheetName) {
        url.searchParams.set('sheet', options.sheetName);
      }
      return url.toString();
    }

    function formatErrorMessage(error) {
      if (!error) {
        return '';
      }
      return String(error && error.message ? error.message : error).trim();
    }

    async function loadGroupMembers(config) {
      const explicitEntries = Object.entries(config.groupMemberSheetCsvUrls || {})
        .map(([groupKey, csvUrl]) => [String(groupKey || '').toUpperCase(), String(csvUrl || '').trim()])
        .filter(([groupKey, csvUrl]) => groupMeta[groupKey] && csvUrl);
      const configuredSheetNames = Object.entries(config.groupMemberSheetNames || {})
        .map(([groupKey, sheetName]) => [String(groupKey || '').toUpperCase(), String(sheetName || '').trim()])
        .filter(([groupKey, sheetName]) => groupMeta[groupKey] && sheetName);
      const spreadsheetId = extractSpreadsheetId(
        config.spreadsheetEditUrl
        || config.groupSheetEditUrl
        || config.reportSheetEditUrl
        || ''
      );
      const publishedBaseUrl = extractPublishedSheetBaseUrl(
        config.groupSheetCsvUrl
        || config.sheetCsvUrl
        || config.reportSheetCsvUrl
        || ''
      );
      let resolvedGroupMemberSheetGids = Object.entries(config.groupMemberSheetGids || {})
        .reduce((acc, [groupKey, gid]) => {
          const normalizedGroupKey = String(groupKey || '').toUpperCase();
          const normalizedGid = String(gid || '').trim();
          if (groupMeta[normalizedGroupKey] && normalizedGid) {
            acc[normalizedGroupKey] = normalizedGid;
          }
          return acc;
        }, {});

      if (!explicitEntries.length && !configuredSheetNames.length && !Object.keys(resolvedGroupMemberSheetGids).length) {
        return {};
      }

      if (!explicitEntries.length && !Object.keys(resolvedGroupMemberSheetGids).length && publishedBaseUrl) {
        try {
          const publishedSheetGidMap = await loadPublishedSheetGidMap(publishedBaseUrl);
          resolvedGroupMemberSheetGids = configuredSheetNames
            .reduce((acc, [groupKey, sheetName]) => {
              const gid = publishedSheetGidMap[sheetName];
              if (gid) {
                acc[groupKey] = gid;
              }
              return acc;
            }, {});
        } catch (error) {
          console.error('Failed to resolve published sheet gid map', error);
        }
      }

      const gidEntries = explicitEntries.length
        ? []
        : Object.entries(resolvedGroupMemberSheetGids)
          .map(([groupKey, gid]) => [groupKey, [
            buildPublishedSheetCsvUrlFromGid(publishedBaseUrl, gid),
            buildPublishedSheetQueryUrlFromGid(publishedBaseUrl, gid)
          ]]);

      const namedEntries = explicitEntries.length || gidEntries.length
        ? []
        : configuredSheetNames
          .filter(([, sheetName]) => sheetName && (spreadsheetId || publishedBaseUrl))
          .map(([groupKey, sheetName]) => {
            const urls = [];
            if (publishedBaseUrl) {
              urls.push(buildPublishedSheetCsvUrlFromName(publishedBaseUrl, sheetName));
              urls.push(buildPublishedSheetQueryUrlFromName(publishedBaseUrl, sheetName));
            }
            if (spreadsheetId) {
              urls.push(buildSheetCsvUrlFromName(spreadsheetId, sheetName));
            }
            return [groupKey, urls];
          });

      const entries = [...explicitEntries, ...gidEntries, ...namedEntries];
      if (!entries.length) {
        return {};
      }

      const results = await Promise.all(entries.map(async ([groupKey, csvUrl]) => {
        try {
          return [groupKey, { ...(await loadMemberNamesFromSheet(csvUrl)), error: '' }];
        } catch (error) {
          const sheetName = String((config.groupMemberSheetNames || {})[groupKey] || '').trim();
          const gid = resolvedGroupMemberSheetGids[groupKey] || '';

          if (spreadsheetId && (gid || sheetName)) {
            try {
              return [groupKey, { ...(await loadMemberNamesViaJsonp(spreadsheetId, { gid, sheetName })), error: '' }];
            } catch (jsonpError) {
              console.error(`${groupKey} members load failed`, error, jsonpError);
              return [groupKey, { members: [], managers: [], error: formatErrorMessage(jsonpError) }];
            }
          }

          console.error(`${groupKey} members load failed`, error);
          return [groupKey, { members: [], managers: [], error: formatErrorMessage(error) }];
        }
      }));

      return Object.fromEntries(results);
    }

    async function loadGroupDefinitions(config) {
      if (!config.groupSheetCsvUrl) {
        return loadGroupsFromJson(config.fallbackGroupsUrl);
      }

      try {
        return await loadGroupsFromSheet(config.groupSheetCsvUrl);
      } catch (error) {
        console.error(error);
        return loadGroupsFromJson(config.fallbackGroupsUrl);
      }
    }

    function parseGroupsFromRows(rows) {
      if (!Array.isArray(rows) || rows.length < 2) {
        return {};
      }

      const headers = rows[0].map((header) => normalizeHeader(header));
      return rows.slice(1)
        .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
        .reduce((acc, row) => {
          const record = {};
          headers.forEach((header, index) => {
            record[header] = row[index] ?? '';
          });

          const visible = pickValue(record, ['visible', '公開']);
          if (visible && ['0', 'false', 'no', '非公開'].includes(visible.toLowerCase())) {
            return acc;
          }

          const groupKey = pickValue(record, ['group', 'グループ']).toUpperCase();
          if (!groupMeta[groupKey]) {
            return acc;
          }

          acc[groupKey] = {
            number: pickValue(record, ['number', 'groupnumber', '表示番号', 'グループ番号']) || `GROUP ${groupKey.slice(1)}`,
            name: pickValue(record, ['name', 'groupname', '表示名', 'グループ名']) || `グループ${groupKey.slice(1)}`,
            leader: pickValue(record, ['leader', 'リーダー']),
            memberCount: pickValue(record, ['membercount', 'members', 'メンバー数']),
            manager: pickValue(record, ['manager', 'organizer', '幹事']),
            members: normalizeMemberList(pickValue(record, ['membernames', 'memberlist', 'メンバー一覧', 'メンバー名一覧']))
          };
          return acc;
        }, {});
    }

    function getMemberCountText(groupInfo) {
      const total = Number(groupInfo.memberTotalCount || 0);
      const members = normalizeMemberList(groupInfo.members);
      return total > 0 ? `${total}名` : (members.length ? `${members.length}名` : (groupInfo.memberCount || ''));
    }

    async function loadTotalMemberCount(config) {
      const [groups, rosters] = await Promise.all([
        loadGroupDefinitions(config), loadGroupMembers(config)
      ]);
      return Object.keys(groupMeta).reduce((sum, key) => {
        const info = { ...defaultGroupCards[key], ...(groups[key] || {}) };
        const roster = rosters[key];
        // Match the group cards' precedence: roster totals, member list, count label.
        if (roster && roster.memberTotalCount) info.memberTotalCount = roster.memberTotalCount;
        if (roster && roster.members.length) info.members = roster.members;
        const match = String(getMemberCountText(info)).match(/\d+/);
        if (!match) throw new Error(`Missing member count: ${key}`);
        return sum + Number(match[0]);
      }, 0);
    }

    window.GroupData = { defaultGroupCards, getMemberCountText, loadTotalMemberCount,
parseCsv, normalizeHeader, pickValue, normalizeMemberList, extractSpreadsheetId, extractPublishedSheetBaseUrl, buildPublishedSheetQueryBaseUrl, buildPublishedHtmlUrl, loadGroupsFromSheet, loadGroupsFromJson, parseMemberRosterFromRows, loadMemberNamesFromSheet, gvizTableToRows, loadMemberNamesViaJsonp, loadPublishedSheetGidMap, buildSheetCsvUrlFromName, buildPublishedSheetCsvUrlFromName, buildPublishedSheetCsvUrlFromGid, buildPublishedSheetQueryUrlFromName, buildPublishedSheetQueryUrlFromGid, buildGvizJsonpUrl, formatErrorMessage, loadGroupMembers, loadGroupDefinitions, parseGroupsFromRows };
})();
