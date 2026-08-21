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

  html += '<table class="border-collapse text-sm w-full"><thead><tr>';
  html += '<th class="px-2 py-2 border text-center w-10">#</th>';
  html += '<th class="px-3 py-2 border text-left">BULAN</th>';
  html += '<th class="px-3 py-2 border text-center w-16">S</th>';
  html += '<th class="px-3 py-2 border text-center w-16">I</th>';
  html += '<th class="px-3 py-2 border text-center w-16">T</th>';
  html += '</tr></thead><tbody>';

  bulanListTA.forEach((b, idx) => {
    const key = `${b.tahun}:${b.bulan}`;
    const d = data[key] || { s: 0, i: 0, a: 0 };
    html += '<tr>';
    html += `<td class="px-2 py-1.5 border text-center text-gray-400 text-xs">${String(idx + 1).padStart(2, '0')}</td>`;
    html += `<td class="px-3 py-1.5 border font-medium">${b.label}</td>`;
    if (canEdit) {
      html += `<td class="px-1 py-1 border text-center"><input type="number" min="0" data-bulan="${key}" data-type="s" value="${d.s}" class="w-12 text-center glass-input rounded px-1 py-1 text-sm"></td>`;
      html += `<td class="px-1 py-1 border text-center"><input type="number" min="0" data-bulan="${key}" data-type="i" value="${d.i}" class="w-12 text-center glass-input rounded px-1 py-1 text-sm"></td>`;
      html += `<td class="px-1 py-1 border text-center"><input type="number" min="0" data-bulan="${key}" data-type="a" value="${d.a}" class="w-12 text-center glass-input rounded px-1 py-1 text-sm"></td>`;
    } else {
      html += `<td class="px-3 py-1.5 border text-center">${d.s || '-'}</td>`;
      html += `<td class="px-3 py-1.5 border text-center">${d.i || '-'}</td>`;
      html += `<td class="px-3 py-1.5 border text-center text-red-600 dark:text-red-400 font-semibold">${d.a || '-'}</td>`;
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

// === TAB PENGAJAR ===
const selBulanHijriP = document.getElementById('sel-bulan-hijri-p');
const btnLoadGridP = document.getElementById('btn-load-grid-p');
const gridContainerP = document.getElementById('grid-pengajar-container');
const gridElP = document.getElementById('grid-pengajar');
const btnSavePengajar = document.getElementById('btn-save-pengajar');

let pengajarList = [];
// (pengajarData lama dihapus — pakai pengajarGridData)

// Populate bulan dropdown pengajar
function initPengajarDropdowns() {
  populateBulanDropdown(selBulanHijriP);
}

let pengajarGridData = {}; // key: pengajarId -> { "tahun:bulan": { s, i, a } }
let bulanListTAP = [];
let currentPengajarIdx = 0;
let currentTingkatanP = null, currentKelasP = null;

btnLoadGridP?.addEventListener('click', loadGridPengajar);

async function loadGridPengajar() {
  const tingkatanId = selTingkatanP.value;
  const kelasId = selKelasP.value;
  if (!tingkatanId || !kelasId) {
    alert('Pilih Tingkatan dan Kelas');
    return;
  }

  bulanListTAP = buildBulanListTA();
  if (bulanListTAP.length === 0) { alert('Kalender akademik belum diset (Settings).'); return; }

  const resP = await fetch(`/api/pengajar?tingkatan_id=${tingkatanId}&kelas_id=${kelasId}`);
  const pJson = await resP.json();
  pengajarList = (Array.isArray(pJson) ? pJson : []).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

  // Load existing data — semua tahun Hijri dalam rentang TA.
  const tahunSet = [...new Set(bulanListTAP.map(b => b.tahun))];
  const existing = [];
  for (const th of tahunSet) {
    try {
      const resData = await fetch(`/api/absensi-manual/pengajar?tingkatan_id=${tingkatanId}&kelas_id=${kelasId}&tahun_hijri=${th}`);
      const arr = await resData.json();
      if (Array.isArray(arr)) existing.push(...arr);
    } catch (_) {}
  }

  pengajarGridData = {};
  existing.forEach(e => {
    const key = `${e.pengajar_id}`;
    if (!pengajarGridData[key]) pengajarGridData[key] = {};
    pengajarGridData[key][`${e.tahun_hijri}:${e.bulan_hijri}`] = {
      s: e.total_sakit || 0, i: e.total_izin || 0, a: e.total_alpha || 0
    };
  });

  currentPengajarIdx = 0;
  currentTingkatanP = tingkatanId;
  currentKelasP = kelasId;

  const canEdit = cachedBagian.some(b => b.tingkatan_id == tingkatanId && b.kelas_id == kelasId && b.can_edit_absensi);

  renderGridPengajar(canEdit);
  gridContainerP.classList.remove('hidden');
  btnSavePengajar?.classList.toggle('hidden', !canEdit || pengajarList.length === 0);
}

function movePengajar(delta) {
  if (!pengajarList.length) return;
  currentPengajarIdx = (currentPengajarIdx + delta + pengajarList.length) % pengajarList.length;
  const canEdit = cachedBagian.some(b => b.tingkatan_id == currentTingkatanP && b.kelas_id == currentKelasP && b.can_edit_absensi);
  renderGridPengajar(canEdit);
}
window.movePengajar = movePengajar;

// Render grid pengajar: seluruh bulan TA × S/I/T untuk 1 pengajar.
function renderGridPengajar(canEdit = false) {
  if (!pengajarList.length) {
    gridElP.innerHTML = '<p class="text-gray-400 text-center py-4">Tidak ada pengajar.</p>';
    return;
  }

  const p = pengajarList[currentPengajarIdx];
  const data = pengajarGridData[String(p.id)] || {};

  let html = '';
  html += '<div class="mb-3 flex items-center justify-between gap-2 flex-wrap">';
  html += '<div class="flex items-center gap-2">';
  html += `<button onclick="movePengajar(-1)" class="tap-target px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-600" aria-label="Pengajar sebelumnya">◀</button>`;
  html += `<span class="text-sm font-bold text-gray-800 dark:text-white whitespace-nowrap">${String(currentPengajarIdx + 1).padStart(2, '0')}. ${p.nama}</span>`;
  html += `<button onclick="movePengajar(1)" class="tap-target px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-600" aria-label="Pengajar berikutnya">▶</button>`;
  html += '</div>';
  html += `<span class="text-xs text-gray-400">${currentPengajarIdx + 1}/${pengajarList.length}</span>`;
  html += '</div>';

  html += '<table class="border-collapse text-sm w-full"><thead><tr>';
  html += '<th class="px-2 py-2 border text-center w-10">#</th>';
  html += '<th class="px-3 py-2 border text-left">BULAN</th>';
  html += '<th class="px-3 py-2 border text-center w-16">S</th>';
  html += '<th class="px-3 py-2 border text-center w-16">I</th>';
  html += '<th class="px-3 py-2 border text-center w-16">T</th>';
  html += '</tr></thead><tbody>';

  bulanListTAP.forEach((b, idx) => {
    const key = `${b.tahun}:${b.bulan}`;
    const d = data[key] || { s: 0, i: 0, a: 0 };
    html += '<tr>';
    html += `<td class="px-2 py-1.5 border text-center text-gray-400 text-xs">${String(idx + 1).padStart(2, '0')}</td>`;
    html += `<td class="px-3 py-1.5 border font-medium">${b.label}</td>`;
    if (canEdit) {
      html += `<td class="px-1 py-1 border text-center"><input type="number" min="0" data-bulan="${key}" data-type="s" value="${d.s}" class="w-12 text-center glass-input rounded px-1 py-1 text-sm"></td>`;
      html += `<td class="px-1 py-1 border text-center"><input type="number" min="0" data-bulan="${key}" data-type="i" value="${d.i}" class="w-12 text-center glass-input rounded px-1 py-1 text-sm"></td>`;
      html += `<td class="px-1 py-1 border text-center"><input type="number" min="0" data-bulan="${key}" data-type="a" value="${d.a}" class="w-12 text-center glass-input rounded px-1 py-1 text-sm"></td>`;
    } else {
      html += `<td class="px-3 py-1.5 border text-center">${d.s || '-'}</td>`;
      html += `<td class="px-3 py-1.5 border text-center">${d.i || '-'}</td>`;
      html += `<td class="px-3 py-1.5 border text-center text-red-600 dark:text-red-400 font-semibold">${d.a || '-'}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody></table>';

  html += '<p class="text-xs text-gray-400 mt-2">S = Sakit &nbsp;•&nbsp; I = Izin &nbsp;•&nbsp; T = Alpha (tanpa keterangan)</p>';
  if (!canEdit) {
    html += '<p class="text-xs text-red-500 mt-2 italic">* Anda tidak memiliki akses untuk mengedit absensi kelas ini.</p>';
  }
  gridElP.innerHTML = html;
}

btnSavePengajar?.addEventListener('click', async () => {
  if (!pengajarList.length) return;
  const tahunAjaran = activeTahunAjaran;
  const entries = [];

  gridElP.querySelectorAll('input[data-bulan]').forEach(inp => {
    const [th, bl] = inp.dataset.bulan.split(':').map(Number);
    const type = inp.dataset.type;
    const val = parseInt(inp.value) || 0;

    let entry = entries.find(e => e.tahun_hijri === th && e.bulan_hijri === bl);
    if (!entry) {
      entry = { pengajar_id: pengajarList[currentPengajarIdx].id, tahun_hijri: th, bulan_hijri: bl, tahun_ajaran: tahunAjaran, total_sakit: 0, total_izin: 0, total_alpha: 0, total_hadir: 0 };
      entries.push(entry);
    }
    if (type === 's') entry.total_sakit = val;
    if (type === 'i') entry.total_izin = val;
    if (type === 'a') entry.total_alpha = val;
  });

  btnSavePengajar.disabled = true;
  btnSavePengajar.textContent = 'Menyimpan...';
  try {
    const res = await fetch('/api/absensi-manual/pengajar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entries)
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    alert(`Tersimpan! ${result.saved} disimpan, ${result.deleted} dihapus.`);
    if (pengajarList.length > 1) movePengajar(1);
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btnSavePengajar.disabled = false;
    btnSavePengajar.textContent = 'Simpan & Lanjut ▶';
  }
});

// === INIT ===
checkAuth().then(() => {
  loadSettings().then(async () => {
    await loadKalenderRange();
    loadFilters();
    initPengajarDropdowns();
  });
});
