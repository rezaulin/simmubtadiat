// frontend/src/js/pengajar-purna.js
//
// Halaman "Data Pengajar Purna" — arsip pengajar lama (mustahiq/munawwib).
// Hanya admin & pimpinan yang boleh mengakses (RBAC sebenarnya ada di router
// Go: GET/POST/PUT/DELETE /api/pengajar-purna di-guard RequireRoles).
// Tombol tulis (tambah/import/export/template) hanya ditampilkan untuk
// Peran_Tulis (window.isAdminRole).

// ==================== ELEMENTS ====================
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');

const btnTambah = document.getElementById('btn-tambah');
const btnImport = document.getElementById('btn-import');
const btnExport = document.getElementById('btn-export');
const btnTemplate = document.getElementById('btn-template');
const inputImportFile = document.getElementById('input-import-file');

// Filter
const filterProvinsi = document.getElementById('filter-provinsi');
const filterKabupaten = document.getElementById('filter-kabupaten');
const filterStatus = document.getElementById('filter-status');
const filterTahunMasuk = document.getElementById('filter-tahun-masuk');
const filterTahunKeluar = document.getElementById('filter-tahun-keluar');
const btnResetFilter = document.getElementById('btn-reset-filter');

// Modal tambah/edit
const modalForm = document.getElementById('modal-form');
const modalFormContent = document.getElementById('modal-form-content');
const modalFormOverlay = document.getElementById('modal-form-overlay');
const modalFormClose = document.getElementById('modal-form-close');
const modalFormCancel = document.getElementById('modal-form-cancel');
const modalTitle = document.getElementById('modal-title');
const formPengajarPurna = document.getElementById('form-pengajar-purna');
const modalFormError = document.getElementById('modal-form-error');

const formId = document.getElementById('form-id');
const formNama = document.getElementById('form-nama');
const formStatus = document.getElementById('form-status');
const formNoHp = document.getElementById('form-no-hp');
const formTtl = document.getElementById('form-ttl');
const formNamaWali = document.getElementById('form-nama-wali');
const formProvinsi = document.getElementById('form-provinsi');
const formKabupaten = document.getElementById('form-kabupaten');
const formAlamat = document.getElementById('form-alamat');
const formTahunMengajar = document.getElementById('form-tahun-mengajar');
const formTahunKeluar = document.getElementById('form-tahun-keluar');

// Peran pengguna saat ini (diisi oleh checkAuth). Menentukan gating tombol.
let currentRole = null;
// Cache data terakhir (dipakai tombol Edit tanpa fetch ulang).
let currentData = [];

// Apply Theme (samakan dengan halaman lain)
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

// ==================== HELPERS ====================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  // Data API sudah disanitasi secara global oleh xss.js.
  // Hindari escaping ganda agar entitas HTML (seperti &#39;) tidak rusak.
  return String(str);
}

// Bangun query string filter (dipakai daftar & tautan export).
function buildFilterParams() {
  const params = new URLSearchParams();
  if (filterProvinsi && filterProvinsi.value) params.set('provinsi', filterProvinsi.value);
  if (filterKabupaten && filterKabupaten.value) params.set('kabupaten', filterKabupaten.value);
  if (filterStatus && filterStatus.value) params.set('status', filterStatus.value);
  if (filterTahunMasuk && filterTahunMasuk.value.trim()) params.set('tahun_masuk', filterTahunMasuk.value.trim());
  if (filterTahunKeluar && filterTahunKeluar.value.trim()) params.set('tahun_keluar', filterTahunKeluar.value.trim());
  return params;
}

// Sinkronkan href tombol Export agar menghormati filter yang aktif.
function syncExportLink() {
  if (!btnExport) return;
  const qs = buildFilterParams().toString();
  btnExport.href = qs ? `/api/pengajar-purna/export?${qs}` : '/api/pengajar-purna/export';
}

// ==================== AUTH ====================
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await response.json();
    currentRole = data.role;

    // Tombol tulis hanya untuk admin/pimpinan.
    if (window.isAdminRole(data.role)) {
      btnTambah?.classList.remove('hidden');
      btnImport?.classList.remove('hidden');
      btnExport?.classList.remove('hidden');
      btnTemplate?.classList.remove('hidden');
    }

    // Muat wilayah untuk filter + modal, lalu data, lalu deep-link #id dari
    // pencarian global (membuka modal detail otomatis).
    await loadProvinsiOptions();
    await loadData();
    openDetailFromHash();
  } catch (err) {
    console.error('Auth check failed:', err);
  }
}

