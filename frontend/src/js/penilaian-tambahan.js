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

  // ── filter cascading Tingkatan → Kelas → Bagian (3 tab nilai tambahan) ────
  // Opsi dibangun dari /api/penilaian/bagian (cakupan-aware: mustahiq/mufatish
  // hanya melihat bagian tugasannya; wali → dropdown kosong). Prefix: br/ja/km.
  var DFT_BAGIAN = [];
  var FILTER_PREFIX = ['br', 'ja', 'km'];

  function unikTert(list) {
    return list.filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  }

  // Isi ulang select (prefix)-tingkatan/-kelas/-bagian mengikuti pilihan induk.
  // Pilihan lama dipertahankan selama masih valid; kalau tidak → di-reset.
  function isiOpsiFilter(prefix) {
    var t = $(prefix + '-tingkatan'), k = $(prefix + '-kelas'), b = $(prefix + '-bagian');
    if (!t || !k || !b) return;
    var pT = t.value, pK = k.value, pB = b.value;
    var daftarT = unikTert(DFT_BAGIAN.map(function (x) { return x.tingkatan; }));
    if (daftarT.indexOf(pT) === -1) pT = '';
    var barisT = DFT_BAGIAN.filter(function (x) { return !pT || x.tingkatan === pT; });
    var daftarK = unikTert(barisT.map(function (x) { return x.kelas; }));
    if (daftarK.indexOf(pK) === -1) pK = '';
    var barisK = barisT.filter(function (x) { return !pK || x.kelas === pK; });
    var adaB = barisK.some(function (x) { return String(x.id) === String(pB); });
    if (!adaB) pB = '';
    var opsiTeks = function (label, nilai, daftar) {
      return '<option value="">' + label + '</option>' + daftar.map(function (v) {
        return '<option value="' + esc(v) + '"' + (nilai === v ? ' selected' : '') + '>' + esc(v) + '</option>';
      }).join('');
    };
    t.innerHTML = opsiTeks('-- Semua Tingkatan --', pT, daftarT);
    k.innerHTML = opsiTeks('-- Semua Kelas --', pK, daftarK);
    b.innerHTML = '<option value="">-- Semua Bagian --</option>' + barisK.map(function (x) {
      return '<option value="' + x.id + '"' + (String(pB) === String(x.id) ? ' selected' : '') + '>' + esc(x.label) + '</option>';
    }).join('');
    t.value = pT; k.value = pK; b.value = pB;
  }

  // Sisipkan param filter cascading (tingkatan/kelas/bagian_id) ke URL load+export.
  function tambahFilter(prefix, p) {
    var t = $(prefix + '-tingkatan'); if (t && t.value) p.set('tingkatan', t.value);
    var k = $(prefix + '-kelas'); if (k && k.value) p.set('kelas', k.value);
    var b = $(prefix + '-bagian'); if (b && b.value) p.set('bagian_id', b.value);
    // Tahun Ajaran (riwayat) — ikut ke load tabel & export Excel.
    var ta = $(prefix + '-tahun'); if (ta && ta.value) p.set('tahun_ajaran', ta.value);
  }

  // ── Keterangan Target Hafalan per kelas (spek owner 2026-10-02) ──────────
  // Pimpinan melihat SEMUA target; role lain hanya kelas dari cakupannya
  // (derive dari baris hasil GET — mustahiq = kelas tugasannya, wali = kelas anak).
  var TARGET_HAFALAN = [
    ['4 ibt', 'Kelas 4 Ibtidaiyah — an-Nas s/d Al-Kautsar'],
    ['5 ibt', 'Kelas 5 Ibtidaiyah — an-Nas s/d al-Humazah'],
    ['6 ibt', 'Kelas 6 Ibtidaiyah — an-Nas s/d az-Zalzalah'],
    ['1 tsn', 'Kelas 1 Tsanawiyah — an-Nas s/d al-Qadr'],
    ['2 tsn', 'Kelas 2 Tsanawiyah — an-Nas s/d ad-Dhuha'],
    ['3 tsn', 'Kelas 3 Tsanawiyah — an-Nas s/d al-A\u2019la'],
    ['1 aly', 'Kelas 1 Aliyah — an-Nas s/d al-Muthaffifin'],
    ['2 aly', 'Kelas 2 Aliyah — an-Nas s/d \u2018Abasa'],
    ['3 aly', 'Kelas 3 Aliyah — an-Nas s/d an-Naba\u2019']
  ];

  // label bagian "2 Tsanawiyah A" → kode kelas "2 tsn"
  function kodeDariBagian(label) {
    var p = String(label || '').trim().split(/\s+/);
    if (p.length < 2) return '';
    return kodeKelas(p[1], p[0]);
  }

  function renderTargetHafalan(rows) {
    var el = $('ja-target');
    if (!el) return;
    var daftar = TARGET_HAFALAN;
    if (!punyaRole(['pimpinan'])) {
      var kode = unikTert((rows || []).map(function (r) { return kodeDariBagian(r.bagian); })).filter(Boolean);
      daftar = TARGET_HAFALAN.filter(function (x) { return kode.indexOf(x[0]) !== -1; });
    }
    if (!daftar.length) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.classList.remove('hidden');
    el.innerHTML = '<b>🎯 Target Hafalan per Kelas:</b>' +
      '<ul class="mt-1.5 space-y-0.5 list-disc list-inside">' +
      daftar.map(function (x) { return '<li>' + esc(x[1]) + '</li>'; }).join('') + '</ul>';
  }

  // ── tabel ─────────────────────────────────────────────────────────────────
  // renderTabel: set innerHTML + pasang data-label otomatis per kolom.
  // Di HP (<768px) class `table-responsive` (style.css) mengubah tiap <tr>
  // jadi kartu vertikal — sama seperti tampilan Data Santri — jadi user
  // cukup scroll ke bawah, TANPA geser ke samping.
  function renderTabel(el, kolom, isi, kosongMsg) {
    if (!isi) {
      el.innerHTML = '<div class="p-8 text-center text-gray-500 dark:text-gray-400">' + esc(kosongMsg) + '</div>';
      return;
    }
    el.innerHTML = '<div class="overflow-x-auto"><table class="w-full text-sm border-collapse table-responsive">' +
      '<thead><tr class="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">' +
      kolom.map(function (k) { return '<th class="px-3 py-2 font-bold whitespace-nowrap">' + k + '</th>'; }).join('') +
      '</tr></thead><tbody class="divide-y divide-gray-100 dark:divide-slate-700/60">' +
      isi + '</tbody></table></div>';
    // label kartu mobile: selaraskan <td> ke-dgn urutan <th>
    var trs = el.querySelectorAll('tbody tr');
    for (var t = 0; t < trs.length; t++) {
      var tds = trs[t].children;
      for (var c = 0; c < tds.length && c < kolom.length; c++) {
        tds[c].setAttribute('data-label', kolom[c]);
      }
    }
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
  function bolehEditTakziran() { return punyaRole(['pimpinan']) && !modeRiwayat('br'); }

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
    tambahFilter('br', p);
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
      renderTabel(el,
        ['No', 'Nama', 'Bagian', 'Jumlah Nilai', 'Rata-rata Nilai', 'Konsekuensi', 'Jenis Takziran', 'Dalam Masa Takziran', 'Selesai Melaksanakan Takziran'],
        isi,
        'Tidak ada siswi dengan rata-rata di bawah 4,4 pada kuartal ini.');
    }).catch(function (e) { el.innerHTML = errHTML(e); });
  }

  // ── Tab: Setoran Juz Amma ─────────────────────────────────────────────────
  // Fase 3: ceklis chip surat aktif (toggle per surat) + select Evaluasi dan
  // Selesai/Belum (per santri). Backend POST hanya pimpinan → kontrol tetap
  // disabled bagi role lain.
  function bolehEditJuz() { return punyaRole(['pimpinan']) && !modeRiwayat('ja'); }

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

  // Evaluasi cukup Lulus / Tidak Lulus — pilihan "Her" dihapus (keputusan
  // owner 2026-10-02; data lama 'her' tetap ditampilkan apa adanya di export).
  var OPSI_EVALUASI = [['', '(belum)'], ['lulus', 'Lulus'], ['tidak_lulus', 'Tidak Lulus']];
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
    tambahFilter('ja', p);
    var s = $('ja-status').value; if (s) p.set('status', s);
    var ev = $('ja-evaluasi').value; if (ev) p.set('evaluasi', ev);
    var qs = p.toString();
    var edit = bolehEditJuz();
    return jget('/api/penilaian-tambahan/juz-amma' + (qs ? '?' + qs : '')).then(function (rows) {
      renderTargetHafalan(rows);
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
      renderTabel(el,
        ['No', 'Bagian', 'Nama Siswi', 'Nama Surat', 'Evaluasi', 'Selesai/Belum Selesai'],
        isi,
        'Tidak ada data setoran Juz Amma untuk filter ini.');
    }).catch(function (e) { el.innerHTML = errHTML(e); });
  }

  // ── Tab: Nilai Kompetensi ─────────────────────────────────────────────────
  // Fase 4: select hasil aktif utk pimpinan → POST per baris. Backend hanya
  // menerima lulus/her/tidak_lulus ("" ditolak 400) → "(belum dinilai)" yang
  // dipilih user dibalikkan lagi.
  function bolehEditKomp() { return punyaRole(['pimpinan']) && !modeRiwayat('km'); }

  function loadKompetensi() {
    var el = $('km-table');
    if (!el) return Promise.resolve();
    el.innerHTML = '<div class="p-6 text-center text-gray-400">Memuat…</div>';
    var p = new URLSearchParams({ kategori: $('km-kategori').value });
    var h = $('km-hasil').value; if (h) p.set('hasil', h);
    tambahFilter('km', p);
    var edit = bolehEditKomp();
    return jget('/api/penilaian-tambahan/kompetensi?' + p.toString()).then(function (rows) {
      var isi = rows.map(function (r, i) {
        return '<tr data-santri="' + r.santri_id + '">' +
          '<td class="px-3 py-2 text-gray-400">' + (i + 1) + '</td>' +
          '<td class="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">' + esc(r.nama) + '</td>' +
          '<td class="px-3 py-2"><select' + (edit ? '' : ' disabled') +
            ' data-santri="' + r.santri_id + '" data-kategori="' + esc(r.kategori) + '"' +
            ' data-awal="' + esc(r.hasil || '') + '"' +
            ' class="km-select glass-input px-2 py-1.5 rounded-lg text-xs w-[160px]">' +
            '<option value="" ' + (!r.hasil ? 'selected' : '') + '>(belum dinilai)</option>' +
            '<option value="lulus" ' + (r.hasil === 'lulus' ? 'selected' : '') + '>Lulus</option>' +
            '<option value="her" ' + (r.hasil === 'her' ? 'selected' : '') + '>Her</option>' +
            '<option value="tidak_lulus" ' + (r.hasil === 'tidak_lulus' ? 'selected' : '') + '>Tidak Lulus</option>' +
            '</select></td>' +
          '<td class="px-3 py-2"><div class="km-status text-[11px] font-semibold text-gray-400"></div></td>' +
          '</tr>';
      }).join('');
      renderTabel(el,
        ['No', 'Nama', 'Hasil', 'Status'],
        isi,
        'Tidak ada siswi untuk kategori ujian & filter ini.');
    }).catch(function (e) { el.innerHTML = errHTML(e); });
  }

  // POST satu hasil kompetensi per baris.
  function simpanKompetensi(tr, sel) {
    var td = tr.querySelector('td:last-child');
    var ind = td && td.querySelector('.km-status');
    var setStatus = function (teks, warna) {
      if (ind) { ind.textContent = teks; ind.className = 'km-status text-[11px] font-semibold ' + warna; }
    };
    if (!sel.value) {
      // backend menolak hasil kosong → kembalikan pilihan lama
      sel.value = sel.dataset.awal || '';
      showToast('Hasil harus Lulus / Her / Tidak Lulus', 'error');
      return;
    }
    setStatus('Menyimpan…', 'text-gray-400');
    fetch('/api/penilaian-tambahan/kompetensi', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tahun_ajaran: '',            // kosong → tahun ajaran aktif
        santri_id: parseInt(sel.dataset.santri, 10),
        kategori: sel.dataset.kategori,
        hasil: sel.value
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!res.ok) throw new Error(d.message || ('HTTP ' + res.status));
        sel.dataset.awal = sel.value;      // jadi patokan revert berikutnya
        setStatus('✓ Tersimpan', 'text-emerald-600 dark:text-emerald-400');
        showToast('Nilai kompetensi tersimpan', 'success');
        // filter hasil memengaruhi keanggotaan baris → refresh tertunda
        if ($('km-hasil').value) refreshKompSetelahBlur(tr);
      });
    }).catch(function (e) {
      setStatus('✗ Gagal', 'text-red-500');
      showToast('Gagal simpan kompetensi: ' + e.message, 'error');
    });
  }

  function refreshKompSetelahBlur(tr) {
    var coba = function () {
      var a = document.activeElement;
      if (a && tr.contains(a) && a.tagName === 'SELECT') {
        setTimeout(coba, 500);   // user masih memilih → tunggu
        return;
      }
      loadKompetensi();
    };
    setTimeout(coba, 300);
  }

  var LOADERS = {
    'bawah-rata': loadBawahRata,
    'juz-amma': loadJuzAmma,
    'kompetensi': loadKompetensi
  };

  // ── Fase 5: unduh Excel (backend mengecek role pimpinan juga) ────────────
  function unduhTambahan(fitur) {
    var p = new URLSearchParams({ fitur: fitur });
    if (fitur === 'bawah-rata') {
      p.set('kuartal', $('br-kuartal').value);
      var d = $('br-dalam').value; if (d) p.set('dalam_masa', d);
      var s = $('br-selesai').value; if (s) p.set('selesai', s);
      tambahFilter('br', p);
    } else if (fitur === 'juz-amma') {
      tambahFilter('ja', p);
      var st = $('ja-status').value; if (st) p.set('status', st);
      var ev = $('ja-evaluasi').value; if (ev) p.set('evaluasi', ev);
    } else if (fitur === 'kompetensi') {
      p.set('kategori', $('km-kategori').value);
      var h = $('km-hasil').value; if (h) p.set('hasil', h);
      tambahFilter('km', p);
    }
    window.location.href = '/api/penilaian-tambahan/export?' + p.toString();
  }

  // ── tab controller ────────────────────────────────────────────────────────
  // Banner syarat ijazah tab Kompetensi mengikuti filter bagian (spek owner:
  // syarat 6 ibt/3 tsn "ditampilkan di kelas 6 ibt & 3 tsn", syarat 3 aly
  // "ditampilkan di kelas 3 aliyah") — 'Semua Bagian' → semua blok tampil.
  var BAGIAN_KELAS = {};   // bagian_id → kode kelas pendek, mis. "6 ibt"

  function kodeKelas(tingkatan, kelas) {
    var t = (tingkatan || '').toLowerCase().trim();
    var pre = t.indexOf('ibt') === 0 ? 'ibt'
      : t.indexOf('tsan') === 0 ? 'tsn'
      : t.indexOf('ali') === 0 ? 'aly' : t;
    return ((kelas || '') + ' ' + pre).trim().toLowerCase();
  }

  function updateKmNotes() {
    var sel = $('km-bagian');
    var kelas = (sel && sel.value && BAGIAN_KELAS[sel.value]) ? BAGIAN_KELAS[sel.value] : '';
    document.querySelectorAll('.km-note').forEach(function (n) {
      if (!kelas) { n.classList.remove('hidden'); return; }
      var daftar = (n.dataset.kelas || '').split(',').map(function (s) { return s.trim(); });
      n.classList.toggle('hidden', daftar.indexOf(kelas) === -1);
    });
  }

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
      // pertahankan status sembunyi (visible[]) — className ditimpa total,
      // jadi class 'hidden' harus dilepas ulang di sini (bug fase-1).
      btn.className = BTN_BASE + ' ' + (on ? BTN_ON : BTN_OFF) +
        (visible[btn.dataset.tab] ? '' : ' hidden');
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
        // Simpan dulu utk cascading filter Tingkatan → Kelas → Bagian,
        // lalu isi select filter ketiga tab dari daftar yang sama.
        DFT_BAGIAN = bagians.map(function (b) {
          BAGIAN_KELAS[b.id] = kodeKelas(b.tingkatan, b.kelas);
          return {
            id: b.id,
            kelas: b.kelas || '',
            tingkatan: b.tingkatan || '',
            label: ((b.kelas || '') + ' ' + (b.tingkatan || '') + ' ' + (b.nama_bagian || '')).trim()
          };
        });
        FILTER_PREFIX.forEach(isiOpsiFilter);
        updateKmNotes();
      })
      .catch(function () { /* dropdown tetap bisa dipakai tanpa opsi */ });
  }

  // ── init ──────────────────────────────────────────────────────────────────
  // ── Pemilih Tahun Ajaran (riwayat) — spek owner 2026-10-02 ─────────────
  // Penilaian tambahan disimpan per tahun_ajaran; select ini membuka tahun
  // lama (naik kelas → riwayat tetap ada). Tahun non-aktif = MODE RIWAYAT:
  // edit & simpan dinonaktifkan (guard bolehEdit*), sebab POST backend
  // selalu menulis ke tahun AKTIF — mencegah salah-tulis ke tahun lama.
  var taAktifGlobal = '';

  function pilihTahun(prefix) {
    var el = $(prefix + '-tahun');
    return el ? el.value : '';
  }
  function modeRiwayat(prefix) {
    var v = pilihTahun(prefix);
    return !!(taAktifGlobal && v && v !== taAktifGlobal);
  }
  function syncRiwayatBanners() {
    FILTER_PREFIX.forEach(function (p) {
      var ban = $(p + '-riwayat');
      if (ban) ban.classList.toggle('hidden', !modeRiwayat(p));
    });
  }
  function initTahunAjaran() {
    var selects = FILTER_PREFIX.map(function (p) { return $(p + '-tahun'); }).filter(Boolean);
    if (!selects.length) return;
    Promise.all([
      fetch('/api/kalender/tahun', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      fetch('/api/settings/umum', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      var list = res[0] || [];
      var umum = res[1] || null;
      taAktifGlobal = (umum && umum.tahun_ajaran_aktif) || '';
      if (taAktifGlobal && list.indexOf(taAktifGlobal) === -1) list.unshift(taAktifGlobal);
      if (!list.length) return;
      if (!taAktifGlobal) taAktifGlobal = list[0];
      var ops = list.map(function (t) {
        return '<option value="' + esc(t) + '">' + esc(t) + (t === taAktifGlobal ? ' (aktif)' : '') + '</option>';
      }).join('');
      selects.forEach(function (sel) {
        sel.innerHTML = ops;
        sel.value = taAktifGlobal;
        // Pilihan disinkronkan antar 3 tab; tab aktif langsung dimuat ulang.
        sel.addEventListener('change', function () {
          var v = sel.value;
          selects.forEach(function (o) { o.value = v; });
          syncRiwayatBanners();
          if (LOADERS[currentTab]) LOADERS[currentTab]();
        });
      });
      syncRiwayatBanners();
    });
  }

  function init() {
    initTahunAjaran();
    document.querySelectorAll('.ptab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { activate(btn.dataset.tab); });
    });
    window.addEventListener('hashchange', function () {
      activate((location.hash || '').slice(1));
    });
    [['br-refresh', 'bawah-rata'], ['ja-refresh', 'juz-amma'], ['km-refresh', 'kompetensi']].forEach(function (pair) {
      var el = $(pair[0]);
      if (el) el.addEventListener('click', function () {
        if (pair[1] === 'kompetensi') updateKmNotes();   // banner ikut filter bagian
        if (LOADERS[pair[1]]) LOADERS[pair[1]]();
      });
    });

    // Filter cascading Tingkatan → Kelas → Bagian (3 tab): pilihan induk
    // me-refresh opsi anak. Load manual tetap lewat tombol "Tampilkan".
    FILTER_PREFIX.forEach(function (p) {
      ['-tingkatan', '-kelas', '-bagian'].forEach(function (sfx) {
        var el = $(p + sfx);
        if (el) el.addEventListener('change', function () { isiOpsiFilter(p); });
      });
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

    // Fase 4 — Nilai Kompetensi: select hasil → POST per baris.
    var kmEl = $('km-table');
    if (kmEl) {
      kmEl.addEventListener('change', function (e) {
        var t = e.target;
        if (!t || !t.classList || !t.classList.contains('km-select')) return;
        var tr = t.closest('tr');
        if (tr) simpanKompetensi(tr, t);
      });
    }

    isiBagian().then(function () {
      return fetch('/api/me', { credentials: 'same-origin' })
        .then(function (res) { if (res.ok) return res.json(); return null; })
        .catch(function () { return null; });
    }).then(function (hasil) {
      me = hasil;
      applyVisibility();
      // Fase 5: tombol Download HANYA utk pimpinan — walau pun, role tetap
      // dicek ulang di backend (GET /export → 403 utk non-pimpinan).
      var bolehUnduh = me ? punyaRole(['pimpinan']) : false;
      document.querySelectorAll('.btn-tambahan').forEach(function (b) {
        if (bolehUnduh) {
          b.addEventListener('click', function () { unduhTambahan(b.dataset.fitur); });
        } else {
          b.remove();
        }
      });
      // Fase 5: wali_santri → banner akses terbatas "hanya anak sendiri".
      if (me && punyaRole(['wali_santri'])) {
        var bar = document.getElementById('ptab-bar');
        if (bar) {
          var ban = document.createElement('div');
          ban.className = 'mx-6 mt-4 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 px-4 py-3 text-sm text-blue-800 dark:text-blue-300 leading-relaxed';
          ban.innerHTML = '👁️ <b>Akses Wali:</b> Anda hanya melihat data <b>anak Anda sendiri</b> pada tab Di Bawah Rata-rata, Setoran Juz Amma, dan Nilai Kompetensi.';
          bar.parentNode.insertBefore(ban, bar.nextSibling);
        }
      }
      activate((location.hash || '').slice(1) || defaultTab());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
