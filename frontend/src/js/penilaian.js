// penilaian.js — Spreadsheet-style grading interface.
// Pilih Bagian + Tahun Ajaran → muncul tabel besar (Tamrin, Ujian, Raport, Al-Bayan).

// Ambil label nama mapel: tampilkan nama_kitab asli (Arabic) — sama seperti raport cetak.
// Tidak transliterasi, tidak pakai nama_indo. Fallback ke nama_mapel jika kitab kosong.
function mapelLabel(m) {
  const kitab = (m.nama_kitab || '').trim();
  const mapel = (m.nama || m.nama_mapel || '').trim();
  const display = kitab || mapel || '-';
  return { display, tooltip: display };
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

  container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-8">Memuat data...</p>';

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
    container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">Tidak ada data.</p>';
    return;
  }

  const { mapels, santri, nilai_kuartal, nilai_khos, nilai_bayan, absensi, absensi_bayan } = currentData;
  if (santri.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">Tidak ada santri di bagian ini.</p>';
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

  // Export + Save buttons
  html += '<div class="mt-6 flex flex-wrap gap-2 justify-end">';
  html += '<div class="flex flex-wrap gap-2">';
  html += '<button class="btn-export bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-md" data-export="tamrin-k1">📥 Tamrin K1</button>';
  html += '<button class="btn-export bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-md" data-export="ujian-smt1">📥 Ujian Smt Ganjil</button>';
  html += '<button class="btn-export bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-md" data-export="tamrin-k3">📥 Tamrin K3</button>';
  html += '<button class="btn-export bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-md" data-export="ujian-smt2">📥 Ujian Smt Genap</button>';
  html += '<button class="btn-export bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-md" data-export="raport-smt1">📥 Raport Smt 1</button>';
  html += '<button class="btn-export bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-md" data-export="raport-smt2">📥 Raport Smt 2</button>';
  html += '<button class="btn-export bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-md" data-export="bayan">📥 Al-Bayan</button>';
  html += '</div>';
  if (canEdit) {
    html += '<button id="btn-save-all" class="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-xl text-sm font-medium shadow-md">Simpan Semua Nilai</button>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Wire bayan label filter dropdown
  const bayanFilter = document.getElementById('bayan-label-filter');
  if (bayanFilter) {
    bayanFilter.addEventListener('change', () => {
      const val = bayanFilter.value;
      container.querySelectorAll('tr[data-label]').forEach(tr => {
        if (!val || tr.dataset.label === val) {
          tr.style.display = '';
        } else {
          tr.style.display = 'none';
        }
      });
    });
  }

  // Clear dirty tracking on fresh render (data just loaded from server).
  dirtyKhos.clear();
  dirtyBayan.clear();

  // Wire save button
  document.getElementById('btn-save-all')?.addEventListener('click', saveAll);

  // Wire export buttons
  container.querySelectorAll('.btn-export').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.export;
      const exportMap = {
        'tamrin-k1':    async () => { const d = buildTamrinData(1, 'Tamrin K1'); if (d) await doExport(d.title, d.headers, d.dataRows); },
        'ujian-smt1':   async () => { const d = buildUjianData(2, 1, 'Ujian Semester Ganjil (Semester 1)'); if (d) await doExport(d.title, d.headers, d.dataRows); },
        'tamrin-k3':    async () => { const d = buildTamrinData(3, 'Tamrin K3'); if (d) await doExport(d.title, d.headers, d.dataRows); },
        'ujian-smt2':   async () => { const d = buildUjianData(4, 2, 'Ujian Semester Genap (Semester 2)'); if (d) await doExport(d.title, d.headers, d.dataRows); },
        'raport-smt1':  async () => { const d = buildRaportData(1, 'Raport Semester 1'); if (d) await doExport(d.title, d.headers, d.dataRows, { avgRow: true }); },
        'raport-smt2':  async () => { const d = buildRaportData(2, 'Raport Semester 2'); if (d) await doExport(d.title, d.headers, d.dataRows, { avgRow: true }); },
        'bayan':        async () => { const d = buildBayanData(); if (d) await doExport(d.title, d.headers, d.dataRows); },
      };
      if (exportMap[type]) exportMap[type]();
    });
  });

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
  // Sekaligus: clamp ke batas max kategori mapel (10 umum / 8 Quran-Akhlaq) —
  // nilai yang melewati batas langsung dikembalikan + flash merah; backend tetap
  // jadi benteng kedua (BulkInputNilaiKuartal menolak di luar rentang).
  container.querySelectorAll('input[data-k]').forEach(inp => {
    inp.addEventListener('input', () => {
      clampNilaiInput(inp);
      recalcSectionRow(inp.dataset.k, inp.dataset.s);
      refreshRendahMarks();
    });
  });

  // Clamp khos override (4-9) & bayan (0-9) + refresh tanda nilai rendah live.
  container.querySelectorAll('input[data-khos-sem], input[data-bayan]').forEach(inp => {
    inp.addEventListener('input', () => {
      clampNilaiInput(inp);
      refreshRendahMarks();
    });
  });

  // Penanda awal: nilai < 5 yang tersimpan langsung merah saat tabel dirender.
  refreshRendahMarks();
}

