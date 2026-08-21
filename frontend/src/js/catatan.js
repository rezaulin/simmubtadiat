// frontend/src/js/catatan.js
// Halaman khusus Pelanggaran & Prestasi. Data dari API sudah di-escape global
// oleh xss.js, jadi nilai disisipkan apa adanya (tanpa escape ganda).

const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const btnAdd = document.getElementById('btn-add');

const modalDetail = document.getElementById('modal-detail-catatan');
const modalDetailOverlay = document.getElementById('modal-detail-overlay');
const btnCloseDetail = document.getElementById('btn-close-detail');
const detailSantriName = document.getElementById('detail-santri-name');
const detailTableBody = document.getElementById('detail-table-body');

// Filters
const filterTingkatan = document.getElementById('filter-tingkatan');
const filterKelas = document.getElementById('filter-kelas');
const filterBagian = document.getElementById('filter-bagian');
const btnResetFilter = document.getElementById('btn-reset-filter');

// Apply theme
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

let currentRole = '';
let currentRoles = [];
let canWrite = false;
let allSantri = [];
let cachedCatatan = [];
let cachedBagian = [];
let searchTimer = null;

async function init() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) { window.location.href = '/login.html'; return; }
    const me = await res.json();
    currentRole = me.role || '';
    currentRoles = me.roles || [me.role];

    await loadBagianOptions();
    await loadCatatan();
  } catch (e) {
    console.error('Init failed', e);
  }
}

async function loadBagianOptions() {
  try {
    const isMustahiqOnly = (currentRoles.includes('mustahiq') || currentRoles.includes('mufatish')) && !currentRoles.includes('pimpinan') && !currentRoles.includes('admin') && !currentRoles.includes('keamanan');
    const endpoint = isMustahiqOnly ? '/api/penilaian/bagian' : '/api/akademik/bagian';
    const res = await fetch(endpoint);
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      cachedBagian = data;
      populateFilterTingkatan();
    }
  } catch (e) {
    console.error('Gagal memuat bagian', e);
  }
}

function populateFilterTingkatan() {
  if (!filterTingkatan) return;
  filterTingkatan.innerHTML = '<option value="">-- Semua Tingkatan --</option>';
  const unique = [...new Set(cachedBagian.map(b => b.tingkatan).filter(Boolean))];
  unique.forEach(t => filterTingkatan.innerHTML += `<option value="${t}">${t}</option>`);
  populateFilterKelas();
}

function populateFilterKelas() {
  if (!filterKelas) return;
  const tVal = filterTingkatan ? filterTingkatan.value : '';
  const prev = filterKelas.value;
  const source = tVal ? cachedBagian.filter(b => b.tingkatan === tVal) : cachedBagian;
  const unique = [...new Set(source.map(b => b.kelas).filter(Boolean))];
  filterKelas.innerHTML = '<option value="">-- Semua Kelas --</option>';
  unique.forEach(k => filterKelas.innerHTML += `<option value="${k}">${k}</option>`);
  if (prev && unique.includes(prev)) filterKelas.value = prev;
  populateFilterBagian();
}

function populateFilterBagian() {
  if (!filterBagian) return;
  const tVal = filterTingkatan ? filterTingkatan.value : '';
  const kVal = filterKelas ? filterKelas.value : '';
  const prev = filterBagian.value;
  let source = cachedBagian;
  if (tVal) source = source.filter(b => b.tingkatan === tVal);
  if (kVal) source = source.filter(b => b.kelas === kVal);
  
  const unique = [...new Set(source.map(b => b.nama_bagian).filter(Boolean))];
  filterBagian.innerHTML = '<option value="">-- Semua Bagian --</option>';
  unique.forEach(nama => filterBagian.innerHTML += `<option value="${nama}">${nama}</option>`);
  if (prev && unique.includes(prev)) filterBagian.value = prev;
  filterCatatan();
}

if (filterTingkatan) filterTingkatan.addEventListener('change', populateFilterKelas);
if (filterKelas) filterKelas.addEventListener('change', populateFilterBagian);
if (filterBagian) filterBagian.addEventListener('change', filterCatatan);

if (btnResetFilter) {
  btnResetFilter.addEventListener('click', () => {
    if (filterTingkatan) filterTingkatan.value = '';
    populateFilterKelas(); 
  });
}

async function loadCatatan() {
  tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Memuat data...</td></tr>`;
  try {
    const res = await fetch(`/api/catatan`);
    if (!res.ok) throw new Error('Gagal memuat catatan');
    cachedCatatan = (await res.json()) || [];
    filterCatatan();
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-red-500">${e.message}</td></tr>`;
  }
}

