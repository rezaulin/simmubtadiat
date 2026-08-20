// frontend/src/js/profil_santri.js

import { translateKitab } from './kitab-translate.js';

const loadingIndicator = document.getElementById('loading-indicator');
const profilContent = document.getElementById('profil-content');
const riwayatContainer = document.getElementById('riwayat-container');
const riwayatEmpty = document.getElementById('riwayat-empty');
const catatanContainer = document.getElementById('catatan-container');
const catatanEmpty = document.getElementById('catatan-empty');

const pFoto = document.getElementById('p-foto');
const pNama = document.getElementById('p-nama');

const pStatus = document.getElementById('p-status');
const pKelasNow = document.getElementById('p-kelas-now');

const pNik = document.getElementById('p-nik');
const pTtl = document.getElementById('p-ttl');
const pWali = document.getElementById('p-wali');
const pNoHp = document.getElementById('p-no-hp');
const pKamar = document.getElementById('p-kamar');
const pAlamat = document.getElementById('p-alamat');

const tabBiodata = document.getElementById('tab-biodata');
const tabAkademik = document.getElementById('tab-akademik');
const tabPelanggaran = document.getElementById('tab-pelanggaran');
const contentBiodata = document.getElementById('content-biodata');
const contentAkademik = document.getElementById('content-akademik');
const contentPelanggaran = document.getElementById('content-pelanggaran');

const btnBack = document.getElementById('btn-back');

// URL params
const urlParams = new URLSearchParams(window.location.search);
const santriId = urlParams.get('id');

