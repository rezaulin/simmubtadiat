// frontend/src/js/landing.js — panel CMS landing page (role: pimpinan)
// API: /api/landing/admin/{sections,settings} (CSRF header otomatis via csrf.js)

const state = {
  sections: [],
  settings: [],
  news: [],
  editing: null, // null = baru, number = id
  sourceMode: false,
  newsEditing: null, // null = berita baru, number = id
  newsSource: false,
  galleryTarget: 'content', // content | news-content | cover
};

const $ = (id) => document.getElementById(id);

// ---------- util ----------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(msg, kind) {
  let box = document.getElementById('lp-toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'lp-toast';
    box.className = 'fixed z-[95] bottom-24 md:bottom-8 right-4 left-4 md:left-auto flex flex-col gap-2 items-stretch md:items-end pointer-events-none';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  const color = kind === 'error'
    ? 'bg-red-600 text-white'
    : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900';
  el.className = color + ' px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-opacity duration-300';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; }, 2600);
  setTimeout(() => { el.remove(); }, 3100);
}

async function api(path, opts) {
  opts = opts || {};
  const res = await fetch(path, opts);
  let data = null;
  const txt = await res.text();
  if (txt) { try { data = JSON.parse(txt); } catch (e) { data = txt; } }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : ('HTTP ' + res.status);
    throw new Error(msg);
  }
  return data;
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ---------- auth ----------
async function checkAuth() {
  const res = await fetch('/api/me');
  if (!res.ok) { window.location.href = '/login.html'; return false; }
  const data = await res.json();
  const roles = data.roles || (data.role ? [data.role] : []);
  if (!roles.includes('pimpinan')) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// ---------- sections ----------
function sectionCard(s) {
  const sub = s.subdomain ? esc(s.subdomain) : '';
  const statusBadge = s.is_published
    ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">PUBLISH</span>'
    : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-gray-300">DRAFT</span>';
  const menuBadge = s.tampil_di_menu
    ? '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">DI MENU</span>'
    : '';
  const len = (s.konten_html || '').length;
  return `
  <div class="glass dark:bg-slate-800/80 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 flex flex-col gap-3">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="font-bold text-gray-800 dark:text-white truncate">${esc(s.judul)}</h3>
          ${statusBadge}${menuBadge}
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          urutan ${s.urutan} &middot; <span class="font-mono">/p/${esc(s.slug)}</span>
          ${sub ? ' &middot; <span class="font-mono">' + sub + '</span>' : ''}
          &middot; ${len} karakter
        </p>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button type="button" data-edit="${s.id}" class="p-2 rounded-lg text-primary hover:bg-primary/10" title="Edit"><i data-lucide="pencil" class="w-4 h-4"></i></button>
        <a href="/p/${esc(s.slug)}" target="_blank" rel="noopener" class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700" title="Lihat"><i data-lucide="external-link" class="w-4 h-4"></i></a>
        <button type="button" data-del="${s.id}" class="p-2 rounded-lg text-red-500 hover:bg-red-500/10" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    </div>
  </div>`;
}

function renderSections() {
  const list = $('section-list');
  const empty = $('section-empty');
  const items = state.sections.slice().sort((a, b) => (a.urutan - b.urutan) || (a.id - b.id));
  list.innerHTML = items.map(sectionCard).join('');
  if (items.length === 0) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
  } else {
    empty.classList.add('hidden');
    list.classList.remove('hidden');
  }
  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-edit'), 10);
      const s = state.sections.find((x) => x.id === id);
      if (s) openEditor(s);
    });
  });
  list.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteSection(parseInt(btn.getAttribute('data-del'), 10)));
  });
  refreshIcons();
}

async function loadSections() {
  try {
    state.sections = await api('/api/landing/admin/sections');
    renderSections();
  } catch (err) {
    toast('Gagal memuat halaman: ' + err.message, 'error');
  }
}

