// frontend/src/js/alumni.js
import ExcelJS from 'exceljs';

// 1. Initial State & Elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const btnTambah = document.getElementById('btn-tambah');

// Modal Elements
const modal = document.getElementById('modal-santri'); // Note: ID in HTML is still modal-santri
const modalContent = document.getElementById('modal-content');
const modalOverlay = document.getElementById('modal-overlay');
const btnClose = document.getElementById('modal-close');
const btnCancel = document.getElementById('btn-cancel');
const formAlumni = document.getElementById('form-alumni');
const modalError = document.getElementById('modal-error');

// Filter Wilayah Elements
const filterProvinsi = document.getElementById('filter-provinsi');
const filterKabupaten = document.getElementById('filter-kabupaten');
const btnResetFilter = document.getElementById('btn-reset-filter');

// Autocomplete Santri Elements
const inputSantriNama = document.getElementById('input-santri-nama');
const santriDatalist = document.getElementById('santri-datalist');
const santriIdHidden = document.getElementById('santri-id-hidden');
let allSantri = [];

// Elemen alur "Mulai Pengabdian" pada modal Proses Keluar (Kelas_Akhir).
const kelasAkhirChoice = document.getElementById('kelas-akhir-choice');
const groupStatusKeluar = document.getElementById('group-status-keluar');
const groupTanggalKeluar = document.getElementById('group-tanggal-keluar');
const selectStatusAkhir = document.getElementById('select-status-akhir');
const inputTanggalKeluar = document.getElementById('input-tanggal-keluar');
const khidmahFields = document.getElementById('khidmah-fields');
const inputKhidmahTempat = document.getElementById('input-khidmah-tempat');
const inputKhidmahMulai = document.getElementById('input-khidmah-mulai');

// Util bersama: deteksi Kelas_Akhir (Kelas 3 Aliyah). Aturan disamakan dengan
// `isKelasAkhirAliyah` pada perpindahan.js: tingkatan cocok /aliyah/i DAN kelas
// mengandung token angka 3 atau kata "tiga". Diekspor agar dapat diuji.
function isKelasAkhir(tingkatanNama, kelasNama) {
  const t = tingkatanNama || '';
  const k = kelasNama || '';
  const isAliyah = /aliyah/i.test(t);
  const isKelas3 = /(^|\D)3(\D|$)/.test(k) || /tiga/i.test(k);
  return isAliyah && isKelas3;
}


// Tab Elements (Pengabdian / Alumni)
const tabPengabdian = document.getElementById('tab-pengabdian');
const tabAlumni = document.getElementById('tab-alumni');
const contentPengabdian = document.getElementById('content-pengabdian');
const contentAlumni = document.getElementById('content-alumni');
const pengabdianList = document.getElementById('pengabdian-list');

// Peran pengguna saat ini (diisi oleh checkAuth). Menentukan gating tombol.
let currentRole = null;

// Apply Theme
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

// Tab switching: toggle `hidden` pada kontainer daftar & tandai tab aktif.
// Pola mengikuti profil_santri.js (indikator border-b + toggle hidden).
const TAB_ACTIVE_CLS = ['border-indigo-500', 'text-indigo-600', 'dark:text-indigo-400'];
const TAB_INACTIVE_CLS = ['border-transparent', 'text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400'];

window.switchTab = function(tab) {
  const showPengabdian = tab === 'pengabdian';

  if (tabPengabdian && tabAlumni) {
    const activeTab = showPengabdian ? tabPengabdian : tabAlumni;
    const inactiveTab = showPengabdian ? tabAlumni : tabPengabdian;
    activeTab.classList.add(...TAB_ACTIVE_CLS);
    activeTab.classList.remove(...TAB_INACTIVE_CLS);
    inactiveTab.classList.add(...TAB_INACTIVE_CLS);
    inactiveTab.classList.remove(...TAB_ACTIVE_CLS);
  }

  if (contentPengabdian) contentPengabdian.classList.toggle('hidden', !showPengabdian);
  if (contentAlumni) contentAlumni.classList.toggle('hidden', showPengabdian);
};

if (tabPengabdian) tabPengabdian.addEventListener('click', () => switchTab('pengabdian'));
if (tabAlumni) tabAlumni.addEventListener('click', () => switchTab('alumni'));

// Default: tab Alumni aktif agar perilaku halaman tetap seperti sebelumnya.
switchTab('alumni');

// 2. Fetch User Auth to determine permissions
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await response.json();
    currentRole = data.role;
    
    // Admins (Pimpinan / Admin) can process student exits
    // Aksi tulis (proses keluar/tambah/import/template) hanya untuk pimpinan.
    // Admin bersifat read-only, jadi dipakai isPimpinanRole (bukan isAdminRole).
    if (window.isPimpinanRole(data.role)) {
      btnTambah.classList.remove('hidden');
      document.getElementById('btn-tambah-alumni')?.classList.remove('hidden');
      // Tombol Import Excel (admin/pimpinan only)
      const btnImport = document.getElementById('btn-import-alumni');
      if (btnImport) btnImport.classList.remove('hidden');
      const btnTemplate = document.getElementById('btn-template-alumni');
      if (btnTemplate) btnTemplate.classList.remove('hidden');
      // Tombol Import/Template Pengabdian (pimpinan only)
      const btnTemplateP = document.getElementById('btn-template-pengabdian');
      if (btnTemplateP) btnTemplateP.classList.remove('hidden');
      const btnImportP = document.getElementById('btn-import-pengabdian');
      if (btnImportP) btnImportP.classList.remove('hidden');
    }

    // Tombol Download: semua role yang bisa akses alumni
    const btnDownloadAlumni = document.getElementById('btn-download-alumni');
    if (btnDownloadAlumni) btnDownloadAlumni.classList.remove('hidden');

    
    // Load Data
    loadProvinsiFilter();
    loadAlumni();
    loadSantriAktif();
    loadPengabdian();
    
  } catch (err) {
    console.error("Auth check failed:", err);
  }
}

