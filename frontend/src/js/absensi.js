// frontend/src/js/absensi.js

const filterKelas = document.getElementById('filter-kelas');
const filterBagian = document.getElementById('filter-bagian');
const filterTanggal = document.getElementById('filter-tanggal');
const filterPertemuan = document.getElementById('filter-pertemuan');
const btnLoad = document.getElementById('btn-load');

// Nama hari sesuai jadwal_pelajaran.hari (Minggu = "Ahad", Jumat = "Jumat").
const NAMA_HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Muat daftar slot/pertemuan (mapel/jam) untuk bagian + tanggal terpilih dari
// jadwal_pelajaran, difilter ke hari tanggal itu, diurutkan jam. Tiap slot diberi
// nomor pertemuan (1..n) berdasarkan urutan jam.
async function loadPertemuanSlots() {
    if (!filterPertemuan) return;
    const bagianId = filterBagian.value;
    const tgl = filterTanggal.value;
    if (!bagianId || !tgl) {
        filterPertemuan.innerHTML = '<option value="">-- Pilih Kelas & Tanggal --</option>';
        filterPertemuan.disabled = true;
        return;
    }
    filterPertemuan.innerHTML = '<option value="">Memuat pertemuan...</option>';
    filterPertemuan.disabled = true;
    try {
        const res = await fetch(`/api/akademik/jadwal?bagian_id=${encodeURIComponent(bagianId)}`);
        const all = (await res.json()) || [];
        const hari = NAMA_HARI[new Date(tgl + 'T00:00:00').getDay()];
        const slots = all
            .filter(j => j.hari === hari)
            .sort((a, b) => String(a.jam_mulai || '').localeCompare(String(b.jam_mulai || '')));
        if (slots.length === 0) {
            filterPertemuan.innerHTML = `<option value="">Tidak ada jadwal pada hari ${hari}</option>`;
            filterPertemuan.disabled = true;
            return;
        }
        filterPertemuan.innerHTML = '';
        slots.forEach((j, i) => {
            const pertemuan = i + 1;
            const opt = document.createElement('option');
            opt.value = JSON.stringify({ jadwal_id: j.id, mapel_id: j.mapel_id, pertemuan });
            opt.textContent = `Pertemuan ${pertemuan} · ${j.nama_mapel || 'Mapel'} (${j.jam_mulai || ''})`;
            filterPertemuan.appendChild(opt);
        });
        filterPertemuan.disabled = false;
    } catch (e) {
        filterPertemuan.innerHTML = '<option value="">Gagal memuat jadwal</option>';
        filterPertemuan.disabled = true;
    }
}
const tableContainer = document.getElementById('table-container');
const emptyState = document.getElementById('empty-state');
const tableBody = document.getElementById('table-body');
const btnSaveBulk = document.getElementById('btn-save-bulk');

let currentSantriList = [];
let currentUser = null; // { role, pengajar_id }

// Apply Theme
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

function isMobile() {
  return window.innerWidth < 768;
}

// Returns true only when the ISO string 'YYYY-MM-DD' denotes a real calendar
// date (e.g. 2024-02-30 is rejected because February has at most 29 days).
function isValidCalendarDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    if (m < 1 || m > 12) return false;
    // Day 0 of the following month rolls back to the last day of month `m`,
    // which accounts for leap years automatically.
    const lastDay = new Date(y, m, 0).getDate();
    return d >= 1 && d <= lastDay;
}

