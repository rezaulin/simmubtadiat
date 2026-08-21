// frontend/src/js/pengajar.js

// ========== MUNAWWIB ASSIGNMENT ==========
window.openModalMunawwib = (bagianId) => {
  window.currentMunawwibBagianId = bagianId;
  const modal = document.getElementById('modal-pilih-munawwib');
  const select = document.getElementById('select-munawwib-add');
  
  const currentAssigned = assignedMunawwib.filter(a => a.bagian_id == bagianId).map(a => a.pengajar_id);
  
  let opts = '<option value="">-- Pilih Munawwib --</option>';
  allPengajar.forEach(p => {
    if (p.status === 'munawwib' && !currentAssigned.includes(p.id)) {
      opts += `<option value="${p.id}">${p.nama}</option>`;
    }
  });
  select.innerHTML = opts;
  modal.classList.remove('hidden');
};

window.closeModalMunawwib = () => {
  document.getElementById('modal-pilih-munawwib').classList.add('hidden');
  window.currentMunawwibBagianId = null;
};

document.getElementById('btn-save-munawwib')?.addEventListener('click', async () => {
  const bagianId = window.currentMunawwibBagianId;
  const pengajarId = parseInt(document.getElementById('select-munawwib-add').value);
  if (!pengajarId) {
    alert("Pilih munawwib terlebih dahulu!");
    return;
  }
  
  const currentAssigned = assignedMunawwib.filter(a => a.bagian_id == bagianId).map(a => a.pengajar_id);
  currentAssigned.push(pengajarId);
  
  try {
    const res = await fetch('/api/penugasan/munawwib', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bagian_id: bagianId, pengajar_ids: currentAssigned })
    });
    if (!res.ok) throw new Error("Gagal menambah munawwib");
    
    closeModalMunawwib();
    await fetchPenugasan();
  } catch (err) {
    alert(err.message);
  }
});

window.removeMunawwib = async (bagianId, pengajarId) => {
  if (!confirm("Hapus munawwib ini dari kelas?")) return;
  try {
    const res = await fetch('/api/penugasan/munawwib', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bagian_id: bagianId, pengajar_id: pengajarId })
    });
    if (!res.ok) throw new Error("Gagal menghapus munawwib");
    await fetchPenugasan();
  } catch (err) {
    alert(err.message);
  }
};

// 1. Initial State & Elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const btnTambah = document.getElementById('btn-tambah');

// Modal Elements
const modal = document.getElementById('modal-santri'); // Note: ID in HTML is still modal-santri (for modal wrapper)
const modalContent = document.getElementById('modal-content');
const modalOverlay = document.getElementById('modal-overlay');
const btnClose = document.getElementById('modal-close');
const btnCancel = document.getElementById('btn-cancel');
const formPengajar = document.getElementById('form-pengajar');
const modalError = document.getElementById('modal-error');
const modalTitle = modalContent.querySelector('h3');

// Tab Elements
const tabData = document.getElementById('tab-data');
const tabPenugasan = document.getElementById('tab-penugasan');
const contentData = document.getElementById('content-data');
const contentPenugasan = document.getElementById('content-penugasan');

let allPengajar = [];
let editId = null;
let userRole = '';

// Tab Event Listeners
if (tabData && tabPenugasan && contentData && contentPenugasan) {
  function switchTab(activeTab, inactiveTab, activeContent, inactiveContent) {
    activeTab.classList.add('text-primary', 'dark:text-accent-emerald', 'border-primary', 'dark:border-accent-emerald');
    activeTab.classList.remove('text-gray-500', 'border-transparent');
    
    inactiveTab.classList.remove('text-primary', 'dark:text-accent-emerald', 'border-primary', 'dark:border-accent-emerald');
    inactiveTab.classList.add('text-gray-500', 'border-transparent');

    activeContent.classList.remove('hidden');
    inactiveContent.classList.add('hidden');
  }

  tabData.addEventListener('click', () => switchTab(tabData, tabPenugasan, contentData, contentPenugasan));
  tabPenugasan.addEventListener('click', () => switchTab(tabPenugasan, tabData, contentPenugasan, contentData));
}


// Apply Theme
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