async function deleteSection(id) {
  const s = state.sections.find((x) => x.id === id);
  if (!s) return;
  if (!window.confirm('Hapus halaman "' + s.judul + '"? Tindakan ini tidak bisa dibatalkan.')) return;
  try {
    await api('/api/landing/admin/sections/' + id, { method: 'DELETE' });
    toast('Halaman dihapus');
    await loadSections();
  } catch (err) {
    toast('Gagal menghapus: ' + err.message, 'error');
  }
}

// ---------- editor ----------
function editorOpen() {
  $('editor-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function editorClose() {
  $('editor-modal').classList.add('hidden');
  document.body.style.overflow = '';
  $('editor-error').classList.add('hidden');
}

function setSourceMode(on) {
  state.sourceMode = on;
  const ed = $('f-konten');
  const src = $('f-konten-src');
  const toolbar = $('editor-toolbar');
  if (on) {
    src.value = ed.innerHTML;
    src.classList.remove('hidden');
    ed.classList.add('hidden');
    toolbar.classList.add('opacity-40', 'pointer-events-none');
    $('btn-toggle-source').textContent = 'Editor visual';
  } else {
    ed.innerHTML = src.value;
    src.classList.add('hidden');
    ed.classList.remove('hidden');
    toolbar.classList.remove('opacity-40', 'pointer-events-none');
    $('btn-toggle-source').textContent = 'Sumber HTML';
  }
}

function openEditor(section) {
  state.editing = section ? section.id : null;
  $('editor-title').textContent = section ? 'Edit Halaman' : 'Halaman Baru';
  $('f-judul').value = section ? section.judul : '';
  $('f-slug').value = section ? section.slug : '';
  $('f-subdomain').value = section && section.subdomain ? section.subdomain : '';
  $('f-urutan').value = section ? section.urutan : (state.sections.length + 1);
  $('f-publish').checked = section ? !!section.is_published : true;
  $('f-menu').checked = section ? !!section.tampil_di_menu : true;
  $('f-meta-title').value = section ? (section.meta_title || '') : '';
  $('f-meta-desc').value = section ? (section.meta_description || '') : '';
  $('f-og').value = section ? (section.og_image || '') : '';
  $('f-konten').innerHTML = section ? (section.konten_html || '') : '';
  $('f-konten-src').value = '';
  if (state.sourceMode) setSourceMode(false);
  const prev = $('editor-preview');
  if (section && section.slug) {
    prev.href = '/p/' + section.slug;
    prev.classList.remove('hidden');
    prev.classList.add('sm:flex');
  } else {
    prev.classList.add('hidden');
    prev.classList.remove('sm:flex');
  }
  editorOpen();
  setTimeout(() => $('f-judul').focus(), 50);
}

function payloadFromForm() {
  const konten = state.sourceMode ? $('f-konten-src').value : $('f-konten').innerHTML;
  const sub = $('f-subdomain').value.trim();
  return {
    slug: $('f-slug').value.trim(),
    subdomain: sub === '' ? null : sub,
    judul: $('f-judul').value.trim(),
    konten_html: konten,
    meta_title: $('f-meta-title').value.trim(),
    meta_description: $('f-meta-desc').value.trim(),
    og_image: $('f-og').value.trim(),
    urutan: parseInt($('f-urutan').value, 10) || 0,
    tampil_di_menu: $('f-menu').checked,
    is_published: $('f-publish').checked,
  };
}

async function saveSection(ev) {
  ev.preventDefault();
  const errBox = $('editor-error');
  errBox.classList.add('hidden');
  const payload = payloadFromForm();
  const btn = $('editor-save');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  try {
    if (state.editing) {
      await api('/api/landing/admin/sections/' + state.editing, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/landing/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    toast('Halaman disimpan');
    editorClose();
    await loadSections();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan';
  }
}

// ---------- settings ----------
const GRUP_LABEL = { umum: 'Identitas Umum', kontak: 'Kontak & Alamat', sosial: 'Media Sosial', seo: 'SEO Default' };
const TEXTAREA_KEYS = { maps_embed: true, footer_alamat: true, seo_description: true };

function renderSettings() {
  const wrap = $('settings-groups');
  const groups = {};
  state.settings.forEach((s) => {
    const g = s.grup || 'umum';
    (groups[g] = groups[g] || []).push(s);
  });
  const order = ['umum', 'kontak', 'sosial', 'seo'];
  const keys = order.filter((g) => groups[g]).concat(Object.keys(groups).filter((g) => order.indexOf(g) === -1));
  wrap.innerHTML = keys.map((g) => {
    const rows = groups[g].map((s) => {
      const id = 'set-' + s.key;
      const label = esc(s.label || s.key);
      const val = esc(s.value || '');
      const input = TEXTAREA_KEYS[s.key]
        ? `<textarea id="${id}" data-key="${esc(s.key)}" rows="2" class="glass-input px-3 py-2 rounded-lg text-sm w-full">${val}</textarea>`
        : `<input type="text" id="${id}" data-key="${esc(s.key)}" value="${val}" class="glass-input px-3 py-2 rounded-lg text-sm w-full">`;
      return `<div class="flex flex-col gap-1">
        <label for="${id}" class="text-xs font-semibold text-gray-500 dark:text-gray-400">${label}</label>
        ${input}
      </div>`;
    }).join('');
    return `<div class="flex flex-col gap-3">
      <h3 class="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wide">${esc(GRUP_LABEL[g] || g)}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${rows}</div>
    </div>`;
  }).join('');
}

async function loadSettings() {
  try {
    state.settings = await api('/api/landing/admin/settings');
    renderSettings();
  } catch (err) {
    toast('Gagal memuat pengaturan: ' + err.message, 'error');
  }
}

async function saveSettings() {
  const status = $('settings-status');
  const values = {};
  document.querySelectorAll('#settings-groups [data-key]').forEach((el) => {
    values[el.getAttribute('data-key')] = el.value;
  });
  if (Object.keys(values).length === 0) return;
  const btn = $('btn-save-settings');
  btn.disabled = true;
  status.textContent = 'Menyimpan...';
  try {
    await api('/api/landing/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    status.textContent = '';
    toast('Pengaturan disimpan');
    await loadSettings();
  } catch (err) {
    status.textContent = '';
    toast('Gagal menyimpan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ---------- tabs ----------
function setTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b) => {
    const active = b.getAttribute('data-tab') === name;
    b.classList.toggle('bg-white', active);
    b.classList.toggle('dark:bg-slate-700', active);
    b.classList.toggle('text-gray-800', active);
    b.classList.toggle('dark:text-white', active);
    b.classList.toggle('shadow-sm', active);
    b.classList.toggle('text-gray-500', !active);
    b.classList.toggle('dark:text-gray-400', !active);
  });
  $('panel-sections').classList.toggle('hidden', name !== 'sections');
  $('panel-settings').classList.toggle('hidden', name !== 'settings');
  $('panel-news').classList.toggle('hidden', name !== 'news');
}

// ---------- editor toolbar ----------
function initToolbar() {
  const toolbar = $('editor-toolbar');
  if (!toolbar) return;
  toolbar.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-cmd]')) e.preventDefault();
  });
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    const cmd = btn.getAttribute('data-cmd');
    const ed = $('f-konten');
    ed.focus();
    if (cmd === 'createLink') {
      const url = window.prompt('URL tautan (https://...)', 'https://');
      if (!url) return;
      document.execCommand('createLink', false, url);
      return;
    }
    if (cmd === 'insertImage') {
      const url = window.prompt('URL gambar (https://...)', 'https://');
      if (!url) return;
      document.execCommand('insertImage', false, url);
      return;
    }
    if (cmd.indexOf('formatBlock:') === 0) {
      document.execCommand('formatBlock', false, cmd.split(':')[1]);
      return;
    }
    document.execCommand(cmd, false, null);
  });
}

