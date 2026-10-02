// penilaian-tambahan.js — tab controller + renderer untuk tab-tab baru di
// halaman Penilaian (Akademik | Di Bawah Rata² | Setoran Juz Amma | Nilai
// Kompetensi). Tab = tampilan terpisah per hash (#akademik, #bawah-rata, …).
// Fase 1: baca-tampil. Fase 2–4: aktifkan kontrol input (sudah dirender
// disabled di sini supaya strukturnya stabil).
(function () {
  'use strict';

  // Role yang boleh MELIHAT tab tambahan (keputusan owner: pimpinan, mufatish,
  // mustahiq, walisantri). Input semuanya pimpinan (dicek backend).
  var ROLE_TAMBAHAN = ['pimpinan', 'mufatish', 'mustahiq', 'wali_santri'];
  // Role yang boleh melihat tab Akademik (mengikuti MENU_COMBO di xss.js).
  var ROLE_AKADEMIK = ['pimpinan', 'admin', 'mustahiq', 'tim_rapot', 'mufatish', 'muroqib'];

  var BTN_BASE = 'ptab-btn shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors';
  var BTN_ON = 'bg-primary text-white shadow-md';
  var BTN_OFF = 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700';

  var NAMA_SURAT = {
    78: "an-Naba'", 79: "an-Nazi'at", 80: "'Abasa", 81: 'at-Takwir', 82: 'al-Infitar',
    83: 'al-Muthaffifin', 84: 'al-Inshiqaq', 85: 'al-Buruj', 86: 'at-Tariq', 87: "al-A'la",
    88: 'al-Ghasyiyah', 89: 'al-Fajr', 90: 'al-Balad', 91: 'asy-Syams', 92: 'al-Lail',
    93: 'ad-Dhuha', 94: 'asy-Syarh', 95: 'at-Tin', 96: "al-'Alaq", 97: 'al-Qadr',
    98: 'al-Bayyinah', 99: 'az-Zalzalah', 100: "al-'Adiyat", 101: "al-Qari'ah",
    102: 'at-Takatsur', 103: "al-'Asr", 104: 'al-Humazah', 105: 'al-Fil', 106: 'Quraisy',
    107: "al-Ma'un", 108: 'al-Kautsar', 109: 'al-Kafirun', 110: 'an-Nasr', 111: 'al-Masad',
    112: 'al-Ikhlas', 113: 'al-Falaq', 114: 'an-Nas'
  };

  var TABS = ['akademik', 'bawah-rata', 'juz-amma', 'kompetensi'];
  var visible = {};       // tab -> bool (hasil cek role)
  var currentTab = 'akademik';
  var me = null;

  // ── util ──────────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n, d) {
    if (typeof n !== 'number' || isNaN(n)) return '-';
    return n.toFixed(d).replace('.', ',');
  }
  function roleList() {
    if (!me) return [];
    if (Array.isArray(me.roles)) return me.roles;
    if (me.role) return [me.role];
    return [];
  }
  function punyaRole(daftar) {
    var r = roleList();
    return r.some(function (x) { return daftar.indexOf(x) !== -1; });
  }
  function jget(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) { var e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
      return res.json();
    });
  }
  function judulHasil(h) {
    return h === 'lulus' ? 'Lulus' : h === 'her' ? 'Her' : h === 'tidak_lulus' ? 'Tidak Lulus' : '(belum dinilai)';
  }

  // ── tabel ─────────────────────────────────────────────────────────────────
  function tabelHTML(kolom, isi, kosongMsg) {
    if (!isi) {
      return '<div class="p-8 text-center text-gray-500 dark:text-gray-400">' + esc(kosongMsg) + '</div>';
    }
    return '<div class="overflow-x-auto"><table class="w-full text-sm border-collapse">' +
      '<thead><tr class="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">' +
      kolom.map(function (k) { return '<th class="px-3 py-2 font-bold whitespace-nowrap">' + k + '</th>'; }).join('') +
      '</tr></thead><tbody class="divide-y divide-gray-100 dark:divide-slate-700/60">' +
      isi + '</tbody></table></div>';
  }
  function errHTML(e) {
    if (e && e.status === 403) {
      return '<div class="p-8 text-center text-amber-600 dark:text-amber-400">Anda tidak memiliki akses melihat data ini.</div>';
    }
    return '<div class="p-8 text-center text-red-500">Gagal memuat data: ' + esc(e && e.message ? e.message : e) + '</div>';
  }

  // ── Tab: Di Bawah Rata² ───────────────────────────────────────────────────
  function loadBawahRata() {
    var el = $('br-table');
    if (!el) return Promise.resolve();
    el.innerHTML = '<div class="p-6 text-center text-gray-400">Memuat…</div>';
    var p = new URLSearchParams({ kuartal: $('br-kuartal').value });
    var d = $('br-dalam').value; if (d) p.set('dalam_masa', d);
    var s = $('br-selesai').value; if (s) p.set('selesai', s);
    return jget('/api/penilaian-tambahan/bawah-rata?' + p.toString()).then(function (rows) {
      var isi = rows.map(function (r, i) {
        return '<tr>' +
          '<td class="px-3 py-2 text-gray-400">' + (i + 1) + '</td>' +
          '<td class="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">' + esc(r.nama) + '</td>' +
          '<td class="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">' + esc(r.bagian) + '</td>' +
          '<td class="px-3 py-2 text-right">' + fmt(r.jumlah_nilai, 1) + '</td>' +
          '<td class="px-3 py-2 text-right font-bold text-red-500">' + fmt(r.rata2, 2) + '</td>' +
          '<td class="px-3 py-2">' + (r.konsekuensi ? esc(r.konsekuensi) : '<span class="text-gray-400">-</span>') + '</td>' +
          '<td class="px-3 py-2">' + (r.jenis_takziran ? esc(r.jenis_takziran) : '<span class="text-gray-400">-</span>') + '</td>' +
          '<td class="px-3 py-2 text-center"><input type="checkbox" disabled class="w-4 h-4 accent-amber-500" ' + (r.dalam_masa ? 'checked' : '') + '></td>' +
          '<td class="px-3 py-2 text-center"><input type="checkbox" disabled class="w-4 h-4 accent-emerald-600" ' + (r.selesai ? 'checked' : '') + '></td>' +
          '</tr>';
      }).join('');
      el.innerHTML = tabelHTML(
        ['No', 'Nama', 'Bagian', 'Jumlah Nilai', 'Rata² Nilai', 'Konsekuensi', 'Jenis Takziran', 'Dalam Masa Takziran', 'Selesai Takziran'],
        isi,
        'Tidak ada siswi dengan rata-rata di bawah 4,4 pada kuartal ini.');
    }).catch(function (e) { el.innerHTML = errHTML(e); });
  }

  // ── Tab: Setoran Juz Amma ─────────────────────────────────────────────────
  function chipSurat(s, santriID) {
    var nama = NAMA_SURAT[s.no] || ('Surat ' + s.no);
    return '<label class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-[11px] text-gray-700 dark:text-gray-200 cursor-not-allowed" title="' + s.no + ' · ' + esc(nama) + '">' +
      '<input type="checkbox" disabled class="w-3 h-3 accent-emerald-600" data-santri="' + santriID + '" data-surat="' + s.no + '" ' + (s.setor ? 'checked' : '') + '>' +
      '<span>' + esc(nama) + '</span></label>';
  }
  function loadJuzAmma() {
    var el = $('ja-table');
    if (!el) return Promise.resolve();
    el.innerHTML = '<div class="p-6 text-center text-gray-400">Memuat…</div>';
    var p = new URLSearchParams();
    var b = $('ja-bagian').value; if (b) p.set('bagian_id', b);
    var s = $('ja-status').value; if (s) p.set('status', s);
    var ev = $('ja-evaluasi').value; if (ev) p.set('evaluasi', ev);
    var qs = p.toString();
    return jget('/api/penilaian-tambahan/juz-amma' + (qs ? '?' + qs : '')).then(function (rows) {
      var isi = rows.map(function (r, i) {
        var setor = r.surat.filter(function (x) { return x.setor; }).length;
        var badge = r.evaluasi
          ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold ' +
            (r.evaluasi === 'lulus' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
              : r.evaluasi === 'her' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
              : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300') + '">' + esc(judulHasil(r.evaluasi)) + '</span>'
          : '<span class="text-gray-400">-</span>';
        var status = r.status === 'selesai'
          ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Selesai</span>'
          : '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-300">Belum</span>';
        return '<tr>' +
          '<td class="px-3 py-2 text-gray-400 align-top">' + (i + 1) + '</td>' +
          '<td class="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap align-top">' + esc(r.bagian) + '</td>' +
          '<td class="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap align-top">' + esc(r.nama) + '</td>' +
          '<td class="px-3 py-2 align-top"><div class="flex flex-wrap gap-1 max-w-[560px]">' +
            r.surat.map(function (x) { return chipSurat(x, r.santri_id); }).join('') +
          '</div><div class="text-[11px] text-gray-400 mt-1.5">' + setor + '/' + r.jumlah_surat + ' surat disetor · An-Nas s/d ' +
            esc(NAMA_SURAT[r.surat_sampai] || ('Surat ' + r.surat_sampai)) + '</div></td>' +
          '<td class="px-3 py-2 align-top text-center">' + badge + '</td>' +
          '<td class="px-3 py-2 align-top text-center">' + status + '</td>' +
          '</tr>';
      }).join('');
      el.innerHTML = tabelHTML(
        ['No', 'Bagian', 'Nama Siswi', 'Nama Surat', 'Evaluasi', 'Selesai / Belum'],
        isi,
        'Tidak ada data setoran Juz Amma untuk filter ini.');
    }).catch(function (e) { el.innerHTML = errHTML(e); });
  }

  // ── Tab: Nilai Kompetensi ─────────────────────────────────────────────────
  function loadKompetensi() {
    var el = $('km-table');
    if (!el) return Promise.resolve();
    el.innerHTML = '<div class="p-6 text-center text-gray-400">Memuat…</div>';
    var p = new URLSearchParams({ kategori: $('km-kategori').value });
    var h = $('km-hasil').value; if (h) p.set('hasil', h);
    var b = $('km-bagian').value; if (b) p.set('bagian_id', b);
    return jget('/api/penilaian-tambahan/kompetensi?' + p.toString()).then(function (rows) {
      var isi = rows.map(function (r, i) {
        return '<tr>' +
          '<td class="px-3 py-2 text-gray-400">' + (i + 1) + '</td>' +
          '<td class="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">' + esc(r.nama) + '</td>' +
          '<td class="px-3 py-2"><select disabled data-santri="' + r.santri_id + '" data-kategori="' + esc(r.kategori) + '" ' +
            'class="km-select glass-input px-2 py-1.5 rounded-lg text-xs w-[160px]">' +
            '<option value="" ' + (!r.hasil ? 'selected' : '') + '>(belum dinilai)</option>' +
            '<option value="lulus" ' + (r.hasil === 'lulus' ? 'selected' : '') + '>Lulus</option>' +
            '<option value="her" ' + (r.hasil === 'her' ? 'selected' : '') + '>Her</option>' +
            '<option value="tidak_lulus" ' + (r.hasil === 'tidak_lulus' ? 'selected' : '') + '>Tidak Lulus</option>' +
            '</select></td>' +
          '</tr>';
      }).join('');
      el.innerHTML = tabelHTML(
        ['No', 'Nama', 'Lulus / Her / Tidak Lulus'],
        isi,
        'Tidak ada siswi untuk kategori ujian & filter ini.');
    }).catch(function (e) { el.innerHTML = errHTML(e); });
  }

  var LOADERS = {
    'bawah-rata': loadBawahRata,
    'juz-amma': loadJuzAmma,
    'kompetensi': loadKompetensi
  };

  // ── tab controller ────────────────────────────────────────────────────────
  function defaultTab() {
    if (visible['akademik']) return 'akademik';
    for (var i = 1; i < TABS.length; i++) { if (visible[TABS[i]]) return TABS[i]; }
    return 'akademik';
  }
  function activate(tab) {
    if (!tab || TABS.indexOf(tab) === -1) tab = defaultTab();
    if (!visible[tab]) tab = defaultTab();
    currentTab = tab;
    document.querySelectorAll('.ptab-panel').forEach(function (p) { p.classList.add('hidden'); });
    var panel = document.getElementById('tab-' + tab);
    if (panel) panel.classList.remove('hidden');
    document.querySelectorAll('.ptab-btn').forEach(function (btn) {
      var on = btn.dataset.tab === tab;
      btn.className = BTN_BASE + ' ' + (on ? BTN_ON : BTN_OFF);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if ((location.hash || '').slice(1) !== tab) history.replaceState(null, '', '#' + tab);
    if (LOADERS[tab]) LOADERS[tab]();
  }
  function applyVisibility() {
    // Tanpa /api/me yang valid → tampil baseline tab akademik saja.
    var bolehTambahan = me ? punyaRole(ROLE_TAMBAHAN) : false;
    var bolehAkademik = me ? punyaRole(ROLE_AKADEMIK) : true;
    TABS.forEach(function (t) {
      visible[t] = (t === 'akademik') ? bolehAkademik : bolehTambahan;
    });
    document.querySelectorAll('.ptab-btn').forEach(function (btn) {
      if (visible[btn.dataset.tab]) btn.classList.remove('hidden');
      else btn.classList.add('hidden');
    });
    if (!visible['akademik']) {
      var p = document.getElementById('tab-akademik');
      if (p) p.classList.add('hidden');
    }
  }

  // ── dropdown bagian (cakupan-aware, sama dengan tab Akademik) ─────────────
  function isiBagian() {
    return fetch('/api/penilaian/bagian', { credentials: 'same-origin' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (bagians) {
        var opts = bagians.map(function (b) {
          var label = ((b.kelas || '') + ' ' + (b.tingkatan || '') + ' ' + (b.nama_bagian || '')).trim();
          return '<option value="' + b.id + '">' + esc(label) + '</option>';
        }).join('');
        ['ja-bagian', 'km-bagian'].forEach(function (id) {
          var el = $(id);
          if (el) el.insertAdjacentHTML('beforeend', opts);
        });
      })
      .catch(function () { /* dropdown tetap bisa dipakai tanpa opsi */ });
  }

  // ── init ──────────────────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.ptab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { activate(btn.dataset.tab); });
    });
    window.addEventListener('hashchange', function () {
      activate((location.hash || '').slice(1));
    });
    [['br-refresh', 'bawah-rata'], ['ja-refresh', 'juz-amma'], ['km-refresh', 'kompetensi']].forEach(function (pair) {
      var el = $(pair[0]);
      if (el) el.addEventListener('click', function () { if (LOADERS[pair[1]]) LOADERS[pair[1]](); });
    });

    isiBagian().then(function () {
      return fetch('/api/me', { credentials: 'same-origin' })
        .then(function (res) { if (res.ok) return res.json(); return null; })
        .catch(function () { return null; });
    }).then(function (hasil) {
      me = hasil;
      applyVisibility();
      activate((location.hash || '').slice(1) || defaultTab());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
