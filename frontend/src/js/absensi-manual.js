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

// === GRID SANTRI ===
const btnLoadGrid = document.getElementById('btn-load-grid');
const gridContainer = document.getElementById('grid-santri-container');
const gridEl = document.getElementById('grid-santri');
const btnSaveSantri = document.getElementById('btn-save-santri');

let santriList = [];
let santriData = {}; // key: santriId -> { s, i, a }

btnLoadGrid?.addEventListener('click', loadGridSantri);

async function loadGridSantri() {
  const bagianId = selBagian.value;
  const pilihan = parseBulanSel(selBulanHijri);
  const tahunHijri = pilihan.tahun;
  const bulanHijri = pilihan.bulan;
  if (!bagianId || !tahunHijri || !bulanHijri) {
    alert('Pilih bagian dan bulan');
    return;
  }

  // Load santri di bagian
  const resSantri = await fetch(`/api/santri/by-bagian/${bagianId}`);
  const santriJson = await resSantri.json();
  santriList = (Array.isArray(santriJson) ? santriJson : []).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

  // Load existing data
  const resData = await fetch(`/api/absensi-manual/santri?bagian_id=${bagianId}&tahun_hijri=${tahunHijri}`);
  const existingJson = await resData.json();
  const existing = Array.isArray(existingJson) ? existingJson : [];

  // Map existing data per santri for the selected bulan
  santriData = {};
  existing.filter(e => e.bulan_hijri == bulanHijri).forEach(e => {
    santriData[e.santri_id] = { s: e.total_sakit, i: e.total_izin, a: e.total_alpha, h: e.total_hadir };
  });

  const activeBagian = cachedBagian.find(b => b.id == bagianId);
  const canEdit = activeBagian ? activeBagian.can_edit_absensi : false;

  renderGridSantri(canEdit);
  gridContainer.classList.remove('hidden');

  if (canEdit) {
    btnSaveSantri?.classList.remove('hidden');
  } else {
    btnSaveSantri?.classList.add('hidden');
  }
}

function renderGridSantri(canEdit = false) {
  if (santriList.length === 0) {
    gridEl.innerHTML = '<p class="text-gray-400 text-center py-4">Tidak ada santri di bagian ini.</p>';
    return;
  }

  let html = `<p class="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Bulan: <span class="font-bold">${selBulanLabel(selBulanHijri)}</span></p>`;
  html += '<table class="border-collapse text-sm w-full"><thead><tr>';
  html += '<th class="px-3 py-2 border text-left">Nama Santri</th>';
  html += '<th class="px-3 py-2 border text-center w-20">Sakit</th>';
  html += '<th class="px-3 py-2 border text-center w-20">Izin</th>';
  html += '<th class="px-3 py-2 border text-center w-20">Alpha</th>';
  html += '<th class="px-3 py-2 border text-center w-20 text-green-600">Hadir</th>';
  html += '</tr></thead><tbody>';

  santriList.forEach(s => {
    const d = santriData[s.id] || { s: 0, i: 0, a: 0, h: 0 };
    if (canEdit) {
      html += `<tr>
        <td class="px-3 py-2 border font-medium">${s.nama}</td>
        <td class="px-1 py-1 border text-center"><input type="number" min="0" data-sid="${s.id}" data-type="s" value="${d.s}" class="w-16 text-center glass-input rounded px-2 py-1 text-sm"></td>
        <td class="px-1 py-1 border text-center"><input type="number" min="0" data-sid="${s.id}" data-type="i" value="${d.i}" class="w-16 text-center glass-input rounded px-2 py-1 text-sm"></td>
        <td class="px-1 py-1 border text-center"><input type="number" min="0" data-sid="${s.id}" data-type="a" value="${d.a}" class="w-16 text-center glass-input rounded px-2 py-1 text-sm"></td>
        <td class="px-1 py-1 border text-center"><input type="number" min="0" data-sid="${s.id}" data-type="h" value="${d.h}" class="w-16 text-center glass-input rounded px-2 py-1 text-sm font-bold text-green-700"></td>
      </tr>`;
    } else {
      html += `<tr>
        <td class="px-3 py-2 border font-medium">${s.nama}</td>
        <td class="px-3 py-2 border text-center">${d.s}</td>
        <td class="px-3 py-2 border text-center">${d.i}</td>
        <td class="px-3 py-2 border text-center">${d.a}</td>
        <td class="px-3 py-2 border text-center font-bold text-green-700">${d.h}</td>
      </tr>`;
    }
  });
  html += '</tbody></table>';
  if (!canEdit) {
    html += '<p class="text-xs text-red-500 mt-2 italic">* Anda tidak memiliki akses untuk mengedit absensi kelas ini.</p>';
  }
  gridEl.innerHTML = html;
}