// 2b. Muat daftar santri aktif untuk autocomplete nama
async function loadSantriAktif() {
  try {
    const res = await fetch('/api/santri');
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) return;
    // Hanya santri yang masih aktif/cuti/pengabdian (belum keluar) yang bisa diproses keluar
    allSantri = data.filter(s => s.status === 'aktif' || s.status === 'cuti' || s.status === 'pengabdian');
    if (santriDatalist) {
      santriDatalist.innerHTML = '';
      allSantri.forEach(s => {
        const opt = document.createElement('option');
        // Tampilkan nama + stambuk agar mudah dibedakan bila nama sama
        opt.value = `${s.nama} (${s.stambuk || 'tanpa stambuk'})`;
        santriDatalist.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Gagal memuat daftar santri:', err);
  }
}

// Resolusi teks pilihan datalist menjadi santri_id
function resolveSantriId(inputVal) {
  if (!inputVal) return null;
  const val = inputVal.trim();
  // Format datalist: "Nama (stambuk)"
  const match = allSantri.find(s => `${s.nama} (${s.stambuk || 'tanpa stambuk'})` === val);
  if (match) return match.id;
  // Fallback: cocokkan berdasarkan nama saja
  const byName = allSantri.filter(s => s.nama.toLowerCase() === val.toLowerCase());
  if (byName.length === 1) return byName[0].id;
  return null;
}

// Cari objek santri lengkap dari teks input (mengandalkan resolveSantriId).
function findSantriByInput(inputVal) {
  const id = resolveSantriId(inputVal);
  if (!id) return null;
  return allSantri.find(s => s.id === id) || null;
}

// Pilihan alur pada modal ('alumni' | 'khidmah'). Default 'alumni'.
function getPengabdianChoice() {
  const checked = formAlumni
    ? formAlumni.querySelector('input[name="pengabdian_choice"]:checked')
    : null;
  return checked ? checked.value : 'alumni';
}

// Terapkan tampilan & atribut `required` sesuai pilihan alur untuk santri
// Kelas_Akhir. 'khidmah' → tampilkan field khidmah (wajib), sembunyikan
// status/tanggal keluar; 'alumni' → status dipaksa 'lulus' (select disembunyikan),
// tanggal keluar tetap wajib, tampilkan field alasan tidak khidmah.
function applyKelasAkhirChoice(choice) {
  const isKhidmah = choice === 'khidmah';

  if (khidmahFields) khidmahFields.classList.toggle('hidden', !isKhidmah);
  if (inputKhidmahTempat) inputKhidmahTempat.required = isKhidmah;
  if (inputKhidmahMulai) inputKhidmahMulai.required = isKhidmah;

  // Status keluar selalu disembunyikan untuk Kelas_Akhir (dipaksa 'lulus'
  // pada alur "Langsung Alumni"; tidak relevan pada alur khidmah).
  if (groupStatusKeluar) groupStatusKeluar.classList.add('hidden');
  if (selectStatusAkhir) selectStatusAkhir.required = false;

  // Tanggal keluar hanya dipakai pada alur "Langsung Alumni".
  if (groupTanggalKeluar) groupTanggalKeluar.classList.toggle('hidden', isKhidmah);
  if (inputTanggalKeluar) inputTanggalKeluar.required = !isKhidmah;

  // Alasan tidak khidmah: tampil hanya pada alur "Langsung Alumni".
  const groupAlasan = document.getElementById('group-alasan-tidak-khidmah');
  const inputKeterangan = document.getElementById('input-keterangan-alumni');
  if (groupAlasan) groupAlasan.classList.toggle('hidden', isKhidmah);
  if (inputKeterangan) inputKeterangan.required = !isKhidmah;
}

// Kembalikan modal ke alur normal (santri bukan Kelas_Akhir).
function resetToNormalFlow() {
  if (kelasAkhirChoice) kelasAkhirChoice.classList.add('hidden');
  if (khidmahFields) khidmahFields.classList.add('hidden');
  if (inputKhidmahTempat) inputKhidmahTempat.required = false;
  if (inputKhidmahMulai) inputKhidmahMulai.required = false;
  if (groupStatusKeluar) groupStatusKeluar.classList.remove('hidden');
  if (selectStatusAkhir) selectStatusAkhir.required = true;
  if (groupTanggalKeluar) groupTanggalKeluar.classList.remove('hidden');
  if (inputTanggalKeluar) inputTanggalKeluar.required = true;
  // Sembunyikan field alasan tidak khidmah
  const groupAlasan = document.getElementById('group-alasan-tidak-khidmah');
  const inputKeterangan = document.getElementById('input-keterangan-alumni');
  if (groupAlasan) groupAlasan.classList.add('hidden');
  if (inputKeterangan) { inputKeterangan.required = false; inputKeterangan.value = ''; }
}

// Perbarui UI modal berdasarkan santri terpilih: bila Kelas_Akhir, tampilkan
// pilihan "Langsung Alumni"/"Khidmah dulu"; selain itu alur normal.
function updateKelasAkhirUI(santri) {
  const isAkhir = santri ? isKelasAkhir(santri.tingkatan_nama, santri.kelas_nama) : false;
  if (!isAkhir) {
    resetToNormalFlow();
    return;
  }
  if (kelasAkhirChoice) kelasAkhirChoice.classList.remove('hidden');
  applyKelasAkhirChoice(getPengabdianChoice());
}

// Reaksi terhadap pemilihan santri & perubahan pilihan alur.
if (inputSantriNama) {
  inputSantriNama.addEventListener('input', () => {
    updateKelasAkhirUI(findSantriByInput(inputSantriNama.value));
  });
}
if (kelasAkhirChoice) {
  kelasAkhirChoice.querySelectorAll('input[name="pengabdian_choice"]').forEach(radio => {
    radio.addEventListener('change', () => applyKelasAkhirChoice(getPengabdianChoice()));
  });
}


// ==================== TAB PENGABDIAN ====================

// Escape helper untuk render aman (mengikuti pola profil_santri.js/rapot.js).
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  // Data API sudah disanitasi secara global oleh xss.js.
  // Hindari escaping ganda agar entitas HTML (seperti &#39;) tidak rusak.
  return String(str);
}

// Format tanggal ISO (YYYY-MM-DD) → tampilan lokal; fallback ke nilai apa adanya.
function formatTanggal(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Gating tombol "Selesai Khidmah → Alumni": hanya penulis (pimpinan).
// (Requirement 8.3, Property 11) — admin bersifat read-only, jadi dipakai
// window.isPimpinanRole (bukan isAdminRole yang juga cocok untuk admin).
function canShowSelesaiKhidmah(role) {
  return window.isPimpinanRole(role);
}

// Fungsi murni: render satu baris (<tr>) daftar pengabdian.
// Selalu memuat nama, khidmah_tempat, dan khidmah_mulai (Requirement 8.2, Property 10).
// Bila `canWrite` true, sertakan tombol "Selesai Khidmah → Alumni" (Requirement 8.3).
function renderPengabdianRow(item, canWrite = false) {
  item = item || {};
  const nama = escapeHtml(item.nama || '-');
  const tempat = escapeHtml(item.khidmah_tempat || '-');
  const mulai = escapeHtml(formatTanggal(item.khidmah_mulai));
  const stambuk = escapeHtml(item.stambuk || '-');

  const aksi = canWrite
    ? `<button type="button" class="btn-selesai-khidmah text-primary dark:text-accent-emerald hover:underline text-sm font-medium"
         data-santri-id="${escapeHtml(item.santri_id)}" data-nama="${nama}">Selesai Khidmah &rarr; Alumni</button>`
    : '';

  return `
    <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
      <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
        ${nama}
        <div class="text-xs text-gray-500 dark:text-gray-400 font-normal">Stambuk: ${stambuk}</div>
      </td>
      <td class="px-6 py-4 text-gray-700 dark:text-gray-300">${tempat}</td>
      <td class="px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${mulai}</td>
      <td class="px-6 py-4 text-right">${aksi}</td>
    </tr>
  `;
}

// Muat daftar santri pengabdian dari GET /api/pengabdian dan render ke tab.
async function loadPengabdian() {
  if (!pengabdianList) return;
  pengabdianList.innerHTML = `<div class="p-6 text-center text-gray-500 dark:text-gray-400">Memuat data pengabdian...</div>`;

  try {
    const response = await fetch('/api/pengabdian');
    // Cek status SEBELUM parse JSON: bila ditolak RBAC, body-nya teks biasa
    // ("Forbidden: ..."), bukan JSON — memanggil .json() lebih dulu akan
    // melempar "JSON.parse: unexpected character" yang membingungkan.
    if (!response.ok) {
      if (response.status === 403) throw new Error('Anda tidak memiliki akses ke data pengabdian.');
      const text = await response.text().catch(() => '');
      throw new Error(text || `Gagal memuat data pengabdian (${response.status})`);
    }
    const data = await response.json();

    const list = Array.isArray(data) ? data : [];
    if (list.length === 0) {
      pengabdianList.innerHTML = `<div class="p-6 text-center text-gray-500 dark:text-gray-400">Tidak ada santri yang sedang berkhidmah.</div>`;
      return;
    }

    const canWrite = canShowSelesaiKhidmah(currentRole);
    const rows = list.map(item => renderPengabdianRow(item, canWrite)).join('');
    pengabdianList.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-600 dark:text-gray-300">
          <thead class="bg-gray-50/50 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400 uppercase font-semibold text-xs border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th class="px-6 py-4">Nama Lengkap</th>
              <th class="px-6 py-4">Tempat Khidmah</th>
              <th class="px-6 py-4">Mulai Khidmah</th>
              <th class="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-700/50">${rows}</tbody>
        </table>
      </div>
    `;

    // Wire tombol "Selesai Khidmah → Alumni" (hanya ada bila Peran_Tulis).
    pengabdianList.querySelectorAll('.btn-selesai-khidmah').forEach(btn => {
      btn.addEventListener('click', () => {
        openSelesaiModal(btn.dataset.santriId, btn.dataset.nama);
      });
    });
  } catch (err) {
    pengabdianList.innerHTML = `<div class="p-6 text-center text-red-500">Terjadi kesalahan: ${escapeHtml(err.message)}</div>`;
  }
}


// ==================== MODAL SELESAI KHIDMAH ====================
const modalSelesai = document.getElementById('modal-selesai');
const modalSelesaiContent = document.getElementById('modal-selesai-content');
const modalSelesaiOverlay = document.getElementById('modal-selesai-overlay');
const btnSelesaiClose = document.getElementById('modal-selesai-close');
const btnSelesaiCancel = document.getElementById('btn-selesai-cancel');
const formSelesai = document.getElementById('form-selesai');
const modalSelesaiError = document.getElementById('modal-selesai-error');
const selesaiNama = document.getElementById('selesai-nama');
const selesaiSantriId = document.getElementById('selesai-santri-id');
const inputKhidmahSelesai = document.getElementById('input-khidmah-selesai');

function openSelesaiModal(santriId, nama) {
  if (!modalSelesai) return;
  formSelesai.reset();
  selesaiSantriId.value = santriId || '';
  if (selesaiNama) selesaiNama.textContent = nama || '';
  // Default tanggal selesai = hari ini.
  if (inputKhidmahSelesai) inputKhidmahSelesai.valueAsDate = new Date();
  if (modalSelesaiError) modalSelesaiError.classList.add('hidden');

  modalSelesai.classList.remove('hidden');
  void modalSelesai.offsetWidth;
  modalSelesaiContent.classList.remove('scale-95', 'opacity-0');
  modalSelesaiContent.classList.add('scale-100', 'opacity-100');
}

function closeSelesaiModal() {
  if (!modalSelesai) return;
  modalSelesaiContent.classList.remove('scale-100', 'opacity-100');
  modalSelesaiContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modalSelesai.classList.add('hidden'), 300);
}

if (btnSelesaiClose) btnSelesaiClose.addEventListener('click', closeSelesaiModal);
if (btnSelesaiCancel) btnSelesaiCancel.addEventListener('click', closeSelesaiModal);
if (modalSelesaiOverlay) modalSelesaiOverlay.addEventListener('click', closeSelesaiModal);

if (formSelesai) {
  formSelesai.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      santri_id: parseInt(selesaiSantriId.value, 10),
      khidmah_selesai: inputKhidmahSelesai.value
    };

    const btnSubmit = formSelesai.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    const oldText = btnSubmit.textContent;
    btnSubmit.textContent = 'Memproses...';
    if (modalSelesaiError) modalSelesaiError.classList.add('hidden');

    try {
      const response = await fetch('/api/pengabdian/selesai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error((data && data.message) || 'Gagal menyelesaikan khidmah');

      // Sukses: reload kedua tab (Pengabdian & Alumni). (Requirement 8.5)
      closeSelesaiModal();
      loadPengabdian();
      loadAlumni();
    } catch (err) {
      if (modalSelesaiError) {
        modalSelesaiError.textContent = err.message;
        modalSelesaiError.classList.remove('hidden');
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = oldText;
    }
  });
}


// 3. Fetch Data Alumni
async function loadAlumni(query = '') {
  tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Memuat data alumni...</td></tr>`;
  
  try {
    // Bangun query string filter wilayah (backend mendukung ?provinsi= & ?kabupaten=)
    const params = new URLSearchParams();
    if (filterProvinsi && filterProvinsi.value) params.set('provinsi', filterProvinsi.value);
    if (filterKabupaten && filterKabupaten.value) params.set('kabupaten', filterKabupaten.value);
    const qs = params.toString();
    const url = qs ? `/api/alumni?${qs}` : '/api/alumni';
    
    // If search is used, filter locally since global search is separate
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 403) throw new Error('Anda tidak memiliki akses ke data alumni.');
      const text = await response.text().catch(() => '');
      throw new Error(text || `Gagal memuat data (${response.status})`);
    }
    let data = await response.json();

    if (query.trim().length > 0) {
      data = data.filter(a => a.nama.toLowerCase().includes(query.toLowerCase()) || (a.stambuk && a.stambuk.includes(query)));
    }
    
    // Filter by tahun masuk / keluar on client side
    const filterTahunMasuk = document.getElementById('filter-tahun-masuk');
    const filterTahunKeluar = document.getElementById('filter-tahun-keluar');
    const tm = filterTahunMasuk && filterTahunMasuk.value ? filterTahunMasuk.value.trim() : '';
    const tk = filterTahunKeluar && filterTahunKeluar.value ? filterTahunKeluar.value.trim() : '';

    if (tm || tk) {
      data = data.filter(a => {
        let match = true;
        if (tm && a.tahun_masuk !== tm) match = false;
        if (tk && a.tahun_keluar !== tk) match = false;
        return match;
      });
    }
    
    renderTable(data);
    
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-red-500">Terjadi kesalahan: ${err.message}</td></tr>`;
  }
}

// 3b. Filter Wilayah: muat provinsi & kabupaten berjenjang
async function loadProvinsiFilter() {
  try {
    const res = await fetch('/api/wilayah/provinsi');
    const list = await res.json();
    if (!res.ok || !Array.isArray(list)) return;
    filterProvinsi.innerHTML = '<option value="">-- Semua Provinsi --</option>';
    list.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.kode;
      opt.textContent = p.nama;
      filterProvinsi.appendChild(opt);
    });
  } catch (err) {
    console.error('Gagal memuat provinsi:', err);
  }
}

