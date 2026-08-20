// frontend/src/js/perpindahan.js

// 1. Initial State & Elements
const tabMutasi = document.getElementById('tab-mutasi');
const tabCuti = document.getElementById('tab-cuti');
const contentMutasi = document.getElementById('content-mutasi');
const contentCuti = document.getElementById('content-cuti');

const selTingkatanAsal = document.getElementById('select-tingkatan-asal');
const selKelasAsal = document.getElementById('select-kelas-asal');
const selBagianAsal = document.getElementById('select-bagian-asal');
const btnLuluskanAlumni = document.getElementById('btn-luluskan-alumni');


const selTingkatanStambuk = document.getElementById('select-tingkatan-stambuk');
const selKelasStambuk = document.getElementById('select-kelas-stambuk');
const btnSusunStambuk = document.getElementById('btn-susun-stambuk');

const selTingkatanTujuan = document.getElementById('select-tingkatan-tujuan');
const selKelasTujuan = document.getElementById('select-kelas-tujuan');
const selBagianTujuan = document.getElementById('select-bagian-tujuan');

const tableBodyMutasi = document.getElementById('table-body-mutasi');
const btnProsesMutasi = document.getElementById('btn-proses-mutasi');
const checkAll = document.getElementById('check-all');
const checkMustahiq = document.getElementById('check-mustahiq');

const formStatus = document.getElementById('form-status');
const statusError = document.getElementById('status-error');
const statusSuccess = document.getElementById('status-success');
const inputTanggalStatus = document.getElementById('input-tanggal-status');
const statusTanggalHijri = document.getElementById('status-tanggal-hijri');

let allSantri = [];

// Nama bulan Hijriyah (transliterasi Indonesia).
const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban", 'Ramadhan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah'];

// Konversi tanggal Masehi → Hijriyah (mis. "23 Muharram 1447 H") memakai kalender
// islamic-umalqura bawaan browser. Dipakai untuk menampilkan padanan Hijriyah
// dari Tanggal Perubahan Status. Nilai yang tersimpan di DB tetap Masehi.
function formatHijri(date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).formatToParts(date);
    let d, m, y;
    parts.forEach(p => {
      if (p.type === 'day') d = parseInt(p.value, 10);
      else if (p.type === 'month') m = parseInt(p.value, 10);
      else if (p.type === 'year') y = parseInt(p.value, 10);
    });
    if (!d || !m || !y) return null;
    return `${d} ${HIJRI_MONTHS[m - 1] || ''} ${y} H`;
  } catch (e) {
    return null;
  }
}

// Perbarui label padanan Hijriyah di bawah input Tanggal Perubahan Status.
function updateStatusHijriLabel() {
  if (!inputTanggalStatus || !statusTanggalHijri) return;
  const v = inputTanggalStatus.value;
  if (!v) { statusTanggalHijri.textContent = ''; return; }
  // Parse sebagai tanggal lokal (hindari pergeseran zona waktu dari string date).
  const [yy, mm, dd] = v.split('-').map(Number);
  const dt = new Date(yy, (mm || 1) - 1, dd || 1);
  const h = formatHijri(dt);
  statusTanggalHijri.textContent = h ? `Hijriyah: ${h}` : '';
}

if (inputTanggalStatus) {
  inputTanggalStatus.addEventListener('input', updateStatusHijriLabel);
  inputTanggalStatus.addEventListener('change', updateStatusHijriLabel);
}

// Apply Theme
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

// 2. Fetch User Auth (Only Pimpinan)
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await response.json();
    
    // Mufatish and Mustahiq can view; write actions are gated separately.
    const canWrite = window.isAdminRole(data.role);
    window._canWrite = canWrite;
    if (!canWrite && data.role !== 'mufatish' && data.role !== 'mustahiq') {
      alert("Akses ditolak: Anda tidak memiliki izin mengakses halaman ini.");
      window.location.href = '/index.html';
      return;
    }

    
    // Load Dependencies
    await Promise.all([loadMasterData(), loadSantri()]);

    // Read-only users (mufatish) can browse but not submit changes.
    if (!canWrite) {
      btnProsesMutasi?.setAttribute('disabled', 'true');
      const btnStatus = formStatus?.querySelector('button');
      if (btnStatus) btnStatus.setAttribute('disabled', 'true');
      document.querySelectorAll('.readonly-hide').forEach(el => el.classList.add('!hidden'));
    }
    
  } catch (err) {

    console.error("Auth check failed:", err);
  }
}