// 2. Fetch User Auth to determine permissions
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await response.json();

    // Admins (Pimpinan / Admin) can manage Pengajar
    userRole = data.role;
    const roles = data.roles || [data.role];
    if (window.isAdminRole(userRole)) {
      btnTambah.classList.remove('hidden');
      const btnExport = document.getElementById('btn-export');
      const btnImport = document.getElementById('btn-import-trigger');
      if (btnExport) { 
        btnExport.classList.remove('hidden'); btnExport.classList.add('flex'); 
        btnExport.addEventListener('click', () => { window.location.href = '/api/pengajar/export'; });
      }
      if (btnImport) { btnImport.classList.remove('hidden'); btnImport.classList.add('flex'); }
    } else {
      // For just "admin" role
      if (roles.includes('admin')) {
        const btnExport = document.getElementById('btn-export');
        if (btnExport) { 
          btnExport.classList.remove('hidden'); btnExport.classList.add('flex'); 
          btnExport.addEventListener('click', () => { window.location.href = '/api/pengajar/export'; });
        }
      }
      
    }

    // Menu Penugasan hanya untuk pimpinan. Peran lain (termasuk admin)
    // disembunyikan; backend juga menolak akses /api/penugasan di luar cakupan.
    if (tabPenugasan && !roles.includes('pimpinan')) {
      tabPenugasan.classList.add('hidden');
    }


    // Load Data
    loadPengajar();

  } catch (err) {
    console.error("Auth check failed:", err);
  }
}


// 3. Fetch Data Pengajar
async function loadPengajar(query = '') {
  tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Memuat data pengajar...</td></tr>`;

  try {
    const response = await fetch('/api/pengajar');
    let data = await response.json();

    if (!response.ok) throw new Error((data && data.message) || 'Gagal memuat data');

    data = data || []; // Handle null response from Go API
    allPengajar = data;

    const filterJenis = document.getElementById('filter-jenis').value;

    let filtered = data;
    if (query.trim().length > 0) {
      filtered = filtered.filter(p => p.nama.toLowerCase().includes(query.toLowerCase()));
    }
    if (filterJenis !== '') {
      filtered = filtered.filter(p => p.status === filterJenis);
    }

    renderTable(filtered);
    
    // Re-render penugasan tables now that allPengajar is populated
    if (typeof renderMufatishTable === 'function') renderMufatishTable();
    if (typeof renderMustahiqTable === 'function') renderMustahiqTable();

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-red-500">Terjadi kesalahan: ${err.message}</td></tr>`;
  }
}