// ---------- foto: upload & galeri ----------
function insertHtmlAtCursor(html) {
  if (state.sourceMode) {
    const ta = $('f-konten-src');
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    ta.value = ta.value.slice(0, start) + html + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + html.length;
    ta.focus();
    return;
  }
  // Sisip sebagai BLOK baru setelah blok tempat kursor berada.
  // execCommand('insertHTML') membuang atribut class dan menempelkan teks ke
  // paragraf berikutnya, jadi caption hilang. Manipulasi node langsung.
  const ed = $('f-konten');
  ed.focus();
  const sel = window.getSelection();
  let range = null;
  if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) {
    range = sel.getRangeAt(0);
  }
  let block = null;
  if (range) {
    let node = range.startContainer;
    if (node && node.nodeType === 3) node = node.parentNode;
    while (node && node !== ed && node.parentNode !== ed) node = node.parentNode;
    if (node && node !== ed) block = node;
  }
  const frag = document.createRange().createContextualFragment(html);
  const lastNode = frag.lastChild;
  if (block && block.parentNode) {
    block.parentNode.insertBefore(frag, block.nextSibling);
  } else {
    ed.appendChild(frag);
  }
  if (lastNode) {
    const r = document.createRange();
    r.setStartAfter(lastNode);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
}

function imageHtml(img, caption) {
  const dims = (img.width && img.height) ? ' width="' + img.width + '" height="' + img.height + '"' : '';
  const cap = (caption || '').trim();
  const alt = cap || img.name || 'foto';
  const capHtml = cap ? '<p class="cap">' + esc(cap) + '</p>' : '';
  return '<p><img src="' + esc(img.url) + '" alt="' + esc(alt) + '"' + dims + ' loading="lazy"></p>' + capHtml;
}

