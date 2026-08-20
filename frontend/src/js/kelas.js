// frontend/src/js/kelas.js
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";

// === DOM ELEMENTS ===
const gridKelas = document.getElementById('grid-kelas');
const btnTambah = document.getElementById('btn-tambah');

// Main Tabs
const tabBagian = document.getElementById('tab-bagian');
const tabKurikulum = document.getElementById('tab-kurikulum');
const tabSetup = document.getElementById('tab-setup');
const contentBagian = document.getElementById('content-bagian');
const contentKurikulum = document.getElementById('content-kurikulum');
const contentSetup = document.getElementById('content-setup');

// Modal Buat Bagian
const modal = document.getElementById('modal-kelas');
const modalContent = document.getElementById('modal-content');
const modalOverlay = document.getElementById('modal-overlay');
const btnClose = document.getElementById('modal-close');
const btnCancel = document.getElementById('btn-cancel');
const formKelas = document.getElementById('form-kelas');
const modalError = document.getElementById('modal-error');
const selTingkatan = document.getElementById('sel-tingkatan');
const selKelas = document.getElementById('sel-kelas');

// Panel Kelola Ruang (Bagian)
const panelKelola = document.getElementById('modal-kelola-bagian');
const btnCloseKelola = document.getElementById('modal-kelola-close');
const titleKelola = document.getElementById('kelola-title');
const tabKelolaSantri = document.getElementById('tab-kelola-santri');
const tabKelolaJadwal = document.getElementById('tab-kelola-jadwal');
const contentKelolaSantri = document.getElementById('content-kelola-santri');
const contentKelolaJadwal = document.getElementById('content-kelola-jadwal');

// Kurikulum Panel
const selKuriTingkatan = document.getElementById('sel-kuri-tingkatan');
const selKuriKelas = document.getElementById('sel-kuri-kelas');
const btnLoadKurikulum = document.getElementById('btn-load-kurikulum');
const kurikulumPanel = document.getElementById('kurikulum-panel');
const formKelolaMapel = document.getElementById('form-kelola-mapel');
const tableKelolaMapel = document.getElementById('table-kelola-mapel');
const titleKurikulum = document.getElementById('title-kurikulum');

// Kelola Jadwal
const formKelolaJadwal = document.getElementById('form-kelola-jadwal');
const tableKelolaJadwal = document.getElementById('table-kelola-jadwal');
const selJadwalMapel = document.getElementById('sel-jadwal-mapel');
const selJadwalPengajar = document.getElementById('sel-jadwal-pengajar');

// Kelola Santri
const listAssignSantri = document.getElementById('list-assign-santri');
const chkAssignAll = document.getElementById('chk-assign-all');
const btnAssignSantri = document.getElementById('btn-assign-santri');
const tableKelolaSantri = document.getElementById('table-kelola-santri');

// Setup Master Form
const formTingkatan = document.getElementById('form-tingkatan');
const formKelasMaster = document.getElementById('form-kelas-master');
const listTingkatan = document.getElementById('list-tingkatan');
const listKelas = document.getElementById('list-kelas');

// State
let cachedTingkatan = [];
let cachedKelas = [];
let cachedBagian = [];
let cachedMapel = [];
let cachedJadwal = [];
let cachedSantri = [];
let currentBagianId = null;
let currentKuriTingkatanId = null;
let currentKuriKelasId = null;
let isPimpinan = false;

// Apply Theme
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

// ==========================================
// 1. INIT & TABS
// ==========================================

async function init() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await response.json();
    // Admins (pimpinan/admin) can write. Mufatish can view everything read-only.
    isPimpinan = window.isAdminRole(data.role);
    const canView = isPimpinan || data.role === 'mufatish';

    if (canView) {
      if (isPimpinan) btnTambah.classList.remove('hidden');
      loadDropdowns();
      loadSetupData();
      loadPengajar();
      loadAllSantri();
    } else {
      tabSetup.classList.add('hidden');
      tabKurikulum.classList.add('hidden');
    }

    
    loadKelas();

    flatpickr("input[type=time]", {
      enableTime: true,
      noCalendar: true,
      dateFormat: "H:i",
      time_24hr: true
    });
    
  } catch (err) {
    console.error("Auth check failed:", err);
  }
}
init();