// Parses the absensi deep-link query string (e.g. window.location.search).
// Valid only when `bagian` is present and numeric, and `tanggal` matches
// /^\d{4}-\d{2}-\d{2}$/ AND is a real calendar date.
// Returns { valid: boolean, bagian: string|null, tanggal: string|null }.
function parseAbsensiQuery(search) {
    const invalid = { valid: false, bagian: null, tanggal: null };
    if (typeof search !== 'string') return invalid;

    // Accept a raw query, a leading-'?' query, or a full URL with a query.
    const qIndex = search.indexOf('?');
    const query = qIndex >= 0 ? search.slice(qIndex + 1) : search;
    const params = new URLSearchParams(query);

    const bagian = params.get('bagian');
    const tanggal = params.get('tanggal');

    if (bagian === null || !/^\d+$/.test(bagian)) return invalid;
    if (tanggal === null || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return invalid;
    if (!isValidCalendarDate(tanggal)) return invalid;

    return { valid: true, bagian, tanggal };
}

// 1. Check Auth & Load Filters
async function init() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login.html';
      return;
    }
    currentUser = await response.json();
    
    // Set default date to today reliably using YYYY-MM-DD format
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    filterTanggal.value = `${yyyy}-${mm}-${dd}`;

    // Wait for filters (allBagian/allTingkatan) to be populated before running
    // the deep-link logic, since selectBagian relies on allBagian.
    await loadFilters();

    // Deep-link handling (Req 5.6, 5.7). If the URL carries a valid
    // ?bagian=&tanggal= query, drive the selection automatically without any
    // extra user interaction; otherwise leave the form in its initial state and
    // show a "bagian belum dipilih" message.
    const parsed = parseAbsensiQuery(window.location.search);
    if (parsed.valid) {
      filterTanggal.value = parsed.tanggal;
      selectBagian(parsed.bagian);
    } else if (!noAssignedClass) {
      // Don't clobber the "Anda belum ditugaskan ke kelas manapun" notice that
      // loadFilters shows for teachers without any assigned class.
      showBagianBelumDipilih();
    }
  } catch (err) {
    console.error("Auth check failed:", err);
  }
}

let allBagian = [];
let allTingkatan = [];
// Set true by loadFilters when a non-pimpinan user has no assigned class, so the
// deep-link handler avoids overwriting that dedicated empty-state message.
let noAssignedClass = false;

// Shows the "bagian belum dipilih" initial-state message in the empty-state
// panel, leaving the form untouched (Req 5.7).
function showBagianBelumDipilih() {
    if (!emptyState) return;
    emptyState.innerHTML = `
        <svg class="w-16 h-16 mb-4 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
        <p>Bagian belum dipilih. Silakan pilih Kelas, Bagian, dan Tanggal terlebih dahulu.</p>
    `;
    emptyState.classList.remove('hidden');
}

