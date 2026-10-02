// penilaian-tambahan.js — tab controller + renderer untuk tab-tab baru di
// halaman Penilaian (Akademik | Di Bawah Rata-rata | Setoran Juz Amma | Nilai
// Kompetensi). Tab = tampilan terpisah per hash (#akademik, #bawah-rata, …).
// Fase 1: baca-tampil. Fase 2: input takziran aktif. Fase 3: setoran Juz
// Amma aktif. Fase 4: select kompetensi. Kontrol tetap dirender disabled
// bagi role non-pimpinan supaya strukturnya stabil.
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
  // Optimistik true SEBELUM init (/api/me) selesai, supaya klik tab yang
  // datang lebih dulu tetap dihormati (loader jalan; akses final tetap
  // di-apply oleh applyVisibility + dicek backend).
  var visible = {
    'akademik': true, 'bawah-rata': true, 'juz-amma': true, 'kompetensi': true
  };
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

  // ── Tab: Di Bawah Rata-rata ───────────────────────────────────────────────
  // Fase 2: input teks bebas (konsekuensi / jenis takziran) + 2 checkbox aktif.
  // Backend POST hanya untuk pimpinan — kontrol tetap disabled bagi role lain.
  function bolehEditTakziran() { return punyaRole(['pimpinan']); }

  function brStatus(td, teks, warna) {
    var s = td.querySelector('.br-status');
    if (!s) return;
    s.textContent = teks;
    s.className = 'br-status text-[11px] font-semibold ' + warna;
  }

  // Simpan SATU baris. Payload lengkap 4 field karena backend melakukan upsert
  // penuh (field yang tidak dikirim akan jadi kosong/false).
  function simpanTakziran(tr) {
    if (!tr) return Promise.resolve();
    var santriID = parseInt(tr.dataset.santri, 10);
    var kuartal = parseInt($('br-kuartal').value, 10) || 1;
    var ambil = function (kolom) {
      var el = tr.querySelector('[data-kolom="' + kolom + '"]');
      if (!el) return null;
      return el.type === 'checkbox' ? el.checked : el.value;
    };
    var payload = {
      tahun_ajaran: '',   // kosong → backend pakai tahun ajaran aktif
      items: [{
        santri_id: santriID,
        kuartal: kuartal,
        konsekuensi: String(ambil('konsekuensi') || ''),
        jenis_takziran: String(ambil('jenis_takziran') || ''),
        dalam_masa: !!ambil('dalam_masa'),
        selesai: !!ambil('selesai')
      }]
    };
    var tdStatus = tr.querySelector('td:last-child');
    brStatus(tdStatus, 'Menyimpan…', 'text-gray-400');
    return fetch('/api/penilaian-tambahan/bawah-rata/takziran', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!res.ok) throw new Error(d.message || ('HTTP ' + res.status));
        brStatus(tdStatus, '✓ Tersimpan', 'text-emerald-600 dark:text-emerald-400');
        showToast('Takziran tersimpan', 'success');
        // Filter yang memengaruhi KEANGGOTAAN baris: dalam_masa / selesai.
        // Kalau filter itu aktif, daftar perlu di-refresh supaya baris
        // keluar/masuk sesuai filter. Ditunda & dibatalkan bila user sudah
        // mengetik di input lain (jangan rebut fokus).
        if (($('br-dalam').value || $('br-selesai').value) && tr.dataset.stale === '1') {
          refreshSetelahBlur(tr);
        }
        delete tr.dataset.stale;
      });
    }).catch(function (e) {
      brStatus(tdStatus, '✗ Gagal', 'text-red-500');
      showToast('Gagal simpan takziran: ' + e.message, 'error');
    });
  }

  function refreshSetelahBlur(tr) {
    var coba = function () {
      var a = document.activeElement;
      if (a && tr.contains(a) && a.tagName === 'INPUT' && a.type !== 'checkbox') {
        setTimeout(coba, 500);   // user masih mengetik → tunggu
        return;
      }
      loadBawahRata();
    };
    setTimeout(coba, 300);
  }

  function loadBawahRata() {
    var el = $('br-table');
    if (!el) return Promise.resolve();
    el.innerHTML = '<div class="p-6 text-center text-gray-400">Memuat…</div>';
    var p = new URLSearchParams({ kuartal: $('br-kuartal').value });
    var d = $('br-dalam').value; if (d) p.set('dalam_masa', d);
    var s = $('br-selesai').value; if (s) p.set('selesai', s);
    var edit = bolehEditTakziran();
    var nonaktif = edit ? '' : ' disabled';
    return jget('/api/penilaian-tambahan/bawah-rata?' + p.toString()).then(function (rows) {
      var isi = rows.map(function (r, i) {
        var kolomTeks = function (kolom, nilai) {
          return '<td class="px-3 py-2">' +
            '<input type="text" data-kolom="' + kolom + '" value="' + esc(nilai || '') + '"' + nonaktif +
            ' placeholder="-"' +
            ' class="glass-input w-full min-w-[120px] px-2 py-1.5 rounded-lg text-xs"' +
            '></td>';
        };
        return '<tr data-santri="' + r.santri_id + '">' +
          '<td class="px-3 py-2 text-gray-400">' + (i + 1) + '</td>' +
          '<td class="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">' + esc(r.nama) + '</td>' +
          '<td class="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">' + esc(r.bagian) + '</td>' +
          '<td class="px-3 py-2 text-right">' + fmt(r.jumlah_nilai, 1) + '</td>' +
          '<td class="px-3 py-2 text-right font-bold text-red-500">' + fmt(r.rata2, 2) + '</td>' +
          kolomTeks('konsekuensi', r.konsekuensi) +
          kolomTeks('jenis_takziran', r.jenis_takziran) +
          '<td class="px-3 py-2 text-center"><input type="checkbox" data-kolom="dalam_masa"' + nonaktif +
          ' class="w-4 h-4 accent-amber-500" ' + (r.dalam_masa ? 'checked' : '') + '></td>' +
          '<td class="px-3 py-2 text-center"><input type="checkbox" data-kolom="selesai"' + nonaktif +
          ' class="w-4 h-4 accent-emerald-600" ' + (r.selesai ? 'checked' : '') + '>' +
          '<div class="br-status text-[11px] font-semibold text-gray-400"></div></td>' +
          '</tr>';
      }).join('');
      el.innerHTML = tabelHTML(
        ['No', 'Nama', 'Bagian', 'Jumlah Nilai', 'Rata-rata Nilai', 'Konsekuensi', 'Jenis Takziran', 'Dalam Masa Takziran', 'Selesai Takziran'],
        isi,
        'Tidak ada siswi dengan rata-rata di bawah 4,4 pada kuartal ini.');
    }).catch(function (e) { el.innerHTML = errHTML(e); });
  }

  // ── Tab: Setoran Juz Amma ─────────────────────────────────────────────────
  // Fase 3: ceklis chip surat aktif (toggle per surat) + select Evaluasi dan
  // Selesai/Belum (per santri). Backend POST hanya pimpinan → kontrol tetap
  // disabled bagi role lain.
  function bolehEditJuz() { return punyaRole(['pimpinan']); }

  function chipSurat(s, santriID, edit) {
    var nama = NAMA_SURAT[s.no] || ('Surat ' + s.no);
    return '<label class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-[11px] text-gray-700 dark:text-gray-200 ' +
      (edit ? 'cursor-pointer hover:border-emerald-400' : 'cursor-not-allowed') +
      '" title="' + s.no + ' · ' + esc(nama) + '">' +
      '<input type="checkbox"' + (edit ? '' : ' disabled') +
      ' class="w-3 h-3 accent-emerald-600" data-santri="' + santriID + '" data-surat="' + s.no + '" ' + (s.setor ? 'checked' : '') + '>' +
      '<span>' + esc(nama) + '</span></label>';
  }

  // Select per santri (Evaluasi / Selesai-Belum) — menggantikan badge statis.
  function selectHasil(santriID, field, nilai, opsi, edit) {
    var opts = opsi.map(function (o) {
      return '<option value="' + o[0] + '"' + (nilai === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
    var warna = field === 'evaluasi'
      ? (nilai === 'lulus' ? 'text-emerald-600 dark:text-emerald-400 font-bold'
        : nilai === 'her' ? 'text-amber-600 dark:text-amber-400 font-bold'
        : nilai === 'tidak_lulus' ? 'text-red-600 dark:text-red-400 font-bold'
        : 'text-gray-400')
      : (nilai === 'selesai' ? 'text-emerald-600 dark:text-emerald-400 font-bold'
        : 'text-gray-500 dark:text-gray-300');
    return '<select data-santri="' + santriID + '" data-field="' + field + '"' + (edit ? '' : ' disabled') +
      ' class="ja-pilih glass-input px-2 py-1.5 rounded-lg text-xs ' + warna + '">' + opts + '</select>';
  }

  var OPSI_EVALUASI = [['', '(belum)'], ['lulus', 'Lulus'], ['her', 'Her'], ['tidak_lulus', 'Tidak Lulus']];
  var OPSI_STATUS = [['belum', 'Belum'], ['selesai', 'Selesai']];

  // POST satu perubahan. body = {santri_id, surat_no?/setor?/evaluasi?/status?}
  function simpanJuz(tr, body, field) {
    body.tahun_ajaran = '';   // kosong → backend pakai tahun ajaran aktif
    var td = tr.querySelector('td:last-child');
    var ind = td && td.querySelector('.ja-status');
    if (ind) { ind.textContent = 'Menyimpan…'; ind.className = 'ja-status text-[11px] font-semibold text-gray-400'; }
    return fetch('/api/penilaian-tambahan/juz-amma', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!res.ok) throw new Error(d.message || ('HTTP ' + res.status));
        if (ind) { ind.textContent = '✓ Tersimpan'; ind.className = 'ja-status text-[11px] font-semibold text-emerald-600 dark:text-emerald-400'; }
        showToast('Setoran Juz Amma tersimpan', 'success');
        // Hitung ulang "N/M surat disetor" tanpa reload bila memungkinkan.
        if (field === 'setor') hitungSetor(tr);
        // Filter yang memengaruhi KEANGGOTAAN baris: ja-status & ja-evaluasi.
        var adaFilter = $('ja-status').value || $('ja-evaluasi').value;
        if (adaFilter && (field === 'evaluasi' || field === 'status')) {
          refreshJuzSetelahBlur(tr);
        }
      });
    }).catch(function (e) {
      if (ind) { ind.textContent = '✗ Gagal'; ind.className = 'ja-status text-[11px] font-semibold text-red-500'; }
      showToast('Gagal simpan Juz Amma: ' + e.message, 'error');
    });
  }

  function hitungSetor(tr) {
    var total = tr.querySelectorAll('[data-surat]').length;
    var n = tr.querySelectorAll('[data-surat]:checked').length;
    var box = tr.querySelector('.ja-hitung');
    if (!box || !total) return;
    var sisa = box.textContent.split('·')[1];
    box.textContent = n + '/' + total + ' surat disetor' + (sisa ? ' ·' + sisa : '');
  }

  function refreshJuzSetelahBlur(tr) {
    var coba = function () {
      var a = document.activeElement;
      if (a && tr.contains(a) && (a.tagName === 'SELECT' ||
          (a.tagName === 'INPUT' && a.type !== 'checkbox'))) {
        setTimeout(coba, 500);   // user masih memilih → tunggu
        return;
      }
      loadJuzAmma();
    };
    setTimeout(coba, 300);
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
    var edit = bolehEditJuz();
    return jget('/api/penilaian-tambahan/juz-amma' + (qs ? '?' + qs : '')).then(function (rows) {
      var isi = rows.map(function (r, i) {
        return '<tr data-santri="' + r.santri_id + '">' +
          '<td class="px-3 py-2 text-gray-400 align-top">' + (i + 1) + '</td>' +
          '<td class="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap align-top">' + esc(r.bagian) + '</td>' +
          '<td class="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap align-top">' + esc(r.nama) + '</td>' +
          '<td class="px-3 py-2 align-top"><div class="flex flex-wrap gap-1 max-w-[560px]">' +
            r.surat.map(function (x) { return chipSurat(x, r.santri_id, edit); }).join('') +
          '</div><div class="ja-hitung text-[11px] text-gray-400 mt-1.5">' +
            r.surat.filter(function (x) { return x.setor; }).length + '/' + r.jumlah_surat +
            ' surat disetor · An-Nas s/d ' +
            esc(NAMA_SURAT[r.surat_sampai] || ('Surat ' + r.surat_sampai)) + '</div></td>' +
          '<td class="px-3 py-2 align-top text-center">' +
            selectHasil(r.santri_id, 'evaluasi', r.evaluasi, OPSI_EVALUASI, edit) + '</td>' +
          '<td class="px-3 py-2 align-top text-center">' +
            selectHasil(r.santri_id, 'status', r.status, OPSI_STATUS, edit) +
            '<div class="ja-status text-[11px] font-semibold text-gray-400"></div></td>' +
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

    // Fase 2 — simpan per baris. Delegasi ke container #br-table supaya tetap
    // berlaku setelah tabel di-render ulang. Teks tersimpan saat 'change'
    // (blur / Enter), checkbox langsung saat dicentang.
    var brEl = $('br-table');
    if (brEl) {
      brEl.addEventListener('change', function (e) {
        var t = e.target;
        if (!t || !t.dataset || !t.dataset.kolom) return;
        var tr = t.closest('tr');
        if (!tr || !tr.dataset.santri) return;
        // Checkbox memengaruhi keanggotaan baris saat filter aktif.
        if (t.dataset.kolom === 'dalam_masa' || t.dataset.kolom === 'selesai') tr.dataset.stale = '1';
        simpanTakziran(tr);
      });
    }

    // Fase 3 — Setoran Juz Amma: ceklis chip per surat + select evaluasi/status.
    var jaEl = $('ja-table');
    if (jaEl) {
      jaEl.addEventListener('change', function (e) {
        var t = e.target;
        if (!t || !t.dataset) return;
        var tr = t.closest('tr');
        if (!tr || !tr.dataset.santri) return;
        var santriID = parseInt(tr.dataset.santri, 10);
        if (t.dataset.surat) {
          // toggle satu surat → baris lain ikut dibuat backend (114..target)
          simpanJuz(tr, { santri_id: santriID, surat_no: parseInt(t.dataset.surat, 10),
                          setor: t.checked }, 'setor');
        } else if (t.dataset.field) {
          // evaluasi / status → diterapkan ke semua baris surat santri tsb
          var body = { santri_id: santriID };
          body[t.dataset.field] = t.value;
          simpanJuz(tr, body, t.dataset.field);
        }
      });
    }

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