function switchTab(tabName) {
  const tabs = {
    'bagian': { btn: tabBagian, content: contentBagian },
    'kurikulum': { btn: tabKurikulum, content: contentKurikulum },
    'setup': { btn: tabSetup, content: contentSetup }
  };

  for (const key in tabs) {
    if (tabs[key].btn) {
      tabs[key].btn.className = "pb-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors";
      tabs[key].content.classList.add('hidden');
    }
  }

  if (tabs[tabName].btn) {
    tabs[tabName].btn.className = "pb-2 text-sm font-semibold border-b-2 border-primary text-primary dark:border-accent-emerald dark:text-accent-emerald transition-colors";
    tabs[tabName].content.classList.remove('hidden');
  }
}

tabBagian?.addEventListener('click', () => switchTab('bagian'));
tabKurikulum?.addEventListener('click', () => switchTab('kurikulum'));
tabSetup?.addEventListener('click', () => switchTab('setup'));

// ==========================================
// 2. RUANG KELAS FISIK (BAGIAN)
// ==========================================
const filterTingkatanRuang = document.getElementById('filter-tingkatan-ruang');
const filterKelasRuang = document.getElementById('filter-kelas-ruang');

async function loadKelas() {
  try {
    if (cachedTingkatan.length === 0) {
      const resT = await fetch('/api/akademik/tingkatan');
      if(resT.ok) cachedTingkatan = (await resT.json()) || [];
    }
    if (cachedKelas.length === 0) {
      const resA = await fetch('/api/akademik/kelas');
      if(resA.ok) cachedKelas = (await resA.json()) || [];
    }

    const response = await fetch('/api/akademik/bagian');
    if (!response.ok) {
      // Backend mengirim pesan error sebagai teks biasa (bukan JSON) saat 500.
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}`);
    }
    cachedBagian = (await response.json()) || [];
    
    // Populate Filters
    if (filterTingkatanRuang && filterTingkatanRuang.options.length <= 1) {
      cachedTingkatan.forEach(t => {
        filterTingkatanRuang.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
      });
      
      filterTingkatanRuang.addEventListener('change', () => {
        const tId = filterTingkatanRuang.value;
        filterKelasRuang.innerHTML = `<option value="">Semua Kelas</option>`;
        if (tId) {
          const kelasFilt = cachedKelas; // Assuming kelas is global, wait, original logic was `angkatan.filter(a => a.tingkatan_id == tId)`? 
          // Let's check original. Original: `angkatanFilt = cachedAngkatan.filter(a => a.tingkatan_id == tId);`. Wait, angkatan doesn't have tingkatan_id.
          // Let's just put all kelas.
          cachedKelas.forEach(a => {
            filterKelasRuang.innerHTML += `<option value="${a.id}">${a.nama}</option>`;
          });
        }
        applyRuangFilter();
      });
      
      filterKelasRuang.addEventListener('change', applyRuangFilter);
      
      // Trigger change on load so the "Semua Kelas" duplicate is cleared and properly synced
      filterTingkatanRuang.dispatchEvent(new Event('change'));
    }
    
    applyRuangFilter();
  } catch (err) {
    gridKelas.innerHTML = `<div class="col-span-full p-4 text-red-500 text-center">Terjadi kesalahan saat memuat kelas.<br><span class="text-xs text-red-400 break-all">${(err && err.message) ? err.message : ''}</span></div>`;
  }
}

function applyRuangFilter() {
  const tId = filterTingkatanRuang?.value;
  const aId = filterKelasRuang?.value;
  
  let filtered = Array.isArray(cachedBagian) ? cachedBagian : [];
  if (tId) filtered = filtered.filter(b => b.tingkatan_id == tId);
  if (aId) filtered = filtered.filter(b => b.kelas_id == aId);
  
  renderGrid(filtered);
}

function renderGrid(bagianArray) {
  if (!bagianArray || bagianArray.length === 0) {
    gridKelas.innerHTML = `<div class="col-span-full p-8 text-center text-gray-400 glass rounded-3xl">Belum ada ruang kelas.</div>`;
    return;
  }
  
  gridKelas.innerHTML = '';
  bagianArray.forEach(b => {
    const colors = ['from-blue-500 to-indigo-500', 'from-emerald-400 to-teal-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-500'];
    const bgGradient = colors[b.id % colors.length];

    const card = document.createElement('div');
    card.className = 'glass dark:bg-slate-800/80 rounded-3xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow group';
    card.innerHTML = `
      <div class="h-2 bg-gradient-to-r ${bgGradient}"></div>
      <div class="p-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">${b.nama_bagian}</h3>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">${b.tingkatan} • ${b.kelas}</p>
          </div>
          <div class="flex gap-2">
            ${isPimpinan ? `
            <button onclick="hapusBagian(${b.id})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors">
              Hapus
            </button>` : ''}
            <button onclick="openPanelKelola(${b.id}, '${b.nama_bagian}')" class="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              Kelola
            </button>
          </div>

        </div>
      </div>
    `;
    gridKelas.appendChild(card);
  });
}

// Modal Buat Bagian
function openModal() {
  modal.classList.remove('hidden');
  void modal.offsetWidth;
  modalContent.classList.remove('scale-95', 'opacity-0');
  modalContent.classList.add('scale-100', 'opacity-100');
}
function closeModal() {
  modalContent.classList.remove('scale-100', 'opacity-100');
  modalContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
    modalError.classList.add('hidden');
    modalError.textContent = '';
  }, 300);
}
btnTambah?.addEventListener('click', openModal);
btnClose?.addEventListener('click', closeModal);
btnCancel?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', closeModal);

window.hapusBagian = async function(id) {
  if(!confirm("Hapus ruang kelas fisik ini? Semua santri di dalamnya akan dikeluarkan dari kelas, dan jadwal akan terhapus.")) return;
  try {
    const res = await fetch(`/api/akademik/bagian/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Gagal menghapus ruang kelas");
    loadKelas();
    loadSetupData();
  } catch(err) {
    alert(err.message);
  }
};

