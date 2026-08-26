// absensi-manual.js — Input absensi manual bulanan (bulan Hijriyah).
// Admin/Pimpinan memasukkan total S/I/A per santri/pengajar per bulan.

const BULAN_HIJRI = [
  'Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir',
  'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Sya\'ban',
  'Ramadhan', 'Syawwal', 'Dzulqa\'dah', 'Dzulhijjah'
];

// Tahun Hijri aktif mendukung pasangan "1447/1448" (satu tahun ajaran = 2 tahun Hijri).
function tahunHijriPair() {
  const parts = String(activeTahunHijri || '').split('/').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
  if (parts.length >= 2) return [parts[0], parts[1]];
  if (parts.length === 1) return [parts[0], parts[0] + 1];
  try {
    const h = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { year: 'numeric' }).format(new Date());
    const y = parseInt(h, 10) || 1447;
    return [y, y + 1];
  } catch (_) { return [1447, 1448]; }
}

// Rentang kalender akademik (Hijri) tahun ajaran aktif.
let kalenderRange = null;

function hijriOrd(y, m, d) { return y * 360 + m * 30 + d; }

// Muat rentang Semester 1 & 2 dari kalender akademik tahun ajaran aktif.
async function loadKalenderRange() {
  try {
    if (!activeTahunAjaran) return;
    const res = await fetch(`/api/kalender/hijri-semester?tahun_ajaran=${encodeURIComponent(activeTahunAjaran)}`);
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
    if (mulai && selesai) kalenderRange = { mulai, selesai };
  } catch (_) {}
}

// Dropdown bulan hanya berisi bulan dalam rentang kalender akademik
// (mis. 17 Syawal 1447 -> 4 Sya'ban 1448). Jika kalender belum diset,
// fallback ke seluruh 2 tahun Hijri aktif.
// Value option = "tahun:bulan" sehingga tidak perlu gonta-ganti tahun.
function populateBulanDropdown(sel) {
  let html = '<option value="">-- Pilih Bulan --</option>';
  if (kalenderRange) {
    let y = kalenderRange.mulai.thn;
    let m = kalenderRange.mulai.bln;
    const endOrd = kalenderRange.selesai.thn * 12 + kalenderRange.selesai.bln;
    let curGroup = null;
    while (y * 12 + m <= endOrd) {
      if (curGroup !== y) {
        if (curGroup !== null) html += '</optgroup>';
        html += `<optgroup label="Tahun ${y} H">`;
        curGroup = y;
      }
      html += `<option value="${y}:${m}">${BULAN_HIJRI[m - 1]} ${y} H</option>`;
      m++;
      if (m > 12) { m = 1; y++; }
    }
    if (curGroup !== null) html += '</optgroup>';
    sel.innerHTML = html;
    return;
  }
  const [t1, t2] = tahunHijriPair();
  [t1, t2].forEach(th => {
    html += `<optgroup label="Tahun ${th} H">`;
    BULAN_HIJRI.forEach((nama, idx) => {
      html += `<option value="${th}:${idx + 1}">${nama} ${th} H</option>`;
    });
    html += '</optgroup>';
  });
  sel.innerHTML = html;
}

// Parse pilihan dropdown { tahun, bulan }.
function parseBulanSel(sel) {
  const v = sel.value || '';
  const [t, b] = v.split(':');
  return { tahun: parseInt(t, 10) || 0, bulan: parseInt(b, 10) || 0 };
}

// Label tampilan, mis. "Rajab 1448 H".
function selBulanLabel(sel) {
  const p = parseBulanSel(sel);
  if (!p.bulan) return '';
  return `${BULAN_HIJRI[p.bulan - 1]} ${p.tahun} H`;
}

// === TABS ===
const tabSantri = document.getElementById('tab-santri');
const tabPengajar = document.getElementById('tab-pengajar');
const panelSantri = document.getElementById('panel-santri');
const panelPengajar = document.getElementById('panel-pengajar');

tabSantri?.addEventListener('click', () => switchTab('santri'));
tabPengajar?.addEventListener('click', () => switchTab('pengajar'));

