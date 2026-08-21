// rekap.js
// Script untuk mengatur menu Rekap Absensi (Siswa & Pengajar)

const tabSiswa = document.getElementById('tab-siswa');
const tabPengajar = document.getElementById('tab-pengajar');
const filterSectionSiswa = document.getElementById('filter-section-siswa');
const filterSectionPengajar = document.getElementById('filter-section-pengajar');

const selTingkatanSiswa = document.getElementById('filter-tingkatan-siswa');
const selKelasSiswa = document.getElementById('filter-kelas-siswa');
const selBagianSiswa = document.getElementById('filter-bagian-siswa');
const selTahunSiswa = document.getElementById('filter-tahun-siswa');
const selTahunHijriSiswa = document.getElementById('filter-tahun-hijri-siswa');
const selBulanHijriSiswa = document.getElementById('filter-bulan-hijri-siswa');
const btnLoadSiswa = document.getElementById('btn-load-siswa');

const selTahunPengajar = document.getElementById('filter-tahun-pengajar');
const selTahunHijriPengajar = document.getElementById('filter-tahun-hijri-pengajar');
const selBulanHijriPengajar = document.getElementById('filter-bulan-hijri-pengajar');
const btnLoadPengajar = document.getElementById('btn-load-pengajar');

const tableContainer = document.getElementById('table-container');
const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('table-body');
const tableScrollHint = document.getElementById('table-scroll-hint');
const emptyState = document.getElementById('empty-state');
const emptyStateText = document.getElementById('empty-state-text');
const btnDownloadPdf = document.getElementById('btn-download-pdf');

const summarySiswa = document.getElementById('summary-siswa');
const rekapSiswaView = document.getElementById('rekap-siswa-view');
const summaryPengajar = document.getElementById('summary-pengajar');
const rekapPengajarView = document.getElementById('rekap-pengajar-view');

let allBagian = [];
let currentTab = 'siswa';

// Apply Theme
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

// Tab Switching Logic
tabSiswa.addEventListener('click', () => switchTab('siswa'));
tabPengajar.addEventListener('click', () => switchTab('pengajar'));

function switchTab(tab) {
    currentTab = tab;
    // Reset semua area hasil
    tableContainer.classList.add('hidden');
    if (tableScrollHint) tableScrollHint.classList.add('hidden');
    emptyState.classList.remove('hidden');
    btnDownloadPdf.classList.add('hidden');
    if (summarySiswa) { summarySiswa.classList.add('hidden'); summarySiswa.innerHTML = ''; }
    if (rekapSiswaView) { rekapSiswaView.classList.add('hidden'); rekapSiswaView.innerHTML = ''; }
    
    if (summaryPengajar) { summaryPengajar.classList.add('hidden'); summaryPengajar.innerHTML = ''; }
    if (rekapPengajarView) { rekapPengajarView.classList.add('hidden'); rekapPengajarView.innerHTML = ''; }

    const tabs = {
        'siswa': { btn: tabSiswa, section: filterSectionSiswa },
        'pengajar': { btn: tabPengajar, section: filterSectionPengajar }
    };

    for (const key in tabs) {
        if (key === tab) {
            tabs[key].btn.classList.add('border-primary', 'text-primary');
            tabs[key].btn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabs[key].section.classList.remove('hidden');
            tabs[key].section.classList.add('flex');
        } else {
            tabs[key].btn.classList.remove('border-primary', 'text-primary');
            tabs[key].btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabs[key].section.classList.add('hidden');
            tabs[key].section.classList.remove('flex');
        }
    }
}

// Authentication & Initialization
async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    loadFilters();
  } catch (err) {
    console.error(err);
  }
}

