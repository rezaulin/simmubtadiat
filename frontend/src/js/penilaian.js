// penilaian.js — Spreadsheet-style grading interface.
// Pilih Bagian + Tahun Ajaran → muncul tabel besar (Tamrin, Ujian, Raport, Al-Bayan).

import { translateKitab } from './kitab-translate.js';

// Ambil label yang dipakai di header kolom: nama kitab (Arab) → Latin.
// Fallback ke nama mapel bila kitab kosong. Tooltip menampilkan versi Arab
// asli agar informasi tidak hilang.
function mapelLabel(m) {
  const kitab = (m.nama_kitab || '').trim();
  const mapel = (m.nama || m.nama_mapel || '').trim();
  const display = translateKitab(kitab) || translateKitab(mapel) || kitab || mapel || '-';
  const tooltip = kitab || mapel || display;
  return { display, tooltip };
}

// === FILTER ===
const selTingkatan = document.getElementById('sel-tingkatan');
const selKelas = document.getElementById('sel-kelas');
const selBagian = document.getElementById('sel-bagian');
const btnLoad = document.getElementById('btn-load');
const container = document.getElementById('spreadsheet-container');

let cachedTingkatan = [], cachedKelas = [], cachedBagian = [];
let currentData = null;
let tahunAjaran = '';

// Track khos/bayan cells that the user explicitly edited (dirty).
// Keys: "santriId_mapelId_semester" for khos, "bayan_santriId" for bayan.
const dirtyKhos = new Set();
const dirtyBayan = new Set();

async function loadFilters() {
  // Load tahun ajaran aktif
  let userRoles = [];
  try {
    const res = await fetch('/api/settings/umum');
    const d = await res.json();
    tahunAjaran = d.tahun_ajaran_aktif || '';
    const elTA = document.getElementById('display-tahun-ajaran');
    if (elTA) elTA.textContent = tahunAjaran;

    const meRes = await fetch('/api/me');
    if (meRes.ok) {
      const meData = await meRes.json();
      userRoles = meData.roles || [meData.role];
    }
  } catch (_) {}

  const [resT, resK, resB] = await Promise.all([
    fetch('/api/akademik/tingkatan'),
    fetch('/api/akademik/kelas'),
    // Bagian dibatasi sesuai cakupan pengguna: pimpinan/admin = semua,
    // mustahiq = hanya kelas+tingkatan penugasannya.
    fetch('/api/penilaian/bagian')
  ]);
  cachedTingkatan = (await resT.json()) || [];
  cachedKelas = (await resK.json()) || [];
  cachedBagian = (await resB.json()) || [];

  // Batasi opsi Tingkatan hanya yang muncul pada bagian yang boleh diakses,
  // sehingga mustahiq tidak melihat tingkatan/kelas di luar cakupannya.
  const allowedTingkatan = new Set(cachedBagian.map(b => b.tingkatan_id));
  cachedTingkatan
    .filter(t => allowedTingkatan.size === 0 || allowedTingkatan.has(t.id))
    .forEach(t => {
      selTingkatan.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
    });

  // Bila hanya satu tingkatan yang tersedia (umumnya mustahiq), pilih otomatis
  // dan langsung isi kelas agar alur lebih ringkas.
  const opsiTingkatan = cachedTingkatan.filter(t => allowedTingkatan.size === 0 || allowedTingkatan.has(t.id));
  if (opsiTingkatan.length === 1) {
    selTingkatan.value = String(opsiTingkatan[0].id);
    selTingkatan.dispatchEvent(new Event('change'));
  }
}

selTingkatan?.addEventListener('change', () => {
  const tId = selTingkatan.value;
  selKelas.innerHTML = '<option value="">-- Pilih --</option>';
  selBagian.innerHTML = '<option value="">-- Pilih --</option>';
  // Hanya tampilkan kelas yang punya bagian dalam cakupan pengguna untuk
  // tingkatan terpilih (mustahiq terbatas; pimpinan/admin melihat semua).
  const allowedKelas = new Set(
    cachedBagian.filter(b => !tId || b.tingkatan_id == tId).map(b => b.kelas_id)
  );
  const opsiKelas = cachedKelas.filter(k => allowedKelas.has(k.id));
  opsiKelas.forEach(k => { selKelas.innerHTML += `<option value="${k.id}">${k.nama}</option>`; });
  if (opsiKelas.length === 1) {
    selKelas.value = String(opsiKelas[0].id);
    selKelas.dispatchEvent(new Event('change'));
  }
});