async function uploadFoto(file) {
  const fd = new FormData();
  fd.append('foto', file);
  toast('Mengunggah foto...');
  const img = await api('/api/landing/admin/upload', { method: 'POST', body: fd });
  const caption = window.prompt('Keterangan foto (opsional)', '') || '';
  insertHtmlAtCursor(imageHtml(img, caption));
  toast('Foto disisipkan');
}

async function loadGallery() {
  const grid = $('gallery-grid');
  grid.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 col-span-full p-3">Memuat...</p>';
  let list = [];
  try {
    list = await api('/api/landing/admin/images');
  } catch (e) {
    grid.innerHTML = '<p class="text-sm text-red-500 col-span-full p-3">Gagal memuat galeri: ' + esc(e.message) + '</p>';
    return;
  }
  if (!list || !list.length) {
    grid.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 col-span-full p-3">Belum ada foto. Pakai tombol Upload.</p>';
    return;
  }
  grid.innerHTML = list.map((it) => (
    '<div class="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">' +
      '<img src="' + esc(it.url) + '" alt="' + esc(it.name) + '" data-url="' + esc(it.url) + '" data-name="' + esc(it.name) + '" class="w-full h-24 object-cover cursor-pointer">' +
      '<button type="button" data-del="' + esc(it.name) + '" class="absolute top-1 right-1 w-6 h-6 rounded-lg bg-red-600 text-white text-sm leading-none opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" title="Hapus foto">&times;</button>' +
      '<span class="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate pointer-events-none">' + esc(it.name) + '</span>' +
    '</div>'
  )).join('');
}

function openGallery(target) {
  state.galleryTarget = target || 'content';
  $('gallery-modal').classList.remove('hidden');
  refreshIcons();
  loadGallery();
}

function closeGallery() {
  $('gallery-modal').classList.add('hidden');
}

async function onGalleryClick(e) {
  const del = e.target.closest('[data-del]');
  if (del) {
    const name = del.getAttribute('data-del');
    if (!window.confirm('Hapus foto ' + name + '? Tautan di konten yang memakainya akan rusak.')) return;
    try {
      await api('/api/landing/admin/images/' + encodeURIComponent(name), { method: 'DELETE' });
      toast('Foto dihapus');
      loadGallery();
    } catch (err) {
      toast('Gagal hapus: ' + err.message, 'error');
    }
    return;
  }
  const pick = e.target.closest('[data-url]');
  if (!pick) return;
  const url = pick.getAttribute('data-url');
  const name = pick.getAttribute('data-name');
  if (state.galleryTarget === 'cover') {
    setCover(url);
    closeGallery();
    toast('Cover dipasang');
    return;
  }
  const img = { url: url, name: name };
  if (state.galleryTarget === 'news-content') {
    const caption = window.prompt('Keterangan foto (opsional)', '') || '';
    insertNewsBlockAtCursor(imageHtml(img, caption));
    closeGallery();
    toast('Foto disisipkan');
    return;
  }
  const caption = window.prompt('Keterangan foto (opsional)', '') || '';
  insertHtmlAtCursor(imageHtml(img, caption));
  closeGallery();
  toast('Foto disisipkan');
}

