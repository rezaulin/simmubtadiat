// frontend/src/js/dewan-harian.js

// 1. Initial State & Elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const filterLembaga = document.getElementById('filter-lembaga');
const filterTahun = document.getElementById('filter-tahun');
const btnTambah = document.getElementById('btn-tambah');

// Modal Elements
const modal = document.getElementById('modal-santri'); // Note: ID in HTML is still modal-santri (for modal wrapper)
const modalContent = document.getElementById('modal-content');
const modalOverlay = document.getElementById('modal-overlay');
const btnClose = document.getElementById('modal-close');
const btnCancel = document.getElementById('btn-cancel');
const formDewan = document.getElementById('form-dewan');
const modalError = document.getElementById('modal-error');
const modalTitle = modalContent.querySelector('h3');

let allDewan = [];
let editId = null;
let userRole = '';


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
    
    // Admins (Pimpinan / Admin) can manage Dewan Harian
    userRole = data.role;
    // Aksi tulis (tambah/edit/hapus/import) hanya untuk pimpinan.
    // Admin bersifat read-only, jadi dipakai isPimpinanRole (bukan isAdminRole).
    if (window.isPimpinanRole(userRole)) {
      btnTambah.classList.remove('hidden');
      document.getElementById('btn-template')?.classList.remove('hidden');
      document.getElementById('btn-import')?.classList.remove('hidden');
    }


    
    // Load Data
    loadDewan();
    
  } catch (err) {
    console.error("Auth check failed:", err);
  }
}

// 3. Fetch Data Dewan Harian
async function loadDewan(query = '') {
  tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Memuat data dewan harian...</td></tr>`;
  
  try {
    const response = await fetch('/api/dewan-harian');
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.message || 'Gagal memuat data');
    
    allDewan = data || []; // Handle null if empty

    // Populate filter tahun dynamically based on data
    if (filterTahun) {
      const currentSelected = filterTahun.value;
      const yearSet = new Set();
      allDewan.forEach(d => {
        if (d.tahun_aktif) {
          d.tahun_aktif.split(',').forEach(y => {
            const trimmed = y.trim();
            if (trimmed) yearSet.add(trimmed);
          });
        }
      });
      const sortedYears = Array.from(yearSet).sort().reverse();
      
      // Clear options except the first one ("Semua Tahun")
      filterTahun.innerHTML = '<option value="">Semua Tahun</option>';
      
      sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        filterTahun.appendChild(opt);
      });
      
      // Restore selection if still exists
      if (sortedYears.includes(currentSelected)) {
        filterTahun.value = currentSelected;
      }
    }

    let filtered = allDewan;
    if (query.trim().length > 0) {
      filtered = filtered.filter(p => p.nama.toLowerCase().includes(query.toLowerCase()) || (p.jabatan && p.jabatan.toLowerCase().includes(query.toLowerCase())));
    }

    if (filterLembaga && filterLembaga.value) {
      filtered = filtered.filter(p => p.lembaga === filterLembaga.value);
    }

    if (filterTahun && filterTahun.value) {
      filtered = filtered.filter(p => p.tahun_aktif && p.tahun_aktif.includes(filterTahun.value));
    }
    
    renderTable(filtered);
    
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-red-500">Terjadi kesalahan: ${err.message}</td></tr>`;
  }
}