// Hitung ulang Jml & Rata² untuk satu santri pada satu section (kuartal).
// Mapel dengan data-excl="1" tidak diikutkan (mis. Quran, Akhlaq).
function recalcSectionRow(kuartal, santriId) {
  const AVG_AMBANG = 4.4;
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
  if (avgCell) {
    const avgVal = count > 0 ? sum / count : null;
    avgCell.textContent = avgVal !== null ? fmtNum(avgVal) : '-';
    // Toggle merah jika rata-rata ≤ 4.4
    avgCell.classList.toggle('text-red-600', avgVal !== null && avgVal <= AVG_AMBANG);
    avgCell.classList.toggle('dark:text-red-400', avgVal !== null && avgVal <= AVG_AMBANG);
    avgCell.classList.toggle('text-primary', avgVal === null || avgVal > AVG_AMBANG);
  }
  // Update nama merah berdasarkan rata-rata terbaru
  refreshRendahMarks();
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
    html += `<tr data-mark-row><td class="px-2 py-1 border text-center sticky left-0 bg-white dark:bg-slate-800 z-10">${idx + 1}</td>`;
    html += `<td data-nama class="px-2 py-1 border font-medium sticky left-[30px] bg-white dark:bg-slate-800 z-10 truncate max-w-[140px]">${s.nama}</td>`;
    html += `<td class="px-2 py-1 border text-center text-gray-600 dark:text-gray-400">${s.stambuk}</td>`;
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
        html += `<td class="px-0 py-0 border text-center bg-gray-100 dark:bg-slate-800"><input type="text" disabled value="-" class="w-full text-center text-xs py-1 bg-transparent border-0 outline-none text-gray-500 dark:text-gray-400"></td>`;
      } else if (!canEdit) {
        html += `<td class="px-0 py-0 border text-center bg-gray-50 dark:bg-slate-800"><input type="text" disabled value="${val}" class="w-full text-center text-xs py-1 bg-transparent border-0 outline-none text-gray-600 dark:text-gray-300"></td>`;
      } else {
        html += `<td class="px-0 py-0 border text-center"><input type="number" step="0.5" min="0" max="${maxNilaiKuartalMapel(m)}" data-k="${kuartal}" data-s="${s.id}" data-m="${m.id}"${excl ? ' data-excl="1"' : ''} value="${val}" class="w-full text-center text-xs py-1 bg-transparent border-0 focus:bg-yellow-50 dark:focus:bg-slate-700 outline-none"></td>`;
      }
    });
    const sumStr = count > 0 ? fmtNum(sum) : '-';
    const avgVal = count > 0 ? sum / count : null;
    const avgStr = avgVal !== null ? fmtNum(avgVal) : '-';
    const avgRed = avgVal !== null && avgVal <= 4.4;
    const avgClass = avgRed ? 'text-red-600 dark:text-red-400' : 'text-primary';
    // data-sum-row menandai baris agar Jml & Rata² bisa dihitung ulang saat
    // pengguna mengubah nilai (recalculateSectionRow). data-k membedakan section.
    html += `<td class="px-1 py-1 border text-center font-bold bg-gray-50 dark:bg-slate-800/50" data-sum-cell="${kuartal}_${s.id}">${sumStr}</td>`;
    html += `<td class="px-1 py-1 border text-center font-bold ${avgClass} bg-gray-50 dark:bg-slate-800/50" data-avg-cell="${kuartal}_${s.id}">${avgStr}</td>`;
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

// Batas atas nilai kuartal per kategori mapel (sinkron dengan backend
// maxNilaiKuartal di models/penilaian_dasar.go): Akhlaq = 8, lainnya 10.
function maxNilaiKuartalMapel(m) {
  const kat = (m.kategori || '').toLowerCase();
  if (kat === 'akhlaq' || kat === 'akhlaq_perilaku') return 8;
  return 10;
}

// Nilai di bawah ambang ini ditandai merah (angka + latar sel, dan nama siswi
// pada barisnya). Ambang 5 → yang kena nilai 4 dan 4.5. Begitu nilai dinaikkan
// ke >= 5, penanda dilepas otomatis (live, tanpa perlu simpan).
const NILAI_RENDAH_AMBANG = 5;