selKelas?.addEventListener('change', () => {
  const tId = selTingkatan.value;
  const kId = selKelas.value;
  selBagian.innerHTML = '<option value="">-- Pilih --</option>';
  cachedBagian.filter(b => (!tId || b.tingkatan_id == tId) && (!kId || b.kelas_id == kId))
    .forEach(b => { selBagian.innerHTML += `<option value="${b.id}">${b.nama_bagian}</option>`; });
});

// === LOAD DATA ===
btnLoad?.addEventListener('click', loadSpreadsheet);

async function loadSpreadsheet() {
  const bagianId = selBagian.value;
  if (!bagianId) { alert('Pilih bagian terlebih dahulu'); return; }

  container.innerHTML = '<p class="text-center text-gray-400 py-8">Memuat data...</p>';

  try {
    const res = await fetch(`/api/penilaian/spreadsheet?bagian_id=${bagianId}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}`);
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal memuat');
    currentData = await res.json();
    renderSpreadsheet();
  } catch (err) {
    container.innerHTML = `<p class="text-center text-red-500 py-8">${err.message}</p>`;
  }
}

// === RENDER ===
function renderSpreadsheet() {
  if (!currentData || !currentData.mapels || !currentData.santri) {
    container.innerHTML = '<p class="text-center text-gray-400 py-4">Tidak ada data.</p>';
    return;
  }

  const { mapels, santri, nilai_kuartal, nilai_khos, nilai_bayan, absensi, absensi_bayan } = currentData;
  if (santri.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-400 py-4">Tidak ada santri di bagian ini.</p>';
    return;
  }

  let html = '';
  // Petunjuk tempel (paste) dari Excel.
  html += `<div class="mb-3 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2">
    <b>Tips:</b> Anda bisa menyalin (copy) blok nilai dari Excel lalu klik sel awal di tabel dan tempel (Ctrl+V). Nilai akan terisi otomatis mengikuti baris & kolom.
  </div>`;
  const bagianIdStr = selBagian.value;
  const activeBagian = cachedBagian.find(b => b.id == bagianIdStr);
  const canEdit = activeBagian ? activeBagian.can_edit_nilai : false;

  // Section 1: Tamrin K1
  html += renderSection('TAMRIN KUARTAL 1', mapels, santri, nilai_kuartal['1'], 1, canEdit);
  // Section 2: Ujian Smt Ganjil (K2)
  html += renderSection('UJIAN SEMESTER GANJIL', mapels, santri, nilai_kuartal['2'], 2, canEdit);
  // Section 3: Raport Semester 1 (Nilai Khos)
  html += renderRaportSection('NILAI RAPORT SEMESTER 1', mapels, santri, nilai_khos['1'], absensi['1'], 1, canEdit);
  // Section 4: Tamrin K3
  html += renderSection('TAMRIN KUARTAL 3', mapels, santri, nilai_kuartal['3'], 3, canEdit);
  // Section 5: Ujian Smt Genap (K4)
  html += renderSection('UJIAN SEMESTER GENAP', mapels, santri, nilai_kuartal['4'], 4, canEdit);
  // Section 6: Raport Semester 2
  html += renderRaportSection('NILAI RAPORT SEMESTER 2', mapels, santri, nilai_khos['2'], absensi['2'], 2, canEdit);
  // Section 7: Al-Bayan
  html += renderBayanSection(santri, nilai_khos, nilai_bayan, absensi_bayan, mapels.length, canEdit);

  // Save button
  if (canEdit) {
    html += `<div class="mt-6 flex justify-end"><button id="btn-save-all" class="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-xl text-sm font-medium shadow-md">Simpan Semua Nilai</button></div>`;
  }

  container.innerHTML = html;

  // Clear dirty tracking on fresh render (data just loaded from server).
  dirtyKhos.clear();
  dirtyBayan.clear();

  // Wire save button
  document.getElementById('btn-save-all')?.addEventListener('click', saveAll);

  // Track user edits on khos inputs — only these will be sent as manual overrides.
  container.querySelectorAll('input[data-khos-sem]').forEach(inp => {
    inp.addEventListener('input', () => {
      dirtyKhos.add(`${inp.dataset.s}_${inp.dataset.m}_${inp.dataset.khosSem}`);
    });
  });

  // Track user edits on bayan inputs.
  container.querySelectorAll('input[data-bayan]').forEach(inp => {
    inp.addEventListener('input', () => {
      dirtyBayan.add(inp.dataset.bayan);
    });
  });

  // Recalculate Jml & Rata² pada baris section (Tamrin/Ujian) secara live saat
  // pengguna mengubah nilai, tanpa perlu menyimpan dulu.
  container.querySelectorAll('input[data-k]').forEach(inp => {
    inp.addEventListener('input', () => recalcSectionRow(inp.dataset.k, inp.dataset.s));
  });
}

