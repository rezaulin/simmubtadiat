// frontend/src/js/santri.js

// 1. DOM Elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const btnTambah = document.getElementById('btn-tambah');
// Tab Elements
const tabAktif = document.getElementById('tab-aktif');
const tabBelum = document.getElementById('tab-belum');
const contentAktif = document.getElementById('content-aktif');
const contentBelum = document.getElementById('content-belum');
const tableBelumBody = document.getElementById('table-belum-body');
const checkAllBelum = document.getElementById('check-all-belum');
const btnAssignBatch = document.getElementById('btn-assign-batch');
// Modal Form Elements
const modal = document.getElementById('modal-santri');
const modalContent = document.getElementById('modal-content');
const modalOverlay = document.getElementById('modal-overlay');
const btnClose = document.getElementById('modal-close');
const btnCancel = document.getElementById('btn-cancel');
const formSantri = document.getElementById('form-santri');
const modalError = document.getElementById('modal-error');
const selectBagianAwal = document.getElementById('select-bagian-awal');
// Modal Detail Elements
const modalDetail = document.getElementById('modal-detail');
const modalDetailOverlay = document.getElementById('modal-detail-overlay');
const modalDetailContent = document.getElementById('modal-detail-content');
const btnDetailClose = document.getElementById('modal-detail-close');
const detailLoading = document.getElementById('detail-loading');
const detailBody = document.getElementById('detail-body');

let activeTab = 'aktif';
let allTingkatan = [];
let allProvinsi = [];
let cachedSantriData = null;

// Escape teks untuk mencegah HTML injection saat render (mis. nama/alasan impor).
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Safely parse a fetch Response as JSON. Some backend error paths return a
// plain-text body (e.g. "no rows in result set"), which would make
// response.json() throw "Unexpected token 'o'... is not valid JSON". This
// helper returns null instead of throwing so callers can handle errors with a
// clean message based on response.ok.
async function parseJSONSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return { message: text };
  }
}

// Apply Theme
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

// 2. Auth
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await response.json();
    if (window.isAdminRole(data.role)) {
      btnTambah.classList.remove('hidden');
      const importBtn = document.getElementById('btn-import');
      if (importBtn) importBtn.classList.remove('hidden');
      const fab = document.getElementById('btn-tambah-fab');
      if (fab) fab.addEventListener('click', openModal);
    }
    const roles = data.roles || [data.role];
    if (roles.includes('pimpinan') || roles.includes('admin')) {
      const exportBtn = document.getElementById('btn-export');
      if (exportBtn) {
        exportBtn.classList.remove('hidden');
        exportBtn.classList.add('flex');
        exportBtn.addEventListener('click', () => {
          window.location.href = '/api/santri/export';
        });
      }
    }
    
    await loadData();
    loadBagianOptions(roles);

    // Auto-open detail if navigated from global search (#detail-<id>)
    handleDetailHash();

  } catch (err) {
    console.error("Auth check failed:", err);
  }
}

// 3. Tab Navigation
tabAktif.addEventListener('click', () => {
  activeTab = 'aktif';
  tabAktif.className = "pb-2 text-sm font-semibold border-b-2 border-primary text-primary dark:border-accent-emerald dark:text-accent-emerald transition-colors";
  tabBelum.className = "pb-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors";
  contentAktif.classList.remove('hidden');
  contentBelum.classList.add('hidden');
  loadData();
});

tabBelum.addEventListener('click', () => {
  activeTab = 'belum';
  tabBelum.className = "pb-2 text-sm font-semibold border-b-2 border-primary text-primary dark:border-accent-emerald dark:text-accent-emerald transition-colors";
  tabAktif.className = "pb-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors";
  contentBelum.classList.remove('hidden');
  contentAktif.classList.add('hidden');
  loadData();
});

// 4. Fetch Data
function loadData() {
  if (activeTab === 'aktif') {
    loadSantriAktif(searchInput.value);
  } else {
    loadSantriBelum(searchInput.value);
  }
}

let searchTimeout;

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    // If we have cached data, filter client-side for instant results
    if (activeTab === 'aktif' && cachedSantriData) {
      renderSantriAktif(cachedSantriData, searchInput.value);
    } else {
      loadData();
    }
  }, 300);
});

function formatKelas(s) {
  if (!s.bagian_id || s.bagian_id === 0) return 'Belum di kelas';
  let result = '';
  if (s.tingkatan_nama) result += s.tingkatan_nama;
  if (s.kelas_nama) result += ` (${s.kelas_nama})`;
  if (s.bagian_nama) result += ` - ${s.bagian_nama}`;
  return result || 'Belum di kelas';
}