// Threshold absensi yang memotong nilai (sinkron dengan backend
// GenerateNilaiKhos / GenerateAlBayan):
//   per semester : izin ≥ 20 atau alpha ≥ 6 → Akhlaq −1 (independen, bisa −2)
//   per tahun    : izin ≥ 15 atau alpha ≥ 5 → Al-Bayan −1
// Zona PERHATIAN (amber): absensi sudah ≥ 75% ambang — "hampir kena potongan".
const ABSENSI_AMBANG = {
  semester: { izin: 20, alpha: 6 },
  tahunan: { izin: 15, alpha: 5 },
};

// Koreksi KELIPATAN (2026-08): tiap ambang penuh = -1.
// izin 55 hari, ambang 15 -> floor(55/15) = -3. Di bawah ambang = 0.
function potonganAbsensi(hari, ambang) {
  const h = hari || 0;
  return h >= ambang ? Math.floor(h / ambang) : 0;
}

function alasanAbsensi(ab, ambang, target) {
  const red = [], warn = [];
  const potongIzin = potonganAbsensi(ab.izin, ambang.izin);
  const potongAlpha = potonganAbsensi(ab.alpha, ambang.alpha);
  if (potongIzin > 0) red.push(`Izin ${ab.izin} hari (setiap ${ambang.izin} hari = -1) → ${target} −${potongIzin}`);
  else {
    const warnIzin = Math.ceil(ambang.izin * 0.75);
    if ((ab.izin || 0) >= warnIzin) warn.push(`Izin ${ab.izin} hari — ${ambang.izin - ab.izin} hari lagi memotong ${target}`);
  }
  if (potongAlpha > 0) red.push(`Alpha ${ab.alpha} hari (setiap ${ambang.alpha} hari = -1) → ${target} −${potongAlpha}`);
  else {
    const warnAlpha = Math.ceil(ambang.alpha * 0.75);
    if ((ab.alpha || 0) >= warnAlpha) warn.push(`Alpha ${ab.alpha} hari — ${ambang.alpha - ab.alpha} hari lagi memotong ${target}`);
  }
  return { red, warn };
}

function markNamaDariAlasan(alasan) {
  let cls = '', title = '', level = '';
  if (alasan.red.length) {
    cls = 'nama-rendah'; level = 'red';
    title = alasan.red.join(' + ') + (alasan.warn.length ? ' | ' + alasan.warn.join(', ') : '');
  } else if (alasan.warn.length) {
    cls = 'nama-warning'; level = 'warn';
    title = 'PERHATIAN: ' + alasan.warn.join(', ');
  }
  return { cls, title, level };
}

function clampNilaiInput(inp) {
  const v = parseFloat(inp.value);
  if (isNaN(v) || inp.value === '') return;
  const lo = inp.min !== '' ? parseFloat(inp.min) : -Infinity;
  const hi = inp.max !== '' ? parseFloat(inp.max) : Infinity;
  if (v > hi || v < lo) {
    inp.value = String(v > hi ? hi : lo);
    inp.classList.add('flash-batas');
    setTimeout(() => inp.classList.remove('flash-batas'), 600);
  }
}

// Tandai sel nilai < ambang dengan .nilai-rendah; nama siswi di baris yang sama
// diberi .nama-rendah jika RATA-RATA kuartal ≤ 4.4 atau absensi merah.
// Threshold: cell ≤ 4.4 = merah; rata-rata ≤ 4.4 = nama merah; Bayan ≤ 5 = merah.
function refreshRendahMarks() {
  const AVG_AMBANG = 4.4;
  container.querySelectorAll('tr[data-mark-row]').forEach(tr => {
    // 1. Cell individual: merah jika ≤ 4.4 (atau ≤ 5 untuk Bayan).
    tr.querySelectorAll('input[data-k], input[data-khos-sem], input[data-nilai-display], input[data-bayan-cell]').forEach(inp => {
      const v = parseFloat(inp.value);
      if (isNaN(v)) return;
      const isBayan = inp.hasAttribute('data-bayan-cell');
      const low = isBayan ? v <= NILAI_RENDAH_AMBANG : v <= AVG_AMBANG;
      inp.classList.toggle('nilai-rendah', low);
    });
    // 2. Nama siswi: merah jika RATA-RATA salah satu kuartal ≤ 4.4 atau absensi merah.
    const namaTd = tr.querySelector('td[data-nama]');
    if (namaTd) {
      const absensiMerah = namaTd.dataset.absensi === 'red';
      let avgLow = false;
      tr.querySelectorAll('td[data-avg-cell]').forEach(avgTd => {
        const v = parseFloat(avgTd.textContent);
        if (!isNaN(v) && v <= AVG_AMBANG) avgLow = true;
      });
      namaTd.classList.toggle('nama-rendah', avgLow || absensiMerah);
      // Tooltip
      const parts = [];
      if (namaTd.dataset.absensiTitle) parts.push(namaTd.dataset.absensiTitle);
      if (avgLow) parts.push('rata-rata ≤ 4.4');
      if (parts.length) namaTd.setAttribute('title', parts.join(' • '));
      else namaTd.removeAttribute('title');
    }
  });
}

