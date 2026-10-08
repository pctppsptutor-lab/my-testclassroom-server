(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const msg = (text, ok) => { $('msg').textContent = text; $('msg').className = ok ? 'ok' : 'err'; };
  const token = () => sessionStorage.getItem('cg-admin') || '';
  async function api(method, path, data) {
    const res = await fetch(path, { method, headers: { authorization: 'Bearer ' + token(), 'content-type': 'application/json' }, body: data ? JSON.stringify(data) : undefined, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Lỗi ' + res.status);
    return json;
  }
  const td = t => { const c = document.createElement('td'); c.textContent = t; return c; };
  async function refresh() {
    const all = await api('GET', '/api/admin/sources');
    $('list').replaceChildren(...Object.entries(all).map(([g, v]) => { const tr = document.createElement('tr'); tr.append(td(g), td(v.sourceUrl), td(new Date(v.updatedAt).toLocaleString('vi-VN'))); return tr; }));
    $('panel').hidden = false;
  }
  $('login').addEventListener('click', async () => { sessionStorage.setItem('cg-admin', $('token').value); try { await refresh(); msg('Đã mở.', true); } catch (e) { msg(e.message); } });
  $('preview').addEventListener('click', async () => {
    $('out').replaceChildren();
    try {
      const bank = await api('POST', '/api/admin/preview', { sourceUrl: $('url').value.trim() });
      const h = document.createElement('h3'); h.textContent = `${bank.title} · ${bank.questions.length} câu · phiên bản ${bank.contentVersion}`;
      const ol = document.createElement('ol');
      bank.questions.forEach(q => {
        const li = document.createElement('li'); li.append(q.prompt);
        const ul = document.createElement('ul');
        q.options.forEach(o => { const x = document.createElement('li'); x.textContent = `${o.id}. ${o.text}`; if (o.id === q.correctOptionId) x.className = 'correct'; ul.append(x); });
        li.append(ul); ol.append(li);
      });
      $('out').append(h, ol); msg('Link đọc được và đúng định dạng.', true);
    } catch (e) { msg(e.message); }
  });
  $('save').addEventListener('click', async () => {
    try { await api('PUT', '/api/admin/sources/' + encodeURIComponent($('gameId').value.trim()), { sourceUrl: $('url').value.trim() }); await refresh(); msg('Đã lưu. Áp dụng từ phòng mới hoặc vòng chơi mới.', true); }
    catch (e) { msg(e.message); }
  });
  if (token()) refresh().catch(() => {});
})();