async function loadSantriAktif(query = '') {
  tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">Memuat data...</td></tr>`;
  try {
    const response = await fetch('/api/santri');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    
    // Cache for client-side filtering
    cachedSantriData = (data || []).filter(s => s.status !== 'lulus' && s.status !== 'boyong');
    
    renderSantriAktif(cachedSantriData, query);
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">${err.message}</td></tr>`;
  }
}

function renderSantriAktif(allData, query = '') {
  let filtered = allData;
  
  const tingkatanId = filterTingkatan ? filterTingkatan.value : '';
  const kelasVal = filterKelas ? filterKelas.value : '';
  const bagianVal = filterBagian ? filterBagian.value : '';
  const provId = filterProvinsi ? filterProvinsi.value : '';
  const kabId = filterKabupaten ? filterKabupaten.value : '';

  if (tingkatanId) {
    filtered = filtered.filter(s => s.tingkatan_nama === tingkatanId);
  }
  if (kelasVal) {
    filtered = filtered.filter(s => s.kelas_nama === kelasVal);
  }
  if (bagianVal) {
    filtered = filtered.filter(s => s.bagian_nama === bagianVal);
  }
  if (provId) {
    filtered = filtered.filter(s => s.provinsi_kode === provId);
  }
  if (kabId) {
    filtered = filtered.filter(s => s.kabupaten_kode === kabId);
  }

  if (query && query.length > 1) {
    const q = query.toLowerCase();
    filtered = filtered.filter(s => 
      s.nama.toLowerCase().includes(q) || 
      (s.stambuk && s.stambuk.toLowerCase().includes(q)) ||
      (s.stambuk && s.stambuk.toLowerCase().includes(q)) ||
      (s.nik && s.nik.includes(q))
    );
  }
  
  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400">Tidak ada data${query ? ' untuk pencarian "' + query + '"' : ''}.</td></tr>`;
    return;
  }
  
  tableBody.innerHTML = '';
  filtered.forEach(s => {
    const kelasInfo = formatKelas(s);
    const stambukDinamis = s.stambuk || (s.stambuk_urut ? String(s.stambuk_urut) : '-');
    
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors';
    tr.innerHTML = `
      <td data-label="Nama Lengkap" class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
        ${s.nama}
      </td>
      <td data-label="Asal Daerah" class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
        ${s.kabupaten_nama ? s.kabupaten_nama + (s.provinsi_nama ? ', ' + s.provinsi_nama : '') : '-'}
      </td>
      <td data-label="Kamar" class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
        ${s.kamar || '-'}
      </td>
      <td data-label="Stambuk" class="px-6 py-4 text-indigo-600 dark:text-indigo-400 font-bold">${stambukDinamis}</td>
      <td data-label="Ruang & Kelas" class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
        ${kelasInfo}
      </td>
      <td data-label="Status" class="px-6 py-4">
        <span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">AKTIF</span>
      </td>
      <td data-label="Aksi" class="px-6 py-4 text-right">
        <button onclick="openDetail('${s.id}')" class="text-primary dark:text-accent-emerald hover:underline text-sm font-medium">Detail</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

async function loadSantriBelum(query = '') {
  tableBelumBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Memuat data...</td></tr>`;
  try {
    const response = await fetch('/api/santri');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    
    // Filter belum dikelas
    let unassigned = (data || []).filter(s => s.status === 'aktif' && (!s.bagian_id || s.bagian_id === 0));
    
    if (query.length > 2) {
       unassigned = unassigned.filter(s => s.nama.toLowerCase().includes(query.toLowerCase()) || s.stambuk.includes(query));
    }
    
    if (unassigned.length === 0) {
      tableBelumBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Tidak ada santri yang belum dikelas.</td></tr>`;
      return;
    }
    
    tableBelumBody.innerHTML = '';
    unassigned.forEach(s => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors';
      tr.innerHTML = `
        <td data-label="Pilih" class="px-4 py-4 md:text-center flex justify-end">
          <input type="checkbox" class="cb-belum w-4 h-4 rounded border-gray-300" value="${s.id}">
        </td>
        <td data-label="Nama Lengkap" class="px-6 py-4 font-medium text-gray-900 dark:text-white">${s.nama}</td>
        <td data-label="No. Stambuk" class="px-6 py-4 text-gray-700 dark:text-gray-300">${s.stambuk || '-'}</td>
        <td data-label="Assign ke Kelas" class="px-6 py-4">
          <select class="sel-assign glass-input px-2 py-1 rounded text-sm bg-white dark:bg-slate-800" data-santri-id="${s.id}">
            <option value="">-- Pilih Bagian --</option>
          </select>
        </td>
      `;
      tableBelumBody.appendChild(tr);
    });
    
    populateAssignSelects();
    
  } catch (err) {
    tableBelumBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-red-500">${err.message}</td></tr>`;
  }
}

// 5. Bagian Loading
let cachedBagian = [];
async function loadBagianOptions(roles = []) {
  try {
    const isMustahiqOnly = roles.includes('mustahiq') && !roles.includes('pimpinan') && !roles.includes('admin') && !roles.includes('keamanan');
    const endpoint = isMustahiqOnly ? '/api/penilaian/bagian' : '/api/akademik/bagian';
    const res = await fetch(endpoint);
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      cachedBagian = data;
      // Populate select in form
      selectBagianAwal.innerHTML = '<option value="">-- Biarkan Kosong (Belum Dikelas) --</option>';
      data.forEach(b => {
        selectBagianAwal.innerHTML += `<option value="${b.id}">${b.tingkatan} - ${b.kelas} - ${b.nama_bagian}</option>`;
      });
      populateFilterTingkatan();
    }
  } catch(e) { console.error(e); }
}

function populateAssignSelects() {
  const selects = document.querySelectorAll('.sel-assign');
  selects.forEach(sel => {
    sel.innerHTML = '<option value="">-- Pilih Bagian --</option>';
    cachedBagian.forEach(b => {
      sel.innerHTML += `<option value="${b.id}">${b.tingkatan} - ${b.kelas} - ${b.nama_bagian}</option>`;
    });
  });
}

// Batch Assignment logic
checkAllBelum.addEventListener('change', (e) => {
  document.querySelectorAll('.cb-belum').forEach(cb => cb.checked = e.target.checked);
});

btnAssignBatch.addEventListener('click', async () => {
  const checkboxes = document.querySelectorAll('.cb-belum:checked');
  if(checkboxes.length === 0) return alert("Pilih minimal 1 santri");
  
  let successCount = 0;
  for(const cb of checkboxes) {
    const id = cb.value;
    const select = document.querySelector(`.sel-assign[data-santri-id="${id}"]`);
    if(select && select.value) {
      try {
        const res = await fetch('/api/perpindahan/naik-kelas', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            santri_ids: [parseInt(id)],
            bagian_baru_id: parseInt(select.value)
          })
        });
        if(res.ok) successCount++;
        else console.error(await res.text());
      } catch(e) { console.error(e); }
    }
  }
  if(successCount > 0) {
    alert(`Berhasil assign ${successCount} santri.`);
    loadData(); // reload
  } else {
    alert("Gagal meng-assign santri. Pastikan bagian tujuan telah dipilih untuk santri yang dicentang.");
  }
});