function renderRaportSection(title, mapels, santri, khosMap, absensiMap, semester, canEdit) {
  let html = `<h3 class="text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-6 mb-2 px-1">${title}</h3>`;
  html += '<div class="overflow-x-auto border border-indigo-200 dark:border-indigo-800 rounded-xl mb-4"><table class="border-collapse text-xs w-full">';
  html += '<thead class="bg-indigo-50 dark:bg-indigo-900"><tr><th class="px-2 py-2 border text-left sticky left-0 bg-indigo-50 dark:bg-indigo-900 z-10 min-w-[30px]">No</th><th class="px-2 py-2 border text-left sticky left-[30px] bg-indigo-50 dark:bg-indigo-900 z-10 min-w-[120px]">Nama</th>';
  // Header mapel: nama kitab (Arab) di-translasi ke ejaan Latin. Arab asli jadi tooltip.
  mapels.forEach(m => { 
    const { display, tooltip } = mapelLabel(m); 
    const isExcl = isExcludedMapel(m, true); // true = ini bagian raport
    const exclMark = isExcl ? '<span class="text-red-500 font-bold ml-0.5" title="Tidak dihitung dalam Penjumlahan">*</span>' : '';
    html += `<th class="px-1 py-2 border text-center min-w-[70px] max-w-[120px] whitespace-normal break-words leading-tight bg-indigo-50 dark:bg-indigo-900" title="${tooltip}${isExcl ? ' (Tidak dihitung)' : ''}">${display}${exclMark}</th>`; 
  });
  html += '<th class="px-2 py-2 border text-center min-w-[50px] bg-blue-50 dark:bg-blue-900/20">Jml</th>';
  html += '<th class="px-2 py-2 border text-center min-w-[40px] bg-yellow-50 dark:bg-yellow-900/20">Izin</th>';
  html += '<th class="px-2 py-2 border text-center min-w-[40px] bg-red-50 dark:bg-red-900/20">Alpha</th>';
  html += '</tr></thead><tbody>';

  const mapelStats = {};
  mapels.forEach(m => { mapelStats[m.id] = { sum: 0, count: 0 }; });

  santri.forEach((s, idx) => {
    // Nama merah jika absensi semester ini sudah memotong Akhlaq, amber jika
    // hampir (≥75% ambang). Tooltip menjelaskan alasannya.
    const ab = absensiMap?.[String(s.id)] || { izin: 0, alpha: 0 };
    const alasan = alasanAbsensi(ab, ABSENSI_AMBANG.semester, `Akhlaq Smt ${semester}`);
    const mark = markNamaDariAlasan(alasan);
    html += `<tr data-mark-row><td class="px-2 py-1 border text-center sticky left-0 bg-white dark:bg-slate-800 z-10">${idx + 1}</td>`;
    html += `<td data-nama data-absensi="${mark.level}" data-absensi-title="${mark.title}"${mark.title ? ` title="${mark.title}"` : ''} class="px-2 py-1 border font-medium sticky left-[30px] bg-white dark:bg-slate-800 z-10 truncate max-w-[140px] ${mark.cls}">${s.nama}</td>`;
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
        html += `<td class="px-0 py-0 border border-indigo-200 dark:border-indigo-800 text-center bg-gray-100 dark:bg-slate-800"><input type="text" disabled value="-" class="w-full text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-1 bg-transparent border-0 outline-none"></td>`;
      } else if (!canEdit) {
        html += `<td class="px-0 py-0 border border-indigo-200 dark:border-indigo-800 text-center bg-gray-50 dark:bg-slate-800"><input type="text" disabled data-nilai-display value="${valDisplay}" class="w-full text-center text-xs font-semibold text-gray-600 dark:text-gray-300 py-1 bg-transparent border-0 outline-none"></td>`;
      } else {
        html += `<td class="px-0 py-0 border border-indigo-200 dark:border-indigo-800 text-center"><input type="number" step="0.5" min="4" max="9" data-khos-sem="${semester}" data-s="${s.id}" data-m="${m.id}" data-nilai-display value="${valDisplay}" class="w-full text-center text-xs font-semibold text-indigo-700 dark:text-indigo-400 py-1 bg-transparent border-0 focus:bg-indigo-50 dark:focus:bg-indigo-900/50 outline-none"></td>`;
      }
    });
    const sumStr = count > 0 ? (Number.isInteger(jumlah) ? String(jumlah) : String(Math.round(jumlah * 10) / 10)) : '-';
    html += `<td class="px-1 py-1 border text-center font-bold bg-blue-50 dark:bg-blue-900/20">${sumStr}</td>`;
    html += `<td class="px-1 py-1 border text-center bg-yellow-50 dark:bg-yellow-900/20">${ab.izin || 0}</td>`;
    html += `<td class="px-1 py-1 border text-center bg-red-50 dark:bg-red-900/20">${ab.alpha || 0}</td>`;
    html += '</tr>';
  });

  // Baris Rata-rata Kelas per Mapel (dibulatkan tanpa koma)
  html += '<tr class="bg-indigo-100/70 dark:bg-indigo-900 font-bold border-t-2 border-indigo-300 dark:border-indigo-700">';
  html += '<td colspan="2" class="px-2 py-1.5 border text-center sticky left-0 bg-indigo-100 dark:bg-indigo-950 z-10 font-bold text-indigo-900 dark:text-indigo-200">Nilai \'Am</td>';
  
  let totalRoundedSum = 0;
  let totalRoundedCount = 0;

  mapels.forEach(m => {
    const st = mapelStats[m.id];
    if (st.count > 0) {
      const avg = st.sum / st.count;
      const roundedAvg = Math.floor(avg + 0.5);
      html += `<td class="px-1 py-1.5 border text-center font-extrabold text-indigo-950 dark:text-indigo-100 bg-indigo-50 dark:bg-indigo-900">${roundedAvg}</td>`;
      totalRoundedSum += roundedAvg;
      totalRoundedCount++;
    } else {
      html += '<td class="px-1 py-1.5 border text-center font-extrabold text-indigo-950 dark:text-indigo-100 bg-indigo-50 dark:bg-indigo-900">-</td>';
    }
  });

  const amAvg = totalRoundedCount > 0 ? totalRoundedSum / totalRoundedCount : 0;
  const amAvgRounded = totalRoundedCount > 0 ? Math.floor(amAvg + 0.5) : '-';
  
  html += `<td class="px-1 py-1.5 border text-center font-bold text-indigo-950 dark:text-indigo-100 bg-blue-100 dark:bg-blue-900/40">${totalRoundedCount > 0 ? totalRoundedSum : '-'}</td>`;
  html += '<td class="px-1 py-1.5 border text-center text-gray-500 dark:text-gray-400">-</td>';
  html += '<td class="px-1 py-1.5 border text-center text-gray-500 dark:text-gray-400">-</td>';
  html += '</tr>';

  html += '</tbody></table></div>';
  return html;
}