async function loadFilters() {
  try {
    const [resTingkatan, resTahun, resUmum, resBagian] = await Promise.all([
        fetch('/api/akademik/tingkatan'),
        fetch('/api/kalender/tahun'),
        fetch('/api/settings/umum'),
        fetch('/api/penilaian/bagian') // Filtered by backend based on user roles
    ]);

    let cachedTingkatan = [];
    if (resTingkatan.ok) {
        cachedTingkatan = await resTingkatan.json();
    }

    if (resBagian.ok) {
        allBagian = await resBagian.json();
    }

    const allowedTingkatan = new Set(allBagian.map(b => b.tingkatan_id));
    selTingkatanSiswa.innerHTML = '<option value="">-- Tingkatan --</option>';
    const opsiTingkatan = cachedTingkatan.filter(t => allowedTingkatan.size === 0 || allowedTingkatan.has(t.id));
    opsiTingkatan.forEach(t => {
        selTingkatanSiswa.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
    });

    if (opsiTingkatan.length === 1) {
        selTingkatanSiswa.value = String(opsiTingkatan[0].id);
        selTingkatanSiswa.dispatchEvent(new Event('change'));
    }

    let tahunData = resTahun.ok ? await resTahun.json() : [];
    if (!Array.isArray(tahunData)) tahunData = [];
    let taAktif = '';
    let tahunHijriAktif = '';
    let bulanHijriAktif = 0;
    if (resUmum.ok) {
        const dataUmum = await resUmum.json();
        taAktif = dataUmum.tahun_ajaran_aktif;
        tahunHijriAktif = dataUmum.tahun_hijri_aktif;
        bulanHijriAktif = dataUmum.bulan_hijri_aktif;
    }
    
    if (taAktif && !tahunData.includes(taAktif)) {
        tahunData.unshift(taAktif);
    }

    const setTahunDropdown = (sel) => {
        sel.innerHTML = '<option value="">-- Tahun Ajaran --</option>';
        tahunData.forEach(t => {
            const selected = (t === taAktif) ? 'selected' : '';
            sel.innerHTML += `<option value="${t}" ${selected}>${t}</option>`;
        });
    };

    setTahunDropdown(selTahunSiswa);
    setTahunDropdown(selTahunPengajar);
    
    // tahun_hijri_aktif bisa berupa pasangan "1447/1448"; prefill hanya jika angka tunggal.
    const prefHijri = /^\d+$/.test(String(tahunHijriAktif || '')) ? tahunHijriAktif : '';
    selTahunHijriSiswa.value = prefHijri;
    selTahunHijriPengajar.value = prefHijri;

  } catch (err) {
    console.error(err);
  }
}

// Cascade: Tingkatan → Kelas → Bagian
selTingkatanSiswa.addEventListener('change', () => {
    const t = selTingkatanSiswa.value;
    selKelasSiswa.innerHTML = '<option value="">-- Kelas --</option>';
    selBagianSiswa.innerHTML = '<option value="">-- Bagian --</option>';
    selBagianSiswa.disabled = true;

    if (!t) {
        selKelasSiswa.disabled = true;
        return;
    }
    
    selKelasSiswa.disabled = false;
    const availableClasses = new Set();
    allBagian.filter(b => b.tingkatan_id == t).forEach(b => {
        if (b.kelas) availableClasses.add(b.kelas);
    });
    
    const sortedClasses = Array.from(availableClasses).sort();
    sortedClasses.forEach(k => {
        selKelasSiswa.insertAdjacentHTML('beforeend', `<option value="${k}">Kelas ${k}</option>`);
    });
    
    if (sortedClasses.length === 1) {
        selKelasSiswa.value = sortedClasses[0];
        selKelasSiswa.dispatchEvent(new Event('change'));
    }
});

selKelasSiswa.addEventListener('change', () => {
    const t = selTingkatanSiswa.value;
    const k = selKelasSiswa.value;
    selBagianSiswa.innerHTML = '<option value="">-- Bagian --</option>';
    
    if (!t || !k) {
        selBagianSiswa.disabled = true;
        return;
    }
    selBagianSiswa.disabled = false;
    const filtered = allBagian.filter(b => b.tingkatan_id == t && b.kelas == k);
    filtered.forEach(b => {
        selBagianSiswa.insertAdjacentHTML('beforeend', `<option value="${b.id}">${b.nama_bagian}</option>`);
    });
});

// ==================== GRID BULANAN (redesign 2026-08) ====================
// Tampilan rekap disamakan dengan absensi manual: seluruh bulan TA ke bawah,
// kolom S / I / T (Hadir dihapus), satu santri per tampilan dengan navigasi ◀ ▶.

const BULAN_HIJRI = [
  'Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir',
  'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban",
  'Ramadhan', 'Syawwal', "Dzulqa'dah", 'Dzulhijjah'
];

let rekapKalenderRange = null;

function hijriOrd(y, m, d) { return y * 360 + m * 30 + d; }