btnSaveSantri?.addEventListener('click', async () => {
  const pilihanS = parseBulanSel(selBulanHijri);
  const tahunHijri = pilihanS.tahun;
  const bulanHijri = pilihanS.bulan;
  const tahunAjaran = activeTahunAjaran;
  const entries = [];

  gridEl.querySelectorAll('input[data-sid]').forEach(inp => {
    const sid = parseInt(inp.dataset.sid);
    const type = inp.dataset.type;
    const val = parseInt(inp.value) || 0;

    let entry = entries.find(e => e.santri_id === sid);
    if (!entry) {
      entry = { santri_id: sid, tahun_hijri: tahunHijri, bulan_hijri: bulanHijri, tahun_ajaran: tahunAjaran, total_sakit: 0, total_izin: 0, total_alpha: 0, total_hadir: 0 };
      entries.push(entry);
    }
    if (type === 's') entry.total_sakit = val;
    if (type === 'i') entry.total_izin = val;
    if (type === 'a') entry.total_alpha = val;
    if (type === 'h') entry.total_hadir = val;
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
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btnSaveSantri.disabled = false;
    btnSaveSantri.textContent = 'Simpan Absensi Santri';
  }
});

// === TAB PENGAJAR ===
const selBulanHijriP = document.getElementById('sel-bulan-hijri-p');
const btnLoadGridP = document.getElementById('btn-load-grid-p');
const gridContainerP = document.getElementById('grid-pengajar-container');
const gridElP = document.getElementById('grid-pengajar');
const btnSavePengajar = document.getElementById('btn-save-pengajar');

let pengajarList = [];
let pengajarData = {};

// Populate bulan dropdown pengajar
function initPengajarDropdowns() {
  populateBulanDropdown(selBulanHijriP);
}

btnLoadGridP?.addEventListener('click', loadGridPengajar);

async function loadGridPengajar() {
  const tingkatanId = selTingkatanP.value;
  const kelasId = selKelasP.value;
  const pilihanP = parseBulanSel(selBulanHijriP);
  const tahunHijri = pilihanP.tahun;
  const bulanHijri = pilihanP.bulan;
  if (!tingkatanId || !kelasId || !tahunHijri || !bulanHijri) {
    alert('Pilih Tingkatan, Kelas, dan Bulan Hijriyah');
    return;
  }

  const resP = await fetch(`/api/pengajar?tingkatan_id=${tingkatanId}&kelas_id=${kelasId}`);
  const pJson = await resP.json();
  pengajarList = (Array.isArray(pJson) ? pJson : []).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

  const resData = await fetch(`/api/absensi-manual/pengajar?tingkatan_id=${tingkatanId}&kelas_id=${kelasId}&tahun_hijri=${tahunHijri}`);
  const existingJson = await resData.json();
  const existing = Array.isArray(existingJson) ? existingJson : [];

  pengajarData = {};
  existing.filter(e => e.bulan_hijri == bulanHijri).forEach(e => {
    pengajarData[e.pengajar_id] = { s: e.total_sakit, i: e.total_izin, a: e.total_alpha, h: e.total_hadir };
  });

  const canEdit = cachedBagian.some(b => b.tingkatan_id == tingkatanId && b.kelas_id == kelasId && b.can_edit_absensi);

  renderGridPengajar(canEdit);
  gridContainerP.classList.remove('hidden');

  if (canEdit) {
    btnSavePengajar?.classList.remove('hidden');
  } else {
    btnSavePengajar?.classList.add('hidden');
  }
}

function renderGridPengajar(canEdit = false) {
  if (pengajarList.length === 0) {
    gridElP.innerHTML = '<p class="text-gray-400 text-center py-4">Tidak ada pengajar.</p>';
    return;
  }

  let html = `<p class="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Bulan: <span class="font-bold">${selBulanLabel(selBulanHijriP)}</span></p>`;
  html += '<table class="border-collapse text-sm w-full"><thead><tr>';
  html += '<th class="px-3 py-2 border text-left">Nama Pengajar</th>';
  html += '<th class="px-3 py-2 border text-center w-20">Sakit</th>';
  html += '<th class="px-3 py-2 border text-center w-20">Izin</th>';
  html += '<th class="px-3 py-2 border text-center w-20">Alpha</th>';
  html += '<th class="px-3 py-2 border text-center w-20 text-green-600">Hadir</th>';
  html += '</tr></thead><tbody>';

  pengajarList.forEach(p => {
    const d = pengajarData[p.id] || { s: 0, i: 0, a: 0, h: 0 };
    if (canEdit) {
      html += `<tr>
        <td class="px-3 py-2 border font-medium">${p.nama}</td>
        <td class="px-1 py-1 border text-center"><input type="number" min="0" data-pid="${p.id}" data-type="s" value="${d.s}" class="w-16 text-center glass-input rounded px-2 py-1 text-sm"></td>
        <td class="px-1 py-1 border text-center"><input type="number" min="0" data-pid="${p.id}" data-type="i" value="${d.i}" class="w-16 text-center glass-input rounded px-2 py-1 text-sm"></td>
        <td class="px-1 py-1 border text-center"><input type="number" min="0" data-pid="${p.id}" data-type="a" value="${d.a}" class="w-16 text-center glass-input rounded px-2 py-1 text-sm"></td>
        <td class="px-1 py-1 border text-center"><input type="number" min="0" data-pid="${p.id}" data-type="h" value="${d.h}" class="w-16 text-center glass-input rounded px-2 py-1 text-sm font-bold text-green-700"></td>
      </tr>`;
    } else {
      html += `<tr>
        <td class="px-3 py-2 border font-medium">${p.nama}</td>
        <td class="px-3 py-2 border text-center">${d.s}</td>
        <td class="px-3 py-2 border text-center">${d.i}</td>
        <td class="px-3 py-2 border text-center">${d.a}</td>
        <td class="px-3 py-2 border text-center font-bold text-green-700">${d.h}</td>
      </tr>`;
    }
  });
  html += '</tbody></table>';
  if (!canEdit) {
    html += '<p class="text-xs text-red-500 mt-2 italic">* Anda tidak memiliki akses untuk mengedit absensi kelas ini.</p>';
  }
  gridElP.innerHTML = html;
}

btnSavePengajar?.addEventListener('click', async () => {
  const pilihanP2 = parseBulanSel(selBulanHijriP);
  const tahunHijri = pilihanP2.tahun;
  const bulanHijri = pilihanP2.bulan;
  const tahunAjaran = activeTahunAjaran;
  const entries = [];

  gridElP.querySelectorAll('input[data-pid]').forEach(inp => {
    const pid = parseInt(inp.dataset.pid);
    const type = inp.dataset.type;
    const val = parseInt(inp.value) || 0;

    let entry = entries.find(e => e.pengajar_id === pid);
    if (!entry) {
      entry = { pengajar_id: pid, tahun_hijri: tahunHijri, bulan_hijri: bulanHijri, tahun_ajaran: tahunAjaran, total_sakit: 0, total_izin: 0, total_alpha: 0, total_hadir: 0 };
      entries.push(entry);
    }
    if (type === 's') entry.total_sakit = val;
    if (type === 'i') entry.total_izin = val;
    if (type === 'a') entry.total_alpha = val;
    if (type === 'h') entry.total_hadir = val;
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
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btnSavePengajar.disabled = false;
    btnSavePengajar.textContent = 'Simpan Absensi Pengajar';
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