formKelas?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(formKelas);
  const data = Object.fromEntries(formData);
  data.kelas_id = parseInt(data.kelas_id);
  data.tingkatan_id = parseInt(data.tingkatan_id);

  try {
    const res = await fetch('/api/akademik/bagian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kelas_id: data.kelas_id,
        tingkatan_id: data.tingkatan_id,
        nama_bagian: data.nama
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      if (errText.includes("duplicate key")) {
        throw new Error("Nama ruang kelas ini sudah digunakan.");
      }
      throw new Error(errText || "Gagal menyimpan");
    }
    closeModal();
    loadKelas();
  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.remove('hidden');
  }
});

// ==========================================
// 3. KURIKULUM (MAPEL)
// ==========================================

btnLoadKurikulum?.addEventListener('click', () => {
  const tingkatan_id = selKuriTingkatan.value;
  const kelas_id = selKuriKelas.value;
  if (!tingkatan_id || !kelas_id) {
    alert("Pilih Tingkatan dan Kelas terlebih dahulu!");
    return;
  }
  currentKuriTingkatanId = tingkatan_id;
  currentKuriKelasId = kelas_id;
  
  const tk = selKuriTingkatan.options[selKuriTingkatan.selectedIndex].text;
  const kl = selKuriKelas.options[selKuriKelas.selectedIndex].text;
  titleKurikulum.textContent = `Mata Pelajaran: ${tk} - ${kl}`;
  
  kurikulumPanel.classList.remove('hidden');
  loadMapelKurikulum();
});

async function loadMapelKurikulum() {
  tableKelolaMapel.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400">Memuat data...</td></tr>';
  try {
    const res = await fetch(`/api/akademik/mapel?tingkatan_id=${currentKuriTingkatanId}&kelas_id=${currentKuriKelasId}`);
    const data = await res.json();
    if (!res.ok) throw new Error("Gagal memuat mapel");
    cachedMapel = data || [];
    renderMapelKurikulum();
  } catch (err) {
    tableKelolaMapel.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-red-500">${err.message}</td></tr>`;
  }
}