function switchTab(name) {
  const isSantri = name === 'santri';
  tabSantri.classList.toggle('border-primary', isSantri);
  tabSantri.classList.toggle('text-primary', isSantri);
  tabSantri.classList.toggle('border-transparent', !isSantri);
  tabSantri.classList.toggle('text-gray-500', !isSantri);
  tabPengajar.classList.toggle('border-primary', !isSantri);
  tabPengajar.classList.toggle('text-primary', !isSantri);
  tabPengajar.classList.toggle('border-transparent', isSantri);
  tabPengajar.classList.toggle('text-gray-500', isSantri);
  panelSantri.classList.toggle('hidden', !isSantri);
  panelPengajar.classList.toggle('hidden', isSantri);
}

// === FILTER CASCADING (Santri) ===
const selTingkatan = document.getElementById('sel-tingkatan');
const selKelas = document.getElementById('sel-kelas');
const selBagian = document.getElementById('sel-bagian');
const selTahunHijri = document.getElementById('sel-tahun-hijri');
const selBulanHijri = document.getElementById('sel-bulan-hijri');

let cachedTingkatan = [], cachedKelas = [], cachedBagian = [];
let activeTahunAjaran = '';
let activeTahunHijri = '';

async function loadSettings() {
  try {
    const res = await fetch('/api/settings/umum');
    const data = await res.json();
    activeTahunAjaran = data.tahun_ajaran_aktif || '';
    activeTahunHijri = data.tahun_hijri_aktif || '1447';
  } catch (_) {
    activeTahunAjaran = '';
    activeTahunHijri = '1447';
  }

  // Set readonly fields
  document.getElementById('sel-tahun-ajaran').value = activeTahunAjaran;
  selTahunHijri.value = activeTahunHijri;
  document.getElementById('sel-tahun-ajaran-p').value = activeTahunAjaran;
  document.getElementById('sel-tahun-hijri-p').value = activeTahunHijri;
}

// 2. Auth Check
let currentRoles = [];
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await response.json();
    currentRoles = data.roles || [data.role];
    
    // Sembunyikan tab pengajar untuk muroqib
    if (currentRoles.includes('muroqib') && !currentRoles.includes('pimpinan')) {
      if (tabPengajar) tabPengajar.classList.add('hidden');
    }
  } catch (err) {
    console.error("Auth check failed:", err);
  }
}


async function loadFilters() {
  const [resT, resK, resB] = await Promise.all([
    fetch('/api/akademik/tingkatan'),
    fetch('/api/akademik/kelas'),
    fetch('/api/penilaian/bagian')
  ]);
  const allTingkatan = (await resT.json()) || [];
  const allKelas = (await resK.json()) || [];
  cachedBagian = (await resB.json()) || [];

  const isAdminOrPimpinan = currentRoles.includes('admin') || currentRoles.includes('pimpinan');
  if (isAdminOrPimpinan) {
    cachedTingkatan = allTingkatan;
    cachedKelas = allKelas;
  } else {
    cachedBagian = cachedBagian.filter(b => b.can_edit_absensi);
    const allowedTingkatanIds = new Set(cachedBagian.map(b => b.tingkatan_id));
    const allowedKelasIds = new Set(cachedBagian.map(b => b.kelas_id));
    cachedTingkatan = allTingkatan.filter(t => allowedTingkatanIds.has(t.id));
    cachedKelas = allKelas.filter(k => allowedKelasIds.has(k.id));
  }

  cachedTingkatan.forEach(t => {
    selTingkatanP.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
    selTingkatan.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
  });

  // Populate bulan Hijri dropdown (24 bulan: 2 tahun Hijri aktif).
  populateBulanDropdown(selBulanHijri);

  const selBagianP = document.getElementById('sel-bagian-p');
  if (selBagianP && selBagianP.parentElement) {
    selBagianP.parentElement.style.display = 'none';
  }
}

selTingkatan?.addEventListener('change', () => {
  selKelas.innerHTML = '<option value="">-- Pilih --</option>';
  selBagian.innerHTML = '<option value="">-- Pilih --</option>';
  cachedKelas.forEach(k => { selKelas.innerHTML += `<option value="${k.id}">${k.nama}</option>`; });
});

selKelas?.addEventListener('change', () => {
  const tId = selTingkatan.value;
  const kId = selKelas.value;
  selBagian.innerHTML = '<option value="">-- Pilih --</option>';
  cachedBagian.filter(b => (!tId || b.tingkatan_id == tId) && (!kId || b.kelas_id == kId))
    .forEach(b => { selBagian.innerHTML += `<option value="${b.id}">${b.nama_bagian}</option>`; });
});