// 6. Modal Tambah Santri
function openModal() {
  modal.classList.remove('hidden');
  void modal.offsetWidth;
  modalContent.classList.remove('scale-95', 'opacity-0');
  modalContent.classList.add('scale-100', 'opacity-100');
  formSantri.reset();
  modalError.classList.add('hidden');
}

function closeModal() {
  modalContent.classList.remove('scale-100', 'opacity-100');
  modalContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

btnTambah.addEventListener('click', openModal);
btnClose.addEventListener('click', closeModal);
btnCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

formSantri.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(formSantri);
  const ttl_tgl = formData.get('ttl_tanggal');
  
  const orNull = (v) => (v && v.trim() !== '' ? v.trim() : null);

  // Parse tanggal lahir: support "2000-07-21", "21 Juli 2000", "21/07/2000", dll.
  function parseTanggalLahir(val) {
    if (!val || !val.trim()) return null;
    val = val.trim();
    // Coba ISO format langsung
    let d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
    // Coba format Indonesia: "21 Juli 2000"
    const bulanMap = {januari:0,februari:1,maret:2,april:3,mei:4,juni:5,juli:6,agustus:7,september:8,oktober:9,november:10,desember:11};
    const parts = val.split(/[\s,/\-]+/);
    if (parts.length >= 3) {
      const day = parseInt(parts[0]);
      const month = bulanMap[parts[1].toLowerCase()];
      const year = parseInt(parts[2]);
      if (day && month !== undefined && year) {
        d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }
    return null;
  }

  const ttlGabung = formData.get('ttl');
  let t_tempat = null;
  let t_tanggal = null;
  if (ttlGabung) {
      let parts = ttlGabung.split(',');
      if (parts.length > 1) {
          t_tempat = orNull(parts[0]);
          t_tanggal = parseTanggalLahir(parts.slice(1).join(',').trim());
      } else {
          t_tempat = orNull(parts[0]);
      }
  }

  const payload = {
    nik: formData.get('nik'),
    stambuk: formData.get('stambuk'),
    stambuk: orNull(formData.get('stambuk')),
    nisn: orNull(formData.get('nisn')),
    nama: formData.get('nama'),
    nama_wali: orNull(formData.get('nama_wali')),
    ttl_tempat: t_tempat,
    ttl_tanggal: t_tanggal,
    alamat: orNull(formData.get('alamat')),
    kamar: orNull(formData.get('kamar')),
    no_hp_wali: orNull(formData.get('no_hp')),
    // Alamat berjenjang
    provinsi_kode: orNull(formData.get('provinsi_kode')),
    provinsi_nama: orNull(formData.get('provinsi_nama')),
    kabupaten_kode: orNull(formData.get('kabupaten_kode')),
    kabupaten_nama: orNull(formData.get('kabupaten_nama')),
    kecamatan_kode: orNull(formData.get('kecamatan_kode')),
    kecamatan_nama: orNull(formData.get('kecamatan_nama')),
    desa: orNull(formData.get('desa')),
    status: "aktif",
    // Kirim bagian_awal_id agar backend CreateSantri langsung set bagian_id +
    // insert riwayat_bagian dalam satu transaksi → santri langsung masuk kelas
    // (tidak nyangkut di "belum di kelas"). owner 2026-08.
    bagian_awal_id: parseInt(formData.get('bagian_awal_id'), 10) || 0
  };

  const btnSubmit = formSantri.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Menyimpan...';

  try {
    const response = await fetch('/api/santri', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    closeModal();
    loadData();
  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Simpan';
  }
});

let currentRiwayat = [];
let selectedTahun = "";

// 7. Modal Detail Santri
window.openDetail = function(id) { window.location.href = '/profil-santri.html?id=' + id; return; };

function switchDetailTab(tabName) {
    const tabBiodata = document.getElementById('tab-detail-biodata');
    const tabAbsensi = document.getElementById('tab-detail-absensi');
    const tabRaport = document.getElementById('tab-detail-raport');
    const contentBiodata = document.getElementById('content-detail-biodata');
    const contentAkademik = document.getElementById('content-detail-akademik');
    
    // Reset classes
    [tabBiodata, tabAbsensi, tabRaport].forEach(t => {
        t.className = "pb-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors";
    });
    contentBiodata.classList.add('hidden');
    contentAkademik.classList.add('hidden');
    contentBiodata.classList.remove('grid');
    contentAkademik.classList.remove('flex');
    
    // Set Active
    if(tabName === 'biodata') {
        tabBiodata.className = "pb-2 text-sm font-semibold border-b-2 border-primary text-primary dark:border-accent-emerald dark:text-accent-emerald transition-colors";
        contentBiodata.classList.remove('hidden');
        contentBiodata.classList.add('grid');
    } else if (tabName === 'absensi' || tabName === 'raport') {
        if(tabName === 'absensi') {
            tabAbsensi.className = "pb-2 text-sm font-semibold border-b-2 border-primary text-primary dark:border-accent-emerald dark:text-accent-emerald transition-colors";
        } else {
            tabRaport.className = "pb-2 text-sm font-semibold border-b-2 border-primary text-primary dark:border-accent-emerald dark:text-accent-emerald transition-colors";
        }
        contentAkademik.classList.remove('hidden');
        contentAkademik.classList.add('flex');
        renderAkademikContent(tabName);
    }
}

document.getElementById('tab-detail-biodata').addEventListener('click', () => switchDetailTab('biodata'));
document.getElementById('tab-detail-absensi').addEventListener('click', () => switchDetailTab('absensi'));
document.getElementById('tab-detail-raport').addEventListener('click', () => switchDetailTab('raport'));

function renderTahunTabs() {
    const c = document.getElementById('tabs-tahun-ajaran');
    c.innerHTML = '';
    if(!currentRiwayat || currentRiwayat.length === 0) {
        document.getElementById('akademik-container').innerHTML = '<p class="text-center text-sm text-gray-500 mt-8">Belum ada data riwayat akademik.</p>';
        return;
    }
    
    if(!selectedTahun) selectedTahun = currentRiwayat[0].tahun_ajaran;
    
    currentRiwayat.forEach(r => {
        const btn = document.createElement('button');
        const isActive = r.tahun_ajaran === selectedTahun;
        btn.className = `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-primary text-white dark:bg-accent-emerald' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600'}`;
        btn.textContent = `${r.tahun_ajaran} (${r.nama_bagian})`;
        btn.onclick = () => {
            selectedTahun = r.tahun_ajaran;
            renderTahunTabs();
            // Re-render based on active tab
            const isAbsensi = document.getElementById('tab-detail-absensi').classList.contains('border-primary');
            renderAkademikContent(isAbsensi ? 'absensi' : 'raport');
        };
        c.appendChild(btn);
    });
}

function renderAkademikContent(mode) {
    const container = document.getElementById('akademik-container');
    if(!currentRiwayat || currentRiwayat.length === 0) return;
    
    const data = currentRiwayat.find(r => r.tahun_ajaran === selectedTahun);
    if(!data) return;
    
    if(mode === 'absensi') {
        let rows = '';
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        
        months.forEach((mName, idx) => {
            const ab = data.absensi.find(a => a.bulan_angka === idx) || {s: '-', i: '-', t: '-'};
            rows += `
              <tr class="border-b border-gray-100 dark:border-slate-700/50">
                  <td class="py-2 font-medium">${mName}</td>
                  <td class="py-2 text-center text-orange-500">${ab.s}</td>
                  <td class="py-2 text-center text-blue-500">${ab.i}</td>
                  <td class="py-2 text-center text-red-500">${ab.t}</td>
              </tr>
            `;
        });
        
        container.innerHTML = `
           <table class="w-full text-left text-sm text-gray-600 dark:text-gray-300">
               <thead class="bg-gray-100/50 dark:bg-slate-800 uppercase text-xs">
                   <tr>
                       <th class="py-2 px-2">Bulan</th>
                       <th class="py-2 text-center w-12">S</th>
                       <th class="py-2 text-center w-12">I</th>
                       <th class="py-2 text-center w-12">T</th>
                   </tr>
               </thead>
               <tbody>${rows}</tbody>
           </table>
        `;
    } else if(mode === 'raport') {
        let rows = '';
        if(data.raport.length === 0) {
            rows = `<tr><td colspan="3" class="py-4 text-center text-gray-400">Belum ada nilai di tahun ini</td></tr>`;
        } else {
            data.raport.forEach((r, idx) => {
                rows += `
                  <tr class="border-b border-gray-100 dark:border-slate-700/50">
                      <td class="py-2">${idx+1}. ${r.mapel}</td>
                      <td class="py-2 text-center font-semibold">${r.smt1 || '-'}</td>
                      <td class="py-2 text-center font-semibold">${r.smt2 || '-'}</td>
                  </tr>
                `;
            });
        }
        
        container.innerHTML = `
           <table class="w-full text-left text-sm text-gray-600 dark:text-gray-300">
               <thead class="bg-gray-100/50 dark:bg-slate-800 uppercase text-xs">
                   <tr>
                       <th class="py-2 px-2">Mata Pelajaran (Kitab)</th>
                       <th class="py-2 text-center w-20">Smt. Ganjil</th>
                       <th class="py-2 text-center w-20">Smt. Genap</th>
                   </tr>
               </thead>
               <tbody>${rows}</tbody>
           </table>
        `;
    }
}

function closeDetail() {
  modalDetailContent.classList.remove('scale-100', 'opacity-100');
  modalDetailContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modalDetail.classList.add('hidden'), 300);
}