function renderMapelKurikulum() {
  if (!cachedMapel || cachedMapel.length === 0) {
    tableKelolaMapel.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400">Belum ada mata pelajaran di kurikulum ini.</td></tr>`;
    return;
  }
  
  let html = '';
  cachedMapel.forEach(m => {
    let kwBadge = '';
    if (m.aktif_kuartal && m.aktif_kuartal.length > 0) {
      if (m.aktif_kuartal.length === 4) {
        kwBadge = '<span class="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-semibold">Semua (K1-K4)</span>';
      } else {
        const str = m.aktif_kuartal.sort().map(k => 'K'+k).join(' ');
        kwBadge = `<span class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold">${str}</span>`;
      }
    } else {
      kwBadge = '<span class="px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-semibold">Nonaktif</span>';
    }

    html += `
      <tr>
        <td class="px-4 py-3 text-center">${m.urutan}</td>
        <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">${m.nama_mapel}</td>
        <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${m.nama_kitab || '-'}</td>
        <td class="px-4 py-3 text-center">${kwBadge}</td>
        <td class="px-4 py-3 text-center flex items-center justify-center gap-2">
          <button onclick="editMapel(${m.id})" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 p-1.5 rounded-lg transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          </button>
          <button onclick="hapusMapel(${m.id})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 p-1.5 rounded-lg transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </td>
      </tr>
    `;
  });
  tableKelolaMapel.innerHTML = html;
}

formKelolaMapel?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentKuriTingkatanId || !currentKuriKelasId) return;
  
  const fd = new FormData(formKelolaMapel);
  const data = Object.fromEntries(fd);
  
  const aktif_kuartal = [];
  if (data.kuartal_1) aktif_kuartal.push(1);
  if (data.kuartal_2) aktif_kuartal.push(2);
  if (data.kuartal_3) aktif_kuartal.push(3);
  if (data.kuartal_4) aktif_kuartal.push(4);

  if (aktif_kuartal.length === 0) {
    alert("Minimal pilih 1 kwartal aktif!");
    return;
  }
  
  try {
    const isEdit = !!data.id;
    const url = isEdit ? `/api/akademik/mapel/${data.id}` : '/api/akademik/mapel';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tingkatan_id: parseInt(currentKuriTingkatanId),
        kelas_id: parseInt(currentKuriKelasId),
        nama_mapel: data.nama_mapel,
        nama_kitab: data.nama_kitab || '',
        kategori: 'umum',
        urutan: parseInt(data.urutan),
        aktif_kuartal: aktif_kuartal
      })
    });
    if (!res.ok) throw new Error("Gagal");
    
    resetMapelForm();
    loadMapelKurikulum();
  } catch (err) {
    alert(err.message);
  }
});

function resetMapelForm() {
  formKelolaMapel.reset();
  document.getElementById('mapel-id').value = '';
  document.getElementById('btn-submit-mapel').textContent = 'Tambah';
  document.getElementById('btn-batal-mapel').classList.add('hidden');
}

document.getElementById('btn-batal-mapel')?.addEventListener('click', resetMapelForm);

window.editMapel = function(id) {
  const m = cachedMapel.find(x => x.id === id);
  if (!m) return;
  
  document.getElementById('mapel-id').value = m.id;
  formKelolaMapel.querySelector('[name="nama_mapel"]').value = m.nama_mapel;
  formKelolaMapel.querySelector('[name="nama_kitab"]').value = m.nama_kitab;
  formKelolaMapel.querySelector('[name="urutan"]').value = m.urutan;
  
  formKelolaMapel.querySelector('[name="kuartal_1"]').checked = m.aktif_kuartal?.includes(1) || false;
  formKelolaMapel.querySelector('[name="kuartal_2"]').checked = m.aktif_kuartal?.includes(2) || false;
  formKelolaMapel.querySelector('[name="kuartal_3"]').checked = m.aktif_kuartal?.includes(3) || false;
  formKelolaMapel.querySelector('[name="kuartal_4"]').checked = m.aktif_kuartal?.includes(4) || false;
  
  document.getElementById('btn-submit-mapel').textContent = 'Update';
  document.getElementById('btn-batal-mapel').classList.remove('hidden');
  
  // Scroll to form smoothly
  formKelolaMapel.scrollIntoView({ behavior: 'smooth', block: 'center' });
};


window.hapusMapel = async function(id) {
  if(!confirm("Yakin hapus mapel ini?")) return;
  try {
    await fetch(`/api/akademik/mapel/${id}`, { method: 'DELETE' });
    loadMapelKurikulum();
  } catch (err) {
    alert("Gagal menghapus");
  }
};