async function loadRekapKalenderRange(ta) {
  rekapKalenderRange = null;
  try {
    const res = await fetch(`/api/kalender/hijri-semester?tahun_ajaran=${encodeURIComponent(ta)}`);
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return;
    let mulai = null, selesai = null;
    rows.forEach(r => {
      const m = { thn: r.mulai_tahun_hijri, bln: r.mulai_bulan_hijri, tgl: r.mulai_tanggal };
      const s = { thn: r.selesai_tahun_hijri, bln: r.selesai_bulan_hijri, tgl: r.selesai_tanggal };
      if (!mulai || hijriOrd(m.thn, m.bln, m.tgl) < hijriOrd(mulai.thn, mulai.bln, mulai.tgl)) mulai = m;
      if (!selesai || hijriOrd(s.thn, s.bln, s.tgl) > hijriOrd(selesai.thn, selesai.bln, selesai.tgl)) selesai = s;
    });
    if (mulai && selesai) rekapKalenderRange = { mulai, selesai };
  } catch (_) {}
}

// Daftar bulan seluruh TA (fallback: 2 tahun Hijri 1447-1448 dari tahun ajaran aktif).
function buildBulanListTA(tahunAjaran) {
  const list = [];
  if (rekapKalenderRange) {
    let y = rekapKalenderRange.mulai.thn, m = rekapKalenderRange.mulai.bln;
    const end = rekapKalenderRange.selesai.thn * 12 + rekapKalenderRange.selesai.bln;
    while (y * 12 + m <= end) {
      list.push({ tahun: y, bulan: m, label: `${BULAN_HIJRI[m - 1]} ${y} H` });
      m++; if (m > 12) { m = 1; y++; }
    }
    return list;
  }
  // Fallback: tahun ajaran "2026/2027" → Hijri 1447/1448 (estimasi kasar)
  let t1 = 1447;
  const parts = String(tahunAjaran || '').split('/');
  if (parts.length === 2) {
    const startMasehi = parseInt(parts[0], 10);
    if (!isNaN(startMasehi)) t1 = startMasehi - 579; // 2026 → 1447
  }
  [t1, t1 + 1].forEach(th => BULAN_HIJRI.forEach((nama, idx) => {
    list.push({ tahun: th, bulan: idx + 1, label: `${nama} ${th} H` });
  }));
  return list;
}

let rekapSiswaList = [], rekapSiswaData = {}, rekapBulanList = [];
let rekapSiswaIdx = 0;

function moveRekapSiswa(delta) {
  if (!rekapSiswaList.length) return;
  rekapSiswaIdx = (rekapSiswaIdx + delta + rekapSiswaList.length) % rekapSiswaList.length;
  renderRekapSiswaGrid();
}
window.moveRekapSiswa = moveRekapSiswa;