btnDetailClose.addEventListener('click', closeDetail);
modalDetailOverlay.addEventListener('click', closeDetail);

// Auto-open detail from global search hash (#detail-<id>)
function handleDetailHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#detail-(\d+)$/);
  if (match) {
    window.openDetail(match[1]);
  }
}

window.addEventListener('hashchange', handleDetailHash);

// ==================== 8. ALAMAT: format & typeahead wilayah ====================

function formatAlamatLengkap(s) {
  const parts = [];
  if (s.alamat) parts.push(s.alamat);
  if (s.desa) parts.push('Ds. ' + s.desa);
  if (s.kecamatan_nama) parts.push('Kec. ' + s.kecamatan_nama);
  if (s.kabupaten_nama) parts.push(s.kabupaten_nama);
  if (s.provinsi_nama) parts.push(s.provinsi_nama);
  return parts.length ? parts.join(', ') : '-';
}

// Debounce helper
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Generic typeahead binder for one level (provinsi/kabupaten/kecamatan).
// getUrl(term) returns the search endpoint; onSelect receives {kode, nama}.
function bindTypeahead({ input, hidden, list, getUrl, onSelect, onClear }) {
  const closeList = () => { list.classList.add('hidden'); list.innerHTML = ''; };

  const search = debounce(async (term) => {
    const url = getUrl(term);
    if (!url) { closeList(); return; }
    try {
      const res = await fetch(url);
      if (!res.ok) { closeList(); return; }
      const items = await res.json();
      if (!items || items.length === 0) {
        list.innerHTML = `<li class="px-3 py-2 text-gray-400">Tidak ada hasil</li>`;
        list.classList.remove('hidden');
        return;
      }
      list.innerHTML = '';
      items.forEach(it => {
        const li = document.createElement('li');
        li.className = 'px-3 py-2 cursor-pointer hover:bg-primary/10 dark:hover:bg-slate-700';
        li.textContent = it.nama;
        li.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          input.value = it.nama;
          hidden.value = it.kode;
          closeList();
          onSelect(it);
        });
        list.appendChild(li);
      });
      list.classList.remove('hidden');
    } catch (e) { closeList(); }
  }, 250);

  input.addEventListener('input', () => {
    // Any manual edit invalidates the previously chosen kode.
    hidden.value = '';
    if (onClear) onClear();
    search(input.value.trim());
  });
  input.addEventListener('focus', () => { if (input.value.trim()) search(input.value.trim()); });
  input.addEventListener('blur', () => setTimeout(closeList, 150));
}