const selTingkatanP = document.getElementById('sel-tingkatan-p');
const selKelasP = document.getElementById('sel-kelas-p');
const selBagianP = document.getElementById('sel-bagian-p');

selTingkatanP?.addEventListener('change', () => {
  selKelasP.innerHTML = '<option value="">-- Pilih --</option>';
  selBagianP.innerHTML = '<option value="">-- Pilih --</option>';
  cachedKelas.forEach(k => { selKelasP.innerHTML += `<option value="${k.id}">${k.nama}</option>`; });
});

selKelasP?.addEventListener('change', () => {
  const tId = selTingkatanP.value;
  const kId = selKelasP.value;
  selBagianP.innerHTML = '<option value="">-- Pilih --</option>';
  cachedBagian.filter(b => (!tId || b.tingkatan_id == tId) && (!kId || b.kelas_id == kId))
    .forEach(b => { selBagianP.innerHTML += `<option value="${b.id}">${b.nama_bagian}</option>`; });
});

// === GRID SANTRI (mode baru: semua bulan TA tampil, input per santri) ===
const btnLoadGrid = document.getElementById('btn-load-grid');
const gridContainer = document.getElementById('grid-santri-container');
const gridEl = document.getElementById('grid-santri');
const btnSaveSantri = document.getElementById('btn-save-santri');

let santriList = [];
let santriGridData = {}; // key: santriId -> { "tahun:bulan": { s, i, a } }
let bulanListTA = [];    // [{ tahun, bulan, label }] seluruh bulan dalam kalender TA
let currentSantriIdx = 0;
let currentBagianId = null;

// Susun daftar bulan TA dari kalender akademik (fallback: pasangan tahun Hijri).
function buildBulanListTA() {
  const list = [];
  if (kalenderRange) {
    let y = kalenderRange.mulai.thn, m = kalenderRange.mulai.bln;
    const end = kalenderRange.selesai.thn * 12 + kalenderRange.selesai.bln;
    while (y * 12 + m <= end) {
      list.push({ tahun: y, bulan: m, label: `${BULAN_HIJRI[m - 1]} ${y} H` });
      m++; if (m > 12) { m = 1; y++; }
    }
  } else {
    const [t1, t2] = tahunHijriPair();
    [t1, t2].forEach(th => BULAN_HIJRI.forEach((nama, idx) => {
      list.push({ tahun: th, bulan: idx + 1, label: `${nama} ${th} H` });
    }));
  }
  return list;
}

btnLoadGrid?.addEventListener('click', loadGridSantri);

async function loadGridSantri() {
  const bagianId = selBagian.value;
  if (!bagianId) { alert('Pilih bagian terlebih dahulu'); return; }

  bulanListTA = buildBulanListTA();
  if (bulanListTA.length === 0) { alert('Kalender akademik belum diset (Settings).'); return; }

  // Load santri di bagian
  const resSantri = await fetch(`/api/santri/by-bagian/${bagianId}`);
  const santriJson = await resSantri.json();
  santriList = (Array.isArray(santriJson) ? santriJson : []).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

  // Load existing data — 1 TA mencakup 2 tahun Hijri, ambil keduanya lalu gabung.
  const tahunSet = [...new Set(bulanListTA.map(b => b.tahun))];
  const existing = [];
  for (const th of tahunSet) {
    try {
      const resData = await fetch(`/api/absensi-manual/santri?bagian_id=${bagianId}&tahun_hijri=${th}`);
      const arr = await resData.json();
      if (Array.isArray(arr)) existing.push(...arr);
    } catch (_) {}
  }

  santriGridData = {};
  existing.forEach(e => {
    const key = `${e.santri_id}`;
    if (!santriGridData[key]) santriGridData[key] = {};
    santriGridData[key][`${e.tahun_hijri}:${e.bulan_hijri}`] = {
      s: e.total_sakit || 0, i: e.total_izin || 0, a: e.total_alpha || 0
    };
  });

  currentSantriIdx = 0;
  currentBagianId = bagianId;

  const activeBagian = cachedBagian.find(b => b.id == bagianId);
  const canEdit = activeBagian ? activeBagian.can_edit_absensi : false;

  renderGridSantri(canEdit);
  gridContainer.classList.remove('hidden');
  btnSaveSantri?.classList.toggle('hidden', !canEdit || santriList.length === 0);
}