function filterCatatan() {
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const tVal = filterTingkatan ? filterTingkatan.value : '';
  const kVal = filterKelas ? filterKelas.value : '';
  const bVal = filterBagian ? filterBagian.value : '';

  let list = cachedCatatan;
  if (q) list = list.filter(c => (c.santri_nama || '').toLowerCase().includes(q));
  if (tVal) list = list.filter(c => c.tingkatan === tVal);
  if (kVal) list = list.filter(c => c.kelas === kVal);
  if (bVal) list = list.filter(c => c.bagian_nama === bVal);

  renderRows(list);
}

function renderRows(list) {
  if (!list || list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Belum ada catatan.</td></tr>`;
    return;
  }
  tableBody.innerHTML = '';
  list.forEach((c) => {
    let infoArr = [];
    if (c.tingkatan) infoArr.push(c.tingkatan);
    if (c.kelas) infoArr.push(c.kelas);
    if (c.bagian_nama) infoArr.push(c.bagian_nama);
    
    const bagian = infoArr.length > 0 
      ? `<div class="text-xs font-medium text-gray-500 mt-0.5">${infoArr.join(' - ')}</div>` 
      : '';
    const btnRiwayat = `<button data-riwayat="${c.santri_id}" data-nama="${c.santri_nama}" class="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition-colors">Riwayat</button>`;
    tableBody.innerHTML += `
      <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
        <td data-label="Santri" class="px-6 py-4">
          <div class="font-semibold text-gray-800 dark:text-gray-200">${c.santri_nama || '-'}</div>
          ${bagian}
        </td>
        <td data-label="Total Pelanggaran" class="px-6 py-4 text-center font-bold text-red-600 dark:text-red-400">${c.total_pelanggaran || 0}</td>
        <td data-label="Total Prestasi" class="px-6 py-4 text-center font-bold text-green-600 dark:text-green-400">${c.total_prestasi || 0}</td>
        <td data-label="Aksi" class="px-6 py-4 text-right">
          <div class="flex justify-end gap-2">
            ${btnRiwayat}
          </div>
        </td>
      </tr>`;
  });
}

// Filter & search
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(filterCatatan, 300);
  });
}

// Aksi (Riwayat)
tableBody.addEventListener('click', (e) => {
  const btnRiwayat = e.target.closest('[data-riwayat]');
  if (btnRiwayat) {
    const santriId = btnRiwayat.getAttribute('data-riwayat');
    const santriNama = btnRiwayat.getAttribute('data-nama');
    openRiwayatModal(santriId, santriNama);
    return;
  }
});

async function openRiwayatModal(santriId, santriNama) {
  if (!modalDetail) return;
  detailSantriName.textContent = santriNama;
  detailTableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">Memuat data...</td></tr>`;
  modalDetail.classList.remove('hidden');

  try {
    const res = await fetch(`/api/catatan?santri_id=${santriId}`);
    if (!res.ok) throw new Error('Gagal memuat detail');
    const data = await res.json() || [];
    renderDetailRows(data, santriId);
  } catch (err) {
    detailTableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">${err.message}</td></tr>`;
  }
}

function renderDetailRows(list, santriId) {
  if (!list || list.length === 0) {
    detailTableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">Belum ada catatan.</td></tr>`;
    return;
  }
  detailTableBody.innerHTML = '';
  list.forEach(c => {
    const isPel = c.jenis === 'pelanggaran';
    const badge = isPel
      ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Pelanggaran</span>'
      : '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Prestasi</span>';
    detailTableBody.innerHTML += `
      <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
        <td class="px-6 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400 text-xs">${c.tanggal}</td>
        <td class="px-6 py-3">${badge}</td>
        <td class="px-6 py-3 text-gray-600 dark:text-gray-300 text-xs">${c.kategori || '-'}</td>
        <td class="px-6 py-3 text-gray-600 dark:text-gray-300 text-xs max-w-xs"><div class="whitespace-pre-line">${c.deskripsi}</div></td>
        <td class="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">${c.pencatat || '-'}</td>
      </tr>`;
  });
}

function closeDetailModal() {
  if (modalDetail) modalDetail.classList.add('hidden');
}

if (btnCloseDetail) btnCloseDetail.addEventListener('click', closeDetailModal);
if (modalDetailOverlay) modalDetailOverlay.addEventListener('click', closeDetailModal);

init();