// Hitung ulang Jml & Rata² untuk satu santri pada satu section (kuartal).
// Mapel dengan data-excl="1" tidak diikutkan (mis. Quran, Akhlaq).
function recalcSectionRow(kuartal, santriId) {
  const inputs = container.querySelectorAll(`input[data-k="${kuartal}"][data-s="${santriId}"]`);
  let sum = 0, count = 0;
  inputs.forEach(inp => {
    if (inp.dataset.excl === '1') return;
    const v = parseFloat(inp.value);
    if (!isNaN(v)) { sum += v; count++; }
  });
  const sumCell = container.querySelector(`[data-sum-cell="${kuartal}_${santriId}"]`);
  const avgCell = container.querySelector(`[data-avg-cell="${kuartal}_${santriId}"]`);
  if (sumCell) sumCell.textContent = count > 0 ? fmtNum(sum) : '-';
  if (avgCell) avgCell.textContent = count > 0 ? fmtNum(sum / count) : '-';
}

const EXCLUDED_KATEGORI = new Set([
  'al_quran',
  'al_khot_imla',
  'qiroah_kutub',
  'muhafadhoh',
  'akhlaq',
  'akhlaq_perilaku'
]);

function isExcludedMapel(m, isRaport = false) {
  if (!m) return false;
  // Di Raport, semua pelajaran (termasuk 4 mapel khusus & Al-Qur'an) tetap dihitung
  if (isRaport) return false;
  const kat = (m.kategori || '').toLowerCase();
  if (EXCLUDED_KATEGORI.has(kat)) return true;

  const nama = (m.nama || m.nama_mapel || '').trim().toLowerCase();
  const kitab = (m.nama_kitab || '').trim().toLowerCase();

  // Pengecualian: mapel yang mengandung kata ini TETAP DIHITUNG
  // (misal: "Qawaid Imla'", "Tafsir Al-Qur'an", "Ulumul Qur'an")
  if (nama.includes('qawaid') || nama.includes('qowaid') || nama.includes('قواعد')) return false;
  if (nama.includes('tafsir') || nama.includes('تفسير')) return false;
  if (nama.includes('ulum') || nama.includes('علوم')) return false;
  if (nama.includes('tarikh') || nama.includes('تاريخ')) return false;
  if (nama.includes('muta\'allim') || nama.includes('متعلم') || nama.includes('ta\'lim') || nama.includes('تعليم')) return false;
  if (kitab.includes('qawaid') || kitab.includes('qowaid') || kitab.includes('قواعد')) return false;
  if (kitab.includes('muta\'allim') || kitab.includes('متعلم') || kitab.includes('ta\'lim') || kitab.includes('تعليم')) return false;

  if (nama.includes('quran') || nama.includes('qur\'an') || nama.includes('قرآن') || nama.includes('القرءان') || nama.includes('القرآن')) return true;
  if (nama.includes('khot') || nama.includes('imla') || nama.includes('خط') || nama.includes('إملاء') || nama.includes('الخط')) return true;
  if (nama.includes('qiroah') || nama.includes('qira\'ah') || nama.includes('qiraat') || nama.includes('قراءة')) return true;
  if (nama.includes('hafad') || nama.includes('muhafadhoh') || nama.includes('محافظة')) return true;

  // Fann Akhlaq HANYA dikecualikan jika tidak ada nama kitabnya
  // ATAU jika nama kitabnya sengaja diisi "-" atau cuma "Akhlaq" / "Al-Akhlaq"
  const isKitabKosong = !kitab || kitab === '-' || 
                        kitab === 'akhlaq' || kitab === 'akhlak' || 
                        kitab === 'al-akhlaq' || kitab === 'al-akhlak' || 
                        kitab === 'أخلاق' || kitab === 'اخلاق' || 
                        kitab === 'الأخلاق' || kitab === 'الاخلاق';
  if ((nama.includes('akhlaq') || nama.includes('akhlak') || nama.includes('أخلاق') || nama.includes('اخلاق')) && isKitabKosong) return true;

  if (kitab.includes('quran') || kitab.includes('قرآن') || kitab.includes('القرآن')) return true;
  if (kitab.includes('khot') || kitab.includes('خط') || kitab.includes('إملاء')) return true;
  if (kitab.includes('qiroah') || kitab.includes('قراءة')) return true;
  if (kitab.includes('hafad') || kitab.includes('محافظة')) return true;
  
  if (kitab === 'akhlaq' || kitab === 'akhlak' || 
      kitab === 'al-akhlaq' || kitab === 'al-akhlak' || 
      kitab === 'أخلاق' || kitab === 'اخلاق' || 
      kitab === 'الأخلاق' || kitab === 'الاخلاق') return true;

  return false;
}