// Navigasi santri (◀ ▶)
function moveSantri(delta) {
  if (!santriList.length) return;
  currentSantriIdx = (currentSantriIdx + delta + santriList.length) % santriList.length;
  const activeBagian = cachedBagian.find(b => b.id == currentBagianId);
  renderGridSantri(activeBagian ? activeBagian.can_edit_absensi : false);
}
window.moveSantri = moveSantri;

// Render grid: seluruh bulan TA ke bawah × 3 kolom (S/I/T) untuk 1 santri.
// Hadir (H) dihapus dari input & rekap sesuai keputusan owner 2026-08.
function renderGridSantri(canEdit = false) {
  if (!santriList.length) {
    gridEl.innerHTML = '<p class="text-gray-400 text-center py-4">Tidak ada santri di bagian ini.</p>';
    return;
  }

  const s = santriList[currentSantriIdx];
  const data = santriGridData[String(s.id)] || {};

  let html = '';
  html += '<div class="mb-3 flex items-center justify-between gap-2 flex-wrap">';
  html += '<div class="flex items-center gap-2">';
  html += `<button onclick="moveSantri(-1)" class="tap-target px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-600" aria-label="Santri sebelumnya">◀</button>`;
  html += `<span class="text-sm font-bold text-gray-800 dark:text-white whitespace-nowrap">${String(currentSantriIdx + 1).padStart(2, '0')}. ${s.nama}</span>`;
  html += `<button onclick="moveSantri(1)" class="tap-target px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-600" aria-label="Santri berikutnya">▶</button>`;
  html += '</div>';
  html += `<span class="text-xs text-gray-400">${currentSantriIdx + 1}/${santriList.length}</span>`;
  html += '</div>';

  html += '<table class="w-full border-collapse text-sm table-fixed">';
  html += '<colgroup><col style="width:10%"><col style="width:40%"><col style="width:16.6%"><col style="width:16.6%"><col style="width:16.6%"></colgroup>';
  html += '<thead><tr>';
  html += '<th class="px-1 py-2 border text-center text-xs">#</th>';
  html += '<th class="px-2 py-2 border text-left text-xs">BULAN</th>';
  html += '<th class="px-1 py-2 border text-center text-xs">S</th>';
  html += '<th class="px-1 py-2 border text-center text-xs">I</th>';
  html += '<th class="px-1 py-2 border text-center text-xs">T</th>';
  html += '</tr></thead><tbody>';

  bulanListTA.forEach((b, idx) => {
    const key = `${b.tahun}:${b.bulan}`;
    const d = data[key]; // undefined = belum diisi → biarkan kosong (jangan 0)
    const vs = d ? (d.s || '') : '';
    const vi = d ? (d.i || '') : '';
    const va = d ? (d.a || '') : '';
    html += '<tr>';
    html += `<td class="px-1 py-1.5 border text-center text-gray-400 text-xs">${String(idx + 1).padStart(2, '0')}</td>`;
    html += `<td class="px-2 py-1.5 border font-medium text-xs break-words">${b.label}</td>`;
    if (canEdit) {
      html += `<td class="px-0.5 py-1 border text-center"><input type="number" min="0" inputmode="numeric" data-bulan="${key}" data-type="s" value="${vs}" class="w-full text-center glass-input rounded px-0.5 py-1 text-sm"></td>`;
      html += `<td class="px-0.5 py-1 border text-center"><input type="number" min="0" inputmode="numeric" data-bulan="${key}" data-type="i" value="${vi}" class="w-full text-center glass-input rounded px-0.5 py-1 text-sm"></td>`;
      html += `<td class="px-0.5 py-1 border text-center"><input type="number" min="0" inputmode="numeric" data-bulan="${key}" data-type="a" value="${va}" class="w-full text-center glass-input rounded px-0.5 py-1 text-sm"></td>`;
    } else {
      html += `<td class="px-1 py-1.5 border text-center">${vs || '-'}</td>`;
      html += `<td class="px-1 py-1.5 border text-center">${vi || '-'}</td>`;
      html += `<td class="px-1 py-1.5 border text-center text-red-600 dark:text-red-400 font-semibold">${va || '-'}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody></table>';

  html += '<p class="text-xs text-gray-400 mt-2">S = Sakit &nbsp;•&nbsp; I = Izin &nbsp;•&nbsp; T = Alpha (tanpa keterangan)</p>';
  if (!canEdit) {
    html += '<p class="text-xs text-red-500 mt-2 italic">* Anda tidak memiliki akses untuk mengedit absensi kelas ini.</p>';
  }
  gridEl.innerHTML = html;
}

btnSaveSantri?.addEventListener('click', async () => {
  if (!santriList.length) return;
  const tahunAjaran = activeTahunAjaran;
  const entries = [];

  gridEl.querySelectorAll('input[data-bulan]').forEach(inp => {
    const [th, bl] = inp.dataset.bulan.split(':').map(Number);
    const type = inp.dataset.type;
    const val = parseInt(inp.value) || 0;

    let entry = entries.find(e => e.tahun_hijri === th && e.bulan_hijri === bl);
    if (!entry) {
      entry = { santri_id: santriList[currentSantriIdx].id, tahun_hijri: th, bulan_hijri: bl, tahun_ajaran: tahunAjaran, total_sakit: 0, total_izin: 0, total_alpha: 0, total_hadir: 0 };
      entries.push(entry);
    }
    if (type === 's') entry.total_sakit = val;
    if (type === 'i') entry.total_izin = val;
    if (type === 'a') entry.total_alpha = val;
  });

  btnSaveSantri.disabled = true;
  btnSaveSantri.textContent = 'Menyimpan...';
  try {
    const res = await fetch('/api/absensi-manual/santri', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entries)
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    alert(`Tersimpan! ${result.saved} disimpan, ${result.deleted} dihapus.`);
    // Lanjut otomatis ke santri berikutnya (loop kembali ke awal di akhir).
    if (santriList.length > 1) moveSantri(1);
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btnSaveSantri.disabled = false;
    btnSaveSantri.textContent = 'Simpan & Lanjut ▶';
  }
});

// === TAB PENGAJAR (input numerik per KUARTAL: K1 | K2&3 | K4) ===
// Ganti model bulanan S/I/T. Isi = angka bebas per grup kuartal, per pengajar.
const btnLoadGridP = document.getElementById('btn-load-grid-p');
const gridContainerP = document.getElementById('grid-pengajar-container');
const gridElP = document.getElementById('grid-pengajar');
const btnSavePengajar = document.getElementById('btn-save-pengajar');

let pengajarKuartalList = []; // [{ pengajar_id, pengajar_nama, kuartal_1, kuartal_23, kuartal_4 }]
let currentTingkatanP = null, currentKelasP = null;

btnLoadGridP?.addEventListener('click', loadGridPengajar);

async function loadGridPengajar() {
  const tingkatanId = selTingkatanP.value;
  const kelasId = selKelasP.value;
  if (!tingkatanId) { alert('Pilih Tingkatan'); return; }

  const params = new URLSearchParams({
    tahun_ajaran: activeTahunAjaran,
    tingkatan_id: tingkatanId,
  });
  if (kelasId) params.set('kelas_id', kelasId);

  try {
    const res = await fetch(`/api/absensi-pengajar-kuartal?${params.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    const arr = await res.json();
    pengajarKuartalList = (Array.isArray(arr) ? arr : []);
  } catch (err) {
    alert('Gagal memuat pengajar: ' + err.message);
    return;
  }

  currentTingkatanP = tingkatanId;
  currentKelasP = kelasId;

  const isAdminOrPimpinan = currentRoles.includes('admin') || currentRoles.includes('pimpinan');
  const canEdit = isAdminOrPimpinan || currentRoles.includes('mufatish') || currentRoles.includes('muroqib');

  renderGridPengajar(canEdit);
  gridContainerP.classList.remove('hidden');
  btnSavePengajar?.classList.toggle('hidden', !canEdit || pengajarKuartalList.length === 0);
}

// Render tabel: baris = pengajar (mustahiq + munawwib), kolom = K1 | K2&3 | K4.
// Pengajar tanpa catatan tetap tampil (angka default 0).
function renderGridPengajar(canEdit = false) {
  if (!pengajarKuartalList.length) {
    gridElP.innerHTML = '<p class="text-gray-400 text-center py-4">Tidak ada pengajar untuk filter ini.</p>';
    return;
  }

  let html = '';
  html += '<table class="w-full border-collapse text-sm table-fixed">';
  html += '<colgroup><col style="width:40%"><col style="width:20%"><col style="width:20%"><col style="width:20%"></colgroup>';
  html += '<thead><tr>';
  html += '<th class="px-2 py-2 border text-left text-xs">NAMA</th>';
  html += '<th class="px-1 py-2 border text-center text-xs leading-tight">K1</th>';
  html += '<th class="px-1 py-2 border text-center text-xs leading-tight">K2&amp;3</th>';
  html += '<th class="px-1 py-2 border text-center text-xs leading-tight">K4</th>';
  html += '</tr></thead><tbody>';

  pengajarKuartalList.forEach((p, idx) => {
    // Sebelum ada record (id==0) biarkan kosong, jangan tampilkan 0.
    const has = p.id > 0;
    const v1 = has ? p.kuartal_1 : '';
    const v23 = has ? p.kuartal_23 : '';
    const v4 = has ? p.kuartal_4 : '';
    html += '<tr>';
    html += `<td class="px-2 py-1.5 border font-medium text-xs break-words">${p.pengajar_nama || '-'}</td>`;
    if (canEdit) {
      html += `<td class="px-0.5 py-1 border text-center"><input type="number" min="0" inputmode="numeric" data-pid="${p.pengajar_id}" data-k="1" value="${v1}" class="w-full text-center glass-input rounded px-0.5 py-1 text-sm"></td>`;
      html += `<td class="px-0.5 py-1 border text-center"><input type="number" min="0" inputmode="numeric" data-pid="${p.pengajar_id}" data-k="23" value="${v23}" class="w-full text-center glass-input rounded px-0.5 py-1 text-sm"></td>`;
      html += `<td class="px-0.5 py-1 border text-center"><input type="number" min="0" inputmode="numeric" data-pid="${p.pengajar_id}" data-k="4" value="${v4}" class="w-full text-center glass-input rounded px-0.5 py-1 text-sm"></td>`;
    } else {
      html += `<td class="px-1 py-1.5 border text-center">${has ? p.kuartal_1 : '-'}</td>`;
      html += `<td class="px-1 py-1.5 border text-center">${has ? p.kuartal_23 : '-'}</td>`;
      html += `<td class="px-1 py-1.5 border text-center">${has ? p.kuartal_4 : '-'}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<p class="text-xs text-gray-400 mt-2">K1 = Kuartal 1 &nbsp;•&nbsp; K2&amp;3 = Kuartal 2 &amp; 3 &nbsp;•&nbsp; K4 = Kuartal 4</p>';

  if (!canEdit) {
    html += '<p class="text-xs text-red-500 mt-2 italic">* Anda tidak memiliki akses untuk mengedit absensi pengajar.</p>';
  }
  gridElP.innerHTML = html;
}

btnSavePengajar?.addEventListener('click', async () => {
  if (!pengajarKuartalList.length) return;

  // Kumpulkan nilai per pengajar dari input K1/K23/K4.
  const byPid = {};
  gridElP.querySelectorAll('input[data-pid]').forEach(inp => {
    const pid = parseInt(inp.dataset.pid, 10);
    const k = inp.dataset.k;
    const val = parseInt(inp.value, 10) || 0;
    if (!byPid[pid]) byPid[pid] = { pengajar_id: pid, kuartal_1: 0, kuartal_23: 0, kuartal_4: 0 };
    if (k === '1') byPid[pid].kuartal_1 = val;
    if (k === '23') byPid[pid].kuartal_23 = val;
    if (k === '4') byPid[pid].kuartal_4 = val;
  });
  const data = Object.values(byPid);

  btnSavePengajar.disabled = true;
  btnSavePengajar.textContent = 'Menyimpan...';
  try {
    const res = await fetch('/api/absensi-pengajar-kuartal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tahun_ajaran: activeTahunAjaran, data })
    });
    if (!res.ok) throw new Error(await res.text());
    await res.json();
    alert('Absensi pengajar tersimpan.');
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btnSavePengajar.disabled = false;
    btnSavePengajar.textContent = 'Simpan';
  }
});

// === INIT ===
checkAuth().then(() => {
  loadSettings().then(async () => {
    await loadKalenderRange();
    loadFilters();
  });
});