const inputProvinsi = document.getElementById('input-provinsi');
const provinsiKode = document.getElementById('provinsi-kode');
const listProvinsi = document.getElementById('list-provinsi');
const inputKabupaten = document.getElementById('input-kabupaten');
const kabupatenKode = document.getElementById('kabupaten-kode');
const listKabupaten = document.getElementById('list-kabupaten');
const inputKecamatan = document.getElementById('input-kecamatan');
const kecamatanKode = document.getElementById('kecamatan-kode');
const listKecamatan = document.getElementById('list-kecamatan');

function resetKabupatenField() {
  inputKabupaten.value = '';
  kabupatenKode.value = '';
  inputKabupaten.disabled = true;
  inputKabupaten.placeholder = 'Pilih provinsi dulu...';
}
function resetKecamatanField() {
  inputKecamatan.value = '';
  kecamatanKode.value = '';
  inputKecamatan.disabled = true;
  inputKecamatan.placeholder = 'Pilih kabupaten dulu...';
}

if (inputProvinsi) {
  bindTypeahead({
    input: inputProvinsi, hidden: provinsiKode, list: listProvinsi,
    getUrl: (term) => `/api/wilayah/provinsi?q=${encodeURIComponent(term)}`,
    onSelect: () => {
      inputKabupaten.disabled = false;
      inputKabupaten.placeholder = 'Ketik nama kabupaten/kota...';
      resetKabupatenField();
      inputKabupaten.disabled = false;
      resetKecamatanField();
    },
    onClear: () => { resetKabupatenField(); resetKecamatanField(); }
  });

  bindTypeahead({
    input: inputKabupaten, hidden: kabupatenKode, list: listKabupaten,
    getUrl: (term) => provinsiKode.value ? `/api/wilayah/kabupaten?provinsi=${encodeURIComponent(provinsiKode.value)}&q=${encodeURIComponent(term)}` : null,
    onSelect: () => {
      inputKecamatan.disabled = false;
      inputKecamatan.placeholder = 'Ketik nama kecamatan...';
      resetKecamatanField();
      inputKecamatan.disabled = false;
    },
    onClear: () => resetKecamatanField()
  });

  bindTypeahead({
    input: inputKecamatan, hidden: kecamatanKode, list: listKecamatan,
    getUrl: (term) => kabupatenKode.value ? `/api/wilayah/kecamatan?kabupaten=${encodeURIComponent(kabupatenKode.value)}&q=${encodeURIComponent(term)}` : null,
    onSelect: () => {}
  });
}