async function loadKabupatenFilter(provinsiKode) {
  filterKabupaten.innerHTML = '<option value="">-- Semua Kabupaten --</option>';
  if (!provinsiKode) {
    filterKabupaten.disabled = true;
    return;
  }
  try {
    const res = await fetch(`/api/wilayah/kabupaten?provinsi=${encodeURIComponent(provinsiKode)}`);
    const list = await res.json();
    if (!res.ok || !Array.isArray(list)) return;
    list.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.kode;
      opt.textContent = k.nama;
      filterKabupaten.appendChild(opt);
    });
    filterKabupaten.disabled = false;
  } catch (err) {
    console.error('Gagal memuat kabupaten:', err);
  }
}

if (filterProvinsi) {
  filterProvinsi.addEventListener('change', async () => {
    await loadKabupatenFilter(filterProvinsi.value);
    loadAlumni(searchInput.value);
  });
}
if (filterKabupaten) {
  filterKabupaten.addEventListener('change', () => loadAlumni(searchInput.value));
}
const filterTahunMasuk = document.getElementById('filter-tahun-masuk');
const filterTahunKeluar = document.getElementById('filter-tahun-keluar');
if (filterTahunMasuk) filterTahunMasuk.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadAlumni(searchInput.value), 300);
});
if (filterTahunKeluar) filterTahunKeluar.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadAlumni(searchInput.value), 300);
});