// ---------- berita ----------
const KAT_LABEL = { pengumuman: 'Pengumuman', kegiatan: 'Kegiatan', prestasi: 'Prestasi', artikel: 'Artikel' };

function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function newsCard(n) {
  const badge = n.is_published
    ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">PUBLISH</span>'
    : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-gray-300">DRAFT</span>';
  const hl = n.is_headline
    ? '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">UTAMA</span>'
    : '';
  const tgl = (n.published_at || '').slice(0, 10);
  const cover = n.cover_url
    ? '<img src="' + esc(n.cover_url) + '" alt="" class="w-14 h-14 rounded-xl object-cover shrink-0 border border-gray-200 dark:border-slate-700">'
    : '<span class="w-14 h-14 rounded-xl bg-gray-100 dark:bg-slate-700 shrink-0 grid place-items-center text-gray-400"><i data-lucide="image" class="w-5 h-5"></i></span>';
  return `
  <div class="glass dark:bg-slate-800/80 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 flex gap-3">
    ${cover}
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2 flex-wrap">
        <h3 class="font-bold text-gray-800 dark:text-white truncate">${esc(n.judul)}</h3>
        ${badge}${hl}
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        ${esc(KAT_LABEL[n.kategori] || n.kategori)} &middot; ${esc(tgl)}
        &middot; <span class="font-mono">/berita/${esc(n.slug)}</span>
      </p>
      <div class="flex items-center gap-1 mt-2">
        <button type="button" data-nedit="${n.id}" class="p-2 rounded-lg text-primary hover:bg-primary/10" title="Edit"><i data-lucide="pencil" class="w-4 h-4"></i></button>
        <a href="/berita/${esc(n.slug)}" target="_blank" rel="noopener" class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700" title="Lihat"><i data-lucide="external-link" class="w-4 h-4"></i></a>
        <button type="button" data-ndel="${n.id}" class="p-2 rounded-lg text-red-500 hover:bg-red-500/10" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    </div>
  </div>`;
}

function renderNews() {
  const list = $('news-list');
  const empty = $('news-empty');
  const items = state.news.slice().sort((a, b) => {
    const da = a.published_at || '';
    const db = b.published_at || '';
    return da < db ? 1 : da > db ? -1 : (b.id - a.id);
  });
  list.innerHTML = items.map(newsCard).join('');
  if (items.length === 0) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
  } else {
    empty.classList.add('hidden');
    list.classList.remove('hidden');
  }
  list.querySelectorAll('[data-nedit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-nedit'), 10);
      const n = state.news.find((x) => x.id === id);
      if (n) openNewsEditor(n);
    });
  });
  list.querySelectorAll('[data-ndel]').forEach((btn) => {
    btn.addEventListener('click', () => deleteNews(parseInt(btn.getAttribute('data-ndel'), 10)));
  });
  refreshIcons();
}

async function loadNews() {
  try {
    state.news = await api('/api/landing/admin/news');
    renderNews();
  } catch (err) {
    toast('Gagal memuat berita: ' + err.message, 'error');
  }
}

async function deleteNews(id) {
  const n = state.news.find((x) => x.id === id);
  if (!n) return;
  if (!window.confirm('Hapus berita "' + n.judul + '"? Tindakan ini tidak bisa dibatalkan.')) return;
  try {
    await api('/api/landing/admin/news/' + id, { method: 'DELETE' });
    toast('Berita dihapus');
    await loadNews();
  } catch (err) {
    toast('Gagal menghapus: ' + err.message, 'error');
  }
}