// ==================== 9. FILTER daftar santri by provinsi/kabupaten/tingkatan ====================

const filterTingkatan = document.getElementById('filter-tingkatan');
const filterKelas = document.getElementById('filter-kelas');
const filterBagian = document.getElementById('filter-bagian');
const filterProvinsi = document.getElementById('filter-provinsi');
const filterKabupaten = document.getElementById('filter-kabupaten');
const btnResetFilter = document.getElementById('btn-reset-filter');

function populateFilterTingkatan() {
  if (!filterTingkatan) return;
  filterTingkatan.innerHTML = '<option value="">-- Semua Tingkatan --</option>';
  const unique = [...new Set(cachedBagian.map(b => b.tingkatan).filter(Boolean))];
  unique.forEach(t => {
    filterTingkatan.innerHTML += `<option value="${t}">${t}</option>`;
  });
  populateFilterKelas();
}

// Isi opsi Filter Kelas. Bila sebuah tingkatan sedang dipilih, kelas dibatasi
// pada kelas yang ada di tingkatan tsb; jika tidak, tampilkan semua kelas unik.
function populateFilterKelas() {
  if (!filterKelas) return;
  const tVal = filterTingkatan ? filterTingkatan.value : '';
  const prev = filterKelas.value;
  const source = tVal ? cachedBagian.filter(b => b.tingkatan === tVal) : cachedBagian;
  const unique = [...new Set(source.map(b => b.kelas).filter(Boolean))];
  filterKelas.innerHTML = '<option value="">-- Semua Kelas --</option>';
  unique.forEach(k => {
    filterKelas.innerHTML += `<option value="${k}">${k}</option>`;
  });
  // Pertahankan pilihan sebelumnya bila masih tersedia.
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
  unique.forEach(nama => {
    filterBagian.innerHTML += `<option value="${nama}">${nama}</option>`;
  });
  if (prev && unique.includes(prev)) filterBagian.value = prev;
}

