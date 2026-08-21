// frontend/src/js/rapot.js

const filterTingkatan = document.getElementById('filter-tingkatan');
const filterKelas = document.getElementById('filter-kelas');
const filterBagian = document.getElementById('filter-bagian');
const filterSemester = document.getElementById('filter-semester');
const btnLoad = document.getElementById('btn-load');

const santriPanel = document.getElementById('santri-panel');
const santriList = document.getElementById('santri-list');
const santriCount = document.getElementById('santri-count');
const santriEmpty = document.getElementById('santri-empty');
const btnPrintBulk = document.getElementById('btn-print-bulk');

const printArea = document.getElementById('print-area');
const rapotTemplate = document.getElementById('rapot-template');

let allSantri = [];
let cachedBagian = [];
let currentSantri = []; // santri di bagian yang sedang dipilih

// Kategori yang HANYA ditampilkan, tidak ikut dihitung dalam جملة (jumlah) & المعدل (rata-rata).
// Sesuai CHECK constraint di migrations/010_fix_penilaian.sql.
const EXCLUDED_KATEGORI = new Set([
  'al_quran',
  'al_khot_imla',
  'qiroah_kutub',
  'muhafadhoh',
  'akhlaq',
  'akhlaq_perilaku'
]);

// Konversi digit latin (0-9) -> Arab-Hindi (٠١٢٣٤٥٦٧٨٩). Karakter lain (titik, spasi) dibiarkan.
function toArabicDigits(value) {
  if (value === null || value === undefined || value === '') return '';
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(value).replace(/[0-9]/g, (d) => map[Number(d)]);
}

// Baris madrasah (kop) mengikuti tingkatan santri. Kata "العالية" pada contoh
// diganti sesuai jenjang. Default ke العالية bila tidak dikenali.
// Decode entitas HTML (mis. &#39; -> ') karena data API sudah di-escape global
// oleh xss.js. Dipakai untuk pencocokan teks, bukan untuk disisipkan ke DOM.
function decodeEntities(str) {
  if (str === null || str === undefined) return '';
  const el = document.createElement('textarea');
  el.innerHTML = String(str);
  return el.value;
}

function madrasahLine(tingkatanNama) {
  const t = decodeEntities(tingkatanNama).toLowerCase();
  let jenjang = 'العالية';
  if (t.includes('ibtida')) jenjang = 'الابتدائية';
  else if (t.includes("i'dad") || t.includes('idad') || t.includes('iʼdad') || t.includes('إعداد')) jenjang = 'الإعدادية';
  else if (t.includes('tsanaw') || t.includes('sanaw') || t.includes('ثانو')) jenjang = 'الثانوية';
  else if (t.includes('aliy') || t.includes('عالي')) jenjang = 'العالية';
  return `المدرسة ${jenjang} للبنات هداية المبتدئات ليربيا كديري`;
}