// 3. Tab Switching (3 tabs: mutasi, cuti, stambuk)
const tabNis = document.getElementById('tab-stambuk');
const contentNis = document.getElementById('content-stambuk');
const TAB_ACTIVE = "px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-700 shadow-sm text-gray-800 dark:text-white transition-all";
const TAB_INACTIVE = "px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all";

function switchPerpindahanTab(tab) {
  const tabs = { mutasi: tabMutasi, cuti: tabCuti, stambuk: tabNis };
  const contents = { mutasi: contentMutasi, cuti: contentCuti, stambuk: contentNis };
  for (const k of Object.keys(tabs)) {
    if (!tabs[k]) continue;
    tabs[k].className = (k === tab) ? TAB_ACTIVE : TAB_INACTIVE;
    if (!contents[k]) continue;
    if (k === tab) {
      contents[k].classList.remove('hidden');
      contents[k].classList.add('flex');
    } else {
      contents[k].classList.add('hidden');
      contents[k].classList.remove('flex');
    }
  }
}

tabMutasi.addEventListener('click', () => switchPerpindahanTab('mutasi'));
tabCuti.addEventListener('click', () => switchPerpindahanTab('cuti'));
if (tabNis) tabNis.addEventListener('click', () => switchPerpindahanTab('stambuk'));

// 4. Load Data
let cachedTingkatan = [];
let cachedKelas = [];
let cachedBagian = [];

async function loadMasterData() {
  try {
    const [resTingkat, resKelas, resBagian] = await Promise.all([
      fetch('/api/akademik/tingkatan'),
      fetch('/api/akademik/kelas'),
      fetch('/api/akademik/bagian')
    ]);
    
    if(resTingkat.ok) cachedTingkatan = await resTingkat.json();
    if(resKelas.ok) cachedKelas = await resKelas.json();
    if(resBagian.ok) cachedBagian = await resBagian.json();
    
    populateTingkatan(selTingkatanAsal);
    populateTingkatan(selTingkatanTujuan);
    if (selTingkatanStambuk) populateTingkatan(selTingkatanStambuk);
  } catch (err) {
    console.error(err);
  }
}

function populateTingkatan(selectEl) {
  selectEl.innerHTML = '<option value="">-- Pilih Tingkatan --</option>';
  (cachedTingkatan || []).forEach(t => {
    selectEl.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
  });
}

function handleTingkatanChange(tingkatanId, selKelas, selBagian) {
  selKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
  selBagian.innerHTML = '<option value="">-- Pilih Bagian --</option>';
  selBagian.disabled = true;
  
  if(!tingkatanId) {
    selKelas.disabled = true;
    return;
  }
  
  selKelas.disabled = false;
  (cachedKelas || []).forEach(a => {
    selKelas.innerHTML += `<option value="${a.id}">${a.nama}</option>`;
  });
}

function handleKelasChange(kelasId, tingkatanId, selBagian) {
  selBagian.innerHTML = '<option value="">-- Pilih Bagian --</option>';
  
  if(!kelasId || !tingkatanId) {
    selBagian.disabled = true;
    return;
  }
  
  selBagian.disabled = false;
  const filtered = (cachedBagian || []).filter(b => b.kelas_id == kelasId && b.tingkatan_id == tingkatanId);
  filtered.forEach(b => {
    selBagian.innerHTML += `<option value="${b.id}">${b.nama_bagian}</option>`;
  });
}

// Event Listeners for Cascading Dropdowns
selTingkatanAsal?.addEventListener('change', (e) => {
  handleTingkatanChange(e.target.value, selKelasAsal, selBagianAsal);
});