// ==========================================
// 4. PANEL KELOLA RUANG (SANTRI & JADWAL)
// ==========================================

window.openPanelKelola = function(bagianId, namaBagian) {
  currentBagianId = bagianId;
  
  titleKelola.textContent = `Kelola Ruang ${namaBagian}`;
  panelKelola.classList.remove('hidden');
  // Slide up effect
  setTimeout(() => {
    panelKelola.classList.remove('translate-y-full');
  }, 10);
  
  switchTabKelola('santri');
  loadSantriByBagian();
  loadAllSantri(); // Refresh unassigned santri
};

btnCloseKelola?.addEventListener('click', () => {
  panelKelola.classList.add('translate-y-full');
  setTimeout(() => {
    panelKelola.classList.add('hidden');
  }, 300);
});

function switchTabKelola(tab) {
  const btnSantri = tabKelolaSantri;
  const btnJadwal = tabKelolaJadwal;
  
  btnSantri.className = "pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors";
  btnJadwal.className = "pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors";
  contentKelolaSantri.classList.add('hidden');
  contentKelolaJadwal.classList.add('hidden');
  
  if (tab === 'santri') {
    btnSantri.className = "pb-3 text-sm font-semibold border-b-2 border-primary text-primary transition-colors";
    contentKelolaSantri.classList.remove('hidden');
  } else if (tab === 'jadwal') {
    btnJadwal.className = "pb-3 text-sm font-semibold border-b-2 border-primary text-primary transition-colors";
    contentKelolaJadwal.classList.remove('hidden');
    loadMapelForJadwal();
    loadJadwal();
  }
}

tabKelolaSantri?.addEventListener('click', () => switchTabKelola('santri'));
tabKelolaJadwal?.addEventListener('click', () => switchTabKelola('jadwal'));

// --- SANTRI MGT ---
async function loadAllSantri() {
  try {
    const res = await fetch('/api/santri');
    if (!res.ok) return;
    const data = await res.json();
    cachedSantri = data || [];
    renderUnassignedSantri();
  } catch (err) {
    console.error(err);
  }
}

const searchAssignSantri = document.getElementById('search-assign-santri');
const countAssignSantri = document.getElementById('count-assign-santri');

function renderUnassignedSantri() {
  // Filter santri that don't have bagian
  const unassigned = cachedSantri.filter(s => !s.bagian_id || s.bagian_id === 0 || s.bagian === "Belum Dikelas");

  // Filter ketik: cocokkan nama atau nomor stambuk (case-insensitive).
  const q = (searchAssignSantri?.value || '').trim().toLowerCase();
  const shown = q
    ? unassigned.filter(s => `${s.nama || ''} ${s.stambuk || ''}`.toLowerCase().includes(q))
    : unassigned;

  listAssignSantri.innerHTML = '';
  if (unassigned.length === 0) {
    listAssignSantri.innerHTML = '<div class="text-gray-500 italic text-center py-4">Tidak ada santri yang belum dikelas</div>';
    if (chkAssignAll) { chkAssignAll.disabled = true; chkAssignAll.checked = false; }
    if (countAssignSantri) countAssignSantri.textContent = '';
    return;
  }
  if (chkAssignAll) chkAssignAll.disabled = false;

  if (shown.length === 0) {
    listAssignSantri.innerHTML = '<div class="text-gray-400 italic text-center py-4">Tidak ada yang cocok dengan pencarian</div>';
  } else {
    listAssignSantri.innerHTML = shown.map(s => `
      <label class="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-slate-600 rounded-lg cursor-pointer transition-colors">
        <input type="checkbox" name="assign_santri" value="${s.id}" class="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer chk-santri-item">
        <span class="text-sm text-gray-700 dark:text-gray-200">${s.stambuk} - ${s.nama}</span>
      </label>
    `).join('');
  }

  if (countAssignSantri) {
    countAssignSantri.textContent = q ? `${shown.length}/${unassigned.length}` : `${unassigned.length} santri`;
  }
  // Reset "Pilih Semua" saat daftar berubah agar tidak menyesatkan.
  if (chkAssignAll) chkAssignAll.checked = false;
}

// Ketik untuk memfilter (instan, tanpa reload).
searchAssignSantri?.addEventListener('input', () => renderUnassignedSantri());