// Format angka nilai: integer tampil apa adanya, desimal dibulatkan 1 angka di belakang koma,
// lalu dikonversi ke Arab-Hindi. Null/undefined -> sel kosong.
function fmtNilai(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (Number.isNaN(num)) return '';
  const rounded = Math.round(num * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return toArabicDigits(str);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  // Data API sudah disanitasi secara global oleh xss.js.
  // Hindari escaping ganda agar entitas HTML (seperti &#39;) tidak rusak.
  return String(str);
}

function resetSelect(sel, placeholder, disabled = true) {
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  sel.disabled = disabled;
}

// 1. Init: cek auth, muat data filter (bagian) + daftar santri.
async function init() {
  let role = null;
  try {
    const me = await fetch('/api/me');
    if (!me.ok) {
      window.location.href = '/login.html';
      return;
    }
    const meData = await me.json();
    role = meData.role;
  } catch (e) {
    console.error('Auth check failed:', e);
  }

  // Wali santri: rapot dibatasi ke anaknya sendiri (tanpa filter kelas pondok).
  if (role === 'wali_santri') {
    try {
      const res = await fetch('/api/wali/anak');
      const anak = res.ok ? ((await res.json()) || []) : [];
      await initWaliRapot(anak);
    } catch (e) {
      console.error('Gagal memuat data anak:', e);
    }
    return;
  }

  await loadFilters();
}

// Mode wali: sembunyikan filter kelas, tampilkan langsung anak untuk dicetak.
async function initWaliRapot(anak) {
  [filterTingkatan, filterKelas, filterBagian].forEach((el) => {
    if (el && el.parentElement) el.parentElement.classList.add('hidden');
  });
  if (btnLoad) btnLoad.classList.add('hidden');

  if (!anak || anak.length === 0) {
    santriPanel.classList.remove('hidden');
    santriEmpty.classList.remove('hidden');
    santriEmpty.textContent = 'Data anak belum tertaut ke akun ini. Hubungi pengurus madrasah.';
    santriCount.textContent = '';
    return;
  }

  // Isi Tahun Ajaran dari riwayat akademik anak (endpoint kalender diblok untuk wali).
  const tahunSet = new Set();
  for (const a of anak) {
    try {
      const r = await fetch(`/api/santri/${a.id}/riwayat-akademik`);
      if (r.ok) {
        const riw = (await r.json()) || [];
        riw.forEach((ta) => { if (ta.tahun_ajaran) tahunSet.add(ta.tahun_ajaran); });
      }
    } catch (e) { /* abaikan */ }
  }
  const tahunList = [...tahunSet].sort((x, y) => String(y).localeCompare(String(x)));
  filterTahunAjaran.innerHTML = '';
  if (tahunList.length === 0) {
    filterTahunAjaran.innerHTML = '<option value="">Tahun ajaran aktif</option>';
  } else {
    tahunList.forEach((t, i) => {
      filterTahunAjaran.innerHTML += `<option value="${t}" ${i === 0 ? 'selected' : ''}>${t}</option>`;
    });
  }

  currentSantri = anak.map((a) => ({ id: a.id, nama: a.nama, stambuk: a.stambuk }));
  renderSantriList();
}

const filterTahunAjaran = document.getElementById('filter-tahun-ajaran');

async function loadFilters() {
  try {
    // Ambil pengaturan umum untuk tahun ajaran aktif
    let taAktif = '';
    const resUmum = await fetch('/api/settings/umum');
    if (resUmum.ok) {
        const dataUmum = await resUmum.json();
        taAktif = dataUmum.tahun_ajaran_aktif;
    }

    // Ambil daftar tahun ajaran
    const resTahun = await fetch('/api/kalender/tahun');
    if (resTahun.ok) {
        const tahunList = await resTahun.json() || [];
        filterTahunAjaran.innerHTML = '';
        if (taAktif && !tahunList.includes(taAktif)) tahunList.unshift(taAktif);
        if (tahunList.length === 0 && taAktif) tahunList.push(taAktif);
        tahunList.forEach(t => {
            const selected = (t === taAktif) ? 'selected' : '';
            filterTahunAjaran.innerHTML += `<option value="${t}" ${selected}>${t}</option>`;
        });
    } else if (taAktif) {
        filterTahunAjaran.innerHTML = `<option value="${taAktif}" selected>${taAktif}</option>`;
    }

    // Daftar tingkatan (level teratas cascading)
    const resTingkatan = await fetch('/api/akademik/tingkatan');
    const allTingkatan = resTingkatan.ok ? (await resTingkatan.json() || []) : [];

    // Cache semua bagian (dipakai mengisi Kelas & Bagian secara lokal, dibatasi untuk mustahiq)
    const resBagian = await fetch('/api/penilaian/bagian');
    cachedBagian = resBagian.ok ? (await resBagian.json() || []) : [];

    // Batasi tingkatan hanya yang ada di cachedBagian
    const allowedTingkatan = new Set(cachedBagian.map(b => b.tingkatan_id));
    const tingkatanList = allTingkatan.filter(t => allowedTingkatan.size === 0 || allowedTingkatan.has(t.id));

    filterTingkatan.innerHTML = '<option value="">-- Pilih Tingkatan --</option>';
    tingkatanList.forEach((t) => {
      filterTingkatan.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
    });

    resetSelect(filterKelas, '-- Pilih Kelas --');
    resetSelect(filterBagian, '-- Pilih Bagian --');

    // Auto-select jika hanya 1 tingkatan (biasanya Mustahiq)
    if (tingkatanList.length === 1 && allowedTingkatan.size > 0) {
      filterTingkatan.value = String(tingkatanList[0].id);
      filterTingkatan.dispatchEvent(new Event('change'));
    }
  } catch (err) {
    console.error('Failed to load filters', err);
    filterTingkatan.innerHTML = '<option value="">Gagal memuat data</option>';
  }
}

// LEVEL 1: Tingkatan -> isi Kelas
filterTingkatan.addEventListener('change', (e) => {
  const tingkatanId = e.target.value;
  resetSelect(filterKelas, '-- Pilih Kelas --');
  resetSelect(filterBagian, '-- Pilih Bagian --');
  hideSantriPanel();

  if (!tingkatanId) return;

  const seen = new Set();
  const kelasList = [];
  cachedBagian
    .filter((b) => b.tingkatan_id == tingkatanId)
    .forEach((b) => {
      if (!seen.has(b.kelas_id)) {
        seen.add(b.kelas_id);
        kelasList.push({ id: b.kelas_id, nama: b.kelas });
      }
    });

  if (kelasList.length === 0) {
    filterKelas.innerHTML = '<option value="">(Tidak ada kelas)</option>';
    return;
  }

  filterKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
  kelasList.forEach((k) => {
    filterKelas.innerHTML += `<option value="${k.id}">${k.nama}</option>`;
  });
  filterKelas.disabled = false;

  // Auto-select jika hanya 1 kelas
  if (kelasList.length === 1) {
    filterKelas.value = String(kelasList[0].id);
    filterKelas.dispatchEvent(new Event('change'));
  }
});

// LEVEL 2: Kelas -> isi Bagian
filterKelas.addEventListener('change', (e) => {
  const kelasId = e.target.value;
  const tingkatanId = filterTingkatan.value;
  resetSelect(filterBagian, '-- Pilih Bagian --');
  hideSantriPanel();

  if (!kelasId) return;

  const bagianList = cachedBagian.filter((b) => b.tingkatan_id == tingkatanId && b.kelas_id == kelasId);

  if (bagianList.length === 0) {
    filterBagian.innerHTML = '<option value="">(Tidak ada bagian)</option>';
    return;
  }

  filterBagian.innerHTML = '<option value="">-- Pilih Bagian --</option>';
  bagianList.forEach((b) => {
    filterBagian.innerHTML += `<option value="${b.id}">${b.nama_bagian}</option>`;
  });
  filterBagian.disabled = false;
});

filterBagian.addEventListener('change', hideSantriPanel);

function hideSantriPanel() {
  santriPanel.classList.add('hidden');
  currentSantri = [];
}

// 2. Tampilkan Santri di bagian terpilih
btnLoad.addEventListener('click', async () => {
  const bagianId = filterBagian.value;
  if (!bagianId) {
    alert('Mohon pilih Tingkatan, Kelas, dan Bagian terlebih dahulu.');
    return;
  }

  const prevText = btnLoad.textContent;
  btnLoad.textContent = 'Memuat...';
  btnLoad.disabled = true;

  try {
    const res = await fetch(`/api/santri/by-bagian/${bagianId}`);
    if (res.ok) {
      currentSantri = (await res.json()) || [];
      renderSantriList();
    } else {
      const errText = await res.text();
      alert('Gagal memuat daftar santri. Server menjawab: ' + res.status + ' ' + errText);
      currentSantri = [];
      renderSantriList();
    }
  } catch (err) {
    console.error(err);
    alert('Terjadi kesalahan jaringan');
  } finally {
    btnLoad.textContent = prevText;
    btnLoad.disabled = false;
  }
});

function renderSantriList() {
  santriPanel.classList.remove('hidden');
  santriList.innerHTML = '';

  if (currentSantri.length === 0) {
    santriEmpty.classList.remove('hidden');
    santriCount.textContent = '';
    btnPrintBulk.disabled = true;
    btnPrintBulk.classList.add('opacity-50', 'cursor-not-allowed');
    return;
  }

  santriEmpty.classList.add('hidden');
  santriCount.textContent = `${currentSantri.length} santri`;
  btnPrintBulk.disabled = false;
  btnPrintBulk.classList.remove('opacity-50', 'cursor-not-allowed');

  currentSantri.forEach((s, idx) => {
    const row = document.createElement('div');
    row.className = 'flex justify-between items-center px-4 py-2 hover:bg-gray-50';
    row.innerHTML = `
      <span class="text-sm">
        <span class="text-gray-400 mr-2">${idx + 1}.</span>
        <span class="font-mono text-xs text-gray-500 mr-2">${s.stambuk || '-'}</span>
        <span class="font-semibold">${s.nama}</span>
      </span>
      <button data-id="${s.id}" class="btn-print-single bg-blue-600 text-white px-4 py-1 rounded text-sm font-bold hover:bg-blue-700">Cetak</button>
    `;
    santriList.appendChild(row);
  });

  santriList.querySelectorAll('.btn-print-single').forEach((btn) => {
    btn.addEventListener('click', () => printSingle(parseInt(btn.dataset.id, 10)));
  });
}

// 3. Ambil daftar semester dari filter ("1", "2", atau "1,2")
function selectedSemesters() {
  return filterSemester.value.split(',');
}

// 4. Fetch data raport untuk 1 santri + 1 semester
async function fetchRaport(santriId, semester) {
  const tahunAjaran = document.getElementById('filter-tahun-ajaran').value || '';
  const res = await fetch(`/api/laporan/raport/${santriId}?semester=${semester}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}`);
  if (!res.ok) {
    throw new Error(`Gagal memuat raport (status ${res.status})`);
  }
  return res.json();
}

// 5. Bangun satu lembar rapot dari template + data. Mengembalikan elemen .rapot-sheet.
function buildSheet(data, semester) {
  const sheet = rapotTemplate.content.cloneNode(true).firstElementChild;
  const set = (field, value) => {
    const el = sheet.querySelector(`[data-field="${field}"]`);
    // Data API sudah di-escape global (xss.js); textContent tidak men-decode entitas,
    // jadi decode dulu agar mis. "&#39;" tampil sebagai "'".
    if (el) el.textContent = decodeEntities(value);
  };

  const santri = data.santri || {};
  const settings = data.settings || {};
  const nilai = Array.isArray(data.nilai) ? data.nilai : [];
  const absensi = data.absensi || {};

  // Identitas siswa (label Latin, isian Latin — sesuai contoh raport asli)
  set('nama', santri.nama || '-');
  set('stambuk', santri.stambuk || '-');
  // No. Tamrin tidak tersimpan di database; sisakan placeholder untuk diisi manual.
  set('tamrin', santri.nomor_tamrin || '....................');
  set('kelas', data.kelas_nama || '-');
  set('bagian', data.bagian_nama || '-');

  // Judul semester Arab (baris besar kop). Sem 2 -> الثانية, selain itu الأولى.
  set('semester-title', String(semester) === '2' ? 'فصل الدراسية الثانية' : 'فصل الدراسية الأولى');

  // Baris madrasah dinamis mengikuti tingkatan santri.
  set('madrasah-line', madrasahLine(data.tingkatan_nama));

  // Auto konversi tahun ajaran ke Hijriyah dan Arab Masehi
  const toArabic = (num) => String(num).split('').map(d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]).join('');
  let autoTahun = data.tahun_ajaran;
  if (data.tahun_ajaran && data.tahun_ajaran.includes('/')) {
    const parts = data.tahun_ajaran.split('/');
    if (parts.length === 2) {
      const m1 = parseInt(parts[0]);
      const m2 = parseInt(parts[1]);
      if (!isNaN(m1) && !isNaN(m2)) {
        autoTahun = `${toArabic(m1 - 579)} - ${toArabic(m2 - 579)} هـ / ${toArabic(m1)} - ${toArabic(m2)} م`;
      }
    }
  }

  set('tahun-ajaran', autoTahun);

  // Tabel nilai
  const tbody = sheet.querySelector('[data-field="tbody"]');
  tbody.innerHTML = '';
  let sumKhos = 0;
  let sumAm = 0;

function fmtNilaiAm(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (Number.isNaN(num)) return '';
  const rounded = Math.floor(num + 0.5);
  return toArabicDigits(rounded);
}

function isExcludedRow(row) {
  if (!row) return false;
  const kat = (row.kategori || '').toLowerCase();
  if (EXCLUDED_KATEGORI.has(kat)) return true;

  const mapel = (row.mapel || '').toLowerCase();
  const kitab = (row.nama_kitab || '').toLowerCase();

  if (mapel.includes('quran') || mapel.includes('qur\'an') || mapel.includes('قرآن') || mapel.includes('القرءان') || mapel.includes('القرآن')) return true;
  if (mapel.includes('khot') || mapel.includes('imla') || mapel.includes('خط') || mapel.includes('إملاء') || mapel.includes('الخط')) return true;
  if (mapel.includes('qiroah') || mapel.includes('qira\'ah') || mapel.includes('qiraat') || mapel.includes('قراءة')) return true;
  if (mapel.includes('akhlaq') || mapel.includes('akhlak') || mapel.includes('أخلاق')) return true;
  if (mapel.includes('hafad') || mapel.includes('muhafadhoh') || mapel.includes('محافظة')) return true;

  if (kitab.includes('quran') || kitab.includes('قرآن') || kitab.includes('القرآن')) return true;
  if (kitab.includes('khot') || kitab.includes('خط') || kitab.includes('إملاء')) return true;
  if (kitab.includes('qiroah') || kitab.includes('قراءة')) return true;
  if (kitab.includes('akhlaq') || kitab.includes('أخلاق')) return true;

  return false;
}

  nilai.forEach((row, idx) => {
    const included = !isExcludedRow(row);
    const khos = row.khos;
    const am = row.am;

    if (khos !== null && khos !== undefined) sumKhos += Number(khos);
    if (am !== null && am !== undefined) sumAm += Math.floor(Number(am) + 0.5);

    tbody.innerHTML += `
      <tr>
        <td class="td-num">${toArabicDigits(idx + 1)}</td>
        <td class="td-left td-arab">${row.nama_kitab}</td>
        <td class="td-left td-arab">${row.mapel}</td>
        <td class="td-num">${fmtNilai(khos)}</td>
        <td class="td-num">${fmtNilaiAm(am)}</td>
      </tr>
    `;
  });

  set('total-khos', fmtNilai(sumKhos));
  set('total-am', fmtNilaiAm(sumAm));

  // Absensi
  set('absen-izin', toArabicDigits(absensi.izin ?? 0));
  set('absen-alfa', toArabicDigits(absensi.alpha ?? 0));

  // Tanda tangan. المدرس = mustahiq bagian. مدير المعهد = mudir per tingkatan
  // (dikelola di Settings), fallback ke nama_kepala global bila belum diisi.
  set('sig-mudarris-nama', data.nama_mudarris || '.....................');
  set('sig-mudir-nama', data.nama_mudir || settings.nama_kepala || '.....................');

  // Tanda tangan digital Mudir (data URL). Bila ada, tampilkan gambar & kecilkan
  // ruang kosong; bila tidak, sisakan ruang tanda tangan manual.
  const ttdMudir = data.tanda_tangan_mudir || '';
  const imgTtd = sheet.querySelector('[data-field="sig-mudir-ttd"]');
  const spaceTtd = sheet.querySelector('[data-field="sig-mudir-space"]');
  if (imgTtd) {
    if (ttdMudir) {
      imgTtd.src = ttdMudir;
      imgTtd.style.display = 'block';
      if (spaceTtd) spaceTtd.style.display = 'none';
    } else {
      imgTtd.style.display = 'none';
      if (spaceTtd) spaceTtd.style.display = 'block';
    }
  }


  // البيان & tanda tangan المدير hanya di semester 2
  const isSem2 = String(semester) === '2';
  const bayanBox = sheet.querySelector('[data-field="bayan-box"]');
  const sigMudir = sheet.querySelector('[data-field="sig-mudir"]');
  if (isSem2) {
    set('bayan-value', data.bayan || '-');
    if (bayanBox) bayanBox.style.display = 'block';
    if (sigMudir) sigMudir.style.display = 'block';
  } else {
    if (bayanBox) bayanBox.style.display = 'none';
    if (sigMudir) sigMudir.style.display = 'none';
  }

  return sheet;
}