selKelasAsal?.addEventListener('change', (e) => {
  handleKelasChange(e.target.value, selTingkatanAsal.value, selBagianAsal);
});

selTingkatanTujuan?.addEventListener('change', (e) => {
  handleTingkatanChange(e.target.value, selKelasTujuan, selBagianTujuan);
});

selKelasTujuan?.addEventListener('change', (e) => {
  handleKelasChange(e.target.value, selTingkatanTujuan.value, selBagianTujuan);
});

// Isi dropdown kelas untuk susun stambuk saat tingkatan dipilih.
selTingkatanStambuk?.addEventListener('change', () => {
  selKelasStambuk.innerHTML = '<option value="">-- Pilih Kelas --</option>';
  if (!selTingkatanStambuk.value) { selKelasStambuk.disabled = true; return; }
  selKelasStambuk.disabled = false;
  (cachedKelas || []).forEach(a => {
    selKelasStambuk.innerHTML += `<option value="${a.id}">${a.nama}</option>`;
  });
});

// Susun ulang Stambuk posisi untuk kelas terpilih (mis. Kelas 1 Tsanawiyah).
btnSusunStambuk?.addEventListener('click', async () => {
  const tingkatanId = selTingkatanStambuk?.value;
  const kelasId = selKelasStambuk?.value;
  if (!tingkatanId || !kelasId) { alert('Pilih tingkatan dan kelas terlebih dahulu.'); return; }
  const namaTingkatan = selTingkatanStambuk.options[selTingkatanStambuk.selectedIndex]?.text || '';
  const namaKelas = selKelasStambuk.options[selKelasStambuk.selectedIndex]?.text || '';
  if (!confirm(`Susun ulang Stambuk untuk ${namaKelas} ${namaTingkatan}? Nomor lama pada kelas ini akan ditimpa (kelas lain tidak berubah).`)) return;

  const oldText = btnSusunStambuk.textContent;
  btnSusunStambuk.disabled = true;
  btnSusunStambuk.textContent = 'Memproses...';
  try {
    const res = await fetch('/api/akademik/susun-stambuk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tingkatan_id: parseInt(tingkatanId), kelas_id: parseInt(kelasId) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Gagal menyusun nomor stambuk');
    alert(`Berhasil: ${data.count || 0} santri dinomori ulang.`);
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btnSusunStambuk.disabled = false;
    btnSusunStambuk.textContent = oldText;
  }
});

async function loadSantri() {
  try {
    const res = await fetch('/api/santri');
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat santri');
    allSantri = data;
    populateStatusSantriDatalist();
  } catch (err) {
    console.error(err);
  }
  // Muat juga daftar cuti/boyong untuk opsi reaktivasi.
  loadReactivatableSantri();
}

// Isi datalist nama santri untuk form Ubah Status (Cuti/Boyong/Reaktivasi)
const statusSantriDatalist = document.getElementById('status-santri-datalist');
const inputStatusSantriNama = document.getElementById('input-status-santri-nama');
const selStatusTarget = formStatus ? formStatus.querySelector('select[name="status"]') : null;

// Santri yang dapat direaktivasi: berstatus cuti atau boyong (dari arsip).
let reactivatableSantri = [];

// Muat daftar santri cuti/boyong untuk kebutuhan reaktivasi. Endpoint arsip
// mengembalikan santri non-aktif; kita saring ke cuti & boyong saja.
async function loadReactivatableSantri() {
  try {
    const res = await fetch('/api/santri/arsip');
    if (!res.ok) { reactivatableSantri = []; return; }
    const data = await res.json();
    reactivatableSantri = (Array.isArray(data) ? data : []).filter(
      s => s.status === 'cuti' || s.status === 'boyong'
    );
  } catch (_) {
    reactivatableSantri = [];
  }
  populateStatusSantriDatalist();
}

// Daftar santri yang relevan dengan status tujuan terpilih:
// - target 'aktif' (Reaktivasi) → tampilkan santri cuti/boyong,
// - target lain (cuti/boyong)   → tampilkan santri aktif.
function relevantStatusSantri() {
  const target = selStatusTarget ? selStatusTarget.value : '';
  if (target === 'aktif') return reactivatableSantri || [];
  return allSantri || [];
}