chkAssignAll?.addEventListener('change', (e) => {
  // Hanya centang santri yang SEDANG TERLIHAT (hasil filter).
  const checkboxes = listAssignSantri.querySelectorAll('.chk-santri-item');
  checkboxes.forEach(chk => {
    chk.checked = e.target.checked;
  });
});

async function loadSantriByBagian() {
  tableKelolaSantri.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Memuat data...</td></tr>';
  try {
    const res = await fetch('/api/santri');
    const data = await res.json();
    const assigned = (data || []).filter(s => s.bagian_id === currentBagianId);

    // Update counter di header
    const countEl = document.getElementById('count-santri-ruangan');
    if (countEl) countEl.textContent = assigned.length;

    if (assigned.length === 0) {
      tableKelolaSantri.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400">Belum ada santri di ruang ini.</td></tr>';
      return;
    }

    // Urutkan berdasarkan nama untuk konsistensi
    assigned.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

    let html = '';
    assigned.forEach((s, idx) => {
      const stambuk = s.stambuk || '-';
      html += `
        <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
          <td data-label="No" class="px-4 py-3 text-center text-gray-500">${idx+1}</td>
          <td data-label="Nama Santri" class="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">${s.nama}</td>
          <td data-label="Stambuk" class="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">${stambuk}</td>
          <td data-label="Aksi" class="px-4 py-3 text-center">
            <button onclick="keluarkanSantri(${s.id})" class="text-red-500 text-xs font-medium hover:underline">Keluarkan</button>
          </td>
        </tr>
      `;
    });
    tableKelolaSantri.innerHTML = html;
  } catch (err) {
    tableKelolaSantri.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-red-500">Gagal memuat</td></tr>';
  }
}

// ==================== MODAL ASSIGN SANTRI ====================
const btnOpenAssign = document.getElementById('btn-open-assign');
const modalAssign = document.getElementById('modal-assign');
const modalAssignContent = document.getElementById('modal-assign-content');
const modalAssignOverlay = document.getElementById('modal-assign-overlay');
const modalAssignClose = document.getElementById('modal-assign-close');
const modalAssignCancel = document.getElementById('modal-assign-cancel');

function openAssignModal() {
  if (!modalAssign) return;
  modalAssign.classList.remove('hidden');
  void modalAssign.offsetWidth;
  modalAssignContent.classList.remove('scale-95', 'opacity-0');
  modalAssignContent.classList.add('scale-100', 'opacity-100');
  // Reload daftar santri yang belum dikelas
  if (typeof loadSantriBelumDikelas === 'function') {
    loadSantriBelumDikelas();
  }
}

function closeAssignModal() {
  if (!modalAssign) return;
  modalAssignContent.classList.remove('scale-100', 'opacity-100');
  modalAssignContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modalAssign.classList.add('hidden'), 300);
}

btnOpenAssign?.addEventListener('click', openAssignModal);
modalAssignClose?.addEventListener('click', closeAssignModal);
modalAssignCancel?.addEventListener('click', closeAssignModal);
modalAssignOverlay?.addEventListener('click', closeAssignModal);

btnAssignSantri?.addEventListener('click', async () => {
  const checkboxes = document.querySelectorAll('.chk-santri-item:checked');
  if(checkboxes.length === 0) {
    alert("Pilih minimal satu santri!");
    return;
  }
  
  const santriIds = Array.from(checkboxes).map(chk => parseInt(chk.value));
  
  try {
    const res = await fetch('/api/santri/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        santri_ids: santriIds,
        bagian_id: currentBagianId
      })
    });
    
    if(!res.ok) throw new Error("Gagal menyimpan data");
    
    // Uncheck "Pilih Semua"
    if(chkAssignAll) chkAssignAll.checked = false;
    
    // Tutup modal kalau ada
    if (typeof closeAssignModal === 'function') closeAssignModal();

    loadSantriByBagian();
    loadAllSantri();
  } catch(err) {
    alert(err.message || "Gagal memindahkan santri");
  }
});

window.keluarkanSantri = async function(santriId) {
  if(!confirm("Keluarkan santri dari ruang ini?")) return;
  try {
    await fetch('/api/santri/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        santri_ids: [parseInt(santriId)],
        bagian_id: 0 // set to 0 to unassign
      })
    });
    loadSantriByBagian();
    loadAllSantri();
  } catch(err) {
    alert("Gagal");
  }
}