// Load Absensi Siswa
btnLoadSiswa.addEventListener('click', async () => {
    const bagianId = selBagianSiswa.value;
    const tahunAjaran = selTahunSiswa.value;

    if (!bagianId) {
        alert('Silakan pilih Bagian (Tingkatan, Kelas, Bagian)');
        return;
    }

    btnLoadSiswa.disabled = true;
    btnLoadSiswa.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Memuat...`;

    try {
        await loadRekapKalenderRange(tahunAjaran);
        rekapBulanList = buildBulanListTA(tahunAjaran);

        // Santri list
        const resSantri = await fetch(`/api/santri/by-bagian/${bagianId}`);
        const santriJson = await resSantri.json();
        rekapSiswaList = (Array.isArray(santriJson) ? santriJson : [])
            .sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

        // Raw data per bulan
        const tahunSet = [...new Set(rekapBulanList.map(b => b.tahun))];
        const existing = [];
        for (const th of tahunSet) {
            try {
                const resData = await fetch(`/api/absensi-manual/santri?bagian_id=${bagianId}&tahun_hijri=${th}`);
                const arr = await resData.json();
                if (Array.isArray(arr)) existing.push(...arr);
            } catch (_) {}
        }

        rekapSiswaData = {};
        existing.forEach(e => {
            const key = String(e.santri_id);
            if (!rekapSiswaData[key]) rekapSiswaData[key] = {};
            rekapSiswaData[key][`${e.tahun_hijri}:${e.bulan_hijri}`] = {
                s: e.total_sakit || 0, i: e.total_izin || 0, a: e.total_alpha || 0
            };
        });

        rekapSiswaIdx = 0;
        renderRekapSiswaGrid();
    } catch (err) {
        alert(err.message);
    } finally {
        btnLoadSiswa.disabled = false;
        btnLoadSiswa.innerHTML = 'Tampilkan Data';
    }
});

// ==================== REKAP ABSENSI SISWA (redesign manual) ====================

function summaryCard(label, value, sub, accent) {
  return `
    <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700/60 shadow-sm">
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400">${label}</p>
      <p class="text-2xl font-bold mt-1 ${accent || 'text-gray-900 dark:text-white'}">${value}</p>
      ${sub ? `<p class="text-xs text-gray-400 mt-0.5">${sub}</p>` : ''}
    </div>`;
}

function renderRekapSiswaGrid() {
  emptyState.classList.add('hidden');
  tableContainer.classList.add('hidden');
  summaryPengajar.classList.add('hidden');
  rekapPengajarView.classList.add('hidden');
  summarySiswa.classList.remove('hidden');
  rekapSiswaView.classList.remove('hidden');

  // --- Kartu ringkasan (Total Hadir dihapus — kolom hadir tidak dipakai lagi) ---
  let totS = 0, totI = 0, totA = 0;
  rekapSiswaList.forEach(s => {
    const d = rekapSiswaData[String(s.id)] || {};
    Object.values(d).forEach(v => { totS += v.s; totI += v.i; totA += v.a; });
  });
  const santriTanpaAlpha = rekapSiswaList.filter(s => {
    const d = rekapSiswaData[String(s.id)] || {};
    return Object.values(d).every(v => !v.a);
  }).length;

  summarySiswa.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${summaryCard('Total Santri', rekapSiswaList.length, 'Siswa dalam kelas ini')}
      ${summaryCard('Sakit & Izin', totS + totI, `S: ${totS} • I: ${totI}`)}
      ${summaryCard('Total Alpha', totA, `Akumulasi Alpha`, (totA ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'))}
      ${summaryCard('Bersih Alpha', `${santriTanpaAlpha}/${rekapSiswaList.length}`, 'Santri nihil alpha', 'text-blue-600 dark:text-blue-400')}
    </div>`;

  if (!rekapSiswaList.length) {
    rekapSiswaView.innerHTML = '<p class="text-center text-gray-400 py-6">Tidak ada santri di bagian ini.</p>';
    return;
  }

  const s = rekapSiswaList[rekapSiswaIdx];
  const data = rekapSiswaData[String(s.id)] || {};

  let html = '';
  html += '<div class="mb-3 flex items-center justify-between gap-2 flex-wrap">';
  html += '<div class="flex items-center gap-2">';
  html += `<button onclick="moveRekapSiswa(-1)" class="tap-target px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-600" aria-label="Santri sebelumnya">◀</button>`;
  html += `<span class="text-sm font-bold text-gray-800 dark:text-white whitespace-nowrap">${String(rekapSiswaIdx + 1).padStart(2, '0')}. ${s.nama}</span>`;
  html += `<button onclick="moveRekapSiswa(1)" class="tap-target px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-600" aria-label="Santri berikutnya">▶</button>`;
  html += '</div>';
  html += `<span class="text-xs text-gray-400">${rekapSiswaIdx + 1}/${rekapSiswaList.length}</span>`;
  html += '</div>';

  html += '<table class="border-collapse text-sm w-full"><thead><tr>';
  html += '<th class="px-2 py-2 border text-center w-10">#</th>';
  html += '<th class="px-3 py-2 border text-left">BULAN</th>';
  html += '<th class="px-3 py-2 border text-center w-16 text-blue-600 dark:text-blue-400">S</th>';
  html += '<th class="px-3 py-2 border text-center w-16 text-amber-600 dark:text-amber-400">I</th>';
  html += '<th class="px-3 py-2 border text-center w-16 text-red-600 dark:text-red-400">T</th>';
  html += '</tr></thead><tbody>';

  rekapBulanList.forEach((b, idx) => {
    const key = `${b.tahun}:${b.bulan}`;
    const d = data[key] || { s: 0, i: 0, a: 0 };
    html += '<tr>';
    html += `<td class="px-2 py-1.5 border text-center text-gray-400 text-xs">${String(idx + 1).padStart(2, '0')}</td>`;
    html += `<td class="px-3 py-1.5 border font-medium">${b.label}</td>`;
    html += `<td class="px-3 py-1.5 border text-center font-bold text-blue-600 dark:text-blue-400">${d.s || '-'}</td>`;
    html += `<td class="px-3 py-1.5 border text-center font-bold text-amber-600 dark:text-amber-400">${d.i || '-'}</td>`;
    html += `<td class="px-3 py-1.5 border text-center font-bold text-red-600 dark:text-red-400">${d.a || '-'}</td>`;
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<p class="text-xs text-gray-400 mt-2">S = Sakit &nbsp;•&nbsp; I = Izin &nbsp;•&nbsp; T = Alpha (tanpa keterangan) &nbsp;•&nbsp; Tampilan rekap (baca saja)</p>';

  rekapSiswaView.innerHTML = html;
}

// Wrapper lama tetap ada supaya referensi lain tidak rusak.
function renderSiswa(data) { renderRekapSiswaGrid(); }

// Load Log Absensi Pengajar
btnLoadPengajar.addEventListener('click', async () => {
    const tahunAjaran = selTahunPengajar.value;
    const tahunHijri = selTahunHijriPengajar.value;
    const bulanHijri = selBulanHijriPengajar.value;

    btnLoadPengajar.disabled = true;
    btnLoadPengajar.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Memuat...`;

    try {
        const res = await fetch(`/api/rekap/absensi-pengajar?tahun_ajaran=${tahunAjaran}&tahun_hijri=${tahunHijri}&bulan_hijri=${bulanHijri}`);
        if (!res.ok) throw new Error('Gagal mengambil data log pengajar');
        const data = await res.json();
        
        renderTablePengajar(data);
    } catch (err) {
        alert(err.message);
    } finally {
        btnLoadPengajar.disabled = false;
        btnLoadPengajar.innerHTML = 'Tampilkan Log';
    }
});

// ==================== LOG ABSENSI PENGAJAR ====================

function renderTablePengajar(data) {
  emptyState.classList.add('hidden');
  summarySiswa.classList.add('hidden');
  rekapSiswaView.classList.add('hidden');
  summaryPengajar.classList.remove('hidden');
  tableContainer.classList.remove('hidden');

  const list = data || [];

  const totalHadir = list.length; // Actually total ustadz active
  const totalSakit = list.reduce((a, u) => a + (u.total_sakit || 0), 0);
  const totalIzin = list.reduce((a, u) => a + (u.total_izin || 0), 0);
  const totalAlpha = list.reduce((a, u) => a + (u.total_alpha || 0), 0);
  const totalAlphaClean = list.filter(u => u.total_alpha === 0).length;

  const totalHadirGlobal = list.reduce((a, u) => a + (u.total_hadir || 0), 0);
  
  summaryPengajar.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${summaryCard('Total Pengajar', list.length, 'Pengajar aktif')}
      ${summaryCard('Sakit & Izin', totalSakit + totalIzin, `S: ${totalSakit} • I: ${totalIzin}`)}
      ${summaryCard('Total Alpha', totalAlpha, `Keseluruhan pengajar`, (totalAlpha ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'))}
      ${summaryCard('Bersih Alpha', `${totalAlphaClean}/${list.length}`, 'Pengajar nihil alpha', 'text-blue-600 dark:text-blue-400')}
    </div>`;

  if (list.length === 0) {
    tableHead.innerHTML = `<tr><th class="px-6 py-3">Data Kosong</th></tr>`;
    tableBody.innerHTML = '<tr><td class="px-6 py-8 text-center text-gray-500">Tidak ada pengajar aktif atau data kosong.</td></tr>';
    return;
  }

  tableHead.innerHTML = `
    <tr>
      <th class="px-4 py-3 w-12 text-center border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700">No</th>
      <th class="px-4 py-3 text-left border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700">Nama Pengajar</th>
      <th class="px-4 py-3 text-center border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400">Total Sakit</th>
      <th class="px-4 py-3 text-center border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 text-amber-600 dark:text-amber-400">Total Izin</th>
      <th class="px-4 py-3 text-center border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 text-red-600 dark:text-red-400">Total Alpha</th>
    </tr>`;

  tableBody.innerHTML = list.map((u, idx) => {
    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
        <td class="px-4 py-3 text-gray-500 text-center">${idx + 1}</td>
        <td class="px-4 py-3">
          <p class="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">${u.nama_pengajar}</p>
        </td>
        <td class="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">${u.total_sakit || 0}</td>
        <td class="px-4 py-3 text-center font-bold text-amber-600 dark:text-amber-400">${u.total_izin || 0}</td>
        <td class="px-4 py-3 text-center font-bold ${u.total_alpha ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}">${u.total_alpha || 0}</td>
      </tr>`;
  }).join('');
}


// Initialize
checkAuth();