if (btnResetFilter) {
  btnResetFilter.addEventListener('click', () => {
    filterProvinsi.value = '';
    filterKabupaten.innerHTML = '<option value="">-- Semua Kabupaten --</option>';
    filterKabupaten.disabled = true;
    if (filterTahunMasuk) filterTahunMasuk.value = '';
    if (filterTahunKeluar) filterTahunKeluar.value = '';
    loadAlumni(searchInput.value);
  });
}


// 4. Render Table
function renderTable(alumniArray) {
  // Update total count
  const totalEl = document.getElementById('total-count');
  if (totalEl) totalEl.textContent = `Total: ${alumniArray.length} alumni`;

  if (!alumniArray || alumniArray.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Tidak ada data alumni ditemukan.</td></tr>`;
    return;
  }
  
  // Clear loading
  tableBody.innerHTML = '';
  
  alumniArray.forEach(a => {
    const nama = a.nama || '-';
    const stambuk = a.stambuk || '-';
    const statusAkhir = a.status_akhir || '-';
    const tingkatanAkhir = a.tingkatan_akhir || '-';

    // Asal daerah: gunakan nilai dari backend (Kabupaten/Provinsi dengan
    // fallback ke alamat bebas). Fallback lama tetap dipertahankan bila kosong.
    let asalDaerah = a.asal_daerah || '';
    if (!asalDaerah || asalDaerah === '-') {
      const kab = a.kabupaten_nama || '';
      const prov = a.provinsi_nama || '';
      if (kab && prov) asalDaerah = `${kab}, ${prov}`;
      else if (prov) asalDaerah = prov;
      else if (kab) asalDaerah = kab;
      else asalDaerah = '-';
    }

    
    let statusClass = 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300';
    if (statusAkhir === 'lulus') {
      statusClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    } else if (statusAkhir === 'boyong') {
      statusClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    } else if (statusAkhir === 'keluar') {
      statusClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
    
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors';
    tr.innerHTML = `
      <td data-label="Nama Lengkap" class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
        ${nama}
      </td>
      <td data-label="Kamar" class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
        ${a.kamar || '-'}
      </td>
      <td data-label="Asal Daerah" class="px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        ${asalDaerah}
      </td>
      <td data-label="Tahun Masuk" class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
        ${a.tahun_masuk || '-'}
      </td>
      <td data-label="Tahun Lulus" class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
        ${a.tahun_keluar || '-'}
      </td>
      <td data-label="Status Keluar" class="px-6 py-4">
        <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${statusClass}">
          ${statusAkhir.toUpperCase()}

        </span>
      </td>
      <td data-label="Tingkatan Akhir" class="px-6 py-4 text-gray-700 dark:text-gray-300">
        ${tingkatanAkhir}
      </td>
      <td data-label="Aksi" class="px-6 py-4 text-right">
        <button class="btn-detail text-primary dark:text-accent-emerald hover:underline text-sm font-medium">Detail</button>
        ${window.isPimpinanRole(currentRole) ? '<button class="btn-edit text-emerald-500 hover:underline text-sm font-medium ml-3">Edit</button>' : ''}
      </td>
    `;
    tableBody.appendChild(tr);
  });
  
  // Attach event listeners to buttons
  const detailButtons = tableBody.querySelectorAll('.btn-detail');
  detailButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => openDetailModal(alumniArray[idx]));
  });
  const editButtons = tableBody.querySelectorAll('.btn-edit');
  editButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => openEditModal(alumniArray[idx]));
  });
}

// 5. Search Logic (Debounced)
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadAlumni(e.target.value);
  }, 300);
});

// 6. Modal Logic
function openModal() {
  modal.classList.remove('hidden');
  // Trigger reflow for animation
  void modal.offsetWidth;
  modalContent.classList.remove('scale-95', 'opacity-0');
  modalContent.classList.add('scale-100', 'opacity-100');
  formAlumni.reset();
  
  // Set default date to today
  formAlumni.querySelector('input[name="tanggal_keluar"]').valueAsDate = new Date();
  
  // Kembalikan alur ke normal; pilihan Kelas_Akhir muncul lagi saat santri dipilih.
  resetToNormalFlow();
  
  modalError.classList.add('hidden');
}

function closeModal() {
  modalContent.classList.remove('scale-100', 'opacity-100');
  modalContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

btnTambah.addEventListener('click', openModal);
btnClose.addEventListener('click', closeModal);
btnCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

// 7. Form Submit Logic (Proses Keluar)
formAlumni.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Resolusi nama santri -> santri_id
  const santriId = resolveSantriId(inputSantriNama.value);
  if (!santriId) {
    modalError.textContent = 'Santri tidak ditemukan. Pilih nama santri dari daftar.';
    modalError.classList.remove('hidden');
    return;
  }
  
  const formData = new FormData(formAlumni);

  // Alur Kelas_Akhir: pilihan block tampil (tidak hidden).
  const isAkhir = kelasAkhirChoice && !kelasAkhirChoice.classList.contains('hidden');
  const choice = isAkhir ? getPengabdianChoice() : null;

  const btnSubmit = formAlumni.querySelector('button[type="submit"]');
  const oldBtnText = btnSubmit.textContent;
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Memproses...';
  modalError.classList.add('hidden');

  try {
    let endpoint, payload;

    if (isAkhir && choice === 'khidmah') {
      // "Khidmah dulu" → Mulai Pengabdian (Requirement 4.2 → Requirement 2).
      const khidmahTempat = (inputKhidmahTempat && inputKhidmahTempat.value || '').trim();
      const khidmahMulai = inputKhidmahMulai && inputKhidmahMulai.value || '';
      if (!khidmahTempat) throw new Error('Tempat khidmah wajib diisi.');
      if (!khidmahMulai) throw new Error('Tanggal mulai khidmah wajib diisi.');
      endpoint = '/api/pengabdian/mulai';
      payload = {
        santri_id: santriId,
        khidmah_tempat: khidmahTempat,
        khidmah_mulai: khidmahMulai
      };
    } else {
      // Alur proses keluar biasa. Untuk Kelas_Akhir "Langsung Alumni" → paksa 'lulus'.
      endpoint = '/api/alumni/proses-keluar';
      payload = {
        santri_id: santriId,
        status_akhir: isAkhir ? 'lulus' : formData.get('status_akhir'),
        tanggal_keluar: formData.get('tanggal_keluar'),
        alasan: formData.get('alasan'),
        keterangan_alumni: formData.get('keterangan_alumni') || ''
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Gagal memproses santri keluar');
    }

    // Success: reload tab terkait & daftar santri aktif (santri berpindah status).
    closeModal();
    loadAlumni();
    loadPengabdian();
    loadSantriAktif();

  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = oldBtnText;
  }
});

// 8. Detail Modal Logic
const modalDetail = document.getElementById('modal-detail');
const modalEdit = document.getElementById('modal-edit');
const modalEditContent = document.getElementById('modal-edit-content');
const modalEditOverlay = document.getElementById('modal-edit-overlay');
const btnEditClose = document.getElementById('modal-edit-close');
const modalDetailContent = document.getElementById('modal-detail-content');
const modalDetailOverlay = document.getElementById('modal-detail-overlay');
const btnDetailClose = document.getElementById('modal-detail-close');
const formUpdateAlumni = document.getElementById('form-update-alumni');


function openDetailModal(alumni) {
  modalDetail.classList.remove('hidden');
  void modalDetail.offsetWidth;
  modalDetailContent.classList.remove('scale-95', 'opacity-0');
  modalDetailContent.classList.add('scale-100', 'opacity-100');
  
  document.getElementById('detail-nama').textContent = alumni.nama || '-';
  document.getElementById('detail-stambuk').textContent = `Stambuk: ${alumni.stambuk || '-'} | NISN: ${alumni.nisn || '-'}`;
  
  const statusEl = document.getElementById('detail-status');
  statusEl.textContent = (alumni.status_akhir || '-').toUpperCase();

  const khidmahBadge = document.getElementById('detail-khidmah-badge');
  if (alumni.khidmah === 'sedang') {
    khidmahBadge.textContent = 'SEDANG KHIDMAH';
    khidmahBadge.className = 'inline-block px-2.5 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs font-semibold ml-2';
    khidmahBadge.classList.remove('hidden');
  } else if (alumni.khidmah === 'selesai') {
    khidmahBadge.textContent = 'SELESAI KHIDMAH';
    khidmahBadge.className = 'inline-block px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-semibold ml-2';
    khidmahBadge.classList.remove('hidden');
  } else {
    khidmahBadge.classList.add('hidden');
  }

  document.getElementById('detail-asal').textContent = alumni.asal_daerah || '-';
  document.getElementById('detail-tingkatan').textContent = alumni.tingkatan_akhir || '-';

  // TTL
  let ttlText = '-';
  if (alumni.ttl_tempat || alumni.ttl_tanggal) {
    const parts = [];
    if (alumni.ttl_tempat) parts.push(alumni.ttl_tempat);
    if (alumni.ttl_tanggal) {
      const d = new Date(alumni.ttl_tanggal);
      if (!Number.isNaN(d.getTime())) parts.push(d.toLocaleDateString('id-ID'));
    }
    ttlText = parts.join(', ');
  }
  document.getElementById('detail-ttl').textContent = ttlText;

  // Wali & kontak
  document.getElementById('detail-wali').textContent = alumni.nama_wali || '-';
  document.getElementById('detail-nohp').textContent = alumni.no_hp_wali || '-';
  document.getElementById('detail-alamat').textContent = alumni.alamat || '-';

  // Riwayat
  document.getElementById('detail-kamar').textContent = alumni.kamar || '-';
  document.getElementById('detail-tahun-masuk').textContent = alumni.tahun_masuk || '-';
  document.getElementById('detail-tahun-keluar').textContent = alumni.tahun_keluar || '-';
  document.getElementById('detail-tempat-khidmah').textContent = alumni.tempat_khidmah || '-';

  // Status & Ijazah
  const keteranganMap = { 'menikah': 'Menikah', 'membantu_ortu': 'Membantu Orang Tua', 'bekerja': 'Bekerja', 'kuliah': 'Kuliah', 'lainnya': 'Lainnya' };
  document.getElementById('detail-keterangan').textContent = keteranganMap[alumni.keterangan] || alumni.keterangan || '-';
  const ijazahMap = { 'belum': 'Belum', 'sudah': 'Sudah', 'tidak': 'Tidak (Tidak Diambil)' };
  document.getElementById('detail-ijazah-status').textContent = ijazahMap[alumni.status_ijazah] || alumni.status_ijazah || '-';
  document.getElementById('detail-alasan-ijazah').textContent = alumni.alasan_ijazah_belum_diambil || '-';
  document.getElementById('detail-no-ijazah').textContent = alumni.no_ijazah || '-';
}

function openEditModal(alumni) {
  modalEdit.classList.remove('hidden');
  void modalEdit.offsetWidth;
  modalEditContent.classList.remove('scale-95', 'opacity-0');
  modalEditContent.classList.add('scale-100', 'opacity-100');
  
  document.getElementById('detail-id').value = alumni.santri_id;
  
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal('edit-alumni-nama', alumni.nama || '');
  setVal('edit-alumni-ttl-tempat', alumni.ttl_tempat || '');
  
  let ttlISO = '';
  if (alumni.ttl_tanggal) {
    const d = new Date(alumni.ttl_tanggal);
    if (!Number.isNaN(d.getTime())) ttlISO = d.toISOString().slice(0, 10);
  }
  setVal('edit-alumni-ttl-tanggal', ttlISO);
  setVal('edit-alumni-wali', alumni.nama_wali || '');
  setVal('edit-alumni-nohp', alumni.no_hp_wali || '');
  setVal('edit-alumni-alamat', alumni.alamat || '');
  setVal('edit-alumni-kamar', alumni.kamar || '');
  setVal('edit-alumni-tahun-masuk', alumni.tahun_masuk || '');
  setVal('edit-alumni-tahun-keluar', alumni.tahun_keluar || '');
  setVal('edit-alumni-tempat-khidmah', alumni.tempat_khidmah || '');

  // Asal Daerah dan Tingkatan Akhir Override
  setVal('edit-alumni-asal-daerah', alumni.asal_daerah || '');
  setVal('edit-alumni-tingkatan-akhir', alumni.tingkatan_akhir || '');

  // Form fields status & ijazah
  document.getElementById('input-status-khidmah').value = alumni.khidmah || 'belum';
  document.getElementById('input-keterangan').value = alumni.keterangan || '';
  document.getElementById('input-ijazah-status').value = alumni.status_ijazah || 'belum';
  document.getElementById('input-ijazah').value = alumni.no_ijazah || '';
  document.getElementById('input-alasan-ijazah').value = alumni.alasan_ijazah_belum_diambil || '';
  
  // Update alasan ijazah visibility
  const alasanGroup = document.getElementById('group-alasan-ijazah');
  if (alumni.status_ijazah === 'belum' || alumni.status_ijazah === 'tidak') {
    alasanGroup.classList.remove('hidden');
  } else {
    alasanGroup.classList.add('hidden');
  }
}

function closeDetailModal() {
  modalDetailContent.classList.remove('scale-100', 'opacity-100');
  modalDetailContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modalDetail.classList.add('hidden'), 300);
}

function closeEditModal() {
  modalEditContent.classList.remove('scale-100', 'opacity-100');
  modalEditContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modalEdit.classList.add('hidden'), 300);
}

const btnTutupDetail = document.querySelector('.btn-tutup-detail');
if(btnTutupDetail) btnTutupDetail.addEventListener('click', closeDetailModal);
btnDetailClose.addEventListener('click', closeDetailModal);
modalDetailOverlay.addEventListener('click', closeDetailModal);

btnEditClose.addEventListener('click', closeEditModal);
modalEditOverlay.addEventListener('click', closeEditModal);

const inputIjazahStatus = document.getElementById('input-ijazah-status');
if (inputIjazahStatus) {
  inputIjazahStatus.addEventListener('change', (e) => {
    const alasanGroup = document.getElementById('group-alasan-ijazah');
    if (e.target.value === 'belum' || e.target.value === 'tidak') {
      alasanGroup.classList.remove('hidden');
    } else {
      alasanGroup.classList.add('hidden');
    }
  });
}

formUpdateAlumni.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('modal-detail-error');
  errorEl.classList.add('hidden');

  const santriId = parseInt(document.getElementById('detail-id').value);
  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const nama = getVal('edit-alumni-nama');
  if (!nama) {
    errorEl.textContent = 'Nama alumni wajib diisi.';
    errorEl.classList.remove('hidden');
    return;
  }
  const payload = {
    santri_id: santriId,
    status_ijazah: document.getElementById('input-ijazah-status').value,
    no_ijazah: document.getElementById('input-ijazah').value,
    khidmah: document.getElementById('input-status-khidmah').value,
    keterangan: document.getElementById('input-keterangan').value,
    // Biodata inti (memicu update tabel santri di backend).
    nama: nama,
    ttl_tempat: getVal('edit-alumni-ttl-tempat'),
    ttl_tanggal: getVal('edit-alumni-ttl-tanggal'),
    nama_wali: getVal('edit-alumni-wali'),
    no_hp_wali: getVal('edit-alumni-nohp'),
    alamat: getVal('edit-alumni-alamat'),
    kamar: getVal('edit-alumni-kamar'),
    tahun_masuk: getVal('edit-alumni-tahun-masuk'),
    tahun_keluar: getVal('edit-alumni-tahun-keluar'),
    tempat_khidmah: getVal('edit-alumni-tempat-khidmah')
  };

  try {
    const res = await fetch('/api/alumni/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Gagal menyimpan');
    }
    closeEditModal();
    loadAlumni();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

// ==================== IMPORT ALUMNI EXCEL ====================
const btnImportAlumni = document.getElementById('btn-import-alumni');
const inputImportFile = document.getElementById('input-import-file');

btnImportAlumni?.addEventListener('click', () => inputImportFile?.click());

inputImportFile?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  if (!allowedTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    alert('File harus berformat Excel (.xlsx)');
    inputImportFile.value = '';
    return;
  }

  if (!confirm(`Import data alumni dari "${file.name}"?\n\nPastikan kolom header sesuai (Nama, NIK, Stambuk, dll). Duplikat NIK akan di-skip.`)) {
    inputImportFile.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  btnImportAlumni.disabled = true;
  btnImportAlumni.innerHTML = '<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Mengimpor...';

  try {
    const res = await fetch('/api/alumni/import', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Import gagal');
    }
    const result = await res.json();
    let msg = `Import selesai!\n\nTotal baris: ${result.total}\nBerhasil: ${result.inserted}\nDilewati: ${result.skipped}`;
    if (result.errors && result.errors.length > 0) {
      msg += '\n\nDetail yang dilewati:\n' + result.errors.slice(0, 10).join('\n');
      if (result.errors.length > 10) msg += `\n... dan ${result.errors.length - 10} lainnya`;
    }
    alert(msg);
    loadAlumni(); // Reload daftar alumni
  } catch (err) {
    alert('Error import: ' + err.message);
  } finally {
    btnImportAlumni.disabled = false;
    btnImportAlumni.innerHTML = '<i data-lucide="arrow-up-from-line" class="w-4 h-4"></i><span class="hidden md:inline">Upload</span>';
    inputImportFile.value = '';
  }
});

// Run
checkAuth();

// ES module exports for tests (jsdom/Vitest) and any module consumers.
// Pages load this file with <script type="module">, so named exports do not
// break plain-page usage; browser behavior still relies on the DOM wiring above.
export { renderPengabdianRow, canShowSelesaiKhidmah, isKelasAkhir };


// ==================== TAMBAH ALUMNI MANUAL ====================
const btnTambahAlumni = document.getElementById('btn-tambah-alumni');
const modalTambahAlumni = document.getElementById('modal-tambah-alumni');
const modalTambahAlumniContent = document.getElementById('modal-tambah-alumni-content');
const formTambahAlumni = document.getElementById('form-tambah-alumni');

function openTambahAlumniModal() {
  modalTambahAlumni.classList.remove('hidden');
  void modalTambahAlumniContent.offsetWidth;
  modalTambahAlumniContent.classList.remove('scale-95', 'opacity-0');
  modalTambahAlumniContent.classList.add('scale-100', 'opacity-100');
  formTambahAlumni.reset();
  document.getElementById('modal-tambah-alumni-error').classList.add('hidden');
}

function closeTambahAlumniModal() {
  modalTambahAlumniContent.classList.remove('scale-100', 'opacity-100');
  modalTambahAlumniContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modalTambahAlumni.classList.add('hidden'), 300);
}

btnTambahAlumni?.addEventListener('click', openTambahAlumniModal);
document.getElementById('modal-tambah-alumni-close')?.addEventListener('click', closeTambahAlumniModal);
document.getElementById('modal-tambah-alumni-cancel')?.addEventListener('click', closeTambahAlumniModal);
document.getElementById('modal-tambah-alumni-overlay')?.addEventListener('click', closeTambahAlumniModal);

formTambahAlumni?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('modal-tambah-alumni-error');
  errorEl.classList.add('hidden');

  const fd = new FormData(formTambahAlumni);
  const nama = fd.get('nama')?.trim();
  const stambuk = fd.get('stambuk')?.trim();

  if (!nama || !stambuk) {
    errorEl.textContent = 'Nama dan Stambuk wajib diisi.';
    errorEl.classList.remove('hidden');
    return;
  }

  const payload = {
    nama: nama,
    stambuk: stambuk,
    nisn: fd.get('nisn')?.trim() || '',
    ttl: fd.get('ttl')?.trim() || '',
    wali: fd.get('wali')?.trim() || '',
    alamat: fd.get('alamat')?.trim() || '',
    no_hp: fd.get('no_hp')?.trim() || '',
    khidmah: fd.get('khidmah') || 'tidak_khidmah',
    tempat_khidmah: fd.get('tempat_khidmah')?.trim() || '',
    status_ijazah: fd.get('status_ijazah') || 'belum',
    keterangan: fd.get('keterangan')?.trim() || '',
    tahun_masuk: fd.get('tahun_masuk')?.trim() || '',
    tahun_keluar: fd.get('tahun_keluar')?.trim() || ''
  };

  const btn = formTambahAlumni.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const res = await fetch('/api/alumni/tambah-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menyimpan');
    closeTambahAlumniModal();
    loadAlumni();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan Alumni';
  }
});

console.log('Cache bust 1');

// === EXPORT ALUMNI & PENGABDIAN KE EXCEL (ExcelJS) ===
const BORDER_THIN = { style: 'thin', color: { argb: 'FFCCCCCC' } };
const FILL_TEAL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7C86' } };

function dlBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function safe(s) { return (s || '').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_'); }

const _htmlMap = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
function dh(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, m => _htmlMap[m] || m);
}

function formatTgl(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function buildWorkbook(title, headers, dataRows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIM Mubtadiat';
  const ws = wb.addWorksheet('Data');
  const colCount = headers.length;

  // Row 1: Title
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = dh(title);
  titleRow.getCell(1).font = { bold: true, size: 14 };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 28;
  ws.mergeCells(1, 1, 1, colCount);

  // Row 2: Info
  const infoRow = ws.getRow(2);
  infoRow.getCell(1).value = `Total: ${dataRows.length} data  |  Diunduh: ${new Date().toLocaleDateString('id-ID')}`;
  infoRow.getCell(1).font = { size: 10, color: { argb: 'FF444444' } };

  // Row 3: blank

  // Row 4: Headers
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

  // Data rows
  dataRows.forEach(row => {
    const r = ws.addRow(row);
    r.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
      cell.alignment = { horizontal: (colNum <= 2 ? 'left' : 'center'), vertical: 'middle' };
      cell.font = { size: 10 };
      if (typeof cell.value === 'string') cell.value = dh(cell.value);
    });
  });

  // Column widths
  ws.columns.forEach((col, i) => {
    col.width = i === 0 ? 5 : (i === 1 ? 25 : (i === 2 ? 15 : 16));
  });

  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return wb;
}

async function doExport(title, headers, dataRows, filename) {
  const wb = await buildWorkbook(title, headers, dataRows);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  dlBlob(blob, filename);
}

// === DOWNLOAD ALUMNI ===
async function downloadAlumni() {
  const btn = document.getElementById('btn-download-alumni');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }
  try {
    const params = new URLSearchParams();
    if (filterProvinsi && filterProvinsi.value) params.set('provinsi', filterProvinsi.value);
    if (filterKabupaten && filterKabupaten.value) params.set('kabupaten', filterKabupaten.value);
    const qs = params.toString();
    const url = qs ? `/api/alumni?${qs}` : '/api/alumni';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Gagal memuat data alumni');
    let data = await res.json();
    if (!Array.isArray(data)) data = [];

    // Apply same filters as table
    const tm = filterTahunMasuk && filterTahunMasuk.value ? filterTahunMasuk.value.trim() : '';
    const tk = filterTahunKeluar && filterTahunKeluar.value ? filterTahunKeluar.value.trim() : '';
    if (tm || tk) {
      data = data.filter(a => {
        if (tm && a.tahun_masuk !== tm) return false;
        if (tk && a.tahun_keluar !== tk) return false;
        return true;
      });
    }

    const headers = ['No', 'Nama', 'Stambuk', 'NISN', 'TTL', 'Tingkatan Akhir', 'Status Keluar', 'Kamar', 'Asal Daerah', 'Provinsi', 'Kabupaten', 'Tahun Masuk', 'Tahun Keluar', 'Nama Wali', 'No. HP Wali', 'Alamat', 'Tempat Khidmah', 'Status Ijazah', 'No. Ijazah', 'Keterangan', 'Alasan Ijazah'];
    const statusMap = { lulus: 'Lulus', boyong: 'Boyong', keluar: 'Dikeluarkan', dikeluarkan: 'Dikeluarkan' };
    const ijazahMap = { belum: 'Belum', sudah: 'Sudah', tidak: 'Tidak' };
    const keteranganMap = { menikah: 'Menikah', membantu_ortu: 'Membantu Orang Tua', bekerja: 'Bekerja', kuliah: 'Kuliah', lainnya: 'Lainnya' };

    const dataRows = data.map((a, idx) => {
      let ttl = '';
      if (a.ttl_tempat || a.ttl_tanggal) {
        const parts = [];
        if (a.ttl_tempat) parts.push(a.ttl_tempat);
        if (a.ttl_tanggal) parts.push(formatTgl(a.ttl_tanggal));
        ttl = parts.join(', ');
      }
      return [
        idx + 1,
        a.nama || '-',
        a.stambuk || '-',
        a.nisn || '-',
        ttl || '-',
        a.tingkatan_akhir || '-',
        statusMap[a.status_akhir] || a.status_akhir || '-',
        a.kamar || '-',
        a.asal_daerah || '-',
        a.provinsi_nama || '-',
        a.kabupaten_nama || '-',
        a.tahun_masuk || '-',
        a.tahun_keluar || '-',
        a.nama_wali || '-',
        a.no_hp_wali || '-',
        a.alamat || '-',
        a.tempat_khidmah || '-',
        ijazahMap[a.status_ijazah] || a.status_ijazah || '-',
        a.no_ijazah || '-',
        keteranganMap[a.keterangan] || a.keterangan || '-',
        a.alasan_ijazah_belum_diambil || '-'
      ];
    });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    await doExport('Data Alumni', headers, dataRows, `Data_Alumni_${dateStr}.xlsx`);
  } catch (err) {
    alert('Gagal download alumni: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="arrow-down-to-line" class="w-4 h-4"></i><span class="hidden md:inline">Download</span>'; if (window.lucide) lucide.createIcons(); }
  }
}

// === DOWNLOAD PENGABDIAN ===
async function downloadPengabdian() {
  const btn = document.getElementById('btn-download-pengabdian');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }
  try {
    const res = await fetch('/api/pengabdian');
    if (!res.ok) throw new Error('Gagal memuat data pengabdian');
    let data = await res.json();
    if (!Array.isArray(data)) data = [];

    const headers = ['No', 'Nama', 'Stambuk', 'Tempat Khidmah', 'Mulai Khidmah'];
    const dataRows = data.map((item, idx) => [
      idx + 1,
      item.nama || '-',
      item.stambuk || '-',
      item.khidmah_tempat || '-',
      item.khidmah_mulai ? formatTgl(item.khidmah_mulai) : '-'
    ]);

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    await doExport('Data Pengabdian (Khidmah)', headers, dataRows, `Data_Pengabdian_${dateStr}.xlsx`);
  } catch (err) {
    alert('Gagal download pengabdian: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="arrow-down-to-line" class="w-4 h-4"></i><span class="hidden md:inline">Download</span>'; if (window.lucide) lucide.createIcons(); }
  }
}

// Wire download buttons
const btnDownloadAlumni = document.getElementById('btn-download-alumni');
const btnDownloadPengabdian = document.getElementById('btn-download-pengabdian');
if (btnDownloadAlumni) btnDownloadAlumni.addEventListener('click', downloadAlumni);
if (btnDownloadPengabdian) btnDownloadPengabdian.addEventListener('click', downloadPengabdian);

// === UPLOAD / IMPORT PENGABDIAN ===
const btnImportPengabdian = document.getElementById('btn-import-pengabdian');
const inputImportPengabdian = document.getElementById('input-import-pengabdian');
if (btnImportPengabdian) btnImportPengabdian.addEventListener('click', () => inputImportPengabdian?.click());
if (inputImportPengabdian) {
  inputImportPengabdian.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      btnImportPengabdian.disabled = true;
      btnImportPengabdian.textContent = 'Mengupload...';
      const res = await fetch('/api/pengabdian/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal import');
      alert(`Import selesai: ${data.success} berhasil, ${data.failed} gagal dari ${data.total} total.${data.errors?.length ? '\n\nDetail:\n' + data.errors.join('\n') : ''}`);
      loadPengabdian();
    } catch (err) {
      alert('Gagal import pengabdian: ' + err.message);
    } finally {
      btnImportPengabdian.disabled = false;
      btnImportPengabdian.innerHTML = '<i data-lucide="upload" class="w-4 h-4"></i><span class="hidden md:inline">Upload</span>';
      if (window.lucide) lucide.createIcons();
      inputImportPengabdian.value = '';
    }
  });
}

// === TAMBAH PENGABDIAN MANUAL ===
const modalTambahPengabdian = document.getElementById('modal-tambah-pengabdian');
const btnTambahPengabdian = document.getElementById('btn-tambah-pengabdian');
const btnPengabdianCancel = document.getElementById('btn-pengabdian-cancel');
const formTambahPengabdian = document.getElementById('form-tambah-pengabdian');
const pengabdianError = document.getElementById('pengabdian-error');
const pengabdianSuccess = document.getElementById('pengabdian-success');

if (btnTambahPengabdian) {
  btnTambahPengabdian.addEventListener('click', () => {
    modalTambahPengabdian?.classList.remove('hidden');
    modalTambahPengabdian?.classList.add('flex');
    pengabdianError?.classList.add('hidden');
    pengabdianSuccess?.classList.add('hidden');
  });
}
if (btnPengabdianCancel) {
  btnPengabdianCancel.addEventListener('click', () => {
    modalTambahPengabdian?.classList.add('hidden');
    modalTambahPengabdian?.classList.remove('flex');
    formTambahPengabdian?.reset();
  });
}

if (formTambahPengabdian) {
  formTambahPengabdian.addEventListener('submit', async (e) => {
    e.preventDefault();
    pengabdianError?.classList.add('hidden');
    pengabdianSuccess?.classList.add('hidden');
    const fd = new FormData(formTambahPengabdian);
    const nama = document.getElementById('input-pengabdian-nama')?.value || '';

    // Resolve santri_id from name
    const pool = allSantri || [];
    const match = pool.find(s => s.nama && s.nama.toLowerCase() === nama.toLowerCase());
    if (!match) {
      pengabdianError.textContent = 'Santri tidak ditemukan. Pilih dari daftar.';
      pengabdianError.classList.remove('hidden');
      return;
    }

    const payload = {
      santri_id: match.id,
      khidmah_tempat: fd.get('khidmah_tempat'),
      khidmah_mulai: fd.get('khidmah_mulai')
    };

    const btn = formTambahPengabdian.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    try {
      const res = await fetch('/api/pengabdian/mulai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menambah pengabdian');
      pengabdianSuccess.textContent = data.message || 'Pengabdian berhasil ditambahkan';
      pengabdianSuccess.classList.remove('hidden');
      formTambahPengabdian.reset();
      setTimeout(() => {
        modalTambahPengabdian?.classList.add('hidden');
        modalTambahPengabdian?.classList.remove('flex');
        loadPengabdian();
      }, 1500);
    } catch (err) {
      pengabdianError.textContent = err.message;
      pengabdianError.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  });
}
