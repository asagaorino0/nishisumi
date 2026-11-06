(() => {
  async function updateMemberCount() {
    const node = document.getElementById('home-member-count');
    if (!node) return;
    try {
      const response = await fetch('./data/site-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load member count settings');
      const config = { fallbackGroupsUrl: './data/groups.json', ...await response.json() };
      node.textContent = String(await window.GroupData.loadTotalMemberCount(config));
    } catch (error) {
      console.error('会員数の読み込みに失敗しました。', error);
      node.textContent = '－';
    }
  }
  updateMemberCount();
})();