// --- JADWAL MGT ---
async function loadMapelForJadwal() {
  try {
    const bagianObj = cachedBagian.find(b => b.id === currentBagianId);
    if (!bagianObj) return;
    
    const res = await fetch(`/api/akademik/mapel?tingkatan_id=${bagianObj.tingkatan_id}&kelas_id=${bagianObj.kelas_id}`);
    const data = await res.json();
    selJadwalMapel.innerHTML = '<option value="">-- Pilih Mapel --</option>';
    if(data) {
      data.forEach(m => {
        selJadwalMapel.innerHTML += `<option value="${m.id}">${m.nama_mapel}</option>`;
      });
    }
  } catch(err) {}
}

async function loadPengajar() {
  try {
    const res = await fetch('/api/pengajar');
    const data = await res.json();
    selJadwalPengajar.innerHTML = '<option value="">-- Kosongkan (Bila belum ada) --</option>';
    if(data) {
      data.forEach(p => {
        selJadwalPengajar.innerHTML += `<option value="${p.id}">${p.nama}</option>`;
      });
    }
  } catch(err) {}
}

async function loadJadwal() {
  tableKelolaJadwal.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Memuat data...</td></tr>';
  try {
    const res = await fetch(`/api/akademik/jadwal?bagian_id=${currentBagianId}`);
    const data = await res.json();
    if (!res.ok) throw new Error("Gagal memuat jadwal");
    
    if (!data || data.length === 0) {
      tableKelolaJadwal.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Belum ada jadwal.</td></tr>';
      return;
    }
    
    let html = '';
    data.forEach(j => {
        html += `
          <tr class="border-b border-gray-100 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <td data-label="Hari" class="px-4 py-3 font-semibold">${j.hari}</td>
            <td data-label="Waktu" class="px-4 py-3">${j.jam_mulai.substring(0, 5)} - ${j.jam_selesai.substring(0, 5)} WIB</td>
            <td data-label="Mata Pelajaran" class="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">${j.nama_mapel}</td>
            <td data-label="Pengajar" class="px-4 py-3">${j.nama_pengajar || '-'}</td>
            <td data-label="Aksi" class="px-4 py-3 text-center">
            <button onclick="hapusJadwal(${j.id})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </td>
        </tr>
      `;
    });
    tableKelolaJadwal.innerHTML = html;
  } catch (err) {
    tableKelolaJadwal.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-red-500">Gagal memuat jadwal</td></tr>';
  }
}

formKelolaJadwal?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(formKelolaJadwal);
  const data = Object.fromEntries(fd);
  
  const payload = {
    bagian_id: currentBagianId,
    mapel_id: parseInt(data.mapel_id),
    hari: data.hari,
    jam_mulai: data.jam_mulai,
    jam_selesai: data.jam_selesai
  };
  if(data.pengajar_id) {
    payload.pengajar_id = parseInt(data.pengajar_id);
  }
  
  try {
    const res = await fetch('/api/akademik/jadwal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error("Gagal menyimpan");
    formKelolaJadwal.reset();
    loadJadwal();
  } catch (err) {
    alert(err.message);
  }
});

window.hapusJadwal = async function(id) {
  if(!confirm("Hapus jadwal ini?")) return;
  try {
    await fetch(`/api/akademik/jadwal/${id}`, { method: 'DELETE' });
    loadJadwal();
  } catch(err) {
    alert("Gagal menghapus");
  }
};

// ==========================================
// 5. SETUP MASTER DATA
// ==========================================