// ==================== WILAYAH ====================
// Muat daftar provinsi sekali, lalu isi kedua select (filter & modal).
async function loadProvinsiOptions() {
  try {
    const res = await fetch('/api/wilayah/provinsi');
    const list = await res.json();
    if (!res.ok || !Array.isArray(list)) return;

    if (filterProvinsi) {
      filterProvinsi.innerHTML = '<option value="">-- Semua Provinsi --</option>';
    }
    if (formProvinsi) {
      formProvinsi.innerHTML = '<option value="">-- Pilih Provinsi --</option>';
    }
    list.forEach(p => {
      if (filterProvinsi) {
        const o1 = document.createElement('option');
        o1.value = p.kode; o1.textContent = p.nama;
        filterProvinsi.appendChild(o1);
      }
      if (formProvinsi) {
        const o2 = document.createElement('option');
        o2.value = p.kode; o2.textContent = p.nama;
        formProvinsi.appendChild(o2);
      }
    });
  } catch (err) {
    console.error('Gagal memuat provinsi:', err);
  }
}

// Muat kabupaten untuk provinsi tertentu ke dalam <select> sasaran.
// Mengembalikan Promise agar pemanggil bisa menunggu sebelum set nilai (mode edit).
async function loadKabupatenInto(selectEl, provinsiKode, placeholder) {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  if (!provinsiKode) {
    selectEl.disabled = true;
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
      selectEl.appendChild(opt);
    });
    selectEl.disabled = false;
  } catch (err) {
    console.error('Gagal memuat kabupaten:', err);
  }
}

// ==================== LOAD & RENDER ====================
async function loadData() {
  tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">Memuat data pengajar purna...</td></tr>`;
  syncExportLink();

  try {
    const qs = buildFilterParams().toString();
    const url = qs ? `/api/pengajar-purna?${qs}` : '/api/pengajar-purna';
    const response = await fetch(url);
    let data = await response.json();
    if (!response.ok) throw new Error((data && data.message) || 'Gagal memuat data');

    if (!Array.isArray(data)) data = [];

    // Pencarian nama (client-side, agar responsif).
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (q) data = data.filter(p => (p.nama || '').toLowerCase().includes(q));

    currentData = data;
    renderTable(data);
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Terjadi kesalahan: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'mustahiq') {
    return `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Mustahiq</span>`;
  }
  if (s === 'munawwib') {
    return `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">Munawwib</span>`;
  }
  return `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300">-</span>`;
}

function renderTable(list) {
  if (!list || list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">Tidak ada data pengajar purna.</td></tr>`;
    return;
  }
  const canWrite = window.isAdminRole(currentRole);
  tableBody.innerHTML = '';

  list.forEach((p, idx) => {
    const nama = escapeHtml(p.nama || '-');
    const asal = escapeHtml(p.asal_daerah && p.asal_daerah !== '' ? p.asal_daerah : '-');
    const tMengajar = escapeHtml(p.tahun_mengajar || '-');
    const tKeluar = escapeHtml(p.tahun_keluar || '-');

    const aksi = `<button class="btn-detail text-blue-500 hover:underline text-sm font-medium" data-idx="${idx}">Detail</button>` + (canWrite
      ? ` <button class="btn-edit text-emerald-500 hover:underline text-sm font-medium ml-3" data-idx="${idx}">Edit</button>
         <button class="btn-hapus text-red-500 hover:underline text-sm font-medium ml-3" data-idx="${idx}">Hapus</button>`
      : '');

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors';
    tr.innerHTML = `
      <td data-label="Nama Lengkap" class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">${nama}</td>
      <td data-label="Asal Daerah" class="px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${asal}</td>
      <td data-label="Status" class="px-6 py-4">${statusBadge(p.status)}</td>
      <td data-label="Tahun Mengajar" class="px-6 py-4 text-gray-700 dark:text-gray-300">${tMengajar}</td>
      <td data-label="Tahun Keluar" class="px-6 py-4 text-gray-700 dark:text-gray-300">${tKeluar}</td>
      <td data-label="Aksi" class="px-6 py-4 text-right">${aksi}</td>
    `;
    tableBody.appendChild(tr);
  });

  // Wire tombol Detail, Edit & Hapus.
  tableBody.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', () => openDetailModal(currentData[parseInt(btn.dataset.idx, 10)]));
  });
  tableBody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(currentData[parseInt(btn.dataset.idx, 10)]));
  });
  tableBody.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', () => hapusData(currentData[parseInt(btn.dataset.idx, 10)]));
  });
}