async function loadFilters() {
    try {
        const fetches = [
            fetch('/api/akademik/tingkatan')
        ];
        
        // Pimpinan gets all bagian, guru gets only their assigned bagian
        if (currentUser.role === 'pimpinan') {
            fetches.push(fetch('/api/akademik/bagian'));
        } else {
            fetches.push(fetch('/api/akademik/bagian-saya'));
        }
        
        const [resTingkatan, resBagian] = await Promise.all(fetches);
        
        // Load tingkatan for Kelas dropdown
        if (resTingkatan.ok) {
            allTingkatan = await resTingkatan.json();
        }
        
        // Load bagian
        if (resBagian.ok) {
            allBagian = await resBagian.json();
        }
        
        // If guru only has bagian in certain tingkatan, filter the kelas dropdown
        if (currentUser.role !== 'pimpinan') {
            if (allBagian && allBagian.length > 0) {
                const tingkatanIds = new Set(allBagian.map(b => b.tingkatan_id));
                const filteredTingkatan = (allTingkatan || []).filter(t => tingkatanIds.has(t.id));
                
                filterKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
                filteredTingkatan.forEach(t => {
                    filterKelas.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
                });
                
                // Auto-select if only one tingkatan
                if (filteredTingkatan.length === 1) {
                    filterKelas.value = filteredTingkatan[0].id;
                    // We can disable it if there's only one choice
                    filterKelas.disabled = true;
                    filterKelas.dispatchEvent(new Event('change'));
                }
            } else {
                // Guru doesn't have any class assigned
                noAssignedClass = true;
                filterKelas.innerHTML = '<option value="">-- Tidak Ada Jadwal --</option>';
                filterKelas.disabled = true;
                filterBagian.disabled = true;
                filterTanggal.disabled = true;
                
                // Show message on screen
                const emptyState = document.getElementById('empty-state');
                if (emptyState) {
                    emptyState.innerHTML = `
                        <div class="text-red-500 mb-2">
                            <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>
                        <p class="text-lg font-medium text-gray-700 dark:text-gray-300">Anda belum ditugaskan ke kelas manapun.</p>
                        <p class="text-sm mt-1">Silakan hubungi admin (Pimpinan/Mufatish) untuk mengatur jadwal pelajaran atau penugasan Anda.</p>
                    `;
                }
            }
        } else {
            // Pimpinan gets all classes
            filterKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
            if (allTingkatan) {
                allTingkatan.forEach(t => {
                    filterKelas.innerHTML += `<option value="${t.id}">${t.nama}</option>`;
                });
            }
        }
        

        // Initialize bagian dropdown if not handled by auto-select
        if (!filterKelas.value) {
            filterBagian.innerHTML = '<option value="">-- Pilih Kelas Dulu --</option>';
            filterBagian.disabled = true;
        }

        // Render today's schedule shortcuts for teachers so they can jump
        // straight to the class they need to take attendance for.
        if (currentUser.role !== 'pimpinan') {
            loadJadwalHariIni();
        }

        // Auto-fetch if everything is selected (useful for Mustahiq/Munawwib with 1 class)
        setTimeout(() => {
            if (filterKelas.value && filterBagian.value && filterTanggal.value) {
                btnLoad.click();
            }
        }, 300);
    } catch (err) {
        console.error(err);
    }
}

// Selects a bagian in the cascading filters and loads its attendance form.
// Used by the "Jadwal Hari Ini" quick-select chips.
function selectBagian(bagianId) {
    const bagian = (allBagian || []).find(b => b.id == bagianId);
    if (!bagian) return;

    filterKelas.disabled = false;
    filterKelas.value = bagian.tingkatan_id;
    filterKelas.dispatchEvent(new Event('change'));

    filterBagian.disabled = false;
    filterBagian.value = bagianId;

    if (filterTanggal.value) {
        updateInfoKuartal();
    }
    // Muat daftar pertemuan (mapel/jam) untuk bagian+tanggal terpilih.
    loadPertemuanSlots();
}