function renderBayanSection(santri, nilaiKhos, nilaiBayan, absensiMap, totalMapels, canEdit) {
  // Label Al-Bayan: 9..6 punya label sendiri, <=5 semuanya RODI'.
  const bayanLabels = { 9: 'JAYYID AWAL', 8: 'JAYYID TSANI', 7: 'MUTAWASSIT AWAL', 6: 'MUTAWASSIT TSANI' };
  const bayanLabel = (v) => bayanLabels[v] || "RODI'";

  let html = `<h3 class="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-8 mb-2 px-1">AL-BAYAN (Prestasi Tahunan)</h3>`;
  html += '<div class="flex items-center gap-2 mb-2 px-1">';
  html += '<label class="text-xs font-medium text-gray-600 dark:text-gray-400">Filter Label:</label>';
  html += '<select id="bayan-label-filter" class="text-xs border border-emerald-300 dark:border-emerald-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">';
  html += '<option value="">Semua</option>';
  html += '<option value="JAYYID AWAL">JAYYID AWAL</option>';
  html += '<option value="JAYYID TSANI">JAYYID TSANI</option>';
  html += '<option value="MUTAWASSIT AWAL">MUTAWASSIT AWAL</option>';
  html += '<option value="MUTAWASSIT TSANI">MUTAWASSIT TSANI</option>';
  html += '<option value="RODI\'">RODI\'</option>';
  html += '</select></div>';
  html += '<div class="overflow-x-auto border border-emerald-200 dark:border-emerald-800 rounded-xl mb-4"><table class="border-collapse text-xs w-full">';
  html += '<thead class="bg-emerald-50 dark:bg-emerald-900/20"><tr>';
  html += '<th class="px-2 py-2 border">No</th><th class="px-2 py-2 border text-left min-w-[120px]">Nama</th>';
  html += '<th class="px-2 py-2 border text-center">Al-Bayan Asli</th>';
  html += '<th class="px-2 py-2 border text-center min-w-[160px]">Keterangan</th>';
  html += '<th class="px-2 py-2 border text-center bg-emerald-100 dark:bg-emerald-800/30">Al-Bayan Akhir</th>';
  html += '<th class="px-2 py-2 border text-center">Label</th>';
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

    // Koreksi absensi — KELIPATAN (sama dengan backend GenerateAlBayan):
    // tiap 15 hari izin = -1, tiap 5 hari alpha = -1 (2026-08).
    let koreksi = 0;
    koreksi -= potonganAbsensi(ab.izin, 15);
    koreksi -= potonganAbsensi(ab.alpha, 5);
    let hasilAkhir = bayanAsli !== '-' ? Math.min(9, bayanAsli + koreksi) : '-';

    // Override from DB if exists — tapi bandingkan dengan kalkulasi frontend.
    // Kalau DB value SAMA dengan hasil kalkulasi → bukan manual override.
    // Kalau BERBEDA → admin ubah sendiri → "Override manual".
    let overridden = false;
    if (bayan.hasil_akhir != null) {
      overridden = (bayan.hasil_akhir !== hasilAkhir);
      hasilAkhir = bayan.hasil_akhir;
    }

    // Keterangan: tampilkan berdasarkan KONDISI SEBENARNYA (bukan overridden).
    // Keterangan selalu tampil: "Dikurangi X", "Tidak ada pengurangan", atau
    // "Override manual" hanya jika admin benar-benar ubah nilai sendiri.
    let ketKoreksi;
    if (overridden) {
      ketKoreksi = 'Override manual';
    } else if (koreksi < 0) {
      const sebab = [];
      const pIzin = potonganAbsensi(ab.izin, 15);
      const pAlpha = potonganAbsensi(ab.alpha, 5);
      if (pIzin > 0) sebab.push(`izin ${ab.izin} hari`);
      if (pAlpha > 0) sebab.push(`alpha ${ab.alpha} hari`);
      ketKoreksi = `Dikurangi ${-koreksi} (${sebab.join(' + ')})`;
    } else {
      ketKoreksi = 'Tidak ada pengurangan';
    }

    const alasanTh = alasanAbsensi(ab, ABSENSI_AMBANG.tahunan, 'Al-Bayan');
    const markTh = markNamaDariAlasan(alasanTh);
    const labelAkhirForTr = hasilAkhir !== '-' ? bayanLabel(hasilAkhir) : '';
    html += `<tr data-mark-row data-label="${labelAkhirForTr}">`;
    html += `<td class="px-2 py-1 border text-center">${idx + 1}</td>`;
    html += `<td data-nama data-absensi="${markTh.level}" data-absensi-title="${markTh.title}"${markTh.title ? ` title="${markTh.title}"` : ''} class="px-2 py-1 border font-medium ${markTh.cls}">${s.nama}</td>`;
    html += `<td class="px-2 py-1 border text-center font-bold">${bayanAsli}</td>`;
    html += `<td class="px-2 py-1 border text-center ${koreksi < 0 && !overridden ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}">${ketKoreksi}</td>`;
    
    const labelAkhir = hasilAkhir !== '-' ? bayanLabel(hasilAkhir) : '';
    if (!canEdit) {
      html += `<td class="px-0 py-0 border text-center bg-gray-50 dark:bg-slate-800"><input type="text" disabled data-bayan-cell value="${hasilAkhir !== '-' ? hasilAkhir : ''}" class="w-full text-center text-xs py-2 bg-transparent border-0 outline-none text-gray-600 dark:text-gray-300 font-bold" title="${labelAkhir || 'Hanya mustahiq yang dapat mengedit'}"></td>`;
    } else {
      html += `<td class="px-0 py-0 border text-center bg-emerald-50 dark:bg-emerald-900/20"><input type="number" min="0" max="9" data-bayan="${s.id}" data-bayan-cell value="${hasilAkhir !== '-' ? hasilAkhir : ''}" class="w-full text-center text-xs py-1 bg-transparent border-0 focus:bg-emerald-100 dark:focus:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 outline-none font-bold" title="${labelAkhir}"></td>`;
    }
    html += `<td class="px-2 py-1 border text-center text-xs font-semibold">${labelAkhir || '-'}</td>`;
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

    // 2. Generate Khos for all santri (only semesters with kuartal data)
    //    Auto-calculates: Khos = (tamrin + ujian) / 2, clamped to 4-9.
    const semestersWithData = new Set();
    kuartalInputs.forEach(k => {
      const sem = k.kuartal <= 2 ? 1 : 2;
      semestersWithData.add(sem);
    });
    // Always include both semesters if any data exists (for edge cases)
    const semsToProcess = semestersWithData.size > 0 ? [...semestersWithData] : [1, 2];
    
    for (const s of currentData.santri) {
      for (const sem of semsToProcess) {
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
    //    Only generate for semesters that have kuartal data
    const bagianId = selBagian.value;
    for (const sem of semsToProcess) {
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

// === EXPORT KE EXCEL (ExcelJS — full styling support) ===
import ExcelJS from 'exceljs';

const BORDER_THIN = { style: 'thin', color: { argb: 'FFCCCCCC' } };
const FILL_TEAL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7C86' } };
const FILL_GREEN  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

function dlBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function getInfoRow() {
  const t = selTingkatan.options[selTingkatan.selectedIndex]?.text || '';
  const k = selKelas.options[selKelas.selectedIndex]?.text || '';
  const b = selBagian.options[selBagian.selectedIndex]?.text || '';
  return `Tingkatan: ${t}  |  Kelas: ${k}  |  Bagian: ${b}  |  Tahun Ajaran: ${tahunAjaran}`;
}

function safe(s) { return (s || '').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_'); }

// Decode HTML entities from API responses
const _htmlMap = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
function dh(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, m => _htmlMap[m] || m);
}

// Build styled workbook from title, headers, rows
async function buildWorkbook(title, headers, dataRows, opts = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIM Mubtadiat';
  const ws = wb.addWorksheet('Data');

  const colCount = headers.length;
  ws.columns = headers.map((h, i) => ({ width: (i <= 2 ? [5,22,12][i] : opts.colWidth || 14) }));

  // Row 1: Title (merged)
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = dh(title);
  titleRow.getCell(1).font = { bold: true, size: 14 };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 28;
  ws.mergeCells(1, 1, 1, colCount);

  // Row 2: Info
  const infoRow = ws.getRow(2);
  infoRow.getCell(1).value = getInfoRow();
  infoRow.getCell(1).font = { size: 10, color: { argb: 'FF444444' } };

  // Row 3: blank

  // Row 4: Headers (teal bg, white bold, borders, center)
  const hdrRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = dh(h);
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = FILL_TEAL;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
  });
  hdrRow.height = 22;

  // Data rows (row 5+)
  dataRows.forEach(row => {
    const r = ws.addRow(row);
    r.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
      cell.alignment = { horizontal: (colNum === 2 ? 'left' : 'center'), vertical: 'middle' };
      cell.font = { size: 10 };
      // Decode HTML entities in string cells
      if (typeof cell.value === 'string') cell.value = dh(cell.value);
    });
  });

  // Last row = average row styling (for raport)
  if (opts.avgRow) {
    const lastRow = ws.getRow(4 + dataRows.length);
    lastRow.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: true, size: 10, color: { argb: 'FF0E7C86' } };
      cell.fill = FILL_GREEN;
    });
  }

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 4 }];

  return wb;
}