// 4. Render Table
function renderTable(dewanArray) {
  if (!dewanArray || dewanArray.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Tidak ada data dewan harian ditemukan.</td></tr>`;
    return;
  }
  
  // Group by nama (case-insensitive)
  const grouped = {};
  dewanArray.forEach(d => {
    const key = (d.nama || '-').toLowerCase().trim();
    if (!grouped[key]) {
      grouped[key] = {
        nama: d.nama || '-',
        alamat: d.alamat || '-',
        jabatans: []
      };
    }
    grouped[key].jabatans.push(d);
  });
  
  // Clear loading
  tableBody.innerHTML = '';
  
  Object.values(grouped).forEach(person => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors border-b border-gray-100 dark:border-slate-700/50';
    
    let jabatansHtml = person.jabatans.map(d => {
      const jabatan = d.jabatan || '-';
      const lembaga = d.lembaga || '-';
      const aksiHtml = window.isPimpinanRole(userRole) ? `
        <button onclick="editDewan(${d.id})" class="text-primary dark:text-accent-emerald hover:underline text-xs font-medium mr-2">Edit</button>
        <button onclick="deleteDewan(${d.id})" class="text-red-500 hover:underline text-xs font-medium">Hapus</button>
      ` : '';

      return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between py-1 border-b border-dashed border-gray-200 dark:border-slate-700 last:border-0 gap-2 sm:gap-0">
          <div class="flex-1">
            <span class="font-semibold text-blue-600 dark:text-blue-400">${jabatan}</span> di ${lembaga}
          </div>
          <div class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            ${d.tahun_aktif || '-'}
          </div>
          <div class="w-full sm:w-24 text-left sm:text-right">
            ${aksiHtml}
          </div>
        </div>
      `;
    }).join('');

    tr.innerHTML = `
      <td data-label="Nama Lengkap" class="px-6 py-4 font-medium text-gray-900 dark:text-white align-top">
        ${person.nama}
      </td>
      <td data-label="Alamat" class="px-6 py-4 text-gray-700 dark:text-gray-300 text-sm align-top">
        ${person.alamat}
      </td>
      <td data-label="Riwayat Jabatan & Aksi" colspan="2" class="px-6 py-3 align-top">
        <div class="flex flex-col w-full text-left" style="align-items:flex-start">${jabatansHtml}</div>
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
    loadDewan(e.target.value);
  }, 300);
});

if (filterLembaga) {
  filterLembaga.addEventListener('change', () => {
    loadDewan(searchInput.value);
  });
}

if (filterTahun) {
  filterTahun.addEventListener('change', () => {
    loadDewan(searchInput.value);
  });
}

// 6. Modal Logic
function openModal(isEdit = false) {
  modal.classList.remove('hidden');
  void modal.offsetWidth;
  modalContent.classList.remove('scale-95', 'opacity-0');
  modalContent.classList.add('scale-100', 'opacity-100');
  modalError.classList.add('hidden');

  if (!isEdit) {
    formDewan.reset();
    editId = null;
    modalTitle.textContent = 'Tambah Pengurus';
  } else {
    modalTitle.textContent = 'Edit Pengurus';
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

window.editDewan = (id) => {
  const d = allDewan.find(x => x.id === id);
  if (!d) return;
  
  editId = d.id;
  formDewan.querySelector('input[name="nama"]').value = d.nama || '';
  formDewan.querySelector('input[name="nama_wali"]').value = d.nama_wali || '';
  formDewan.querySelector('input[name="no_hp"]').value = d.no_hp || '';
  formDewan.querySelector('textarea[name="alamat"]').value = d.alamat || '';
  formDewan.querySelector('input[name="jabatan"]').value = d.jabatan || '';
  formDewan.querySelector('select[name="lembaga"]').value = d.lembaga || 'P3HM';
  formDewan.querySelector('input[name="tahun_aktif"]').value = d.tahun_aktif || '';
  
  openModal(true);
};

window.deleteDewan = async (id) => {
  if (!confirm("Apakah Anda yakin ingin menghapus data pengurus ini?")) return;
  
  try {
    const res = await fetch(`/api/dewan-harian/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menghapus');
    
    loadDewan();
  } catch (err) {
    alert("Error: " + err.message);
  }
};

// 7. Form Submit Logic
formDewan.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(formDewan);
  const payload = {
    nama: formData.get('nama'),
    nama_wali: formData.get('nama_wali') || null,
    no_hp: formData.get('no_hp') || null,
    alamat: formData.get('alamat') || null,
    jabatan: formData.get('jabatan'),
    lembaga: formData.get('lembaga'),
    tahun_aktif: formData.get('tahun_aktif'),
    is_active: true
  };
  
  const btnSubmit = formDewan.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Menyimpan...';
  modalError.classList.add('hidden');
  
  try {
    const url = editId ? `/api/dewan-harian/${editId}` : '/api/dewan-harian';
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
    loadDewan(); // reload table
    
  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Simpan';
  }
});

// Run
checkAuth();

// 8. Import Excel Logic
const inputImportFile = document.getElementById('input-import-file');
if (inputImportFile) {
  inputImportFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm(`Import file "${file.name}"? Data akan ditambahkan ke dewan harian.`)) {
      inputImportFile.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/dewan-harian/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors && data.errors.length > 0) {
          const errList = data.errors.map(e => `Baris ${e.baris} (${e.nama}): ${e.pesan}`).join('\n');
          alert(`Import gagal!\n\n${errList}`);
        } else {
          alert('Import gagal: ' + (data.message || JSON.stringify(data)));
        }
        return;
      }

      alert(data.message || `${data.sukses} data berhasil diimpor`);
      loadDewan();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      inputImportFile.value = '';
    }
  });
}