function populateStatusSantriDatalist() {
  if (!statusSantriDatalist) return;
  statusSantriDatalist.innerHTML = '';
  relevantStatusSantri().forEach(s => {
    const opt = document.createElement('option');
    opt.value = `${s.nama} (${s.stambuk || 'tanpa stambuk'})`;
    statusSantriDatalist.appendChild(opt);
  });
}

// Perbarui datalist saat status tujuan berubah (mis. pilih Reaktivasi).
if (selStatusTarget) {
  selStatusTarget.addEventListener('change', () => {
    if (inputStatusSantriNama) inputStatusSantriNama.value = '';
    populateStatusSantriDatalist();
  });
}

// Resolusi teks input datalist menjadi santri_id. Cari di gabungan daftar
// (aktif + cuti/boyong) agar tetap kenal walau status tujuan berganti.
function resolveStatusSantriId(inputVal) {
  if (!inputVal) return null;
  const val = inputVal.trim();
  const pool = [...(allSantri || []), ...(reactivatableSantri || [])];
  const match = pool.find(s => `${s.nama} (${s.stambuk || 'tanpa stambuk'})` === val);
  if (match) return match.id;
  const byName = pool.filter(s => s.nama.toLowerCase() === val.toLowerCase());
  if (byName.length === 1) return byName[0].id;
  return null;
}


// 5. Render Mutasi Table
selBagianAsal.addEventListener('change', () => {
  const bgId = parseInt(selBagianAsal.value);
  if (!bgId) {
    tableBodyMutasi.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-gray-400">Pilih Bagian Asal terlebih dahulu...</td></tr>`;
    btnProsesMutasi.disabled = true;
    return;
  }
  
  const filtered = allSantri.filter(s => s.bagian_id === bgId);
  if (filtered.length === 0) {
    tableBodyMutasi.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-gray-400">Tidak ada santri di bagian ini.</td></tr>`;
    btnProsesMutasi.disabled = true;
    return;
  }
  
  tableBodyMutasi.innerHTML = '';
  filtered.forEach(s => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50';
    
    // Create dropdown for this specific row using cachedBagian
    let selectTujuanStr = `<select class="sel-tujuan-row glass-input px-2 py-1 rounded text-sm w-full bg-white dark:bg-slate-800" data-santri="${s.id}">
                             <option value="">Ikut Tujuan Utama</option>`;
    cachedBagian.forEach(b => {
      if(b.id !== bgId) {
        selectTujuanStr += `<option value="${b.id}">${b.tingkatan} - ${b.nama_bagian}</option>`;
      }
    });
    selectTujuanStr += `</select>`;

    tr.innerHTML = `
      <td data-label="Pilih" class="px-6 py-4 md:text-center flex justify-end">
        <input type="checkbox" value="${s.id}" class="santri-checkbox rounded text-primary focus:ring-primary" checked>
      </td>
      <td data-label="Stambuk" class="px-6 py-4 font-medium text-gray-900 dark:text-white">${s.stambuk}</td>
      <td data-label="Nama Lengkap" class="px-6 py-4 text-gray-700 dark:text-gray-300">${s.nama}</td>
      <td data-label="Tujuan (Opsional)" class="px-6 py-4">${selectTujuanStr}</td>
    `;
    tableBodyMutasi.appendChild(tr);
  });
  
  btnProsesMutasi.disabled = false;
  updateLuluskanVisibility();
  
  // Attach checkbox events to update "Check All"
  document.querySelectorAll('.santri-checkbox').forEach(cb => {
    cb.addEventListener('change', updateCheckAllState);
  });
});

// Tampilkan tombol "Luluskan ke Alumni" hanya bila Bagian Asal berada
// di Kelas 3 tingkatan Aliyah (kelas akhir).
function isKelasAkhirAliyah() {
  const tingkatanText = selTingkatanAsal?.options[selTingkatanAsal.selectedIndex]?.text || '';
  const kelasText = selKelasAsal?.options[selKelasAsal.selectedIndex]?.text || '';
  const isAliyah = /aliyah/i.test(tingkatanText);
  const isKelas3 = /(^|\D)3(\D|$)/.test(kelasText) || /tiga/i.test(kelasText);
  return isAliyah && isKelas3;
}