// 4. Render Table
function renderTable(pengajarArray) {
  if (!pengajarArray || pengajarArray.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Tidak ada data pengajar ditemukan.</td></tr>`;
    return;
  }

  // Clear loading
  tableBody.innerHTML = '';

  pengajarArray.forEach(p => {
    const nama = p.nama || '-';
    const noHp = p.no_hp || '-';
    const alamat = p.alamat || '-';
    
    let badgeHtml = '';
    const roles = (p.user_roles || '').split(',');
    
    if (roles.includes('mustahiq')) {
      badgeHtml += `<span class="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Mustahiq</span>`;
    }
    if (roles.includes('mufatish')) {
      badgeHtml += `<span class="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Mufattish</span>`;
    }
    if (p.status === 'munawwib') {
      badgeHtml += `<span class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Munawwib</span>`;
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors';
    tr.innerHTML = `
      <td data-label="Nama Lengkap" class="px-6 py-4 font-medium text-gray-900 dark:text-white">
        <div class="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
          <span class="whitespace-nowrap">${nama}</span>
          ${badgeHtml ? `<span class="flex flex-wrap gap-1">${badgeHtml}</span>` : ''}
        </div>
      </td>
      <td data-label="Nomor HP" class="px-6 py-4 text-gray-700 dark:text-gray-300">
        ${noHp}
      </td>
      <td data-label="Alamat" class="px-6 py-4 text-gray-700 dark:text-gray-300">
        ${alamat}
      </td>
      <td data-label="Aksi" class="px-6 py-4 text-right">
        <button onclick="openDetailPengajar(${p.id}, '${nama}')" class="text-blue-500 hover:underline text-sm font-medium mr-3">Info</button>
        ${window.isAdminRole(userRole) ? `
          <button onclick="editPengajar(${p.id})" class="text-primary dark:text-accent-emerald hover:underline text-sm font-medium mr-3">Edit</button>
          <button onclick="deletePengajar(${p.id})" class="text-red-500 hover:underline text-sm font-medium">Hapus</button>
        ` : ''}

      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// 5. Search Logic (Debounced)
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadPengajar(e.target.value);
  }, 300);
});

document.getElementById('filter-jenis').addEventListener('change', () => {
  loadPengajar(searchInput.value);
});

// 6. Modal Logic
function openModal(isEdit = false) {
  modal.classList.remove('hidden');
  void modal.offsetWidth;
  modalContent.classList.remove('scale-95', 'opacity-0');
  modalContent.classList.add('scale-100', 'opacity-100');
  modalError.classList.add('hidden');

  if (!isEdit) {
    formPengajar.reset();
    editId = null;
    modalTitle.textContent = 'Tambah Pengajar';
  } else {
    modalTitle.textContent = 'Edit Pengajar';
  }
}

function closeModal() {
  modalContent.classList.remove('scale-100', 'opacity-100');
  modalContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

btnTambah.addEventListener('click', () => openModal(false));
btnClose.addEventListener('click', closeModal);
btnCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

window.editPengajar = (id) => {
  const p = allPengajar.find(x => x.id === id);
  if (!p) return;

  editId = p.id;
  formPengajar.querySelector('input[name="nama"]').value = p.nama || '';
  formPengajar.querySelector('input[name="nama_arab"]').value = p.nama_arab || '';
  formPengajar.querySelector('select[name="status"]').value = p.status || 'mustahiq';
  formPengajar.querySelector('input[name="no_hp"]').value = p.no_hp || '';
  formPengajar.querySelector('textarea[name="alamat"]').value = p.alamat || '';
  formPengajar.querySelector('input[name="ttl"]').value = p.ttl || '';
  formPengajar.querySelector('input[name="nama_wali"]').value = p.nama_wali || '';
  formPengajar.querySelector('input[name="tahun_mengajar"]').value = p.tahun_mengajar || '';

  openModal(true);
};

window.deletePengajar = async (id) => {
  if (!confirm("Apakah Anda yakin ingin menghapus data pengajar ini?")) return;

  try {
    const res = await fetch(`/api/pengajar/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menghapus');

    loadPengajar();
  } catch (err) {
    alert("Error: " + err.message);
  }
};

// 7. Form Submit Logic
formPengajar.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(formPengajar);
  const payload = {
    nama: formData.get('nama'),
    nama_arab: formData.get('nama_arab'),
    status: formData.get('status'),
    no_hp: formData.get('no_hp'),
    alamat: formData.get('alamat'),
    ttl: formData.get('ttl') || null,
    nama_wali: formData.get('nama_wali') || null,
    tahun_mengajar: formData.get('tahun_mengajar') || null
  };

  const btnSubmit = formPengajar.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Menyimpan...';
  modalError.classList.add('hidden');

  try {
    const url = editId ? `/api/pengajar/${editId}` : '/api/pengajar';
    const method = editId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Gagal menyimpan data');
    }

    // Success
    closeModal();
    loadPengajar(); // reload table

  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Simpan';
  }
});

// Export Data Pengajar
const btnExport = document.getElementById('btn-export');
if (btnExport) {
  btnExport.addEventListener('click', () => {
    window.location.href = '/api/pengajar/export';
  });
}

// Import Data Pengajar
const fileImport = document.getElementById('file-import');
if (fileImport) {
  fileImport.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const prevTitle = document.getElementById('btn-import-trigger').innerHTML;
    document.getElementById('btn-import-trigger').innerHTML = 'Mengimpor...';

    try {
      const res = await fetch('/api/pengajar/import', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      alert('Berhasil mengimpor data pengajar!');
      loadPengajar();
    } catch (err) {
      alert('Gagal mengimpor data pengajar: ' + err.message);
    } finally {
      document.getElementById('btn-import-trigger').innerHTML = prevTitle;
      fileImport.value = '';
    }
  });
}