// ==================== MODAL DETAIL (read-only) ====================
// Modal detail disuntikkan sekali (tidak di markup) agar pimpinan — yang
// tidak punya tombol Edit/Hapus — tetap bisa melihat data lengkap.
function ensureDetailModal() {
  let m = document.getElementById('modal-detail-purna');
  if (m) return m;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="modal-detail-purna" class="hidden fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-gray-900/50 dark:bg-black/60 backdrop-blur-sm" id="modal-detail-purna-overlay"></div>
      <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-800 dark:text-white">Detail Pengajar Purna</h3>
          <button id="modal-detail-purna-close" class="tap-target text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1" aria-label="Tutup">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div id="modal-detail-purna-body" class="space-y-3"></div>
      </div>
    </div>`);
  m = document.getElementById('modal-detail-purna');
  document.getElementById('modal-detail-purna-overlay').addEventListener('click', closeDetailModal);
  document.getElementById('modal-detail-purna-close').addEventListener('click', closeDetailModal);
  return m;
}

function closeDetailModal() {
  const m = document.getElementById('modal-detail-purna');
  if (m) m.classList.add('hidden');
}

function openDetailModal(p) {
  if (!p) return;
  const m = ensureDetailModal();
  const rows = [
    ['Nama Lengkap', p.nama],
    ['Status', p.status],
    ['Tempat, Tanggal Lahir', p.ttl],
    ['Nama Wali', p.nama_wali],
    ['Nomor HP/WA', p.no_hp],
    ['Asal Daerah', p.asal_daerah],
    ['Alamat', p.alamat],
    ['Tahun Mengajar (Masuk)', p.tahun_mengajar],
    ['Tahun Keluar', p.tahun_keluar],
  ];
  const html = rows.map(([label, val]) => `
    <div class="grid grid-cols-[140px_1fr] gap-2 text-sm border-b border-gray-100 dark:border-slate-700 pb-2 last:border-0">
      <span class="text-gray-500 dark:text-gray-400 font-medium">${escapeHtml(label)}</span>
      <span class="text-gray-800 dark:text-gray-200">${escapeHtml(val != null && val !== '' ? String(val) : '-')}</span>
    </div>`).join('');
  document.getElementById('modal-detail-purna-body').innerHTML = html;
  m.classList.remove('hidden');
}
window.openDetailPurna = openDetailModal;

// Deep-link dari pencarian global: /pengajar-purna.html#<id> langsung membuka
// detail data pengajar purna tersebut.
function openDetailFromHash() {
  const id = parseInt(window.location.hash.replace('#', ''), 10);
  if (!id || !currentData || !currentData.length) return;
  const item = currentData.find(p => p.id === id);
  if (item) openDetailModal(item);
}

// ==================== FILTER WIRING ====================
if (filterProvinsi) {
  filterProvinsi.addEventListener('change', async () => {
    await loadKabupatenInto(filterKabupaten, filterProvinsi.value, '-- Semua Kabupaten --');
    loadData();
  });
}
if (filterKabupaten) filterKabupaten.addEventListener('change', loadData);
if (filterStatus) filterStatus.addEventListener('change', loadData);

let filterTimeout;
function debouncedLoad() {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(loadData, 300);
}
if (filterTahunMasuk) filterTahunMasuk.addEventListener('input', debouncedLoad);
if (filterTahunKeluar) filterTahunKeluar.addEventListener('input', debouncedLoad);
if (searchInput) searchInput.addEventListener('input', debouncedLoad);

if (btnResetFilter) {
  btnResetFilter.addEventListener('click', () => {
    if (filterProvinsi) filterProvinsi.value = '';
    if (filterKabupaten) {
      filterKabupaten.innerHTML = '<option value="">-- Semua Kabupaten --</option>';
      filterKabupaten.disabled = true;
    }
    if (filterStatus) filterStatus.value = '';
    if (filterTahunMasuk) filterTahunMasuk.value = '';
    if (filterTahunKeluar) filterTahunKeluar.value = '';
    if (searchInput) searchInput.value = '';
    loadData();
  });
}

// ==================== MODAL TAMBAH/EDIT ====================
function openModal() {
  modalForm.classList.remove('hidden');
  void modalForm.offsetWidth;
  modalFormContent.classList.remove('scale-95', 'opacity-0');
  modalFormContent.classList.add('scale-100', 'opacity-100');
  modalFormError.classList.add('hidden');
}

function closeModal() {
  modalFormContent.classList.remove('scale-100', 'opacity-100');
  modalFormContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modalForm.classList.add('hidden'), 300);
}

function resetForm() {
  formPengajarPurna.reset();
  formId.value = '';
  if (formKabupaten) {
    formKabupaten.innerHTML = '<option value="">-- Pilih Kabupaten --</option>';
    formKabupaten.disabled = true;
  }
  modalFormError.classList.add('hidden');
}

function openTambahModal() {
  resetForm();
  modalTitle.textContent = 'Tambah Pengajar Purna';
  openModal();
}

async function openEditModal(item) {
  if (!item) return;
  resetForm();
  modalTitle.textContent = 'Edit Pengajar Purna';

  formId.value = item.id;
  formNama.value = item.nama || '';
  formStatus.value = item.status || '';
  formNoHp.value = item.no_hp || '';
  formTtl.value = item.ttl || '';
  formNamaWali.value = item.nama_wali || '';
  formAlamat.value = item.alamat || '';
  formTahunMengajar.value = item.tahun_mengajar || '';
  formTahunKeluar.value = item.tahun_keluar || '';

  // Provinsi + kabupaten: set provinsi, muat kabupatennya, lalu set nilai.
  if (formProvinsi) formProvinsi.value = item.provinsi_kode || '';
  if (item.provinsi_kode) {
    await loadKabupatenInto(formKabupaten, item.provinsi_kode, '-- Pilih Kabupaten --');
    if (formKabupaten) formKabupaten.value = item.kabupaten_kode || '';
  }

  openModal();
}

if (btnTambah) btnTambah.addEventListener('click', openTambahModal);
if (modalFormClose) modalFormClose.addEventListener('click', closeModal);
if (modalFormCancel) modalFormCancel.addEventListener('click', closeModal);
if (modalFormOverlay) modalFormOverlay.addEventListener('click', closeModal);

// Ganti provinsi di modal → muat ulang kabupaten.
if (formProvinsi) {
  formProvinsi.addEventListener('change', () => {
    loadKabupatenInto(formKabupaten, formProvinsi.value, '-- Pilih Kabupaten --');
  });
}

// Ambil teks (nama) dari opsi terpilih sebuah <select>.
function selectedText(selectEl) {
  if (!selectEl || selectEl.selectedIndex < 0) return '';
  const opt = selectEl.options[selectEl.selectedIndex];
  return opt && opt.value ? opt.textContent : '';
}

formPengajarPurna.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalFormError.classList.add('hidden');

  const nama = formNama.value.trim();
  if (!nama) {
    modalFormError.textContent = 'Nama wajib diisi.';
    modalFormError.classList.remove('hidden');
    return;
  }

  // Kirim kode + nama wilayah (backend menyimpan keduanya, denormalisasi).
  const provinsiKode = formProvinsi ? formProvinsi.value : '';
  const kabupatenKode = formKabupaten ? formKabupaten.value : '';
  const payload = {
    nama: nama,
    status: formStatus.value || null,
    ttl: formTtl.value.trim() || null,
    nama_wali: formNamaWali.value.trim() || null,
    no_hp: formNoHp.value.trim() || null,
    alamat: formAlamat.value.trim() || null,
    tahun_mengajar: formTahunMengajar.value.trim() || null,
    tahun_keluar: formTahunKeluar.value.trim() || null,
    provinsi_kode: provinsiKode || null,
    provinsi_nama: provinsiKode ? (selectedText(formProvinsi) || null) : null,
    kabupaten_kode: kabupatenKode || null,
    kabupaten_nama: kabupatenKode ? (selectedText(formKabupaten) || null) : null
  };

  const id = formId.value;
  const isEdit = !!id;
  const url = isEdit ? `/api/pengajar-purna/${id}` : '/api/pengajar-purna';
  const method = isEdit ? 'PUT' : 'POST';

  const btnSubmit = formPengajarPurna.querySelector('button[type="submit"]');
  const oldText = btnSubmit.textContent;
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Menyimpan...';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Gagal menyimpan');
    closeModal();
    loadData();
  } catch (err) {
    modalFormError.textContent = err.message;
    modalFormError.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = oldText;
  }
});

// ==================== HAPUS ====================
async function hapusData(item) {
  if (!item) return;
  if (!confirm(`Hapus data pengajar purna "${item.nama}"?`)) return;
  try {
    const res = await fetch(`/api/pengajar-purna/${item.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Gagal menghapus');
    loadData();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ==================== IMPORT EXCEL ====================
if (btnImport) btnImport.addEventListener('click', () => inputImportFile?.click());

if (inputImportFile) {
  inputImportFile.addEventListener('change', async (e) => {
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

    if (!confirm(`Import data pengajar purna dari "${file.name}"?\n\nPastikan kolom header sesuai template (Nama, Status, TTL, Nama Wali, No HP, Alamat, Provinsi, Kabupaten, Tahun Mengajar, Tahun Keluar).`)) {
      inputImportFile.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    btnImport.disabled = true;
    const oldHtml = btnImport.innerHTML;
    btnImport.innerHTML = '<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Mengimpor...';

    try {
      const res = await fetch('/api/pengajar-purna/import', { method: 'POST', body: formData });
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
      loadData();
    } catch (err) {
      alert('Error import: ' + err.message);
    } finally {
      btnImport.disabled = false;
      btnImport.innerHTML = oldHtml;
      inputImportFile.value = '';
    }
  });
}

// ==================== RUN ====================
checkAuth();

// Ekspor untuk pengujian (jsdom/Vitest). Tidak memengaruhi pemakaian di halaman.
export { escapeHtml, statusBadge, buildFilterParams };