// 6. Cetak satu santri (semua semester yang dipilih, berurutan)
async function printSingle(santriId) {
  const semesters = selectedSemesters();
  printArea.innerHTML = '';
  try {
    for (const sem of semesters) {
      const data = await fetchRaport(santriId, sem);
      printArea.appendChild(buildSheet(data, sem));
    }
    window.print();
  } catch (e) {
    console.error(e);
    alert('Gagal memuat data raport. Silakan coba lagi.');
    printArea.innerHTML = '';
  }
}

// 7. Cetak bulk. Untuk tiap santri, cetak semua semester yang dipilih berurutan
//    (santri A sem1, santri A sem2, lalu santri B sem1, ...).
btnPrintBulk.addEventListener('click', async () => {
  if (currentSantri.length === 0) return;

  const semesters = selectedSemesters();
  const originalText = btnPrintBulk.textContent;
  btnPrintBulk.textContent = 'Menyiapkan...';
  btnPrintBulk.disabled = true;
  printArea.innerHTML = '';

  try {
    for (const s of currentSantri) {
      for (const sem of semesters) {
        const data = await fetchRaport(s.id, sem);
        printArea.appendChild(buildSheet(data, sem));
      }
    }
    window.print();
  } catch (e) {
    console.error(e);
    alert('Gagal memuat data raport untuk cetak bulk. Silakan coba lagi.');
    printArea.innerHTML = '';
  } finally {
    btnPrintBulk.textContent = originalText;
    btnPrintBulk.disabled = false;
  }
});

init();