function updateLuluskanVisibility() {
  if (!btnLuluskanAlumni) return;
  const bgId = parseInt(selBagianAsal.value);
  const canWrite = window._canWrite !== false;
  if (bgId && isKelasAkhirAliyah() && canWrite) {
    btnLuluskanAlumni.classList.remove('hidden');
  } else {
    btnLuluskanAlumni.classList.add('hidden');
  }
}

// Luluskan santri terpilih (Kelas 3 Aliyah) — buka modal pilihan khidmah/tidak
btnLuluskanAlumni?.addEventListener('click', () => {
  const checkboxes = Array.from(document.querySelectorAll('.santri-checkbox:checked'));
  if (checkboxes.length === 0) {
    alert('Pilih minimal satu santri untuk diluluskan.');
    return;
  }

  // Buka modal
  const modal = document.getElementById('modal-luluskan');
  const content = document.getElementById('modal-luluskan-content');
  const info = document.getElementById('luluskan-count-info');
  info.textContent = `${checkboxes.length} santri terpilih akan diproses.`;
  modal.classList.remove('hidden');
  void content.offsetWidth;
  content.classList.remove('scale-95', 'opacity-0');
  content.classList.add('scale-100', 'opacity-100');
});

// Modal toggle fields berdasarkan radio
document.querySelectorAll('input[name="luluskan_choice"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const isKhidmah = e.target.value === 'khidmah';
    document.getElementById('luluskan-fields-tidak')?.classList.toggle('hidden', isKhidmah);
    document.getElementById('luluskan-fields-khidmah')?.classList.toggle('hidden', !isKhidmah);
  });
});

// Modal close
function closeLuluskanModal() {
  const modal = document.getElementById('modal-luluskan');
  const content = document.getElementById('modal-luluskan-content');
  content.classList.remove('scale-100', 'opacity-100');
  content.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}
document.getElementById('modal-luluskan-close')?.addEventListener('click', closeLuluskanModal);
document.getElementById('modal-luluskan-cancel')?.addEventListener('click', closeLuluskanModal);
document.getElementById('modal-luluskan-overlay')?.addEventListener('click', closeLuluskanModal);

// Modal submit
document.getElementById('modal-luluskan-submit')?.addEventListener('click', async () => {
  const checkboxes = Array.from(document.querySelectorAll('.santri-checkbox:checked'));
  if (checkboxes.length === 0) return;

  const choice = document.querySelector('input[name="luluskan_choice"]:checked')?.value || 'tidak_khidmah';
  const tanggalKeluar = new Date().toISOString().slice(0, 10);

  if (choice === 'khidmah') {
    // Alur Pengabdian
    const tempat = document.getElementById('luluskan-khidmah-tempat')?.value?.trim();
    const mulai = document.getElementById('luluskan-khidmah-mulai')?.value;
    if (!tempat || !mulai) {
      alert('Tempat khidmah dan tanggal mulai wajib diisi.');
      return;
    }

    const btn = document.getElementById('modal-luluskan-submit');
    btn.disabled = true; btn.textContent = 'Memproses...';

    try {
      let successCount = 0;
      for (const cb of checkboxes) {
        const payload = { santri_id: parseInt(cb.value), khidmah_tempat: tempat, khidmah_mulai: mulai };
        const res = await fetch('/api/pengabdian/mulai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Gagal memproses santri ID ${cb.value}`);
        }
        successCount++;
      }
      alert(`Sukses! ${successCount} santri masuk pengabdian (khidmah).`);
      closeLuluskanModal();
      selBagianAsal.dispatchEvent(new Event('change'));
      await loadSantri();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      const btn = document.getElementById('modal-luluskan-submit');
      btn.disabled = false; btn.textContent = 'Proses';
    }
  } else {
    // Alur Tidak Khidmah — langsung lulus
    const alasan = document.getElementById('luluskan-alasan')?.value?.trim();
    if (!alasan) {
      alert('Alasan tidak khidmah wajib diisi.');
      return;
    }

    const btn = document.getElementById('modal-luluskan-submit');
    btn.disabled = true; btn.textContent = 'Memproses...';

    try {
      let successCount = 0;
      for (const cb of checkboxes) {
        const payload = {
          santri_id: parseInt(cb.value),
          status_akhir: 'lulus',
          tanggal_keluar: tanggalKeluar,
          alasan: 'Lulus kelas 3 Aliyah - Tidak Khidmah',
          keterangan_alumni: alasan
        };
        const res = await fetch('/api/alumni/proses-keluar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Gagal meluluskan santri ID ${cb.value}`);
        }
        successCount++;
      }
      alert(`Sukses meluluskan ${successCount} santri menjadi Alumni (Tidak Khidmah).`);
      closeLuluskanModal();
      selBagianAsal.dispatchEvent(new Event('change'));
      await loadSantri();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      const btn = document.getElementById('modal-luluskan-submit');
      btn.disabled = false; btn.textContent = 'Proses';
    }
  }
});