async function doExport(title, headers, dataRows, opts = {}) {
  const wb = await buildWorkbook(title, headers, dataRows, opts);
  const bagianName = selBagian.options[selBagian.selectedIndex]?.text || 'Bagian';
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  dlBlob(blob, `${safe(title)}_${safe(bagianName)}_${tahunAjaran.replace('/', '-')}.xlsx`);
}

function buildTamrinData(kuartal, label) {
  if (!currentData) return null;
  const { mapels, santri, nilai_kuartal } = currentData;
  const data = nilai_kuartal[String(kuartal)] || {};
  const headers = ['No', 'Nama', 'Stambuk'];
  mapels.forEach(m => { headers.push(mapelLabel(m).display); });
  headers.push('Jml', 'Rata²');
  const dataRows = [];
  santri.forEach((s, idx) => {
    const row = [idx + 1, s.nama, s.stambuk];
    let sum = 0, count = 0;
    mapels.forEach(m => {
      const key = `${s.id}_${m.id}`;
      const val = data[key] ?? '';
      row.push(val === '' || val == null ? '' : val);
      const excl = isExcludedMapel(m);
      const isDisabled = !m.aktif_kuartal || !m.aktif_kuartal.includes(kuartal);
      if (val !== '' && val != null && !isNaN(parseFloat(val)) && !excl && !isDisabled) {
        sum += parseFloat(val); count++;
      }
    });
    row.push(count > 0 ? fmtNum(sum) : '');
    row.push(count > 0 ? fmtNum(sum / count) : '');
    dataRows.push(row);
  });
  return { headers, dataRows, title: label };
}