async function loadDropdowns() {
  try {
    const resTingkat = await fetch('/api/akademik/tingkatan');
    const dataTingkat = await resTingkat.json();
    selTingkatan.innerHTML = '<option value="">-- Pilih Tingkatan --</option>';
    if(resTingkat.ok && dataTingkat) {
      dataTingkat.forEach(t => {
        selTingkatan.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
      });
    }

    const resKelas = await fetch('/api/akademik/kelas');
    const dataKelas = await resKelas.json();
    selKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    if(resKelas.ok && dataKelas) {
      dataKelas.forEach(a => {
        selKelas.innerHTML += `<option value="${a.id}">${a.nama}</option>`;
      });
    }

    if (selKuriTingkatan && selKuriKelas) {
      selKuriTingkatan.innerHTML = '<option value="">-- Pilih Tingkatan --</option>';
      selKuriKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
      if(resTingkat.ok && dataTingkat) {
        dataTingkat.forEach(t => {
          selKuriTingkatan.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
        });
      }
      if(resKelas.ok && dataKelas) {
        dataKelas.forEach(a => {
          selKuriKelas.innerHTML += `<option value="${a.id}">${a.nama}</option>`;
        });
      }
    }
  } catch(err) { console.error(err); }
}

async function loadSetupData() {
  try {
    const resTingkat = await fetch('/api/akademik/tingkatan');
    const dataTingkat = await resTingkat.json();
    listTingkatan.innerHTML = '';
    if(resTingkat.ok && dataTingkat) {
      dataTingkat.forEach(t => {
        listTingkatan.innerHTML += `<li class="flex justify-between items-center px-2 py-1 border-b border-gray-100 dark:border-slate-700">
          <div>
            <span>${t.nama}</span> <span class="text-xs text-gray-400 ml-2">Urutan: ${t.urutan}</span>
          </div>
          <button onclick="hapusTingkatan(${t.id})" class="text-red-500 hover:text-red-700 text-xs font-medium">Hapus</button>
        </li>`;
      });
    }

    const resKelas = await fetch('/api/akademik/kelas');
    const dataKelas = await resKelas.json();
    listKelas.innerHTML = '';
    if(resKelas.ok && dataKelas) {
      dataKelas.forEach(a => {
        listKelas.innerHTML += `<li class="flex justify-between items-center px-2 py-1 border-b border-gray-100 dark:border-slate-700">
          <span>${a.nama}</span>
          <button onclick="hapusKelas(${a.id})" class="text-red-500 hover:text-red-700 text-xs font-medium">Hapus</button>
        </li>`;
      });
    }
  } catch(err) { console.error(err); }
}

formTingkatan?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(formTingkatan));
  data.urutan = parseInt(data.urutan);
  try {
    await fetch('/api/akademik/tingkatan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    formTingkatan.reset();
    loadSetupData();
    loadDropdowns();
  } catch(err) {}
});

formKelasMaster?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(formKelasMaster));
  try {
    await fetch('/api/akademik/kelas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: data.nama, tahun_masuk: new Date().getFullYear().toString() })
    });
    formKelasMaster.reset();
    loadSetupData();
    loadDropdowns();
  } catch(err) {}
});

window.hapusTingkatan = async function(id) {
  if(!confirm("Hapus Tingkatan ini?")) return;
  try {
    await fetch(`/api/akademik/tingkatan/${id}`, { method: 'DELETE' });
    loadSetupData();
    loadDropdowns();
  } catch(err) {
    alert("Gagal menghapus");
  }
};

window.hapusKelas = async function(id) {
  if(!confirm("Hapus Kelas ini? Pastikan tidak ada data yang terikat dengan kelas ini.")) return;
  try {
    const res = await fetch(`/api/akademik/kelas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Gagal menghapus");
    loadSetupData();
    loadDropdowns();
  } catch(err) {
    alert(err.message);
  }
};

// === TATA ULANG NO STAMBUK ===
document.getElementById('btn-susun-stambuk')?.addEventListener('click', async () => {
  const tingkatanId = selTingkatan?.value || selKuriTingkatan?.value;
  const kelasId = selKelas?.value || selKuriKelas?.value;

  if (!tingkatanId || !kelasId) {
    alert("Silakan pilih Tingkatan dan Kelas terlebih dahulu pada filter Kurikulum.");
    return;
  }

  const confirmMsg = "Apakah Anda yakin ingin menata ulang Stambuk untuk kelas ini?\nStambuk akan disusun otomatis sesuai urutan bagian dan nama santri.";
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/stambuk/susun-ulang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tingkatan_id: parseInt(tingkatanId),
        kelas_id: parseInt(kelasId)
      })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message || d.error || "Gagal menyusun ulang stambuk");
    alert(`Berhasil! ${d.count || 0} santri telah diperbarui nomor stambuknya.`);
  } catch (err) {
    alert(err.message);
  }
});