// Pemetaan Status_Santri → label & kelas warna badge pada detail profil.
// Nilai DB: aktif, cuti, pengabdian, lulus, boyong, keluar.
// Entri `pengabdian` memakai warna ungu (purple) sesuai design.
const statusMap = {
  aktif:      { label: 'Aktif',            cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  lulus:      { label: 'Alumni (Lulus)',   cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  pengabdian: { label: 'Pengabdian',       cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  keluar:     { label: 'Keluar',           cls: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  boyong:     { label: 'Boyong / Pindah',  cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  cuti:       { label: 'Cuti',             cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' }
};

// Fungsi murni: pemetaan Status_Santri → label badge pada detail profil.
// Menghasilkan 'Pengabdian' jika & hanya jika status 'pengabdian' (Requirement 6.1).
function profilStatusLabel(status) {
  const st = statusMap[status];
  return st ? st.label : (status || '-');
}

// Fungsi murni: status riwayat pengabdian.
// 'pengabdian' → 'Berlangsung' (Requirement 7.2); status lain → 'Selesai'
// (termasuk 'lulus' yang pernah berkhidmah, Requirement 7.3).
function khidmahRiwayatStatus(status) {
  return status === 'pengabdian' ? 'Berlangsung' : 'Selesai';
}

// Render daftar catatan pelanggaran & prestasi.
function populateCatatan(list, canWrite) {
  if (!catatanContainer) return;
  catatanContainer.innerHTML = '';
  if (!list || list.length === 0) {
    if (catatanEmpty) catatanEmpty.classList.remove('hidden');
    return;
  }
  if (catatanEmpty) catatanEmpty.classList.add('hidden');

  list.forEach((c) => {
    const isPel = c.jenis === 'pelanggaran';
    const badgeTxt = isPel ? 'Pelanggaran' : 'Prestasi';
    const badgeCls = isPel
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    const borderCls = isPel
      ? 'border-red-200 dark:border-red-800'
      : 'border-green-200 dark:border-green-800';
    const kategori = c.kategori ? ` · ${c.kategori}` : '';
    const pencatat = c.pencatat
      ? `<div class="mt-1 text-xs text-gray-400">Dicatat oleh: ${c.pencatat}</div>`
      : '';
    const aksi = canWrite
      ? `<button data-del-catatan="${c.id}" class="text-red-500 hover:text-red-700 text-xs font-semibold ml-auto transition-colors">Hapus</button>`
      : '';
    catatanContainer.innerHTML += `
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${borderCls} p-4">
        <div class="flex items-center justify-between gap-3 mb-1">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeCls}">${badgeTxt}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">${c.tanggal}${kategori}</span>
          </div>
          ${aksi}
        </div>
        <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">${c.deskripsi}</p>
        ${pencatat}
      </div>`;
  });
}

// Kelas aktif/nonaktif untuk tombol tab.
const TAB_ACTIVE = ['border-indigo-500', 'text-indigo-600', 'dark:text-indigo-400'];
const TAB_INACTIVE = ['border-transparent', 'text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400'];

// switchTab generik yang aman terhadap tab/konten yang tidak ada (mis. pada
// lingkungan test yang hanya menyediakan sebagian elemen).
window.switchTab = function(tab) {
  const tabs = [
    { key: 'biodata', btn: tabBiodata, content: contentBiodata },
    { key: 'akademik', btn: tabAkademik, content: contentAkademik },
    { key: 'pelanggaran', btn: tabPelanggaran, content: contentPelanggaran },
  ];
  tabs.forEach((t) => {
    const active = t.key === tab;
    if (t.content) t.content.classList.toggle('hidden', !active);
    if (t.btn) {
      if (active) {
        t.btn.classList.add(...TAB_ACTIVE);
        t.btn.classList.remove(...TAB_INACTIVE);
      } else {
        t.btn.classList.remove(...TAB_ACTIVE);
        t.btn.classList.add(...TAB_INACTIVE);
      }
    }
  });
};

if (tabBiodata) tabBiodata.addEventListener('click', () => switchTab('biodata'));
if (tabAkademik) tabAkademik.addEventListener('click', () => switchTab('akademik'));
if (tabPelanggaran) tabPelanggaran.addEventListener('click', () => switchTab('pelanggaran'));

btnBack.addEventListener('click', () => {
  if (document.referrer) {
    window.history.back();
  } else {
    window.location.href = '/santri.html';
  }
});

const btnDelete = document.getElementById('btn-delete');
const btnEdit = document.getElementById('btn-edit');
if (btnDelete || btnEdit) {
  const role = localStorage.getItem('user_role');
  if (role === 'pimpinan' || role === 'admin') {
    if (btnDelete) {
      btnDelete.classList.remove('hidden');
      btnDelete.classList.add('flex');
      btnDelete.addEventListener('click', async () => {
        if (confirm('Yakin ingin menghapus santri ini secara permanen? Semua riwayat kelas, absensi, nilai, dll juga akan terhapus dan tidak bisa dikembalikan.')) {
          try {
            const res = await fetch(`/api/santri/${santriId}`, { method: 'DELETE' });
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.message || 'Gagal menghapus santri');
            }
            alert('Santri berhasil dihapus');
            window.location.href = '/santri.html';
          } catch (e) {
            alert(e.message);
          }
        }
      });
    }

    if (btnEdit) {
      btnEdit.classList.remove('hidden');
      btnEdit.classList.add('flex');
    }
  }
}

// Global variable to hold loaded santri data for edit
let currentSantriData = null;

function escapeHtml(str) {
  if (str === null || str === undefined) return '-';
  // Data API sudah disanitasi secara global oleh xss.js.
  // Hindari escaping ganda agar entitas HTML (seperti &#39;) tidak rusak.
  return String(str);
}

async function loadData() {
  if (!santriId) {
    alert("ID Santri tidak ditemukan.");
    window.location.href = '/santri.html';
    return;
  }

  try {
    let canWriteCatatan = false;
    try {
      const meRes = await fetch('/api/me');
      if (meRes.ok) {
        const me = await meRes.json();
        const roles = me.roles || [me.role];
        canWriteCatatan = roles.includes('pimpinan') || roles.includes('muroqib');
        if (canWriteCatatan) {
          const btnAddC = document.getElementById('btn-add-catatan');
          if (btnAddC) btnAddC.classList.remove('hidden');
        }
      }
    } catch (e) {}

    // 1. Fetch Biodata
    const resSantri = await fetch(`/api/santri/${santriId}`);
    if (!resSantri.ok) throw new Error('Gagal memuat profil santri');
    const s = await resSantri.json();

    // 2. Fetch Riwayat Akademik
    const resRiwayat = await fetch(`/api/santri/${santriId}/riwayat-akademik`);
    const riwayat = resRiwayat.ok ? await resRiwayat.json() : [];

    // 3. Fetch Catatan Pelanggaran & Prestasi
    const resCatatan = await fetch(`/api/catatan?santri_id=${santriId}`);
    const catatan = resCatatan.ok ? (await resCatatan.json()) || [] : [];

    currentSantriData = s;
    populateBiodata(s);
    populateRiwayat(riwayat);
    populateCatatan(catatan, canWriteCatatan);

    loadingIndicator.classList.add('hidden');
    profilContent.classList.remove('hidden');
    
    // auto switch tab if location hash is present
    if (window.location.hash === '#transkrip' || window.location.hash === '#akademik') {
      switchTab('akademik');
    } else if (window.location.hash === '#pelanggaran' || window.location.hash === '#catatan') {
      switchTab('pelanggaran');
    }

  } catch (e) {
    console.error(e);
    alert('Terjadi kesalahan saat memuat data: ' + e.message);
  }
}

function populateBiodata(s) {
  if (s.foto_url) {
    pFoto.src = s.foto_url.startsWith('/uploads') ? s.foto_url : `/uploads/${s.foto_url}`;
  } else {
    pFoto.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(s.nama || 'Santri')}&background=e0e7ff&color=4f46e5&size=200`;
  }

  pNama.textContent = s.nama;

  const elNis = document.getElementById('p-nis');
  if (elNis) elNis.textContent = s.stambuk || (s.nomor_stambuk_urut ? String(s.nomor_stambuk_urut) : '-');
  pNik.textContent = s.nik || '-';
  const elNisn = document.getElementById('p-nisn');
  if (elNisn) elNisn.textContent = s.nisn || '-';
  const elNisnHeader = document.getElementById('p-nisn-header');
  if (elNisnHeader) elNisnHeader.textContent = s.nisn || '-';
  pTtl.textContent = `${s.ttl_tempat || '-'}, ${s.ttl_tanggal ? new Date(s.ttl_tanggal).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}`;
  pWali.textContent = s.nama_wali || '-';
  pNoHp.textContent = s.no_hp_wali || '-';
  if (pKamar) pKamar.textContent = s.kamar || '-';

  const alamatArr = [s.alamat, s.desa, s.kecamatan_nama, s.kabupaten_nama, s.provinsi_nama].filter(Boolean);
  pAlamat.textContent = alamatArr.length > 0 ? alamatArr.join(', ') : '-';

  // Tahun masuk & keluar
  const elTahunMasuk = document.getElementById('p-tahun-masuk');
  const elTahunKeluar = document.getElementById('p-tahun-keluar');
  if (elTahunMasuk) elTahunMasuk.textContent = s.tahun_masuk || '-';
  if (elTahunKeluar) elTahunKeluar.textContent = s.tahun_keluar || '-';

  // Status santri (nilai DB: aktif, cuti, pengabdian, lulus, boyong, keluar).
  const st = statusMap[s.status] || { label: s.status || '-', cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' };
  pStatus.textContent = st.label;
  pStatus.className = 'px-3 py-1 text-sm rounded-full font-medium ' + st.cls;

  // Badge khidmah:
  // - status 'pengabdian' → tampilkan "Khidmah: <tempat>"
  // - status 'lulus' + khidmah_selesai terisi → "SELESAI KHIDMAH" (pernah berkhidmah)
  // - status 'lulus' tanpa data khidmah → "TIDAK KHIDMAH"
  const khidmahBadge = document.getElementById('p-khidmah-tempat');
  if (khidmahBadge) {
    khidmahBadge.classList.add('hidden');
    khidmahBadge.textContent = '';
    khidmahBadge.className = 'px-3 py-1 text-sm rounded-full font-medium';

    if (s.status === 'pengabdian' && s.khidmah_tempat) {
      khidmahBadge.textContent = `Khidmah: ${s.khidmah_tempat}`;
      khidmahBadge.className += ' bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      khidmahBadge.classList.remove('hidden');
    } else if (s.status === 'lulus') {
      // Cek apakah pernah berkhidmah (punya khidmah_selesai atau khidmah_tempat)
      const pernahKhidmah = s.khidmah_selesai || (s.khidmah_tempat && s.khidmah_tempat.trim());
      if (pernahKhidmah) {
        const tempat = s.khidmah_tempat ? ` (${s.khidmah_tempat})` : '';
        khidmahBadge.textContent = `Selesai Khidmah${tempat}`;
        khidmahBadge.className += ' bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      } else {
        khidmahBadge.textContent = 'Tidak Khidmah';
        khidmahBadge.className += ' bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      }
      khidmahBadge.classList.remove('hidden');
    }
  }

  // Blok Riwayat Pengabdian (Requirement 7): tampil bila santri punya data khidmah.
  populateRiwayatPengabdian(s);

  // Kelas: hanya "Kelas Saat Ini" bila masih aktif. Untuk alumni/keluar/boyong,
  // tampilkan sebagai "Kelas Terakhir" agar tidak menyesatkan.
  const kelasStr = [
    s.tingkatan_nama,
    s.kelas_nama ? `Kelas ${s.kelas_nama}` : null,
    s.bagian_nama ? `Bagian ${s.bagian_nama}` : null
  ].filter(Boolean).join(' - ');

  if (s.status === 'aktif') {
    pKelasNow.textContent = kelasStr ? `Kelas Saat Ini: ${kelasStr}` : 'Tidak Ada Kelas Aktif';
    pKelasNow.className = 'px-3 py-1 text-sm rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  } else if (kelasStr) {
    pKelasNow.textContent = `Kelas Terakhir: ${kelasStr}`;
    pKelasNow.className = 'px-3 py-1 text-sm rounded-full font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  } else {
    pKelasNow.textContent = 'Tidak Ada Kelas';
    pKelasNow.className = 'px-3 py-1 text-sm rounded-full font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

// Format tanggal khidmah → "-" bila kosong (Requirement 7.4).
function fmtTanggalKhidmah(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID');
}

// Blok "Riwayat Pengabdian" pada tab Biodata. Tampil selama santri memiliki
// data khidmah (khidmah_tempat terisi). Menampilkan tempat, mulai,
// selesai ("-" bila kosong), dan status (Berlangsung/Selesai).
function populateRiwayatPengabdian(s) {
  const card = document.getElementById('riwayat-pengabdian-card');
  if (!card) return;

  if (!s.khidmah_tempat) {
    card.classList.add('hidden');
    return;
  }

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setText('p-khidmah-tempat-detail', s.khidmah_tempat || '-');
  setText('p-khidmah-mulai', fmtTanggalKhidmah(s.khidmah_mulai));
  setText('p-khidmah-selesai', fmtTanggalKhidmah(s.khidmah_selesai));
  setText('p-khidmah-status', khidmahRiwayatStatus(s.status));

  card.classList.remove('hidden');
}

function toArabicDigits(value) {
  if (value === null || value === undefined || value === '') return '';
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(value).replace(/[0-9]/g, (d) => map[Number(d)]);
}

function fmtNilai(n) {
  if (n === null || n === undefined || n === '') return '-';
  const num = Number(n);
  if (Number.isNaN(num)) return escapeHtml(n);
  const rounded = Math.round(num * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return toArabicDigits(str);
}

const EXCLUDED_KATEGORI = new Set([
  'al_quran',
  'al_khot_imla',
  'qiroah_kutub',
  'muhafadhoh',
  'akhlaq',
  'akhlaq_perilaku'
]);

function populateRiwayat(riwayatArr) {
  if (!riwayatArr || riwayatArr.length === 0) {
    riwayatEmpty.classList.remove('hidden');
    return;
  }

  riwayatContainer.innerHTML = '';
  // Sort descending by tahun_ajaran
  riwayatArr.sort((a, b) => b.tahun_ajaran.localeCompare(a.tahun_ajaran));

  riwayatArr.forEach(taData => {
    const isLatest = riwayatArr.indexOf(taData) === 0;
    
    // Aggregate absensi
    let totS = 0, totI = 0, totA = 0;
    if (Array.isArray(taData.absensi)) {
       taData.absensi.forEach(a => {
           totS += a.s || 0;
           totI += a.i || 0;
           totA += a.t || 0;
       });
    }

    // Bangun tabel raport per mapel dengan 6 kolom nilai
    const raportArr = Array.isArray(taData.raport) ? taData.raport : [];
    let raportRows = '';
    raportArr.forEach((r, idx) => {
      const cell = (v) => v != null && v !== '' ? escapeHtml(String(v)) : '<span class="text-gray-300">-</span>';
      // Nama kitab (Arab) di-translasi ke Latin. Nama Arab asli tetap
      // dipertahankan sebagai tooltip agar informasi tak hilang.
      const rawMapel = r.mapel || '';
      const mapelDisplay = translateKitab(rawMapel) || rawMapel || '-';
      const mapelTitle  = rawMapel && rawMapel !== mapelDisplay ? ` title="${escapeHtml(rawMapel)}"` : '';
      raportRows += `
        <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
          <td class="px-3 py-2 text-center text-xs text-gray-500">${idx + 1}</td>
          <td class="px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200"${mapelTitle}>${escapeHtml(mapelDisplay)}</td>
          <td class="px-2 py-2 text-center text-sm">${cell(r.tamrin_k1)}</td>
          <td class="px-2 py-2 text-center text-sm">${cell(r.ujian_k2)}</td>
          <td class="px-2 py-2 text-center text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">${cell(r.smt1)}</td>
          <td class="px-2 py-2 text-center text-sm">${cell(r.tamrin_k3)}</td>
          <td class="px-2 py-2 text-center text-sm">${cell(r.ujian_k4)}</td>
          <td class="px-2 py-2 text-center text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">${cell(r.smt2)}</td>
        </tr>
      `;
    });

    const raportTable = raportArr.length === 0
      ? '<p class="text-sm text-gray-400 italic py-4">Belum ada nilai raport di tahun ini.</p>'
      : `
        <div class="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table class="w-full text-sm">
            <thead class="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th rowspan="2" class="px-3 py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-12 border-r border-gray-200 dark:border-gray-700">No</th>
                <th rowspan="2" class="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">Mata Pelajaran</th>
                <th colspan="3" class="px-2 py-2 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase border-r border-gray-200 dark:border-gray-700 border-b">Semester 1 (Ganjil)</th>
                <th colspan="3" class="px-2 py-2 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase border-b">Semester 2 (Genap)</th>
              </tr>
              <tr class="border-t border-gray-200 dark:border-gray-700">
                <th class="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase w-16">Tamrin K1</th>
                <th class="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase w-16">Ujian K2</th>
                <th class="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase w-16 border-r border-gray-200 dark:border-gray-700 bg-indigo-50/50 dark:bg-indigo-900/10">Raport</th>
                <th class="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase w-16">Tamrin K3</th>
                <th class="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase w-16">Ujian K4</th>
                <th class="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase w-16 bg-indigo-50/50 dark:bg-indigo-900/10">Raport</th>
              </tr>
            </thead>
            <tbody>${raportRows}</tbody>
          </table>
        </div>
      `;

    const cardHtml = `
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
         <div class="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col md:flex-row md:justify-between md:items-center">
            <div>
              <h3 class="text-lg font-bold text-gray-900 dark:text-white">Kelas: ${escapeHtml(taData.nama_bagian || '-')}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">TA ${escapeHtml(taData.tahun_ajaran)}</p>
            </div>
            ${isLatest ? '<span class="mt-2 md:mt-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Terkini</span>' : ''}
         </div>

         <div class="p-6">
            <h4 class="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Rekap Absensi</h4>
            <div class="grid grid-cols-3 gap-4 text-center max-w-lg mb-8">
               <div class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                  <div class="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Sakit (S)</div>
                  <div class="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">${totS}</div>
               </div>
               <div class="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3 border border-yellow-100 dark:border-yellow-800">
                  <div class="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Izin (I)</div>
                  <div class="mt-1 text-2xl font-bold text-yellow-900 dark:text-yellow-100">${totI}</div>
               </div>
               <div class="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 border border-red-100 dark:border-red-800">
                  <div class="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Alpha (A)</div>
                  <div class="mt-1 text-2xl font-bold text-red-900 dark:text-red-100">${totA}</div>
               </div>
            </div>

            <h4 class="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Transkrip Nilai (Tamrin, Ujian & Raport)</h4>
            ${raportTable}

            <h4 class="text-md font-semibold text-gray-800 dark:text-gray-200 mt-8 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Nilai Al-Bayan</h4>
            <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-4 text-center">
               <div class="text-lg font-bold text-indigo-900 dark:text-indigo-200" dir="rtl">
                  البيان (Al-Bayan): ${taData.al_bayan ? escapeHtml(taData.al_bayan) : 'Belum ada'}
               </div>
            </div>
         </div>
      </div>
    `;

    riwayatContainer.innerHTML += cardHtml;
  });
}

document.addEventListener('DOMContentLoaded', loadData);

// ==================== EDIT SANTRI LOGIC ====================
const modalEdit = document.getElementById('modal-edit-santri');
const modalEditContent = document.getElementById('modal-edit-content');
const formEditSantri = document.getElementById('form-edit-santri');
const btnEditClose = document.getElementById('modal-edit-close');
const btnEditCancel = document.getElementById('btn-edit-cancel');
const modalEditError = document.getElementById('modal-edit-error');

function openEditModal() {
  if (!currentSantriData) return;
  
  // Pre-fill form
  const f = formEditSantri;
  f.nik.value = currentSantriData.nik || '';
  f.stambuk.value = currentSantriData.stambuk || '';
  f.stambuk.value = currentSantriData.stambuk || '';
  f.nisn.value = currentSantriData.nisn || '';
  f.nama.value = currentSantriData.nama || '';
  
  const tanggalFormat = currentSantriData.ttl_tanggal ? new Date(currentSantriData.ttl_tanggal).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '';
  const tempatVal = currentSantriData.ttl_tempat || '';
  if(tempatVal && tanggalFormat) {
      f.ttl.value = `${tempatVal}, ${tanggalFormat}`;
  } else if (tempatVal) {
      f.ttl.value = tempatVal;
  } else if (tanggalFormat) {
      f.ttl.value = tanggalFormat;
  } else {
      f.ttl.value = '';
  }

  f.nama_wali.value = currentSantriData.nama_wali || '';
  f.no_hp.value = currentSantriData.no_hp_wali || '';
  f.desa.value = currentSantriData.desa || '';
  f.alamat.value = currentSantriData.alamat || '';
  if (f.kamar) f.kamar.value = currentSantriData.kamar || '';
  
  // Wilayah
  document.getElementById('edit-input-provinsi').value = currentSantriData.provinsi_nama || '';
  document.getElementById('edit-provinsi-kode').value = currentSantriData.provinsi_kode || '';
  document.getElementById('edit-input-kabupaten').value = currentSantriData.kabupaten_nama || '';
  document.getElementById('edit-kabupaten-kode').value = currentSantriData.kabupaten_kode || '';
  document.getElementById('edit-input-kecamatan').value = currentSantriData.kecamatan_nama || '';
  document.getElementById('edit-kecamatan-kode').value = currentSantriData.kecamatan_kode || '';
  
  modalEditError.classList.add('hidden');
  
  // Show modal
  modalEdit.classList.remove('hidden');
  setTimeout(() => {
    modalEditContent.classList.remove('scale-95', 'opacity-0');
  }, 10);
}

function closeEditModal() {
  if (!modalEdit) return;
  modalEditContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modalEdit.classList.add('hidden');
  }, 300);
}

if (btnEdit) {
  btnEdit.addEventListener('click', openEditModal);
}
if (btnEditClose) {
  btnEditClose.addEventListener('click', closeEditModal);
}
if (btnEditCancel) {
  btnEditCancel.addEventListener('click', closeEditModal);
}
const modalEditOverlay = document.getElementById('modal-edit-overlay');
if (modalEditOverlay) {
  modalEditOverlay.addEventListener('click', closeEditModal);
}

if (formEditSantri) {
  formEditSantri.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalEditError.classList.add('hidden');
    
    const formData = new FormData(formEditSantri);

    function parseTanggalLahir(val) {
      if (!val || !val.trim()) return null;
      val = val.trim();
      let d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString();
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
            t_tempat = parts[0].trim() || null;
            t_tanggal = parseTanggalLahir(parts.slice(1).join(',').trim());
        } else {
            t_tempat = parts[0].trim() || null;
        }
    }

    const payload = {
      nik: formData.get('nik'),
      stambuk: formData.get('stambuk'),
      stambuk: formData.get('stambuk'),
      nisn: formData.get('nisn'),
      nama: formData.get('nama'),
      ttl_tempat: t_tempat,
      ttl_tanggal: t_tanggal,
      nama_wali: formData.get('nama_wali'),
      no_hp_wali: formData.get('no_hp'),
      provinsi_kode: formData.get('provinsi_kode'),
      provinsi_nama: formData.get('provinsi_nama'),
      kabupaten_kode: formData.get('kabupaten_kode'),
      kabupaten_nama: formData.get('kabupaten_nama'),
      kecamatan_kode: formData.get('kecamatan_kode'),
      kecamatan_nama: formData.get('kecamatan_nama'),
      desa: formData.get('desa'),
      alamat: formData.get('alamat'),
      kamar: formData.get('kamar')
    };

    try {
      const btn = formEditSantri.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<div class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>';
      btn.disabled = true;

      const res = await fetch(`/api/santri/${santriId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      btn.innerHTML = originalText;
      btn.disabled = false;

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Gagal menyimpan data');
      }

      closeEditModal();
      alert('Data santri berhasil diperbarui!');
      window.location.reload();
      
    } catch (err) {
      modalEditError.textContent = err.message;
      modalEditError.classList.remove('hidden');
    }
  });
}


// ==================== TAMBAH / HAPUS CATATAN LOGIC ====================
const modalCatatan = document.getElementById('modal-catatan');
const formCatatan = document.getElementById('form-catatan');
const btnCancelCatatan = document.getElementById('btn-cancel-catatan');
const btnAddCatatan = document.getElementById('btn-add-catatan');

function openCatatanModal() {
  if (!modalCatatan) return;
  formCatatan.reset();
  document.getElementById('input-tanggal').value = new Date().toISOString().slice(0, 10);
  modalCatatan.classList.remove('hidden');
}

function closeCatatanModal() {
  if (modalCatatan) modalCatatan.classList.add('hidden');
}

if (btnAddCatatan) btnAddCatatan.addEventListener('click', openCatatanModal);
if (btnCancelCatatan) btnCancelCatatan.addEventListener('click', closeCatatanModal);
const modalCatatanOverlay = document.getElementById('modal-overlay');
if (modalCatatanOverlay) modalCatatanOverlay.addEventListener('click', closeCatatanModal);

if (formCatatan) {
  formCatatan.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      santri_id: parseInt(santriId, 10),
      jenis: document.getElementById('input-jenis').value,
      tanggal: document.getElementById('input-tanggal').value,
      kategori: document.getElementById('input-kategori').value.trim(),
      deskripsi: document.getElementById('input-deskripsi').value.trim(),
    };
    if (!payload.deskripsi) { alert('Deskripsi wajib diisi.'); return; }
    try {
      const btn = formCatatan.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Menyimpan...';
      btn.disabled = true;

      const res = await fetch('/api/catatan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      btn.innerHTML = originalText;
      btn.disabled = false;
      
      if (!res.ok) throw new Error(d.message || d.error || 'Gagal menyimpan');
      
      closeCatatanModal();
      
      // reload data catatan
      const resCat = await fetch(`/api/catatan?santri_id=${santriId}`);
      if (resCat.ok) {
        const cat = await resCat.json();
        populateCatatan(cat || [], true);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
}

if (catatanContainer) {
  catatanContainer.addEventListener('click', async (e) => {
    const btnDel = e.target.closest('[data-del-catatan]');
    if (btnDel) {
      if (!confirm('Yakin ingin menghapus catatan ini?')) return;
      const id = btnDel.getAttribute('data-del-catatan');
      try {
        const res = await fetch(`/api/catatan/${id}`, { method: 'DELETE' });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.message || d.error || 'Gagal menghapus');
        
        // reload data catatan
        const resCat = await fetch(`/api/catatan?santri_id=${santriId}`);
        if (resCat.ok) {
          const cat = await resCat.json();
          populateCatatan(cat || [], true); // We know it's true because they clicked delete
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }
  });
}

// Initialize auth to populate navbar
checkAuth();

// ES module exports for tests (jsdom/Vitest) and any module consumers.
// Halaman memuat file ini dengan <script type="module">, sehingga named export
// tidak mengganggu perilaku halaman biasa (browser tetap memakai fungsi di atas).
export { statusMap, profilStatusLabel, khidmahRiwayatStatus, populateBiodata, populateRiwayatPengabdian };