// Fetches the logged-in teacher's schedule for today and renders quick-select
// chips. Falls back silently if the teacher has no classes scheduled today.
async function loadJadwalHariIni() {
    const container = document.getElementById('jadwal-hari-ini');
    if (!container) return;

    try {
        const res = await fetch('/api/akademik/jadwal-saya-hari-ini');
        if (!res.ok) return;

        const data = await res.json();
        const jadwal = (data && data.jadwal) || [];
        if (jadwal.length === 0) {
            container.classList.add('hidden');
            // No schedule today: keep the manual filter dropdowns visible so the
            // teacher can still pick a class by hand.
            return;
        }


        const chips = jadwal.map(j => {
            const label = `${j.nama_mapel} — ${j.nama_bagian}${j.kelas ? ' (' + j.kelas + ')' : ''}`;
            const jam = j.jam_mulai ? `<span class="text-[10px] opacity-70">${j.jam_mulai}</span>` : '';
            return `<button type="button" data-bagian="${j.bagian_id}"
                        class="jadwal-chip flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-primary/10 text-primary dark:bg-accent-emerald/20 dark:text-accent-emerald hover:bg-primary/20 dark:hover:bg-accent-emerald/30 transition-colors">
                        ${jam}<span class="font-medium">${label}</span>
                    </button>`;
        }).join('');

        container.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <i class="fas fa-calendar-day"></i> Jadwal Anda Hari ${data.hari} — klik untuk mengisi absensi
                </p>
                <button type="button" id="toggle-manual-filter" class="text-xs text-primary dark:text-accent-emerald hover:underline">
                    Pilih kelas manual
                </button>
            </div>
            <div class="flex flex-wrap gap-2">${chips}</div>
        `;
        container.classList.remove('hidden');

        // Teacher has a schedule today, so collapse the manual filter dropdowns
        // and let the quick-select chips drive the flow. The toggle reveals the
        // dropdowns again for anyone who needs to pick a different class.
        const filterSection = document.getElementById('filter-section');
        if (filterSection) {
            filterSection.classList.add('hidden');
            const toggleBtn = container.querySelector('#toggle-manual-filter');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    const isHidden = filterSection.classList.toggle('hidden');
                    toggleBtn.textContent = isHidden ? 'Pilih kelas manual' : 'Sembunyikan filter';
                });
            }
        }

        container.querySelectorAll('.jadwal-chip').forEach(btn => {
            btn.addEventListener('click', () => selectBagian(btn.dataset.bagian));
        });
    } catch (err) {
        console.error('Gagal memuat jadwal hari ini:', err);
    }
}


// Cascade: Kelas → Bagian
filterKelas.addEventListener('change', () => {
    const kelasId = filterKelas.value;
    if (!kelasId) {
        filterBagian.innerHTML = '<option value="">-- Pilih Kelas Dulu --</option>';
        filterBagian.disabled = true;
        return;
    }
    
    const filtered = (allBagian || []).filter(b => b.tingkatan_id == kelasId);
    filterBagian.innerHTML = '<option value="">-- Pilih Bagian --</option>';
    filtered.forEach(b => {
        filterBagian.innerHTML += `<option value="${b.id}">Bagian ${b.nama_bagian} (${b.kelas || ''})</option>`;
    });
    filterBagian.disabled = false;
    
    // Auto-select if only one bagian
    if (filtered.length === 1) {
        filterBagian.value = filtered[0].id;
        filterBagian.disabled = true;
    }
});

// Update info kuartal
async function updateInfoKuartal() {
    const tgl = filterTanggal.value;
    const infoContainer = document.getElementById('info-kuartal');
    const infoText = document.getElementById('info-kuartal-text');
    
    if (!tgl) {
        infoContainer.classList.add('hidden');
        return;
    }
    
    try {
        // We don't pass tahun_ajaran, so the API uses the active year automatically
        const res = await fetch(`/api/kalender?tahun_ajaran=`);
        if (!res.ok) return;
        
        const kalender = await res.json();
        const selectedDate = new Date(tgl);
        
        let found = null;
        if (kalender && kalender.length > 0) {
            for (const k of kalender) {
                const start = new Date(k.tgl_mulai);
                const end = new Date(k.tgl_selesai);
                if (selectedDate >= start && selectedDate <= end) {
                    found = k;
                    break;
                }
            }
        }
        
        if (found) {
            const smt = found.kuartal <= 2 ? '1' : '2';
            const tipe = (found.kuartal % 2 !== 0) ? 'Tamrin' : 'Ujian';
            infoText.innerHTML = `<strong>Kuartal ${found.kuartal}</strong> — ${tipe} Smt ${smt} (Aktif untuk tanggal yang dipilih)`;
            infoContainer.classList.remove('hidden');
        } else {
            infoText.innerHTML = `Tanggal yang dipilih berada <strong>di luar rentang</strong> kalender kuartal ${ta}.`;
            infoContainer.classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
    }
}

filterTanggal.addEventListener('change', updateInfoKuartal);
filterTanggal.addEventListener('change', loadPertemuanSlots);
filterBagian.addEventListener('change', loadPertemuanSlots);

// 2. Load Santri based on filter
btnLoad.addEventListener('click', async () => {
    const bagianId = filterBagian.value;
    const tanggal = filterTanggal.value;

    if (!bagianId || !tanggal) {
        alert("Pilih Kelas, Bagian, dan Tanggal terlebih dahulu!");
        return;
    }

    // Pastikan daftar pertemuan termuat.
    if (filterPertemuan && (filterPertemuan.disabled || !filterPertemuan.value)) {
        await loadPertemuanSlots();
    }

    btnLoad.textContent = 'Memuat...';
    btnLoad.disabled = true;

    try {
        // Fetch students scoped directly to the selected bagian. This works for
        // subject teachers whose class only appears via jadwal (not their role
        // assignment), which the general /api/santri endpoint would exclude.
        const res = await fetch(`/api/santri/by-bagian/${encodeURIComponent(bagianId)}`);
        currentSantriList = (await res.json()) || [];

        if (currentSantriList.length === 0) {

            emptyState.innerHTML = '<p class="text-red-500">Tidak ada santri ditemukan di kelas ini.</p>';
            emptyState.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            btnSaveBulk.classList.add('hidden');
            return;
        }

        renderTable(currentSantriList);
        
        emptyState.classList.add('hidden');
        tableContainer.classList.remove('hidden');
        btnSaveBulk.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        emptyState.innerHTML = '<p class="text-red-500">Gagal memuat data.</p>';
    } finally {
        btnLoad.textContent = 'Tampilkan Form';
        btnLoad.disabled = false;
    }
});

// 3. Render Table rows — responsive
function renderTable(santriArray) {
    tableBody.innerHTML = '';
    const mobile = isMobile();
    
    santriArray.forEach((s, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors group';
        row.setAttribute('data-santri-id', s.id);
        
        if (mobile) {
            // MOBILE: Compact row with letter buttons
            row.innerHTML = `
                <td class="px-3 py-3 text-center text-xs text-gray-400">${index + 1}</td>
                <td class="px-3 py-3">
                    <div class="font-semibold text-gray-800 dark:text-gray-200 text-sm">${s.nama}</div>
                    <div class="text-[10px] text-gray-400 font-mono">${s.stambuk}</div>
                </td>
                <td class="px-2 py-3">
                    <div class="flex gap-1" data-santri="${s.id}">
                        <button type="button" data-status="Hadir" class="status-btn w-8 h-8 rounded-lg text-xs font-bold transition-all active" title="Hadir">H</button>
                        <button type="button" data-status="Izin" class="status-btn w-8 h-8 rounded-lg text-xs font-bold transition-all" title="Izin">I</button>
                        <button type="button" data-status="Sakit" class="status-btn w-8 h-8 rounded-lg text-xs font-bold transition-all" title="Sakit">S</button>
                        <button type="button" data-status="Alpha" class="status-btn w-8 h-8 rounded-lg text-xs font-bold transition-all" title="Alpha">A</button>
                    </div>
                </td>
            `;
            
            // Add expandable keterangan row
            const ketRow = document.createElement('tr');
            ketRow.className = 'ket-row hidden bg-gray-50/30 dark:bg-slate-800/30';
            ketRow.setAttribute('data-ket-for', s.id);
            ketRow.innerHTML = `
                <td colspan="3" class="px-3 pb-3 pt-1">
                    <input type="text" data-keterangan="${s.id}" class="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="Keterangan...">
                </td>
            `;
            
            tableBody.appendChild(row);
            tableBody.appendChild(ketRow);
            
            // Bind mobile button clicks
            const btns = row.querySelectorAll('.status-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remove active from siblings
                    btns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Show/hide keterangan row
                    if (btn.dataset.status !== 'Hadir') {
                        ketRow.classList.remove('hidden');
                    } else {
                        ketRow.classList.add('hidden');
                        const ketInput = ketRow.querySelector(`input[data-keterangan="${s.id}"]`);
                        if (ketInput) ketInput.value = '';
                    }
                });
            });
        } else {
            // DESKTOP: Full table with select dropdown
            row.innerHTML = `
                <td class="px-6 py-4 text-center font-medium">${index + 1}</td>
                <td class="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">${s.stambuk}</td>
                <td class="px-6 py-4 font-semibold text-gray-800 dark:text-gray-200">${s.nama}</td>
                <td class="px-6 py-4">
                    <select data-santri="${s.id}" class="status-select w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all">
                        <option value="Hadir" selected>Hadir</option>
                        <option value="Izin">Izin (Bi Idzni)</option>
                        <option value="Sakit">Sakit (Bi Idzni)</option>
                        <option value="Alpha">Alpha (Bi Ghoirihi)</option>
                    </select>
                </td>
                <td class="px-6 py-4">
                    <input type="text" data-keterangan="${s.id}" class="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="Keterangan opsional...">
                </td>
            `;
            tableBody.appendChild(row);
        }
    });
}

// 4. Save Bulk Data
btnSaveBulk.addEventListener('click', async () => {
    const tanggal = filterTanggal.value;
    const bagianId = filterBagian.value;

    // Slot/pertemuan (mapel/jam) wajib dipilih agar sesi tercatat per-slot.
    if (!filterPertemuan || !filterPertemuan.value) {
        alert('Pilih Pertemuan (mapel/jam) terlebih dahulu!');
        return;
    }
    let slot = null;
    try { slot = JSON.parse(filterPertemuan.value); } catch (_) { slot = null; }
    if (!slot || !slot.pertemuan) {
        alert('Pertemuan tidak valid. Pilih ulang.');
        return;
    }

    const STATUS_MAP = { Izin: 'izin', Sakit: 'sakit', Alpha: 'alpha' };
    const data = [];
    const mobile = isMobile();

    if (mobile) {
        const activeBtns = tableBody.querySelectorAll('.status-btn.active');
        const seen = new Set();
        activeBtns.forEach(btn => {
            const container = btn.closest('[data-santri]');
            const santriId = parseInt(container.dataset.santri);
            if (seen.has(santriId)) return;
            seen.add(santriId);
            const status = STATUS_MAP[btn.dataset.status];
            if (!status) return; // Hadir dilewati
            const ketInput = tableBody.querySelector(`input[data-keterangan="${santriId}"]`);
            data.push({ santri_id: santriId, status, keterangan: ketInput ? ketInput.value : '' });
        });
    } else {
        tableBody.querySelectorAll('.status-select').forEach(sel => {
            const santriId = parseInt(sel.getAttribute('data-santri'));
            const status = STATUS_MAP[sel.value];
            if (!status) return; // Hadir dilewati
            const ketInput = tableBody.querySelector(`input[data-keterangan="${santriId}"]`);
            data.push({ santri_id: santriId, status, keterangan: ketInput ? ketInput.value : '' });
        });
    }

    // Submit SELALU dikirim walau semua hadir → sesi tercatat (bukti ustadz masuk).
    const payload = {
        tahun_ajaran: "",
        bagian_id: parseInt(bagianId),
        jadwal_id: slot.jadwal_id || null,
        mapel_id: slot.mapel_id || null,
        pertemuan: slot.pertemuan,
        tanggal: tanggal,
        data: data
    };

    btnSaveBulk.textContent = 'Menyimpan...';
    btnSaveBulk.disabled = true;

    try {
        const response = await fetch('/api/absensi/input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (!response.ok) throw new Error(result.message || result.error || 'Gagal menyimpan absensi');

        alert('Berhasil menyimpan absensi untuk tanggal ' + tanggal + '!');
        
    } catch (err) {
        alert(err.message);
    } finally {
        btnSaveBulk.textContent = 'Simpan Absensi';
        btnSaveBulk.disabled = false;
    }
});

// Run
init();

// ES module exports for tests (jsdom/Vitest) and any module consumers.
// Pages load this file with <script type="module">, so named exports do not
// break plain-page usage; browser behavior still relies on the DOM wiring above.
export { parseAbsensiQuery };
