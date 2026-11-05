(function (global) {
  'use strict';
  const requests = new Map();

  function load(apiUrl, reportId) {
    const url = new URL(apiUrl);
    url.searchParams.set('resource', 'report-photo');
    url.searchParams.set('reportId', reportId);
    // No includeHidden or fileId is sent; the server checks the public report.
    url.searchParams.delete('includeHidden');
    const key = url.href;
    if (!requests.has(key)) {
      requests.set(key, (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await fetch(key, { credentials: 'omit', cache: 'no-store', signal: controller.signal });
          if (!response.ok) throw new Error('Photo API HTTP error');
          const payload = await response.json();
          if (!payload.ok || !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(payload.dataUrl || '')) {
            throw new Error('Photo API did not return an image');
          }
          return payload.dataUrl;
        } finally {
          clearTimeout(timer);
        }
      })());
    }
    return requests.get(key);
  }

  async function attach(img, apiUrl) {
    const candidates = String(img.dataset.fallbacks || '').split('||').filter(Boolean);
    let pending = false;
    let index = 0;
    function next() {
      if (pending) return;
      if (index < candidates.length) {
        img.src = candidates[index++];
      }
    }
    img.addEventListener('error', next);
    // Ordinary external image URLs keep their existing behavior.
    if (!candidates.length || !apiUrl || !img.dataset.reportId) return;
    pending = true;
    try {
      const dataUrl = await load(apiUrl, img.dataset.reportId);
      if (img.isConnected === false) return;
      pending = false;
      img.src = dataUrl;
    } catch (error) {
      pending = false;
      console.warn('活動報告の写真取得に失敗しました。Apps Scriptの反映と実行者のDrive閲覧権限を確認してください。', error);
      if (img.complete && !img.naturalWidth) next();
    }
  }

  global.ReportPhotos = { attach };
})(window);