function newsOpen() {
  $('news-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function newsClose() {
  $('news-modal').classList.add('hidden');
  document.body.style.overflow = '';
  $('news-error').classList.add('hidden');
}

function setNewsSourceMode(on) {
  state.newsSource = on;
  const ed = $('n-konten');
  const src = $('n-konten-src');
  const toolbar = $('n-toolbar');
  if (on) {
    src.value = ed.innerHTML;
    src.classList.remove('hidden');
    ed.classList.add('hidden');
    toolbar.classList.add('opacity-40', 'pointer-events-none');
    $('n-toggle-source').textContent = 'Editor visual';
  } else {
    ed.innerHTML = src.value;
    src.classList.add('hidden');
    ed.classList.remove('hidden');
    toolbar.classList.remove('opacity-40', 'pointer-events-none');
    $('n-toggle-source').textContent = 'Sumber HTML';
  }
}

function showCover(url) {
  const prev = $('n-cover-prev');
  const u = (url || '').trim();
  if (!u) { prev.classList.add('hidden'); prev.removeAttribute('src'); return; }
  prev.src = u;
  prev.classList.remove('hidden');
}

function setCover(url) {
  $('n-cover').value = url || '';
  showCover(url);
}

function openNewsEditor(n) {
  state.newsEditing = n ? n.id : null;
  $('news-title').textContent = n ? 'Edit Berita' : 'Berita Baru';
  $('n-judul').value = n ? n.judul : '';
  $('n-slug').value = n ? n.slug : '';
  $('n-slug').dataset.touched = n ? '1' : '';
  $('n-kategori').value = n ? (n.kategori || 'kegiatan') : 'kegiatan';
  $('n-tanggal').value = n && n.published_at ? String(n.published_at).slice(0, 10) : new Date().toISOString().slice(0, 10);
  $('n-ringkasan').value = n ? (n.ringkasan || '') : '';
  $('n-cover').value = n ? (n.cover_url || '') : '';
  showCover($('n-cover').value);
  $('n-publish').checked = n ? !!n.is_published : true;
  $('n-headline').checked = n ? !!n.is_headline : false;
  $('n-konten').innerHTML = n ? (n.konten_html || '') : '';
  $('n-konten-src').value = '';
  if (state.newsSource) setNewsSourceMode(false);
  const prev = $('news-preview');
  if (n && n.slug) {
    prev.href = '/berita/' + n.slug;
    prev.classList.remove('hidden');
    prev.classList.add('sm:flex');
  } else {
    prev.classList.add('hidden');
    prev.classList.remove('sm:flex');
  }
  newsOpen();
  setTimeout(() => $('n-judul').focus(), 50);
}

function payloadNews() {
  const konten = state.newsSource ? $('n-konten-src').value : $('n-konten').innerHTML;
  return {
    slug: $('n-slug').value.trim(),
    judul: $('n-judul').value.trim(),
    kategori: $('n-kategori').value,
    ringkasan: $('n-ringkasan').value.trim(),
    konten_html: konten,
    cover_url: $('n-cover').value.trim(),
    is_published: $('n-publish').checked,
    is_headline: $('n-headline').checked,
    tanggal: $('n-tanggal').value,
  };
}

async function saveNews(ev) {
  ev.preventDefault();
  const errBox = $('news-error');
  errBox.classList.add('hidden');
  const payload = payloadNews();
  if (!payload.slug) payload.slug = slugify(payload.judul);
  const btn = $('news-save');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  try {
    if (state.newsEditing) {
      await api('/api/landing/admin/news/' + state.newsEditing, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/landing/admin/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    toast('Berita disimpan');
    newsClose();
    await loadNews();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan';
  }
}

function initNewsToolbar() {
  const toolbar = $('n-toolbar');
  if (!toolbar) return;
  toolbar.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-ncmd]')) e.preventDefault();
  });
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ncmd]');
    if (!btn) return;
    const cmd = btn.getAttribute('data-ncmd');
    const ed = $('n-konten');
    ed.focus();
    if (cmd === 'createLink') {
      const url = window.prompt('URL tautan (https://...)', 'https://');
      if (!url) return;
      document.execCommand('createLink', false, url);
      return;
    }
    if (cmd.indexOf('formatBlock:') === 0) {
      document.execCommand('formatBlock', false, cmd.split(':')[1]);
      return;
    }
    document.execCommand(cmd, false, null);
  });
}