// Run
// 8. Modal Detail Pengajar (Riwayat Penugasan)
window.openDetailPengajar = function(id, nama) {
  if (typeof window.openGlobalDetailPengajar === 'function') {
    window.openGlobalDetailPengajar(id, nama);
  }
};

checkAuth();



// ==========================================
// PENUGASAN & AKSES LOGIC
// ==========================================

let allKelas = [];
let allBagian = [];
let allTingkatan = [];
let assignedMufatish = [];
let assignedMustahiq = [];
let assignedMunawwib = [];

async function fetchMasterAkademik() {
  try {
    const [resTingkatan, resKelas, resBagian] = await Promise.all([
      fetch('/api/akademik/tingkatan'),
      fetch('/api/akademik/kelas'),
      fetch('/api/akademik/bagian')
    ]);
    
    if (resTingkatan.ok) allTingkatan = await resTingkatan.json() || [];
    if (resKelas.ok) allKelas = await resKelas.json() || [];
    if (resBagian.ok) allBagian = await resBagian.json() || [];
    
    populateFilters();
  } catch(err) {
    console.error("Gagal load master akademik", err);
  }
}

async function fetchPenugasan() {
  try {
    const [resMufatish, resMustahiq, resMunawwib] = await Promise.all([
      fetch('/api/penugasan/mufatish'),
      fetch('/api/penugasan/mustahiq'),
      fetch('/api/penugasan/munawwib')
    ]);
    
    if (resMufatish.ok) assignedMufatish = await resMufatish.json() || [];
    if (resMustahiq.ok) assignedMustahiq = await resMustahiq.json() || [];
    if (resMunawwib.ok) assignedMunawwib = await resMunawwib.json() || [];
    
    renderMufatishTable();
    renderMustahiqTable();
  } catch(err) {
    console.error("Gagal load penugasan", err);
  }
}

function populateFilters() {
  const filterTM = document.getElementById('filter-tingkatan-mufatish');
  const filterKM = document.getElementById('filter-kelas-mufatish');
  const filterTQ = document.getElementById('filter-tingkatan-mustahiq');
  const filterKQ = document.getElementById('filter-kelas-mustahiq');

  let tingkatanOpts = '<option value="">Semua Tingkatan</option>';
  allTingkatan.forEach(t => {
    tingkatanOpts += `<option value="${t.id}">${t.nama}</option>`;
  });
  if(filterTM) filterTM.innerHTML = tingkatanOpts;
  if(filterTQ) filterTQ.innerHTML = tingkatanOpts;

  let kelasOpts = '<option value="">Semua Kelas</option>';
  allKelas.forEach(k => {
    // only active ones usually
    kelasOpts += `<option value="${k.id}">${k.nama}</option>`;
  });
  if(filterKM) filterKM.innerHTML = kelasOpts;
  if(filterKQ) filterKQ.innerHTML = kelasOpts;
}

document.getElementById('filter-tingkatan-mufatish')?.addEventListener('change', renderMufatishTable);
document.getElementById('filter-kelas-mufatish')?.addEventListener('change', renderMufatishTable);
document.getElementById('filter-tingkatan-mustahiq')?.addEventListener('change', renderMustahiqTable);
document.getElementById('filter-kelas-mustahiq')?.addEventListener('change', renderMustahiqTable);