checkAll.addEventListener('change', (e) => {
  document.querySelectorAll('.santri-checkbox').forEach(cb => {
    cb.checked = e.target.checked;
  });
});

function updateCheckAllState() {
  const checkboxes = document.querySelectorAll('.santri-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkAll.checked = allChecked;
}

// 6. Submit Mutasi (Naik Kelas / Redistribusi)
btnProsesMutasi.addEventListener('click', async () => {
  const bagianAsalId = parseInt(selBagianAsal.value);
  const bagianTujuanGlobal = parseInt(selBagianTujuan.value);
  
  if (!bagianAsalId) {
    alert("Harap pilih Bagian Asal.");
    return;
  }
  
  const checkboxes = Array.from(document.querySelectorAll('.santri-checkbox:checked'));
  if (checkboxes.length === 0) {
    alert("Pilih minimal satu santri untuk dipindah.");
    return;
  }

  // Group by destination
  const groups = {};
  for(const cb of checkboxes) {
    const sId = parseInt(cb.value);
    const selRow = document.querySelector(`.sel-tujuan-row[data-santri="${sId}"]`);
    
    let destId = bagianTujuanGlobal;
    if(selRow && selRow.value) {
      destId = parseInt(selRow.value);
    }
    
    if(!destId) {
      alert(`Santri dengan ID ${sId} tidak memiliki tujuan (Pilih di baris atau Tujuan Utama)`);
      return;
    }
    if(destId === bagianAsalId) {
      alert(`Tujuan tidak boleh sama dengan Asal (Santri ID ${sId})`);
      return;
    }
    
    if(!groups[destId]) groups[destId] = [];
    groups[destId].push(sId);
  }
  
  if (!confirm(`Anda yakin ingin memindahkan ${checkboxes.length} santri ke tujuan masing-masing?`)) return;
  
  btnProsesMutasi.disabled = true;
  btnProsesMutasi.textContent = "Memproses...";
  
  try {
    let successCount = 0;
    for (const destId of Object.keys(groups)) {
      const payload = {
        bagian_asal_id: bagianAsalId,
        bagian_baru_id: parseInt(destId),
        santri_ids: groups[destId],
        pindah_mustahiq: checkMustahiq.checked // Note: if redistributing, maybe this only applies to the first group, but backend handles it by checking asal_id.
      };
      
      const res = await fetch('/api/perpindahan/naik-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || `Gagal memindah ke bagian ${destId}`);
      }
      successCount += groups[destId].length;
    }
    
    alert(`Sukses memindahkan ${successCount} santri.`);
    
    // Reload UI
    selBagianAsal.value = '';
    selBagianTujuan.value = '';
    selBagianAsal.dispatchEvent(new Event('change'));
    await loadSantri(); // Refresh master data
    
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    btnProsesMutasi.textContent = "Proses Mutasi";
    btnProsesMutasi.disabled = false;
  }
});

// 7. Submit Cuti/Reaktivasi
formStatus.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusError.classList.add('hidden');
  statusSuccess.classList.add('hidden');
  
  const santriId = resolveStatusSantriId(inputStatusSantriNama.value);
  if (!santriId) {
    statusError.textContent = 'Santri tidak ditemukan. Pilih nama santri dari daftar.';
    statusError.classList.remove('hidden');
    return;
  }
  
  const formData = new FormData(formStatus);
  const payload = {
    santri_id: santriId,
    status: formData.get('status'),
    tanggal_status: formData.get('tanggal_status')
  };
  
  const btnSubmit = formStatus.querySelector('button');

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Memproses...";
  
  try {
    const res = await fetch('/api/perpindahan/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal mengubah status');
    
    statusSuccess.textContent = data.message;
    statusSuccess.classList.remove('hidden');
    formStatus.reset();
    
    await loadSantri(); // Refresh internal data
    
  } catch (err) {
    statusError.textContent = err.message;
    statusError.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Simpan Perubahan Status";
  }
});