async function loadFilterProvinsi() {
  if (!filterProvinsi) return;
  try {
    const res = await fetch('/api/wilayah/provinsi');
    if (!res.ok) return;
    const items = await res.json();
    (items || []).forEach(it => {
      filterProvinsi.innerHTML += `<option value="${it.kode}">${it.nama}</option>`;
    });
  } catch (e) { console.error(e); }
}

async function loadFilterKabupaten(provinsiKodeVal) {
  filterKabupaten.innerHTML = '<option value="">-- Semua Kabupaten --</option>';
  if (!provinsiKodeVal) { filterKabupaten.disabled = true; return; }
  try {
    const res = await fetch(`/api/wilayah/kabupaten?provinsi=${encodeURIComponent(provinsiKodeVal)}`);
    if (!res.ok) return;
    const items = await res.json();
    (items || []).forEach(it => {
      filterKabupaten.innerHTML += `<option value="${it.kode}">${it.nama}</option>`;
    });
    filterKabupaten.disabled = false;
  } catch (e) { console.error(e); }
}

function applyWilayahFilter() {
  if (!cachedSantriData) return;
  renderSantriAktif(cachedSantriData, searchInput.value);
}

if (filterTingkatan) {
  filterTingkatan.addEventListener('change', () => {
    populateFilterKelas(); // sesuaikan opsi kelas dengan tingkatan terpilih
    applyWilayahFilter();
  });
}

if (filterKelas) {
  filterKelas.addEventListener('change', () => {
    populateFilterBagian(); // sesuaikan opsi bagian dengan kelas terpilih
    applyWilayahFilter();
  });
}

if (filterBagian) {
  filterBagian.addEventListener('change', applyWilayahFilter);
}

if (filterProvinsi) {
  filterProvinsi.addEventListener('change', async () => {
    await loadFilterKabupaten(filterProvinsi.value);
    applyWilayahFilter();
  });
  filterKabupaten.addEventListener('change', applyWilayahFilter);
  btnResetFilter.addEventListener('click', () => {
    if (filterTingkatan) filterTingkatan.value = '';
    if (filterKelas) { populateFilterKelas(); filterKelas.value = ''; }
    if (filterBagian) { populateFilterBagian(); filterBagian.value = ''; }
    filterProvinsi.value = '';
    filterKabupaten.innerHTML = '<option value="">-- Semua Kabupaten --</option>';
    filterKabupaten.disabled = true;
    if (cachedSantriData) renderSantriAktif(cachedSantriData, searchInput.value);
  });
  loadFilterProvinsi();
}

// ==================== 10. IMPORT EXCEL ====================

const btnImport = document.getElementById('btn-import');
const modalImport = document.getElementById('modal-import');
const modalImportContent = document.getElementById('modal-import-content');
const modalImportOverlay = document.getElementById('modal-import-overlay');
const btnImportClose = document.getElementById('modal-import-close');
const btnImportCancel = document.getElementById('btn-import-cancel');
const btnImportSubmit = document.getElementById('btn-import-submit');
const importFile = document.getElementById('import-file');
const importResult = document.getElementById('import-result');

function openImportModal() {
  modalImport.classList.remove('hidden');
  void modalImport.offsetWidth;
  modalImportContent.classList.remove('scale-95', 'opacity-0');
  modalImportContent.classList.add('scale-100', 'opacity-100');
  importResult.classList.add('hidden');
  importResult.innerHTML = '';
  importFile.value = '';
}
function closeImportModal() {
  modalImportContent.classList.remove('scale-100', 'opacity-100');
  modalImportContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modalImport.classList.add('hidden'), 300);
}