function buildUjianData(kuartal, semester, label) {
  if (!currentData) return null;
  const { mapels, santri, nilai_kuartal } = currentData;
  const data = nilai_kuartal[String(kuartal)] || {};
  const headers = ['No', 'Nama', 'Stambuk'];
  mapels.forEach(m => { headers.push(mapelLabel(m).display); });
  headers.push('Jml', 'Rata²');
  const dataRows = [];
  santri.forEach((s, idx) => {
    const row = [idx + 1, s.nama, s.stambuk];
    let sum = 0, count = 0;
    mapels.forEach(m => {
      const key = `${s.id}_${m.id}`;
      const val = data[key] ?? '';
      row.push(val === '' || val == null ? '' : val);
      const excl = isExcludedMapel(m);
      const isDisabled = !m.aktif_kuartal || !m.aktif_kuartal.includes(kuartal);
      if (val !== '' && val != null && !isNaN(parseFloat(val)) && !excl && !isDisabled) {
        sum += parseFloat(val); count++;
      }
    });
    row.push(count > 0 ? fmtNum(sum) : '');
    row.push(count > 0 ? fmtNum(sum / count) : '');
    dataRows.push(row);
  });
  return { headers, dataRows, title: label };
}

function buildRaportData(semester, label) {
  if (!currentData) return null;
  const { mapels, santri, nilai_khos, absensi } = currentData;
  const khosData = nilai_khos[String(semester)] || {};
  const absData = absensi[String(semester)] || {};
  const headers = ['No', 'Nama', 'Stambuk'];
  mapels.forEach(m => { headers.push(mapelLabel(m).display); });
  headers.push('Jml', 'Izin', 'Alpha');
  const dataRows = [];
  santri.forEach((s, idx) => {
    const row = [idx + 1, s.nama, s.stambuk];
    let jumlah = 0, count = 0;
    mapels.forEach(m => {
      const key = `${s.id}_${m.id}`;
      const val = khosData[key] ?? '';
      row.push(val === '' || val == null ? '' : val);
      const excl = isExcludedMapel(m, true);
      const semKuartals = semester === 1 ? [1, 2] : [3, 4];
      const isDisabled = !m.aktif_kuartal || !semKuartals.some(k => m.aktif_kuartal.includes(k));
      if (val != null && !isNaN(val) && !isDisabled && !excl) {
        jumlah += val; count++;
      }
    });
    row.push(count > 0 ? fmtNum(jumlah) : '');
    const ab = absData[String(s.id)] || { izin: 0, alpha: 0 };
    row.push(ab.izin || 0);
    row.push(ab.alpha || 0);
    dataRows.push(row);
  });
  // Baris Rata-rata Kelas
  const avgRow = ['', 'Rata-rata Kelas', ''];
  mapels.forEach(m => {
    let sum = 0, cnt = 0;
    santri.forEach(s => {
      const key = `${s.id}_${m.id}`;
      const val = khosData[key];
      const excl = isExcludedMapel(m, true);
      const semKuartals = semester === 1 ? [1, 2] : [3, 4];
      const isDisabled = !m.aktif_kuartal || !semKuartals.some(k => m.aktif_kuartal.includes(k));
      if (val != null && !isNaN(val) && !isDisabled && !excl) { sum += val; cnt++; }
    });
    avgRow.push(cnt > 0 ? Math.floor(sum / cnt + 0.5) : '');
  });
  avgRow.push('', '', '');
  dataRows.push(avgRow);
  return { headers, dataRows, title: label, avgRow: true };
}