// Init
checkAuth();


// ==================== KELOLA Stambuk MASSAL ====================
const stambukTingkatanSel = document.getElementById('stambuk-tingkatan');
const stambukKelasSel = document.getElementById('stambuk-kelas');
const stambukLoadBtn = document.getElementById('stambuk-load');
const stambukToolbar = document.getElementById('stambuk-toolbar');
const stambukTableContainer = document.getElementById('stambuk-table-container');
const stambukTableBody = document.getElementById('stambuk-table-body');
const stambukEmpty = document.getElementById('stambuk-empty');
const stambukMaxEl = document.getElementById('stambuk-max');
const stambukStartInp = document.getElementById('stambuk-start');
const stambukGenerateBtn = document.getElementById('stambuk-generate');
const stambukClearBtn = document.getElementById('stambuk-clear');
const stambukSaveBtn = document.getElementById('stambuk-save');

// Populate tingkatan dropdown (pakai cachedTingkatan yang sudah dimuat).
function populateNisTingkatan() {
  if (!stambukTingkatanSel) return;
  stambukTingkatanSel.innerHTML = '<option value="">-- Pilih Tingkatan --</option>';
  (cachedTingkatan || []).forEach(t => {
    stambukTingkatanSel.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
  });
}

// Cascade tingkatan → kelas.
stambukTingkatanSel?.addEventListener('change', () => {
  stambukKelasSel.innerHTML = '<option value="">-- Pilih Kelas --</option>';
  stambukKelasSel.disabled = !stambukTingkatanSel.value;
  if (!stambukTingkatanSel.value) return;
  (cachedKelas || []).forEach(k => {
    stambukKelasSel.innerHTML += `<option value="${k.id}">${k.nama}</option>`;
  });
});

