// frontend/src/js/arsip.js

const tableBody = document.getElementById("table-body");
const searchInput = document.getElementById("search-input");
const filterStatus = document.getElementById("filter-status");
const filterTingkatan = document.getElementById("filter-tingkatan");
const filterKelas = document.getElementById("filter-kelas");
const filterBagian = document.getElementById("filter-bagian");
const filterTahun = document.getElementById("filter-tahun");
const btnReset = document.getElementById("btn-reset-filter");

let debounceTimeout = null;
let cachedBagian = [];

// Apply Theme
if (localStorage.theme === "dark") {
  document.documentElement.classList.add("dark");
}

// Format tanggal ISO -> tampilan lokal Indonesia; "-" bila kosong/invalid.
function formatTanggalStatus(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// Fetch Data Arsip
async function loadArsip() {
  const query = searchInput.value;
  const status = filterStatus.value;
  const tingkatanId = filterTingkatan ? filterTingkatan.value : "";
  const kelasId = filterKelas ? filterKelas.value : "";
  const bagianId = filterBagian ? filterBagian.value : "";
  const tahunAjaran = filterTahun ? filterTahun.value : "";

  tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">Memuat arsip santri...</td></tr>`;
  
  try {
    let url = "/api/santri/arsip?";
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    
    // We send the text values if we do not have IDs, but wait, the backend expects IDs for Tingkatan and Kelas.
    // However, cachedBagian has tingkatan_id, kelas_id. We should use the IDs!
    // But in our dropdowns, do we use IDs or text? Let us check populateFilter.
    
    // Actually, backend filter expects IDs. Let us make sure options have value=id.
    // Wait, tingkatan and kelas in cachedBagian might not have tingkatan_id and kelas_id.
    // Let us check what cachedBagian contains. It usually has .id (for bagian), .tingkatan, .kelas, .nama_bagian.
    // If backend expects tingkatan_id and kelas_id, but we only have string names, we might have a problem.
    // Wait, earlier in santri.js, how does it filter? It filters on the CLIENT SIDE for tingkatan and kelas, or just sends `tingkatan`?
    // Let us just do client-side filtering for Tingkatan and Kelas, or we can find the IDs if they are present.
    // Actually, backend has filterTingkatan and filterKelas expecting INT.
    // In our arsip.js, we should send `bagian_id` if selected, otherwise nothing, and do the rest of filtering on the CLIENT SIDE if we do not have IDs.
    // Wait, I will just send `bagian_id` and `tahun_ajaran` and `status` to backend, and do tingkatan/kelas filtering locally to be safe.
    
    if (bagianId) params.append("bagian_id", bagianId);
    if (tahunAjaran) params.append("tahun_ajaran", tahunAjaran);
    
    url += params.toString();
    
    const response = await fetch(url);
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || "Gagal memuat data");
    }
    
    let data = await response.json();
    if (!data) data = [];

    // Client-side search and advanced filter
    if (query.trim().length > 0) {
      data = data.filter(s => 
        (s.nama && s.nama.toLowerCase().includes(query.toLowerCase())) || 
        (s.nik && s.nik.includes(query)) ||
        (s.stambuk && s.stambuk.includes(query))
      );
    }
    
    if (tingkatanId && !bagianId) {
      // Find all bagian IDs that belong to this tingkatan string
      const validBagianIds = cachedBagian.filter(b => b.tingkatan === tingkatanId).map(b => b.id);
      data = data.filter(s => validBagianIds.includes(s.bagian_id || s.last_bagian_id));
    }
    
    if (kelasId && !bagianId) {
      const validBagianIds = cachedBagian.filter(b => b.kelas === kelasId).map(b => b.id);
      data = data.filter(s => validBagianIds.includes(s.bagian_id || s.last_bagian_id));
    }

    renderTable(data);
    
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Terjadi kesalahan: ${err.message}</td></tr>`;
  }
}

// Render Table
function renderTable(santriArray) {
  if (!santriArray || santriArray.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">Tidak ada data arsip santri ditemukan.</td></tr>`;
    return;
  }
  
  tableBody.innerHTML = "";
  
  santriArray.forEach(s => {
    const stambuk = s.stambuk || "-";
    const nama = s.nama || "-";
    const status = s.status || "-";
    
    let statusClass = "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300";
    if (status === "cuti") {
      statusClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    } else if (status === "lulus") {
      statusClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    } else if (status === "boyong" || status === "keluar") {
      statusClass = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    }
    
    const tr = document.createElement("tr");
    tr.className = "hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors";
    tr.innerHTML = `
      <td data-label="Nama Lengkap" class="px-6 py-4 font-medium text-gray-900 dark:text-white">
        ${nama}
      </td>
      <td data-label="Asal Daerah" class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
        ${s.kabupaten_nama ? s.kabupaten_nama + (s.provinsi_nama ? ", " + s.provinsi_nama : "") : "-"}
      </td>
      <td data-label="Kamar" class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
        ${s.kamar || "-"}
      </td>
      <td data-label="Status" class="px-6 py-4">
        <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${statusClass}">
          ${status.toUpperCase()}
        </span>
      </td>
      <td data-label="Tgl. Perubahan" class="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">${formatTanggalStatus(s.tanggal_status)}</td>
      <td data-label="Aksi" class="px-6 py-4 text-right">
        <a href="/profil-santri.html?id=${s.id}" class="text-primary dark:text-accent-emerald hover:underline text-sm font-medium">Detail</a>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Load Filters
async function loadFilters() {
  try {
    const rolesStr = localStorage.getItem("user_roles") || "[]";
    let roles = [];
    try { roles = JSON.parse(rolesStr); } catch (e) {}

    const isMustahiqOnly = roles.includes("mustahiq") && !roles.includes("pimpinan") && !roles.includes("admin") && !roles.includes("keamanan");
    const endpoint = isMustahiqOnly ? "/api/penilaian/bagian" : "/api/akademik/bagian";

    const [resBagian, resArsipAll] = await Promise.all([
      fetch(endpoint),
      fetch("/api/santri/arsip")
    ]);
    
    if (resBagian.ok) {
      cachedBagian = await resBagian.json();
      populateFilterTingkatan();
    }
    
    if (resArsipAll.ok) {
      const allArsip = await resArsipAll.json();
      if (allArsip && allArsip.length > 0) {
        const years = new Set();
        allArsip.forEach(s => {
          if (s.last_tahun_ajaran) years.add(s.last_tahun_ajaran);
          else if (s.tahun_keluar) years.add(s.tahun_keluar);
        });
        
        const uniqueYears = [...years].filter(Boolean).sort().reverse();
        if (uniqueYears.length > 0) {
          filterTahun.innerHTML = `<option value="">-- Semua Tahun --</option>`;
          uniqueYears.forEach(ta => {
            const opt = document.createElement("option");
            opt.value = ta;
            opt.textContent = ta;
            filterTahun.appendChild(opt);
          });
        }
      }
    }
  } catch(e) {
    console.error("Gagal memuat filter:", e);
  }
}

function populateFilterTingkatan() {
  if (!filterTingkatan) return;
  filterTingkatan.innerHTML = `<option value="">-- Semua Tingkatan --</option>`;
  const unique = [...new Set(cachedBagian.map(b => b.tingkatan).filter(Boolean))];
  unique.forEach(t => {
    filterTingkatan.innerHTML += `<option value="${t}">${t}</option>`;
  });
  populateFilterKelas();
}

function populateFilterKelas() {
  if (!filterKelas) return;
  const tVal = filterTingkatan ? filterTingkatan.value : "";
  const source = tVal ? cachedBagian.filter(b => b.tingkatan === tVal) : cachedBagian;
  const unique = [...new Set(source.map(b => b.kelas).filter(Boolean))];
  
  filterKelas.innerHTML = `<option value="">-- Semua Kelas --</option>`;
  unique.forEach(k => {
    filterKelas.innerHTML += `<option value="${k}">${k}</option>`;
  });
  populateFilterBagian();
}

function populateFilterBagian() {
  if (!filterBagian) return;
  const tVal = filterTingkatan ? filterTingkatan.value : "";
  const kVal = filterKelas ? filterKelas.value : "";
  let source = cachedBagian;
  
  if (tVal) source = source.filter(b => b.tingkatan === tVal);
  if (kVal) source = source.filter(b => b.kelas === kVal);
  
  const unique = [...new Set(source.map(b => b.nama_bagian).filter(Boolean))];
  filterBagian.innerHTML = `<option value="">-- Semua Bagian --</option>`;
  
  unique.forEach(b => {
    // Find ID
    const found = source.find(x => x.nama_bagian === b);
    if (found) {
      filterBagian.innerHTML += `<option value="${found.id}">${found.tingkatan} - ${found.kelas} - ${b}</option>`;
    }
  });
}

// Events
if (filterTingkatan) {
  filterTingkatan.addEventListener("change", () => {
    populateFilterKelas();
    loadArsip();
  });
}

if (filterKelas) {
  filterKelas.addEventListener("change", () => {
    populateFilterBagian();
    loadArsip();
  });
}

if (filterBagian) filterBagian.addEventListener("change", loadArsip);
if (filterTahun) filterTahun.addEventListener("change", loadArsip);
if (filterStatus) filterStatus.addEventListener("change", loadArsip);

if (searchInput) {
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      loadArsip();
    }, 300);
  });
}

if (btnReset) {
  btnReset.addEventListener("click", () => {
    if (filterStatus) filterStatus.value = "";
    if (filterTahun) filterTahun.value = "";
    if (filterTingkatan) filterTingkatan.value = "";
    if (searchInput) searchInput.value = "";
    populateFilterKelas(); // cascades to bagian
    loadArsip();
  });
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  loadFilters();
  loadArsip();
});