function insertNewsBlockAtCursor(html) {
  if (state.newsSource) {
    const ta = $('n-konten-src');
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    ta.value = ta.value.slice(0, start) + html + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + html.length;
    ta.focus();
    return;
  }
  const ed = $('n-konten');
  ed.focus();
  const sel = window.getSelection();
  let range = null;
  if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) {
    range = sel.getRangeAt(0);
  }
  let block = null;
  if (range) {
    let node = range.startContainer;
    if (node && node.nodeType === 3) node = node.parentNode;
    while (node && node !== ed && node.parentNode !== ed) node = node.parentNode;
    if (node && node !== ed) block = node;
  }
  const frag = document.createRange().createContextualFragment(html);
  const lastNode = frag.lastChild;
  if (block && block.parentNode) {
    block.parentNode.insertBefore(frag, block.nextSibling);
  } else {
    ed.appendChild(frag);
  }
  if (lastNode) {
    const r = document.createRange();
    r.setStartAfter(lastNode);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
}

async function uploadCover(file) {
  const fd = new FormData();
  fd.append('foto', file);
  toast('Mengunggah foto...');
  const img = await api('/api/landing/admin/upload', { method: 'POST', body: fd });
  setCover(img.url);
  toast('Cover dipasang');
}

// ---------- boot ----------
(async function boot() {
  if (!(await checkAuth())) return;

  initToolbar();
  initNewsToolbar();
  setTab('sections');
  await Promise.all([loadSections(), loadSettings(), loadNews()]);

  $('btn-new-section').addEventListener('click', () => openEditor(null));
  $('editor-close').addEventListener('click', editorClose);
  $('editor-cancel').addEventListener('click', editorClose);
  $('editor-overlay').addEventListener('click', editorClose);
  $('editor-form').addEventListener('submit', saveSection);
  $('btn-toggle-source').addEventListener('click', () => setSourceMode(!state.sourceMode));
  $('btn-upload-foto').addEventListener('click', () => $('file-foto').click());
  $('file-foto').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { await uploadFoto(f); } catch (err) { toast('Gagal upload: ' + err.message, 'error'); }
  });
  $('btn-galeri-foto').addEventListener('click', openGallery);
  $('gallery-close').addEventListener('click', closeGallery);
  $('gallery-overlay').addEventListener('click', closeGallery);
  $('gallery-grid').addEventListener('click', onGalleryClick);
  $('btn-save-settings').addEventListener('click', saveSettings);

  // Berita
  $('btn-new-news').addEventListener('click', () => openNewsEditor(null));
  $('news-close').addEventListener('click', newsClose);
  $('news-cancel').addEventListener('click', newsClose);
  $('news-overlay').addEventListener('click', newsClose);
  $('news-form').addEventListener('submit', saveNews);
  $('n-toggle-source').addEventListener('click', () => setNewsSourceMode(!state.newsSource));
  $('n-galeri').addEventListener('click', () => openGallery('news-content'));
  $('n-pick-cover').addEventListener('click', () => openGallery('cover'));
  $('n-upload-cover').addEventListener('click', () => $('n-file').click());
  $('n-clear-cover').addEventListener('click', () => setCover(''));
  $('n-cover').addEventListener('input', () => showCover($('n-cover').value));
  $('n-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { await uploadCover(f); } catch (err) { toast('Gagal upload: ' + err.message, 'error'); }
  });
  $('n-judul').addEventListener('input', () => {
    if (!$('n-slug').dataset.touched) $('n-slug').value = slugify($('n-judul').value);
  });
  $('n-slug').addEventListener('input', () => { $('n-slug').dataset.touched = '1'; });
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.addEventListener('click', () => setTab(b.getAttribute('data-tab')));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('editor-modal').classList.contains('hidden')) editorClose();
    if (e.key === 'Escape' && !$('news-modal').classList.contains('hidden')) newsClose();
  });
})();