// Muat data santri di kelas terpilih.
stambukLoadBtn?.addEventListener('click', async () => {
  const tId = stambukTingkatanSel.value;
  const kId = stambukKelasSel.value;
  if (!tId || !kId) { alert('Pilih tingkatan dan kelas dulu.'); return; }

  stambukToolbar.classList.add('hidden');
  stambukTableContainer.classList.add('hidden');
  stambukEmpty.classList.add('hidden');
  stambukLoadBtn.disabled = true;
  const oldText = stambukLoadBtn.textContent;
  stambukLoadBtn.textContent = 'Memuat...';

  try {
    const res = await fetch(`/api/stambuk/kelas?tingkatan_id=${tId}&kelas_id=${kId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat data');

    const santri = data.santri || [];
    stambukMaxEl.textContent = data.max_stambuk || 0;
    stambukStartInp.value = data.next_stambuk || 1;

    if (santri.length === 0) {
      stambukEmpty.classList.remove('hidden');
      return;
    }

    // Render tabel: urut sudah dari backend (bagian → nama).
    stambukTableBody.innerHTML = '';
    let currentBagian = null;
    let noPerBagian = 0;
    santri.forEach(s => {
      if (s.nama_bagian !== currentBagian) {
        currentBagian = s.nama_bagian;
        noPerBagian = 0;
      }
      noPerBagian++;
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors';
      tr.innerHTML = `
        <td class="px-4 py-2 font-semibold text-indigo-600 dark:text-indigo-400">${s.nama_bagian}</td>
        <td class="px-4 py-2 text-center text-gray-500">${noPerBagian}</td>
        <td class="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">${s.nama}</td>
        <td class="px-2 py-1">
          <input type="text" data-santri-id="${s.santri_id}" value="${s.stambuk || ''}"
                 class="stambuk-input glass-input px-2 py-1.5 rounded-lg text-sm w-full text-center font-mono font-bold text-indigo-700 dark:text-indigo-400"
                 placeholder="-">
        </td>
      `;
      stambukTableBody.appendChild(tr);
    });

    stambukToolbar.classList.remove('hidden');
    stambukToolbar.classList.add('flex');
    stambukTableContainer.classList.remove('hidden');

  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    stambukLoadBtn.disabled = false;
    stambukLoadBtn.textContent = oldText;
  }
});

// Generate otomatis: urutan tabel sudah bagian → nama, tinggal isi Stambuk berurutan.
stambukGenerateBtn?.addEventListener('click', () => {
  const start = parseInt(stambukStartInp.value);
  if (isNaN(start) || start < 1) { alert('Nomor mulai harus angka >= 1.'); return; }

  const inputs = stambukTableBody.querySelectorAll('.stambuk-input');
  if (inputs.length === 0) return;

  // Konfirmasi kalau ada yang sudah punya Stambuk.
  const hasExisting = Array.from(inputs).some(i => i.value.trim() !== '');
  if (hasExisting) {
    if (!confirm(`Ini akan menimpa Stambuk ${inputs.length} santri. Lanjutkan?`)) return;
  }

  let n = start;
  inputs.forEach(inp => {
    inp.value = String(n);
    n++;
  });
});

// Kosongkan semua Stambuk di tabel (visual saja, belum simpan).
stambukClearBtn?.addEventListener('click', () => {
  if (!confirm('Kosongkan Stambuk semua santri di kelas ini? (belum tersimpan sampai klik Simpan)')) return;
  stambukTableBody.querySelectorAll('.stambuk-input').forEach(inp => { inp.value = ''; });
});

// Simpan bulk update.
stambukSaveBtn?.addEventListener('click', async () => {
  const inputs = stambukTableBody.querySelectorAll('.stambuk-input');
  if (inputs.length === 0) return;

  const items = [];
  const seen = new Set();
  let hasDuplicate = false;

  inputs.forEach(inp => {
    const stambuk = inp.value.trim();
    const sid = parseInt(inp.dataset.santriId);
    items.push({ santri_id: sid, stambuk: stambuk });
    if (stambuk !== '') {
      if (seen.has(stambuk)) hasDuplicate = true;
      seen.add(stambuk);
    }
  });

  if (hasDuplicate) {
    if (!confirm('Ada Stambuk duplikat di tabel ini. Tetap simpan?')) return;
  }

  stambukSaveBtn.disabled = true;
  const oldText = stambukSaveBtn.textContent;
  stambukSaveBtn.textContent = 'Menyimpan...';

  try {
    const res = await fetch('/api/stambuk/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal simpan');
    alert(`Berhasil update ${data.count || items.length} Stambuk santri.`);
    // Reload untuk update MAX Stambuk.
    stambukLoadBtn.click();
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    stambukSaveBtn.disabled = false;
    stambukSaveBtn.textContent = oldText;
  }
});

// Populate tingkatan setelah master data ready. loadMasterData() dipanggil di
// checkAuth() dan cachedTingkatan diset di dalamnya. Kita listen ke perubahan
// dropdown tingkatan lama untuk memicu populate (guarantee sudah loaded).
selTingkatanAsal?.addEventListener('change', populateNisTingkatan);
// Juga panggil setelah 1 detik untuk safety (kalau user tidak sentuh dropdown lama).
setTimeout(populateNisTingkatan, 1500);