if (btnImport) {
  btnImport.addEventListener('click', openImportModal);
  btnImportClose.addEventListener('click', closeImportModal);
  btnImportCancel.addEventListener('click', closeImportModal);
  modalImportOverlay.addEventListener('click', closeImportModal);

  btnImportSubmit.addEventListener('click', async () => {
    if (!importFile.files || importFile.files.length === 0) {
      importResult.className = 'text-sm rounded-lg p-3 bg-red-50 text-red-600 dark:bg-red-900/30';
      importResult.textContent = 'Pilih file Excel terlebih dahulu.';
      importResult.classList.remove('hidden');
      return;
    }
    const fd = new FormData();
    fd.append('file', importFile.files[0]);

    btnImportSubmit.disabled = true;
    btnImportSubmit.textContent = 'Mengimpor...';
    try {
      const res = await fetch('/api/santri/import', { method: 'POST', body: fd });
      const data = await parseJSONSafe(res);
      // Struktur hasil (sukses/gagal/errors) bisa datang DI JALUR 422 (parse/validasi
      // gagal) maupun 200 (partial). Selama ada field terstruktur, render laporan —
      // JANGAN throw hanya karena !res.ok, biar tabel detail tetap tampil.
      const hasStruct = data && (typeof data.gagal === 'number' || typeof data.sukses === 'number' || Array.isArray(data.errors));
      if (!res.ok && !hasStruct) throw new Error((data && data.message) || 'Gagal mengimpor');

      const berhasil = (data && data.sukses) ?? 0;
      const gagal = (data && data.gagal) ?? 0;
      const errors = (data && data.errors) || [];
      let html = `<div class="flex flex-wrap gap-2 mb-2">
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✅ Berhasil: ${berhasil}</span>
        ${gagal > 0 ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">⚠️ Dilewati: ${gagal}</span>` : ''}
      </div>`;
      if (gagal > 0 && errors.length) {
        // Teks polos untuk tombol Salin (baris\tnama\talasan).
        const plain = errors.map(e => {
          const b = e.baris ? `Baris ${e.baris}` : '';
          const n = e.nama || '';
          const p = e.pesan || e;
          return `${b}\t${n}\t${p}`;
        }).join('\n');
        window.__importErrorText = plain;

        html += `<div class="flex items-center justify-between mb-1 mt-2">
          <p class="text-xs font-semibold text-red-600 dark:text-red-400">Data tidak sesuai (diperbaiki lalu unggah ulang):</p>
          <button type="button" id="btn-copy-import-err" class="text-xs px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-medium">📋 Salin</button>
        </div>`;
        html += `<div class="max-h-52 overflow-y-auto rounded-lg border border-red-200 dark:border-red-800">
          <table class="w-full text-xs">
            <thead class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 sticky top-0">
              <tr>
                <th class="px-2 py-1.5 text-center font-semibold w-14">Baris</th>
                <th class="px-2 py-1.5 text-left font-semibold">Nama</th>
                <th class="px-2 py-1.5 text-left font-semibold">Alasan</th>
              </tr>
            </thead>
            <tbody>`;
        errors.forEach(e => {
          const b = e.baris || '-';
          const n = e.nama || '-';
          const p = e.pesan || e;
          html += `<tr class="bg-red-50/40 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/40">
            <td class="px-2 py-1.5 text-center text-gray-600 dark:text-gray-400">${b}</td>
            <td class="px-2 py-1.5 font-medium text-gray-800 dark:text-gray-200">${escapeHtml(String(n))}</td>
            <td class="px-2 py-1.5 text-red-600 dark:text-red-400">${escapeHtml(String(p))}</td>
          </tr>`;
        });
        html += `</tbody></table></div>`;
      }
      importResult.className = 'text-sm rounded-lg p-3 bg-gray-50 dark:bg-slate-900/50';
      importResult.innerHTML = html;
      importResult.classList.remove('hidden');
      // Wire tombol Salin.
      const btnCopy = document.getElementById('btn-copy-import-err');
      if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(window.__importErrorText || '');
            btnCopy.textContent = '✅ Tersalin';
            setTimeout(() => { btnCopy.textContent = '📋 Salin'; }, 1500);
          } catch (_) {
            // Fallback: seleksi via textarea sementara.
            const ta = document.createElement('textarea');
            ta.value = window.__importErrorText || '';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            btnCopy.textContent = '✅ Tersalin';
            setTimeout(() => { btnCopy.textContent = '📋 Salin'; }, 1500);
          }
        });
      }
      if (berhasil > 0) loadData();
    } catch (err) {
      importResult.className = 'text-sm rounded-lg p-3 bg-red-50 text-red-600 dark:bg-red-900/30';
      importResult.textContent = err.message;
      importResult.classList.remove('hidden');
    } finally {
      btnImportSubmit.disabled = false;
      btnImportSubmit.textContent = 'Unggah & Import';
    }
  });
}

checkAuth();


window.uploadFoto = async function(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  if (file.size > 2 * 1024 * 1024) {
    alert('Ukuran file maksimal 2MB');
    return;
  }
  const formData = new FormData();
  formData.append('foto', file);
  try {
    const res = await fetch(`/api/santri/${window.currentSantriId}/foto`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      const imgFoto = document.getElementById('detail-foto');
      imgFoto.src = data.foto_url + '?t=' + new Date().getTime();
      imgFoto.classList.remove('hidden');
      document.getElementById('detail-inisial').classList.add('hidden');
      alert('Foto berhasil diupload');
    } else {
      alert('Gagal: ' + data.message || 'Error');
    }
  } catch (e) {
    alert('Error mengunggah foto');
  }
};