function renderSection(title, mapels, santri, nilaiMap, kuartal, canEdit) {
  let html = `<div class="mt-8 mb-2 flex items-center justify-between px-1">
    <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200">${title}</h3>
    <span class="text-xs text-red-500 font-semibold">* Mapel yang ditandai tidak dihitung dalam Jml/Rata-rata</span>
  </div>`;
  html += '<div class="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-xl mb-4"><table class="border-collapse text-xs w-full">';
  html += '<thead class="bg-gray-50 dark:bg-slate-800"><tr><th class="px-2 py-2 border text-left sticky left-0 bg-gray-50 dark:bg-slate-800 z-10 min-w-[30px]">No</th><th class="px-2 py-2 border text-left sticky left-[30px] bg-gray-50 dark:bg-slate-800 z-10 min-w-[120px]">Nama</th><th class="px-2 py-2 border text-center min-w-[50px]">Stambuk</th>';
  // Header mapel: nama kitab (Arab) di-translasi ke ejaan Latin. Arab asli jadi tooltip.
  mapels.forEach(m => { 
    const { display, tooltip } = mapelLabel(m); 
    const isExcl = isExcludedMapel(m);
    const exclMark = isExcl ? '<span class="text-red-500 font-bold ml-0.5" title="Tidak dihitung dalam Penjumlahan">*</span>' : '';
    html += `<th class="px-1 py-2 border text-center min-w-[70px] max-w-[120px] whitespace-normal break-words leading-tight" title="${tooltip}${isExcl ? ' (Tidak dihitung)' : ''}">${display}${exclMark}</th>`; 
  });
  html += '<th class="px-2 py-2 border text-center min-w-[50px] bg-gray-100 dark:bg-slate-700">Jml</th>';
  html += '<th class="px-2 py-2 border text-center min-w-[50px] bg-gray-100 dark:bg-slate-700">Rata²</th>';
  html += '</tr></thead><tbody>';

  santri.forEach((s, idx) => {
    html += `<tr><td class="px-2 py-1 border text-center sticky left-0 bg-white dark:bg-slate-800 z-10">${idx + 1}</td>`;
    html += `<td class="px-2 py-1 border font-medium sticky left-[30px] bg-white dark:bg-slate-800 z-10 truncate max-w-[140px]">${s.nama}</td>`;
    html += `<td class="px-2 py-1 border text-center text-gray-500">${s.stambuk}</td>`;
    let sum = 0, count = 0;
    mapels.forEach(m => {
      const key = `${s.id}_${m.id}`;
      const val = nilaiMap?.[key] ?? '';
      const excl = isExcludedMapel(m);
      
      const isDisabled = !m.aktif_kuartal || !m.aktif_kuartal.includes(kuartal);
      
      if (val !== '' && val != null && !isNaN(parseFloat(val))) {
        if (!excl && !isDisabled) {
          sum += parseFloat(val);
          count++;
        }
      }
      // data-excl="1" menandai mapel yang tidak dihitung ke Jml/Rata² (mis. Quran, Akhlaq).
      if (isDisabled) {
        html += `<td class="px-0 py-0 border text-center bg-gray-100 dark:bg-slate-800"><input type="text" disabled value="-" class="w-full text-center text-xs py-1 bg-transparent border-0 outline-none text-gray-400"></td>`;
      } else if (!canEdit) {
        html += `<td class="px-0 py-0 border text-center bg-gray-50 dark:bg-slate-800"><input type="text" disabled value="${val}" class="w-full text-center text-xs py-1 bg-transparent border-0 outline-none text-gray-600 dark:text-gray-300"></td>`;
      } else {
        html += `<td class="px-0 py-0 border text-center"><input type="number" step="0.5" min="0" max="10" data-k="${kuartal}" data-s="${s.id}" data-m="${m.id}"${excl ? ' data-excl="1"' : ''} value="${val}" class="w-full text-center text-xs py-1 bg-transparent border-0 focus:bg-yellow-50 dark:focus:bg-slate-700 outline-none"></td>`;
      }
    });
    const sumStr = count > 0 ? fmtNum(sum) : '-';
    const avgStr = count > 0 ? fmtNum(sum / count) : '-';
    // data-sum-row menandai baris agar Jml & Rata² bisa dihitung ulang saat
    // pengguna mengubah nilai (recalculateSectionRow). data-k membedakan section.
    html += `<td class="px-1 py-1 border text-center font-bold bg-gray-50 dark:bg-slate-800/50" data-sum-cell="${kuartal}_${s.id}">${sumStr}</td>`;
    html += `<td class="px-1 py-1 border text-center font-bold text-primary bg-gray-50 dark:bg-slate-800/50" data-avg-cell="${kuartal}_${s.id}">${avgStr}</td>`;
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

// Format angka: bilangan bulat tanpa desimal, selain itu satu angka desimal.
function fmtNum(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function renderRaportSection(title, mapels, santri, khosMap, absensiMap, semester, canEdit) {
  let html = `<h3 class="text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-6 mb-2 px-1">${title}</h3>`;
  html += '<div class="overflow-x-auto border border-indigo-200 dark:border-indigo-800 rounded-xl mb-4"><table class="border-collapse text-xs w-full">';
  html += '<thead class="bg-indigo-50 dark:bg-indigo-900/20"><tr><th class="px-2 py-2 border text-left sticky left-0 bg-indigo-50 dark:bg-indigo-900/20 z-10 min-w-[30px]">No</th><th class="px-2 py-2 border text-left sticky left-[30px] bg-indigo-50 dark:bg-indigo-900/20 z-10 min-w-[120px]">Nama</th>';
  // Header mapel: nama kitab (Arab) di-translasi ke ejaan Latin. Arab asli jadi tooltip.
  mapels.forEach(m => { 
    const { display, tooltip } = mapelLabel(m); 
    const isExcl = isExcludedMapel(m, true); // true = ini bagian raport
    const exclMark = isExcl ? '<span class="text-red-500 font-bold ml-0.5" title="Tidak dihitung dalam Penjumlahan">*</span>' : '';
    html += `<th class="px-1 py-2 border text-center min-w-[70px] max-w-[120px] whitespace-normal break-words leading-tight" title="${tooltip}${isExcl ? ' (Tidak dihitung)' : ''}">${display}${exclMark}</th>`; 
  });
  html += '<th class="px-2 py-2 border text-center min-w-[50px] bg-blue-50 dark:bg-blue-900/20">Jml</th>';
  html += '<th class="px-2 py-2 border text-center min-w-[40px] bg-yellow-50 dark:bg-yellow-900/20">Izin</th>';
  html += '<th class="px-2 py-2 border text-center min-w-[40px] bg-red-50 dark:bg-red-900/20">Alpha</th>';
  html += '</tr></thead><tbody>';

  const mapelStats = {};
  mapels.forEach(m => { mapelStats[m.id] = { sum: 0, count: 0 }; });

  santri.forEach((s, idx) => {
    html += `<tr><td class="px-2 py-1 border text-center sticky left-0 bg-white dark:bg-slate-800 z-10">${idx + 1}</td>`;
    html += `<td class="px-2 py-1 border font-medium sticky left-[30px] bg-white dark:bg-slate-800 z-10 truncate max-w-[140px]">${s.nama}</td>`;
    let jumlah = 0, count = 0;
    mapels.forEach(m => {
      const key = `${s.id}_${m.id}`;
      const val = khosMap?.[key];
      const valDisplay = val != null ? val : '';
      const excl = isExcludedMapel(m, true); // true = ini bagian raport
      
      const semKuartals = semester === 1 ? [1,2] : [3,4];
      const isDisabled = !m.aktif_kuartal || !semKuartals.some(k => m.aktif_kuartal.includes(k));
      
      if (val != null && !isNaN(val) && !isDisabled) {
        if (!excl) {
          mapelStats[m.id].sum += val;
          mapelStats[m.id].count++;
          jumlah += val;
          count++;
        }
      }
      
      if (isDisabled) {
        html += `<td class="px-0 py-0 border border-indigo-200 dark:border-indigo-800 text-center bg-gray-100 dark:bg-slate-800"><input type="text" disabled value="-" class="w-full text-center text-xs font-semibold text-gray-400 py-1 bg-transparent border-0 outline-none"></td>`;
      } else if (!canEdit) {
        html += `<td class="px-0 py-0 border border-indigo-200 dark:border-indigo-800 text-center bg-gray-50 dark:bg-slate-800"><input type="text" disabled value="${valDisplay}" class="w-full text-center text-xs font-semibold text-gray-600 dark:text-gray-300 py-1 bg-transparent border-0 outline-none"></td>`;
      } else {
        html += `<td class="px-0 py-0 border border-indigo-200 dark:border-indigo-800 text-center"><input type="number" step="0.5" min="4" max="9" data-khos-sem="${semester}" data-s="${s.id}" data-m="${m.id}" value="${valDisplay}" class="w-full text-center text-xs font-semibold text-indigo-700 dark:text-indigo-400 py-1 bg-transparent border-0 focus:bg-indigo-50 dark:focus:bg-indigo-900/50 outline-none"></td>`;
      }
    });
    const sumStr = count > 0 ? (Number.isInteger(jumlah) ? String(jumlah) : String(Math.round(jumlah * 10) / 10)) : '-';
    const ab = absensiMap?.[String(s.id)] || { izin: 0, alpha: 0 };
    html += `<td class="px-1 py-1 border text-center font-bold bg-blue-50 dark:bg-blue-900/20">${sumStr}</td>`;
    html += `<td class="px-1 py-1 border text-center bg-yellow-50 dark:bg-yellow-900/20">${ab.izin || 0}</td>`;
    html += `<td class="px-1 py-1 border text-center bg-red-50 dark:bg-red-900/20">${ab.alpha || 0}</td>`;
    html += '</tr>';
  });

  // Baris Rata-rata Kelas per Mapel (dibulatkan tanpa koma)
  html += '<tr class="bg-indigo-100/70 dark:bg-indigo-900/50 font-bold border-t-2 border-indigo-300 dark:border-indigo-700">';
  html += '<td colspan="2" class="px-2 py-1.5 border text-center sticky left-0 bg-indigo-100 dark:bg-indigo-950 z-10 font-bold text-indigo-900 dark:text-indigo-200">Nilai \'Am</td>';
  
  let totalRoundedSum = 0;
  let totalRoundedCount = 0;

  mapels.forEach(m => {
    const st = mapelStats[m.id];
    if (st.count > 0) {
      const avg = st.sum / st.count;
      const roundedAvg = Math.floor(avg + 0.5);
      html += `<td class="px-1 py-1.5 border text-center font-extrabold text-indigo-950 dark:text-indigo-100 bg-indigo-50 dark:bg-indigo-900/30">${roundedAvg}</td>`;
      totalRoundedSum += roundedAvg;
      totalRoundedCount++;
    } else {
      html += '<td class="px-1 py-1.5 border text-center font-extrabold text-indigo-950 dark:text-indigo-100 bg-indigo-50 dark:bg-indigo-900/30">-</td>';
    }
  });

  const amAvg = totalRoundedCount > 0 ? totalRoundedSum / totalRoundedCount : 0;
  const amAvgRounded = totalRoundedCount > 0 ? Math.floor(amAvg + 0.5) : '-';
  
  html += `<td class="px-1 py-1.5 border text-center font-bold text-indigo-950 dark:text-indigo-100 bg-blue-100 dark:bg-blue-900/40">${totalRoundedCount > 0 ? totalRoundedSum : '-'}</td>`;
  html += '<td class="px-1 py-1.5 border text-center text-gray-400">-</td>';
  html += '<td class="px-1 py-1.5 border text-center text-gray-400">-</td>';
  html += '</tr>';

  html += '</tbody></table></div>';
  return html;
}

function renderBayanSection(santri, nilaiKhos, nilaiBayan, absensiMap, totalMapels, canEdit) {
  const bayanLabels = { 9: 'JAYYID AWAL', 8: 'JAYYID TSANI', 7: 'MUTAWASSIT AWAL', 6: 'MUTAWASSIT TSANI', 5: "RODI'" };

  let html = `<h3 class="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-8 mb-2 px-1">AL-BAYAN (Prestasi Tahunan)</h3>`;
  html += '<div class="overflow-x-auto border border-emerald-200 dark:border-emerald-800 rounded-xl mb-4"><table class="border-collapse text-xs w-full">';
  html += '<thead class="bg-emerald-50 dark:bg-emerald-900/20"><tr>';
  html += '<th class="px-2 py-2 border">No</th><th class="px-2 py-2 border text-left min-w-[120px]">Nama</th>';
  html += '<th class="px-2 py-2 border text-center">Total Izin</th>';
  html += '<th class="px-2 py-2 border text-center">Total Alpha</th>';
  html += '<th class="px-2 py-2 border text-center">Al-Bayan Asli</th>';
  html += '<th class="px-2 py-2 border text-center">Keterangan Asli</th>';
  html += '<th class="px-2 py-2 border text-center bg-emerald-100 dark:bg-emerald-800/30">Hasil Akhir</th>';
  html += '<th class="px-2 py-2 border text-center bg-emerald-100 dark:bg-emerald-800/30">Keterangan</th>';
  html += '</tr></thead><tbody>';

  santri.forEach((s, idx) => {
    const ab = absensiMap?.[String(s.id)] || { izin: 0, alpha: 0 };
    const bayan = nilaiBayan?.[String(s.id)] || {};

    // Calculate Al-Bayan asli from khos smt1 + smt2
    let sumKhos = 0, countKhos = 0;
    const khos1 = nilaiKhos?.['1'] || {};
    const khos2 = nilaiKhos?.['2'] || {};
    for (const key of Object.keys(khos1)) {
      if (key.startsWith(s.id + '_')) { sumKhos += khos1[key]; countKhos++; }
    }
    for (const key of Object.keys(khos2)) {
      if (key.startsWith(s.id + '_')) { sumKhos += khos2[key]; countKhos++; }
    }
    const bayanAsli = countKhos > 0 ? Math.round(sumKhos / countKhos) : '-';

    // Koreksi absensi
    let koreksi = 0;
    if (ab.izin >= 15) koreksi--;
    if (ab.alpha >= 5) koreksi--;
    let hasilAkhir = bayanAsli !== '-' ? Math.max(5, Math.min(9, bayanAsli + koreksi)) : '-';

    // Override from DB if exists
    if (bayan.hasil_akhir != null) hasilAkhir = bayan.hasil_akhir;

    const labelAsli = bayanAsli !== '-' ? (bayanLabels[bayanAsli] || '-') : '-';
    const labelAkhir = hasilAkhir !== '-' ? (bayanLabels[hasilAkhir] || '-') : '-';

    html += `<tr>`;
    html += `<td class="px-2 py-1 border text-center">${idx + 1}</td>`;
    html += `<td class="px-2 py-1 border font-medium">${s.nama}</td>`;
    html += `<td class="px-2 py-1 border text-center">${ab.izin}</td>`;
    html += `<td class="px-2 py-1 border text-center">${ab.alpha}</td>`;
    html += `<td class="px-2 py-1 border text-center font-bold">${bayanAsli}</td>`;
    html += `<td class="px-2 py-1 border text-center">${labelAsli}</td>`;
    
    if (!canEdit) {
      html += `<td class="px-0 py-0 border text-center bg-gray-50 dark:bg-slate-800"><input type="text" disabled value="${hasilAkhir !== '-' ? hasilAkhir : ''}" class="w-full text-center text-xs py-2 bg-transparent border-0 outline-none text-gray-600 dark:text-gray-300 font-bold" title="Hanya mustahiq yang dapat mengedit"></td>`;
    } else {
      html += `<td class="px-0 py-0 border text-center bg-emerald-50 dark:bg-emerald-900/20"><input type="number" min="5" max="9" data-bayan="${s.id}" value="${hasilAkhir !== '-' ? hasilAkhir : ''}" class="w-full text-center text-xs py-1 bg-transparent border-0 focus:bg-emerald-100 dark:focus:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 outline-none font-bold"></td>`;
    }
    
    html += `<td class="px-2 py-1 border font-bold text-center text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/10" data-bayan-ket="${s.id}">${labelAkhir}</td>`;
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function abbreviate(name) {
  if (name.length <= 6) return name;
  const words = name.split(/\s+/);
  if (words.length === 1) return name.substring(0, 5) + '.';
  return words.map(w => w[0]).join('').toUpperCase();
}

// === SAVE ALL ===
async function saveAll() {
  const bagianId = selBagian.value;
  if (!bagianId || !currentData) return;

  // Collect all kuartal inputs
  const kuartalInputs = [];
  container.querySelectorAll('input[data-k]').forEach(inp => {
    const val = parseFloat(inp.value);
    if (isNaN(val)) return;
    kuartalInputs.push({
      santri_id: parseInt(inp.dataset.s),
      mapel_id: parseInt(inp.dataset.m),
      kuartal: parseInt(inp.dataset.k),
      nilai: val,
      is_her: false
    });
  });

  // Collect ONLY khos inputs that were explicitly edited by the user (dirty).
  // Non-dirty cells are left to auto-generate so stale values don't overwrite.
  const khosInputs = [];
  let hasInvalidKhos = false;
  container.querySelectorAll('input[data-khos-sem]').forEach(inp => {
    const dirtyKey = `${inp.dataset.s}_${inp.dataset.m}_${inp.dataset.khosSem}`;
    if (!dirtyKhos.has(dirtyKey)) return; // skip non-edited cells
    const val = parseFloat(inp.value);
    if (isNaN(val)) return;
    if (val < 4 || val > 9) {
      hasInvalidKhos = true;
      inp.classList.add('bg-red-100', 'text-red-600');
    } else {
      inp.classList.remove('bg-red-100', 'text-red-600');
    }
    khosInputs.push({
      santri_id: parseInt(inp.dataset.s),
      mapel_id: parseInt(inp.dataset.m),
      semester: parseInt(inp.dataset.khosSem),
      nilai: val
    });
  });

  if (hasInvalidKhos) {
    alert("Terdapat nilai raport yang tidak valid. Nilai raport harus antara 4 dan 9.");
    return;
  }

  const btn = document.getElementById('btn-save-all');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    // 1. Save kuartal values
    if (kuartalInputs.length > 0) {
      const res = await fetch(`/api/penilaian/kuartal?tahun_ajaran=${encodeURIComponent(tahunAjaran)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kuartalInputs)
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Gagal simpan nilai kuartal');
      }
    }

    // 2. Generate Khos for all santri (both semesters)
    //    Auto-calculates: Khos = (tamrin + ujian) / 2, clamped to 4-9.
    for (const s of currentData.santri) {
      for (const sem of [1, 2]) {
        await fetch('/api/penilaian/generate-khos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ santri_id: s.id, semester: sem, tahun_ajaran: tahunAjaran })
        });
      }
    }

    // 3. Save manual Khos overrides ONLY for cells the user explicitly edited.
    //    This runs AFTER auto-generate so intentional overrides take precedence,
    //    but stale display values no longer clobber auto-generated results.
    if (khosInputs.length > 0) {
      const resKhos = await fetch(`/api/penilaian/khos?tahun_ajaran=${encodeURIComponent(tahunAjaran)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(khosInputs)
      });
      if (!resKhos.ok) {
        const d = await resKhos.json().catch(() => ({}));
        throw new Error(d.message || 'Gagal simpan nilai raport manual');
      }
    }

    // 4. Generate Nilai Am (rata-rata kelas per mapel) per bagian per semester
    const bagianId = selBagian.value;
    for (const sem of [1, 2]) {
      await fetch('/api/penilaian/generate-am', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bagian_id: parseInt(bagianId), semester: sem, tahun_ajaran: tahunAjaran })
      });
    }

    // 5. Generate Al-Bayan for all santri
    for (const s of currentData.santri) {
      await fetch('/api/penilaian/generate-bayan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ santri_id: s.id, tahun_ajaran: tahunAjaran })
      });
    }

    // 6. Save manual Al-Bayan overrides (if edited directly in Al-Bayan table)
    // Collect ONLY bayan inputs that the user explicitly edited.
    const bayanInputs = [];
    container.querySelectorAll('input[data-bayan]').forEach(inp => {
      if (!dirtyBayan.has(inp.dataset.bayan)) return; // skip non-edited cells
      const val = parseInt(inp.value);
      if (isNaN(val)) return;
      bayanInputs.push({
        santri_id: parseInt(inp.dataset.bayan),
        hasil_akhir: val
      });
    });

    if (bayanInputs.length > 0) {
      const resBayan = await fetch(`/api/penilaian/bayan?tahun_ajaran=${encodeURIComponent(tahunAjaran)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bayanInputs)
      });
      if (!resBayan.ok) {
        const d = await resBayan.json().catch(() => ({}));
        throw new Error(d.message || 'Gagal simpan manual override Al-Bayan');
      }
    }

    alert('Semua nilai berhasil disimpan dan dihitung!');
    loadSpreadsheet(); // Reload to show calculated values
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan Semua Nilai';
  }
}

// === PASTE DARI EXCEL ===
// Memungkinkan admin/mustahiq menyalin blok nilai dari Excel/Sheets lalu
// menempelkannya (Ctrl+V) ke tabel. Data clipboard berformat TSV (kolom
// dipisah TAB, baris dipisah newline). Nilai diisi relatif dari sel awal
// (tempat kursor), mengikuti baris & kolom sumber. Sel non-input (No, Nama,
// Jml, dll) dilewati otomatis.
if (container) {
  container.addEventListener('paste', (e) => {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    // Hanya tangani paste multi-sel (mengandung TAB atau newline).
    if (!/[\t\n\r]/.test(text)) return;
    e.preventDefault();

    const rowsText = text.replace(/\r/g, '').split('\n');
    // Buang baris kosong terakhir (umum dari Excel).
    if (rowsText.length && rowsText[rowsText.length - 1] === '') rowsText.pop();

    const table = target.closest('table');
    const startTr = target.closest('tr');
    const startTd = target.closest('td');
    if (!table || !startTr || !startTd) return;

    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    const startRow = bodyRows.indexOf(startTr);
    const startCol = Array.from(startTr.children).indexOf(startTd);
    if (startRow < 0 || startCol < 0) return;

    rowsText.forEach((rowText, ri) => {
      const cols = rowText.split('\t');
      const tr = bodyRows[startRow + ri];
      if (!tr) return;
      const tds = Array.from(tr.children);
      cols.forEach((raw, ci) => {
        const td = tds[startCol + ci];
        if (!td) return;
        const inp = td.querySelector('input');
        if (!inp) return; // lewati kolom non-input (Jml/Rata²/dll)
        const v = raw.trim().replace(',', '.');
        if (v === '') return;
        inp.value = v;
        // Picu 'input' agar dirty-tracking & recalc Jml/Rata² ikut jalan.
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  });
}

// === INIT ===
loadFilters();