function renderMufatishTable() {
  const tbody = document.getElementById('tbody-mufatish');
  if(!tbody) return;
  tbody.innerHTML = '';
  
  const filterT = document.getElementById('filter-tingkatan-mufatish')?.value;
  const filterK = document.getElementById('filter-kelas-mufatish')?.value;

  // Extract unique (tingkatan_id, kelas_id) combinations from allBagian
  const uniqueClasses = [];
  const classKeys = new Set();
  allBagian.forEach(b => {
    const key = b.tingkatan_id + '-' + b.kelas_id;
    if(!classKeys.has(key)) {
      classKeys.add(key);
      uniqueClasses.push({ tingkatan_id: b.tingkatan_id, kelas_id: b.kelas_id, tingkatan: b.tingkatan, kelas: b.kelas });
    }
  });

  let filtered = uniqueClasses;
  if(filterT) filtered = filtered.filter(c => c.tingkatan_id == filterT);
  if(filterK) filtered = filtered.filter(c => c.kelas_id == filterK);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Tidak ada data kelas.</td></tr>`;
    return;
  }

  filtered.forEach(k => {
    const assignment = assignedMufatish.find(a => a.kelas_id == k.kelas_id && a.tingkatan_id == k.tingkatan_id);
    const assignedId = assignment ? assignment.pengajar_id : 0;
    const assignedNama = assignment ? assignment.pengajar_nama : '-';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors';
    
    let opts = '<option value="0">-- Kosong / Tidak Ada --</option>';
    allPengajar.forEach(p => {
       const sel = (p.id == assignedId) ? 'selected' : '';
       opts += `<option value="${p.id}" ${sel}>${p.nama}</option>`;
    });

    tr.innerHTML = `
      <td class="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">${k.tingkatan}</td>
      <td class="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">${k.kelas}</td>
      <td class="px-6 py-4">
        <div class="view-mode flex items-center">
          <span class="text-gray-900 dark:text-white">${assignedNama}</span>
        </div>
        <div class="edit-mode hidden">
          <select class="glass-input text-sm rounded-lg px-2 py-1 w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white select-pengajar">
            ${opts}
          </select>
        </div>
      </td>
      <td class="px-6 py-4 text-right">
        ${window.isAdminRole(userRole) ? `
          <button type="button" class="btn-atur text-blue-500 hover:underline text-sm font-medium view-mode">${assignedId ? 'Edit' : 'Atur'}</button>
          <button type="button" class="btn-simpan text-green-500 hover:underline text-sm font-medium hidden edit-mode">Simpan</button>
          <button type="button" class="btn-batal text-gray-400 hover:underline text-sm font-medium hidden edit-mode ml-2">Batal</button>
        ` : ''}
      </td>
    `;
    
    if (window.isAdminRole(userRole)) {
       const btnAtur = tr.querySelector('.btn-atur');
       const btnSimpan = tr.querySelector('.btn-simpan');
       const btnBatal = tr.querySelector('.btn-batal');
       const viewModes = tr.querySelectorAll('.view-mode');
       const editModes = tr.querySelectorAll('.edit-mode');
       const selectEl = tr.querySelector('.select-pengajar');

       const toggleMode = (isEdit) => {
          viewModes.forEach(el => isEdit ? el.classList.add('hidden') : el.classList.remove('hidden'));
          editModes.forEach(el => isEdit ? el.classList.remove('hidden') : el.classList.add('hidden'));
       };

       btnAtur.addEventListener('click', () => toggleMode(true));
       btnBatal.addEventListener('click', () => {
          selectEl.value = assignedId;
          toggleMode(false);
       });
       btnSimpan.addEventListener('click', async () => {
          const newPengajarId = parseInt(selectEl.value);
          btnSimpan.textContent = '...';
          await saveMufatish(k.kelas_id, k.tingkatan_id, newPengajarId);
       });
    }

    tbody.appendChild(tr);
  });
}

function renderMustahiqTable() {
  const tbody = document.getElementById('tbody-mustahiq');
  if(!tbody) return;
  tbody.innerHTML = '';
  
  const filterT = document.getElementById('filter-tingkatan-mustahiq')?.value;
  const filterK = document.getElementById('filter-kelas-mustahiq')?.value;

  let filtered = allBagian;
  if(filterT) filtered = filtered.filter(b => b.tingkatan_id == filterT);
  if(filterK) filtered = filtered.filter(b => b.kelas_id == filterK);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Tidak ada data bagian.</td></tr>`;
    return;
  }

  filtered.forEach(b => {
    const assignment = assignedMustahiq.find(a => a.bagian_id == b.id);
    const assignedId = assignment ? assignment.pengajar_id : 0;
    const assignedNama = assignment ? assignment.pengajar_nama : '-';

    const munawwibList = assignedMunawwib.filter(a => a.bagian_id == b.id);
    let munawwibHtml = munawwibList.map(m => `
      <span class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full inline-flex items-center mr-1 mb-1">
        ${m.pengajar_nama}
        ${window.isAdminRole(userRole) ? `<button type="button" class="ml-1 hover:text-indigo-900 dark:hover:text-indigo-200 focus:outline-none" onclick="removeMunawwib(${b.id}, ${m.pengajar_id})">&times;</button>` : ''}
      </span>`).join('');
    
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors';
    
    let opts = '<option value="0">-- Kosong / Tidak Ada --</option>';
    allPengajar.forEach(p => {
       const sel = (p.id == assignedId) ? 'selected' : '';
       opts += `<option value="${p.id}" ${sel}>${p.nama}</option>`;
    });

    tr.innerHTML = `
      <td class="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">${b.tingkatan} ${b.kelas}</td>
      <td class="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">${b.nama_bagian}</td>
      <td class="px-6 py-4">
        <div class="view-mode flex items-center">
          <span class="text-gray-900 dark:text-white">${assignedNama}</span>
        </div>
        <div class="edit-mode hidden">
          <select class="glass-input text-sm rounded-lg px-2 py-1 w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white select-pengajar">
            ${opts}
          </select>
        </div>
      </td>
      <td class="px-6 py-4">
        <div class="mb-2 flex flex-wrap max-w-[200px]">${munawwibHtml || '<span class="text-gray-400 text-xs">-</span>'}</div>
      </td>
      <td class="px-6 py-4">
        ${window.isAdminRole(userRole) ? `
          <button type="button" class="btn-atur text-blue-500 hover:underline text-sm font-medium view-mode">${assignedId ? 'Edit Mustahiq' : 'Atur Mustahiq'}</button>
          <button type="button" class="btn-simpan text-green-500 hover:underline text-sm font-medium hidden edit-mode">Simpan</button>
          <button type="button" class="btn-batal text-gray-400 hover:underline text-sm font-medium hidden edit-mode ml-2">Batal</button>
        ` : ''}
      </td>
      <td class="px-6 py-4">
        ${window.isAdminRole(userRole) ? `
          <button type="button" class="text-indigo-500 hover:underline text-sm font-medium" onclick="openModalMunawwib(${b.id})">+ Tambah Munawwib</button>
        ` : ''}
      </td>
    `;
    
    if (window.isAdminRole(userRole)) {
       const btnAtur = tr.querySelector('.btn-atur');
       const btnSimpan = tr.querySelector('.btn-simpan');
       const btnBatal = tr.querySelector('.btn-batal');
       const viewModes = tr.querySelectorAll('.view-mode');
       const editModes = tr.querySelectorAll('.edit-mode');
       const selectEl = tr.querySelector('.select-pengajar');

       const toggleMode = (isEdit) => {
          viewModes.forEach(el => isEdit ? el.classList.add('hidden') : el.classList.remove('hidden'));
          editModes.forEach(el => isEdit ? el.classList.remove('hidden') : el.classList.add('hidden'));
       };

       btnAtur.addEventListener('click', () => toggleMode(true));
       btnBatal.addEventListener('click', () => {
          selectEl.value = assignedId;
          toggleMode(false);
       });
       btnSimpan.addEventListener('click', async () => {
          const newPengajarId = parseInt(selectEl.value);
          btnSimpan.textContent = '...';
          await saveMustahiq(b.id, newPengajarId);
       });
    }

    tbody.appendChild(tr);
  });
}

async function saveMufatish(kelasId, tingkatanId, pengajarId) {
  try {
    const res = await fetch('/api/penugasan/mufatish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kelas_id: kelasId,
        tingkatan_id: tingkatanId,
        pengajar_id: pengajarId
      })
    });
    if(!res.ok) {
       const data = await res.json();
       throw new Error(data.message || 'Gagal menyimpan penugasan mufatish');
    }
    // Reload penugasan data
    await fetchPenugasan();
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function saveMustahiq(bagianId, pengajarId) {
  try {
    const res = await fetch('/api/penugasan/mustahiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bagian_id: bagianId,
        pengajar_id: pengajarId
      })
    });
    if(!res.ok) {
       const data = await res.json();
       throw new Error(data.message || 'Gagal menyimpan penugasan mustahiq');
    }
    // Reload penugasan data
    await fetchPenugasan();
  } catch (err) {
    alert("Error: " + err.message);
  }
}

// Ensure data loads in order
async function initPenugasan() {
  await fetchMasterAkademik();
  await fetchPenugasan();
}
initPenugasan();
