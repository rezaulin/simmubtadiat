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
    gridKelas.innerHTML = `<div class="col-span-full p-8 text-center text-gray-500 dark:text-gray-400 glass rounded-3xl">Belum ada ruang kelas.</div>`;
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
  tableKelolaMapel.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Memuat data...</td></tr>';
  try {
    const res = await fetch(`/api/akademik/mapel?tingkatan_id=${currentKuriTingkatanId}&kelas_id=${currentKuriKelasId}`);
    const data = await res.json();
    if (!res.ok) throw new Error("Gagal memuat mapel");
    cachedMapel = data || [];
    renderMapelKurikulum();
  } catch (err) {
    tableKelolaMapel.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-center text-red-500">${err.message}</td></tr>`;
  }
}

function renderMapelKurikulum() {
  if (!cachedMapel || cachedMapel.length === 0) {
    tableKelolaMapel.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Belum ada mata pelajaran di kurikulum ini.</td></tr>`;
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

    // Badge kategori
    const katLabels = { umum: 'Umum', al_quran: "Al-Qur'an", al_khot_imla: "Al-Khot Imla'", qiroah_kutub: 'Qiroatul Kutub', muhafadhoh: 'Muhafadhoh', akhlaq: 'Akhlaq (ilmu)', akhlaq_perilaku: 'Akhlaq Perilaku' };
    const katColors = { umum: 'bg-gray-100 text-gray-600', al_quran: 'bg-emerald-50 text-emerald-700', al_khot_imla: 'bg-blue-50 text-blue-700', qiroah_kutub: 'bg-purple-50 text-purple-700', muhafadhoh: 'bg-amber-50 text-amber-700', akhlaq: 'bg-teal-50 text-teal-700', akhlaq_perilaku: 'bg-rose-50 text-rose-700' };
    const kat = m.kategori || 'umum';
    const katBadge = `<span class="px-2 py-1 rounded ${katColors[kat] || katColors.umum} text-xs font-semibold">${katLabels[kat] || kat}</span>`;

    html += `
      <tr>
        <td class="px-4 py-3 text-center">${m.urutan}</td>
        <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">${m.nama_mapel}</td>
        <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${m.nama_kitab || '-'}</td>
        <td class="px-4 py-3">${katBadge}</td>
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
        nama_indo: data.nama_indo || '',
        kategori: data.kategori || 'umum',
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

  // Decode entitas HTML (&amp; -> &, dst) sebelum mengisi form: XSS sanitizer
  // global meng-escape semua response API, dan .value TIDAK men-decode
  // entitas. Tanpa ini, tiap edit mapel menyimpan "&amp;" mentah ke DB dan
  // berakumulasi jadi "&amp;amp;" (bug 2026-08: "Aswaja &amp;amp; Ke-NU-an"
  // muncul di raport kelas 3).
  const decodeEntities = (str) => {
    if (str === null || str === undefined) return '';
    const el = document.createElement('textarea');
    el.innerHTML = String(str);
    return el.value;
  };

  document.getElementById('mapel-id').value = m.id;
  formKelolaMapel.querySelector('[name="nama_mapel"]').value = decodeEntities(m.nama_mapel);
  formKelolaMapel.querySelector('[name="nama_kitab"]').value = decodeEntities(m.nama_kitab);
  const indoInput = formKelolaMapel.querySelector('[name="nama_indo"]');
  if (indoInput) indoInput.value = decodeEntities(m.nama_indo || '');
  formKelolaMapel.querySelector('[name="urutan"]').value = m.urutan;
  // Populate kategori dropdown
  const katSelect = formKelolaMapel.querySelector('[name="kategori"]');
  if (katSelect) katSelect.value = m.kategori || 'umum';
  
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
  
  btnSantri.className = "pb-3 text-sm font-medium border-b-2 border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-700 transition-colors";
  btnJadwal.className = "pb-3 text-sm font-medium border-b-2 border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-700 transition-colors";
  contentKelolaSantri.classList.add('hidden');
  contentKelolaJadwal.classList.add('hidden');
  
  if (tab === 'santri') {
    btnSantri.className = "pb-3 text-sm font-semibold border-b-2 border-primary text-primary transition-colors";
    contentKelolaSantri.classList.remove('hidden');
  } else if (tab === 'jadwal') {
    btnJadwal.className = "pb-3 text-sm font-semibold border-b-2 border-primary text-primary transition-colors";
    contentKelolaJadwal.classList.remove('hidden');
    loadMapelForJadwal();
    loadPengajar();
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
    listAssignSantri.innerHTML = '<div class="text-gray-600 dark:text-gray-400 italic text-center py-4">Tidak ada santri yang belum dikelas</div>';
    if (chkAssignAll) { chkAssignAll.disabled = true; chkAssignAll.checked = false; }
    if (countAssignSantri) countAssignSantri.textContent = '';
    return;
  }
  if (chkAssignAll) chkAssignAll.disabled = false;

  if (shown.length === 0) {
    listAssignSantri.innerHTML = '<div class="text-gray-500 dark:text-gray-400 italic text-center py-4">Tidak ada yang cocok dengan pencarian</div>';
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
  tableKelolaSantri.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Memuat data...</td></tr>';
  try {
    const res = await fetch('/api/santri');
    const data = await res.json();
    const assigned = (data || []).filter(s => s.bagian_id === currentBagianId);

    // Update counter di header
    const countEl = document.getElementById('count-santri-ruangan');
    if (countEl) countEl.textContent = assigned.length;

    if (assigned.length === 0) {
      tableKelolaSantri.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Belum ada santri di ruang ini.</td></tr>';
      return;
    }

    // Urutkan berdasarkan nama untuk konsistensi
    assigned.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

    let html = '';
    assigned.forEach((s, idx) => {
      const stambuk = s.stambuk || '-';
      html += `
        <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
          <td data-label="No" class="px-4 py-3 text-center text-gray-600 dark:text-gray-400">${idx+1}</td>
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

// --- JADWAL MGT v3: papan seminggu, sekali simpan (permintaan owner 2026-10-12) ---
// Grid 6 hari x 2 hissoh. Semua editan disimpan lokal di `jadwalDraft`,
// baru dikirim SEKALIGUS lewat PUT /jadwal-minggu (transaksi atomik).
const JADWAL_HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Sabtu'];
const JADWAL_HISSOH = [['ula', 'Hissoh Ula'], ['tsaniyah', 'Hissoh Tsaniyah']];
let jadwalDraft = [];      // {hari, hissoh, peran, mapel_id, nama_kitab, nama_pengajar}
let jadwalOrig = '';       // snapshot (stripped) utk indikator "Belum tersimpan"
let jadwalMapel = [];      // kitab utk kelas ini
let jadwalGuru = [];       // [{peran, pengajar_id, nama}] dari penugasan
let jadwalSlot = null;     // slot aktif {hari, hissoh}
let jadwalActiveDay = null; // hari aktif di tab HP (default Ahad)

const jadwalStrip = (e) => ({ hari: e.hari, hissoh: e.hissoh, peran: e.peran, mapel_id: e.mapel_id });
const jadwalNamaKitab = (m) => (m.nama_kitab && String(m.nama_kitab).trim()) ? m.nama_kitab : m.nama_mapel;
const jadwalHissohLabel = (h) => h === 'ula' ? 'Hissoh Ula' : 'Hissoh Tsaniyah';

function jadwalUpdateDirty() {
  const badge = document.getElementById('jadwal-dirty');
  if (!badge) return;
  const dirty = JSON.stringify(jadwalDraft.map(jadwalStrip)) !== jadwalOrig;
  badge.classList.toggle('hidden', !dirty);
}

async function loadMapelForJadwal() {
  try {
    const bagianObj = cachedBagian.find(b => b.id === currentBagianId);
    if (!bagianObj) return;
    const res = await fetch(`/api/akademik/mapel?tingkatan_id=${bagianObj.tingkatan_id}&kelas_id=${bagianObj.kelas_id}`);
    jadwalMapel = (await res.json()) || [];
    renderSlotMapel();
  } catch(err) { jadwalMapel = []; }
}

// Dropdown guru HANYA dari penugasan bagian ini (mustahiq + munawwib).
async function loadPengajar() {
  try {
    if (!currentBagianId) { jadwalGuru = []; return; }
    const res = await fetch(`/api/akademik/jadwal-pengajar?bagian_id=${encodeURIComponent(currentBagianId)}`);
    jadwalGuru = (await res.json()) || [];
    renderSlotGuru();
  } catch(err) { jadwalGuru = []; }
}

async function loadJadwal() {
  jadwalRenderGrid('memuat');
  try {
    const res = await fetch(`/api/akademik/jadwal?bagian_id=${currentBagianId}`);
    const data = await res.json();
    if (!res.ok) throw new Error('Gagal memuat jadwal');
    jadwalDraft = (data || []).map(j => ({
      hari: j.hari, hissoh: j.hissoh, peran: j.peran, mapel_id: j.mapel_id,
      nama_kitab: j.nama_kitab || j.nama_mapel || '-',
      nama_pengajar: j.nama_pengajar || ''
    }));
    jadwalOrig = JSON.stringify(jadwalDraft.map(jadwalStrip));
    jadwalRenderGrid();
    jadwalUpdateDirty();
    renderSlotList();
  } catch (err) {
    jadwalRenderGrid('gagal');
  }
}

function jadwalRenderGrid(mode) {
  const body = document.getElementById('jadwal-grid-body');
  const cardWrap = document.getElementById('jadwal-card-wrap');
  if (!body) return;
  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  if (mode === 'memuat') {
    body.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-8 text-xs">Memuat jadwal...</td></tr>';
    if (cardWrap) cardWrap.innerHTML = '<p class="text-center text-gray-500 py-8 text-xs">Memuat jadwal...</p>';
    return;
  }
  if (mode === 'gagal') {
    body.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 py-8 text-xs">Gagal memuat jadwal</td></tr>';
    if (cardWrap) cardWrap.innerHTML = '<p class="text-center text-red-500 py-8 text-xs">Gagal memuat jadwal</p>';
    return;
  }

  // HP (<768px): tab hari. Cuma 1 hari tampil sekaligus. Nol geser samping.
  if (isMobile && cardWrap) {
    if (!jadwalActiveDay) jadwalActiveDay = JADWAL_HARI[0];
    // Baris tab hari (scroll horizontal halus kalau sempit, tapi tetap 1 baris).
    let tabs = '<div class="jadwal-day-tabs -mx-1 px-1 mb-3 flex gap-1.5 overflow-x-auto pb-1">';
    for (const hari of JADWAL_HARI) {
      const on = hari === jadwalActiveDay;
      tabs += `<button type="button" class="jadwal-day-tab shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${on
        ? 'bg-primary text-white border-primary shadow-sm'
        : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600'}" data-day="${hari}">${hari}</button>`;
    }
    tabs += '</div>';

    // Kartu hanya untuk hari aktif — 2 hissoh.
    const hari = jadwalActiveDay;
    let slotHtml = '';
    for (const [hissoh, label] of JADWAL_HISSOH) {
      const items = jadwalDraft.map((e, i) => ({ e, i }))
        .filter(x => x.e.hari === hari && x.e.hissoh === hissoh);
      let inner;
      if (items.length === 0) {
        inner = '<span class="text-gray-300 dark:text-slate-600 text-xs">+ klik untuk isi</span>';
      } else {
        inner = items.map(x => {
          const guru = x.e.nama_pengajar || '(kosong)';
          return `<div class="flex items-center justify-between gap-1 text-[11px] leading-tight bg-primary/10 text-primary dark:bg-slate-700 dark:text-gray-200 rounded px-1.5 py-1 mb-1">
            <span class="font-semibold truncate"><span class="font-arab">${x.e.nama_kitab}</span> <span class="font-normal opacity-70">&middot; ${guru}</span></span>
            <button type="button" class="jadwal-del shrink-0 text-red-400 hover:text-red-600 font-bold px-2 py-1" data-entry="${x.i}" title="Hapus dari slot">&#10005;</button>
          </div>`;
        }).join('');
      }
      slotHtml += `<div class="mb-2">
        <div class="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">${label}</div>
        <div class="jadwal-cell cursor-pointer border border-gray-200 dark:border-slate-700 rounded-lg p-2 min-h-[44px] hover:border-primary/60 hover:bg-primary/5 transition-colors" data-hari="${hari}" data-hissoh="${hissoh}">${inner}</div>
      </div>`;
    }
    cardWrap.innerHTML = `${tabs}<div class="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="bg-gray-50 dark:bg-slate-700/50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">${hari}</div>
      <div class="p-2">${slotHtml}</div>
    </div>`;
    body.innerHTML = ''; // tabel kosong, disembunyikan CSS di HP
    return;
  }

  // Desktop (>=768px): tabel 7 kolom seperti semula.
  if (cardWrap) cardWrap.innerHTML = '';
  let html = '';
  for (const [hissoh, label] of JADWAL_HISSOH) {
    html += `<tr><td class="text-xs font-bold text-gray-600 dark:text-gray-300 px-1 whitespace-nowrap align-top">${label}</td>`;
    for (const hari of JADWAL_HARI) {
      const items = jadwalDraft.map((e, i) => ({ e, i }))
        .filter(x => x.e.hari === hari && x.e.hissoh === hissoh);
      let inner = '';
      if (items.length === 0) {
        inner = '<span class="text-gray-300 dark:text-slate-600 text-xs">+ klik untuk isi</span>';
      } else {
        inner = items.map(x => {
          const guru = x.e.nama_pengajar || '(kosong)';
          return `<div class="flex items-center justify-between gap-1 text-[11px] leading-tight bg-primary/10 text-primary dark:bg-slate-700 dark:text-gray-200 rounded px-1.5 py-1 mb-1">
            <span class="font-semibold truncate"><span class="font-arab">${x.e.nama_kitab}</span> <span class="font-normal opacity-70">&middot; ${guru}</span></span>
            <button type="button" class="jadwal-del shrink-0 text-red-400 hover:text-red-600 font-bold px-0.5" data-entry="${x.i}" title="Hapus dari slot">&#10005;</button>
          </div>`;
        }).join('');
      }
      html += `<td class="jadwal-cell cursor-pointer border border-gray-200 dark:border-slate-700 rounded-lg p-1.5 align-top hover:border-primary/60 hover:bg-primary/5 transition-colors" data-hari="${hari}" data-hissoh="${hissoh}">${inner}</td>`;
    }
    html += '</tr>';
  }
  body.innerHTML = html;
}

function jadwalOpenSlot(hari, hissoh) {
  jadwalSlot = { hari, hissoh };
  const panel = document.getElementById('jadwal-slot-panel');
  const title = document.getElementById('jadwal-slot-title');
  if (!panel || !title) return;
  title.textContent = `Isi Slot: ${hari} \u00b7 ${jadwalHissohLabel(hissoh)}`;
  panel.classList.remove('hidden');
  renderSlotGuru(); renderSlotMapel(); renderSlotList();
}

function renderSlotGuru() {
  const sel = document.getElementById('jadwal-slot-guru');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Guru --</option>';
  if (!jadwalGuru.length) {
    sel.innerHTML += '<option value="" disabled>Penugasan kelas ini belum ada</option>';
    return;
  }
  for (const g of jadwalGuru) {
    sel.innerHTML += `<option value="${g.peran}">${g.nama} (${g.peran})</option>`;
  }
}

function renderSlotMapel() {
  const box = document.getElementById('jadwal-slot-mapel');
  if (!box) return;
  if (!jadwalMapel.length) {
    box.innerHTML = '<span class="text-gray-400 text-xs">Belum ada kitab untuk kelas ini.</span>';
    return;
  }
  box.innerHTML = jadwalMapel.map(m =>
    `<label class="flex items-center gap-2 text-xs cursor-pointer">
       <input type="checkbox" class="slot-mapel-cb rounded" value="${m.id}"> <span>${jadwalNamaKitab(m)}</span>
     </label>`).join('');
}

function renderSlotList() {
  const el = document.getElementById('jadwal-slot-list');
  if (!el) return;
  if (!jadwalSlot) { el.innerHTML = ''; return; }
  const items = jadwalDraft.map((e, i) => ({ e, i }))
    .filter(x => x.e.hari === jadwalSlot.hari && x.e.hissoh === jadwalSlot.hissoh);
  if (!items.length) {
    el.innerHTML = '<p class="text-xs text-gray-400">Slot ini masih kosong.</p>';
    return;
  }
  el.innerHTML = items.map(x =>
    `<div class="flex items-center justify-between gap-2 text-xs bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
       <span><b class="font-arab">${x.e.nama_kitab}</b> &mdash; ${x.e.nama_pengajar || '(kosong)'} <span class="text-gray-400">(${x.e.peran})</span></span>
       <button type="button" class="jadwal-del text-red-400 hover:text-red-600 font-bold" data-entry="${x.i}">&#10005;</button>
     </div>`).join('');
}

// Klik sel: buka panel slot. Klik &#10005;: hapus entry dari draft (belum tersimpan).
// Handler sama dipasang di dua wadah: #jadwal-grid-body (desktop) & #jadwal-card-wrap (HP).
function jadwalGridClickHandler(ev) {
  // Klik tab hari (HP): ganti hari aktif, render ulang.
  const tab = ev.target.closest('.jadwal-day-tab');
  if (tab) {
    jadwalActiveDay = tab.dataset.day;
    jadwalRenderGrid();
    return;
  }
  const del = ev.target.closest('.jadwal-del');
  if (del) {
    ev.stopPropagation();
    jadwalDraft.splice(parseInt(del.dataset.entry, 10), 1);
    jadwalRenderGrid(); jadwalUpdateDirty(); renderSlotList();
    return;
  }
  const cell = ev.target.closest('.jadwal-cell');
  if (cell) jadwalOpenSlot(cell.dataset.hari, cell.dataset.hissoh);
}
document.getElementById('jadwal-grid-body')?.addEventListener('click', jadwalGridClickHandler);
document.getElementById('jadwal-card-wrap')?.addEventListener('click', jadwalGridClickHandler);

// Desktop <-> HP: render ulang bentuk (tabel vs kartu) saat lebar melewati 768px.
let jadwalWasMobile = window.matchMedia('(max-width: 767px)').matches;
window.addEventListener('resize', () => {
  const nowMobile = window.matchMedia('(max-width: 767px)').matches;
  if (nowMobile === jadwalWasMobile) return;
  jadwalWasMobile = nowMobile;
  if (typeof jadwalRenderGrid === 'function') {
    jadwalRenderGrid();
    renderSlotList();
  }
});
document.getElementById('jadwal-slot-list')?.addEventListener('click', (ev) => {
  const del = ev.target.closest('.jadwal-del');
  if (!del) return;
  jadwalDraft.splice(parseInt(del.dataset.entry, 10), 1);
  jadwalRenderGrid(); jadwalUpdateDirty(); renderSlotList();
});

document.getElementById('btn-slot-close')?.addEventListener('click', () => {
  document.getElementById('jadwal-slot-panel')?.classList.add('hidden');
  jadwalSlot = null;
});

// Tambah kitab tercentang ke slot aktif (dedupe: slot+peran+kitab sama = skip).
document.getElementById('btn-slot-add')?.addEventListener('click', () => {
  if (!jadwalSlot) return;
  const peran = document.getElementById('jadwal-slot-guru')?.value;
  if (!peran) { alert('Pilih pengajar dulu.'); return; }
  const checked = [...document.querySelectorAll('#jadwal-slot-mapel .slot-mapel-cb:checked')];
  if (!checked.length) { alert('Centang minimal satu kitab.'); return; }
  const guru = jadwalGuru.find(g => g.peran === peran);
  let n = 0;
  for (const cb of checked) {
    const mid = parseInt(cb.value, 10);
    const ada = jadwalDraft.some(e =>
      e.hari === jadwalSlot.hari && e.hissoh === jadwalSlot.hissoh &&
      e.peran === peran && e.mapel_id === mid);
    if (ada) continue;
    const m = jadwalMapel.find(x => x.id === mid);
    jadwalDraft.push({
      hari: jadwalSlot.hari, hissoh: jadwalSlot.hissoh, peran: peran, mapel_id: mid,
      nama_kitab: m ? jadwalNamaKitab(m) : String(mid),
      nama_pengajar: guru ? guru.nama : ''
    });
    n++;
  }
  checked.forEach(cb => { cb.checked = false; });
  jadwalRenderGrid(); jadwalUpdateDirty(); renderSlotList();
});

// SEKALI SIMPAN untuk seluruh minggu — atomik di server (DELETE + INSERT dalam tx).
document.getElementById('btn-jadwal-save')?.addEventListener('click', async () => {
  if (!currentBagianId) return;
  const btn = document.getElementById('btn-jadwal-save');
  try {
    const res = await fetch(`/api/akademik/jadwal-minggu?bagian_id=${encodeURIComponent(currentBagianId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: jadwalDraft.map(jadwalStrip) })
    });
    if (!res.ok) throw new Error((await res.text()) || 'Gagal menyimpan');
    await loadJadwal();
    const lama = btn.textContent;
    btn.textContent = 'Tersimpan \u2713';
    setTimeout(() => { btn.textContent = lama; }, 1500);
  } catch (err) {
    alert(err.message);
  }
});
document.getElementById('btn-jadwal-reload')?.addEventListener('click', () => loadJadwal());

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
            <span>${t.nama}</span> <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">Urutan: ${t.urutan}</span>
          </div>
          <div class="flex gap-2">
            <button onclick="editTingkatan(${t.id}, '${t.nama.replace(/'/g, "\\'")}', ${t.urutan})" class="text-blue-500 hover:text-blue-700 text-xs font-medium">Edit</button>
            <button onclick="hapusTingkatan(${t.id})" class="text-red-500 hover:text-red-700 text-xs font-medium">Hapus</button>
          </div>
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
          <div class="flex gap-2">
            <button onclick="editKelas(${a.id}, '${a.nama.replace(/'/g, "\\'")}')" class="text-blue-500 hover:text-blue-700 text-xs font-medium">Edit</button>
            <button onclick="hapusKelas(${a.id})" class="text-red-500 hover:text-red-700 text-xs font-medium">Hapus</button>
          </div>
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

window.editTingkatan = async function(id, nama, urutan) {
  const newNama = prompt("Nama Tingkatan:", nama);
  if (newNama === null || newNama.trim() === '') return;
  const newUrutanStr = prompt("Urutan:", urutan);
  if (newUrutanStr === null) return;
  const newUrutan = parseInt(newUrutanStr);
  if (isNaN(newUrutan)) return alert("Urutan harus angka");
  
  try {
    const res = await fetch(`/api/akademik/tingkatan/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: newNama.trim(), urutan: newUrutan, is_active: true })
    });
    if (!res.ok) throw new Error("Gagal update");
    loadSetupData();
    loadDropdowns();
  } catch(err) {
    alert("Gagal mengupdate tingkatan");
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
    alert("Gagal menghapus kelas");
  }
};

window.editKelas = async function(id, nama) {
  const newNama = prompt("Nama Kelas:", nama);
  if (newNama === null || newNama.trim() === '') return;
  
  try {
    const res = await fetch(`/api/akademik/kelas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: newNama.trim(), tahun_masuk: new Date().getFullYear().toString(), is_active: true })
    });
    if (!res.ok) throw new Error("Gagal update");
    loadSetupData();
    loadDropdowns();
  } catch(err) {
    alert("Gagal mengupdate kelas");
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