function buildBayanData() {
  if (!currentData) return null;
  const { santri, nilai_bayan, absensi_bayan } = currentData;
  const bayanLabels = { 9: 'JAYYID AWAL', 8: 'JAYYID TSANI', 7: 'MUTAWASSIT AWAL', 6: 'MUTAWASSIT TSANI' };
  const bayanLabel = (v) => bayanLabels[v] || "RODI'";
  const headers = ['No', 'Nama', 'Stambuk', 'Nilai Al-Bayan', 'Label', 'Izin', 'Alpha'];
  const dataRows = [];
  santri.forEach((s, idx) => {
    const b = nilai_bayan[String(s.id)] || {};
    const ab = absensi_bayan[String(s.id)] || { izin: 0, alpha: 0 };
    const val = b.hasil_akhir ?? b.nilai_asli ?? '';
    dataRows.push([
      idx + 1, s.nama, s.stambuk,
      val === '' ? '' : val,
      val !== '' && val != null ? bayanLabel(val) : '',
      ab.izin || 0, ab.alpha || 0
    ]);
  });
  return { headers, dataRows, title: 'AL-BAYAN (Prestasi Tahunan)' };
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
        // Validate: only set numeric values on type="number" inputs to avoid
        // DOMException "The string did not match the expected pattern".
        if (inp.type === 'number' && v !== '' && isNaN(Number(v))) return;
        inp.value = v;
        // Picu 'input' agar dirty-tracking & recalc Jml/Rata² ikut jalan.
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  });
}

// === INIT ===
loadFilters();
