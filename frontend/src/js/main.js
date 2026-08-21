// frontend/src/js/main.js

// Reuse the canonical HTML escaper from xss.js so user-provided text rendered by
// the dashboard render layer is escaped consistently with the rest of the app.
import { escapeHTML, computeAllowedLinks } from './xss.js';

// Decode entitas HTML yang sudah dihasilkan sanitizer global xss.js (& < > ' ")
// SEBELUM render meng-escape ulang, agar tidak terjadi escape ganda (mis. tampil
// "I&#39;dadiyyah"). Membalik escapeHTML; &amp; didekode terakhir. Murni (tanpa DOM).
function decodeEntities(str) {
  return String(str == null ? '' : str)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Apply dark mode if preference exists
if (localStorage.theme === 'dark') {
  document.documentElement.classList.add('dark');
}

const themeToggle = document.getElementById('theme-toggle-main');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
}

// ==================== FUNGSI MURNI: RESOLUSI PERAN & NORMALISASI METRIK ====================
// Diekspor untuk pengujian (Vitest + fast-check + jsdom) tanpa efek samping.

// Peran_Admin (akses statistik & grafik): pimpinan, admin, mufatish, tim_rapot, keamanan.
const ADMIN_DASHBOARD_ROLES = ['pimpinan', 'admin', 'mufatish', 'tim_rapot', 'keamanan'];
// Peran_Guru (pengajar): mustahiq, muroqib.
const GURU_DASHBOARD_ROLES = ['mustahiq', 'muroqib'];

// Resolusi peran → tampilan dashboard.
//   Peran_Admin  → 'admin'
//   Peran_Guru   → 'guru'
//   selain itu   → 'unknown'
// (Requirements 4.1, 4.2, 4.5, 7.6)
function resolveDashboardView(roles) {
  if (Array.isArray(roles)) {
    if (roles.some(r => ADMIN_DASHBOARD_ROLES.includes(r))) return 'admin';
    if (roles.some(r => GURU_DASHBOARD_ROLES.includes(r))) return 'guru';
    return 'unknown';
  }
  if (ADMIN_DASHBOARD_ROLES.includes(roles)) return 'admin';
  if (GURU_DASHBOARD_ROLES.includes(roles)) return 'guru';
  return 'unknown';
}

// Normalisasi nilai metrik menjadi bilangan bulat non-negatif untuk ditampilkan.
// Nilai bukan-angka, negatif, NaN, Infinity, null, atau undefined → 0.
// Nilai pecahan dibulatkan ke bawah menjadi bilangan bulat.
// (Requirements 2.5, 2.6, 7.1, 7.4, 7.5)
function toDisplayCount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  // Normalisasi negative zero (-0) menjadi positive zero (+0): Math.floor(-0)
  // menghasilkan -0, yang gagal pada perbandingan Object.is/toBe(0). Kembalikan
  // +0 agar nilai metrik selalu bilangan bulat non-negatif yang kanonik.
  const n = Math.floor(value);
  return n === 0 ? 0 : n;
}

// ==================== FUNGSI MURNI: STATISTIK & GRAFIK ====================
// Diekspor untuk pengujian (Vitest + fast-check + jsdom) tanpa efek samping.

// Label untuk santri dengan field pengelompokan yang kosong/null/undefined.
const UNKNOWN_GROUP_LABEL = 'Tidak Diketahui';

// Kelompokkan daftar santri berdasarkan field tertentu.
// Field yang kosong/null/undefined/bukan-string → "Tidak Diketahui".
// Setiap santri terhitung tepat satu kali sehingga jumlah seluruh count
// sama dengan jumlah santri pada daftar (konservasi total).
// Urutan kelompok mengikuti kemunculan pertama key pada daftar.
// return: Array<{ key: string, count: number }>
function groupByField(santriList, field) {
  const list = Array.isArray(santriList) ? santriList : [];
  const counts = new Map();
  for (const santri of list) {
    const raw = santri == null ? undefined : santri[field];
    let key;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      key = trimmed === '' ? UNKNOWN_GROUP_LABEL : trimmed;
    } else if (raw == null) {
      key = UNKNOWN_GROUP_LABEL;
    } else {
      // Nilai non-string non-null (mis. angka) tetap dinormalisasi ke string.
      key = String(raw);
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts, ([key, count]) => ({ key, count }));
}

// Kelompokkan santri per tingkatan (field `tingkatan_nama`).
// field kosong/null → "Tidak Diketahui"; setiap santri terhitung sekali.
// return: Array<{ key: string, count: number }>
// (Requirements 7.2, 7.8)
function groupByTingkatan(santriList) {
  return groupByField(santriList, 'tingkatan_nama');
}

// Kelompokkan santri per status (field `status`).
// field kosong/null → "Tidak Diketahui"; setiap santri terhitung sekali.
// return: Array<{ key: string, count: number }>
// (Requirements 7.3, 7.8)
function groupByStatus(santriList) {
  return groupByField(santriList, 'status');
}

// Hitung segmen donut proporsional dari daftar kelompok status.
// Setiap segmen: fraction = count / total; startAngle/endAngle dalam derajat
// (0..360) proporsional dan bersambung sehingga segmen terakhir berakhir di 360.
// total 0 (atau daftar kosong) → [] (empty state, Req 2.11).
// return: Array<{ key, count, fraction, startAngle, endAngle }>
// (Requirements 2.10, 2.11)
function computeDonutSegments(groups) {
  const list = Array.isArray(groups) ? groups : [];
  const total = list.reduce((sum, g) => sum + (g && Number.isFinite(g.count) ? g.count : 0), 0);
  if (total <= 0) return [];
  const segments = [];
  let cursor = 0;
  for (const g of list) {
    const count = g && Number.isFinite(g.count) ? g.count : 0;
    const fraction = count / total;
    const startAngle = cursor;
    cursor += fraction * 360;
    segments.push({
      key: g && g.key != null ? g.key : UNKNOWN_GROUP_LABEL,
      count,
      fraction,
      startAngle,
      endAngle: cursor,
    });
  }
  // Pastikan segmen terakhir berakhir tepat di 360 (koreksi galat floating point).
  if (segments.length > 0) segments[segments.length - 1].endAngle = 360;
  return segments;
}

// ==================== FUNGSI MURNI: KALENDER, JADWAL & DEEP-LINK ====================
// Diekspor untuk pengujian (Vitest + fast-check + jsdom) tanpa efek samping.
// Seluruh fungsi murni: tidak mengubah argumen dan tidak menyentuh DOM/jaringan.

// Format Date → 'YYYY-MM-DD' pada zona waktu lokal (bukan UTC), sehingga
// tanggal yang tampil konsisten dengan tanggal kalender lokal pengguna.
// Argumen non-Date atau tanggal tidak valid → null.
function toISODateLocal(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Jumlah hari pada strip minggu.
const WEEK_STRIP_LENGTH = 7;

// Bangun strip minggu berisi tepat tujuh hari berurutan menaik (berselisih satu
// hari) yang dimulai dari `today`, sehingga selalu mengandung tanggal hari ini.
// Tepat satu sel bertanda `isToday=true` (yaitu hari pertama = today).
// Tidak mengubah argumen `today`.
// return: Array<{ date: Date, isToday: boolean }> panjang 7
// (Requirements 6.3)
function buildWeekStrip(today) {
  const base = today instanceof Date && !Number.isNaN(today.getTime())
    ? today
    : new Date();
  const todayIso = toISODateLocal(base);
  const strip = [];
  for (let i = 0; i < WEEK_STRIP_LENGTH; i++) {
    // Konstruksi tanggal baru per iterasi agar `base` tidak termutasi dan
    // pergeseran bulan/tahun ditangani otomatis oleh konstruktor Date.
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    strip.push({ date, isToday: toISODateLocal(date) === todayIso });
  }
  return strip;
}

// Normalisasi sumber Jadwal_Hari_Ini menjadi array entri jadwal.
// Menerima array langsung atau objek `{ hari, jadwal: [...] }` dari backend.
function normalizeJadwalList(jadwalHariIni) {
  if (Array.isArray(jadwalHariIni)) return jadwalHariIni;
  if (jadwalHariIni && Array.isArray(jadwalHariIni.jadwal)) return jadwalHariIni.jadwal;
  return [];
}

// Bangun indeks agenda per tanggal (kunci 'YYYY-MM-DD') dari data kuartal dan
// Jadwal_Hari_Ini SAJA. Setiap agenda bertipe:
//   'kuartal-mulai'   → tanggal = kuartal.tgl_mulai
//   'kuartal-selesai' → tanggal = kuartal.tgl_selesai
//   'jadwal'          → tanggal = hari ini (today)
// Tanggal setiap agenda berasal hanya dari data sumber tersebut (Property 15).
// return: Map<string, Array<{ tanggal, tipe, label }>>
// (Requirements 6.1, 6.4, 6.5)
function buildAgendaIndex(kuartalList, jadwalHariIni, today, agendaList) {
  const index = new Map();

  const push = (tanggal, tipe, label) => {
    if (!tanggal) return;
    if (!index.has(tanggal)) index.set(tanggal, []);
    index.get(tanggal).push({ tanggal, tipe, label });
  };

  // Agenda dari data kuartal (tgl_mulai / tgl_selesai).
  const kuartals = Array.isArray(kuartalList) ? kuartalList : [];
  for (const k of kuartals) {
    if (!k) continue;
    const ta = k.tahun_ajaran != null ? String(k.tahun_ajaran) : '';
    const kuartalLabel = k.kuartal != null ? String(k.kuartal) : '';
    const suffix = [kuartalLabel && `Kuartal ${kuartalLabel}`, ta].filter(Boolean).join(' ');
    if (k.tgl_mulai) {
      push(String(k.tgl_mulai), 'kuartal-mulai', `Mulai ${suffix}`.trim());
    }
    if (k.tgl_selesai) {
      push(String(k.tgl_selesai), 'kuartal-selesai', `Selesai ${suffix}`.trim());
    }
  }

  // Agenda dari Jadwal_Hari_Ini → seluruhnya jatuh pada tanggal hari ini.
  const todayIso = toISODateLocal(today instanceof Date ? today : new Date());
  if (todayIso) {
    for (const j of normalizeJadwalList(jadwalHariIni)) {
      if (!j) continue;
      const parts = [j.jam_mulai, j.nama_mapel, j.nama_bagian].filter(Boolean).map(String);
      const label = parts.length > 0 ? parts.join(' • ') : 'Jadwal mengajar';
      push(todayIso, 'jadwal', label);
    }
  }

  // Agenda bebas (acara manual) → tipe 'acara' pada setiap tanggal yang dicakup
  // acara ([tgl_mulai .. tgl_selesai]). Tanggal berasal HANYA dari data agenda.
  for (const a of (Array.isArray(agendaList) ? agendaList : [])) {
    if (!a || !a.tgl_mulai) continue;
    const startIso = String(a.tgl_mulai);
    const endIso = a.tgl_selesai ? String(a.tgl_selesai) : startIso;
    const label = a.judul != null ? String(a.judul) : 'Agenda';
    for (const iso of eachDateISO(startIso, endIso)) {
      push(iso, 'acara', label);
    }
  }

  return index;
}

// Hasilkan daftar string tanggal 'YYYY-MM-DD' dari startIso hingga endIso
// (inklusif) pada zona waktu lokal. Bila rentang tak valid/terbalik, kembalikan
// hanya tanggal awal (bila dapat diurai). `cap` membatasi ekspansi agar rentang
// ekstrem tidak membuat daftar sangat besar.
function eachDateISO(startIso, endIso, cap = 400) {
  const out = [];
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return out;
  if (Number.isNaN(end.getTime()) || end < start) {
    out.push(toISODateLocal(start));
    return out;
  }
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < cap) {
    out.push(toISODateLocal(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    guard++;
  }
  return out;
}

// Saring & urutkan agenda "mendatang": acara yang masih berlangsung atau akan
// datang (COALESCE(tgl_selesai, tgl_mulai) >= hari ini) dan dimulai dalam
// `days` hari ke depan. Diurutkan menaik berdasarkan tgl_mulai lalu judul.
// Fungsi murni: tidak mengubah argumen, tidak menyentuh DOM/jaringan.
// return: Array<agenda> terurut.
function filterUpcomingAgenda(agendaList, today, days) {
  const list = Array.isArray(agendaList) ? agendaList : [];
  const base = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const horizonDays = Number.isFinite(days) ? days : 30;
  const todayIso = toISODateLocal(base);
  const horizon = new Date(base.getFullYear(), base.getMonth(), base.getDate() + horizonDays);
  const horizonIso = toISODateLocal(horizon);

  const res = list.filter((a) => {
    if (!a || !a.tgl_mulai) return false;
    const startIso = String(a.tgl_mulai);
    const endIso = a.tgl_selesai ? String(a.tgl_selesai) : startIso;
    // Perbandingan leksikografis setara kronologis untuk format YYYY-MM-DD.
    return endIso >= todayIso && startIso <= horizonIso;
  });
  res.sort((a, b) => {
    const sa = String(a.tgl_mulai), sb = String(b.tgl_mulai);
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    const ja = a.judul != null ? String(a.judul) : '';
    const jb = b.judul != null ? String(b.judul) : '';
    return ja < jb ? -1 : ja > jb ? 1 : 0;
  });
  return res;
}

// Format label rentang tanggal agenda untuk ditampilkan (mis. "2025-01-15" atau
// "2025-01-15 – 2025-01-18" bila multi-hari).
function formatAgendaRange(a) {
  const start = a && a.tgl_mulai != null ? String(a.tgl_mulai) : '';
  const end = a && a.tgl_selesai ? String(a.tgl_selesai) : '';
  return end && end !== start ? `${start} – ${end}` : start;
}

// Urutkan daftar jadwal menaik berdasarkan `jam_mulai` (format 'HH:MM',
// sehingga perbandingan leksikografis setara dengan perbandingan waktu).
// Non-mutating: mengembalikan array baru; hasil adalah permutasi masukan
// (multiset yang sama), sehingga jumlah entri dipertahankan.
// Pengurutan stabil menjaga urutan relatif entri dengan `jam_mulai` sama.
// (Requirements 5.3)
function sortJadwal(jadwalList) {
  const list = Array.isArray(jadwalList) ? jadwalList.slice() : [];
  return list.sort((a, b) => {
    const ja = a && a.jam_mulai != null ? String(a.jam_mulai) : '';
    const jb = b && b.jam_mulai != null ? String(b.jam_mulai) : '';
    if (ja < jb) return -1;
    if (ja > jb) return 1;
    return 0;
  });
}

// Bangun URL deep-link ke halaman Input Absensi untuk bagian & tanggal tertentu.
// Format: `absensi.html?bagian=<bagian_id>&tanggal=<YYYY-MM-DD>`.
// `today` boleh berupa Date (dikonversi via toISODateLocal) atau string
// 'YYYY-MM-DD' yang sudah jadi. Hasil round-trip valid dengan parseAbsensiQuery
// di absensi.js (bagian numerik, tanggal format kalender valid).
// (Requirements 5.5)
function buildAbsensiDeepLink(bagianId, today) {
  const tanggal = today instanceof Date ? toISODateLocal(today) : String(today);
  return `absensi.html?bagian=${bagianId}&tanggal=${tanggal}`;
}

// ==================== LAPISAN RENDER: HERO, METRIK, RINGKASAN PONSEL ====================
// Fungsi render menghasilkan markup (string HTML) dari data yang sudah dinormalisasi.
// Diekspor untuk pengujian berbasis properti. Seluruh teks yang berasal dari
// pengguna di-escape via escapeHTML (xss.js). Nilai numerik dinormalisasi via
// toDisplayCount menjadi bilangan bulat non-negatif.

// Teks salam tetap pada Header_Hero.
const HERO_GREETING = "Assalamu'alaikum";
// Placeholder saat nama pengguna tidak tersedia (Req 2.3).
const HERO_NAME_PLACEHOLDER = 'Pengguna';
// Placeholder saat peran tidak tersedia (Req 2.3).
const HERO_ROLE_PLACEHOLDER = '—';
// Placeholder untuk elemen tanggal/waktu/hijriah sebelum jam hidup mengisinya.
const HERO_TIME_PLACEHOLDER = '—';

// Format label peran untuk badge: huruf besar dan garis bawah → spasi
// (mis. "wali_santri" → "WALI SANTRI"). Peran kosong/null → string kosong.
function formatRoleLabel(role) {
  if (role == null) return '';
  const str = String(role).trim();
  if (str === '') return '';
  return str.toUpperCase().replace(/_/g, ' ');
}

// Render Header_Hero (Req 2.1, 2.3). Menghasilkan markup yang SELALU memuat:
//   - teks salam,
//   - nama pengguna ter-escape, atau placeholder saat kosong/null,
//   - badge peran ter-escape, atau placeholder saat kosong/null,
//   - elemen tanggal (#hero-date), waktu (#hero-time), dan hijriah (#hero-hijri).
// Tidak pernah melempar error untuk nama/peran apa pun (termasuk kosong/null).
// `opts.date`/`opts.time`/`opts.hijri` opsional; bila tidak diberikan, elemen
// tetap dirender dengan placeholder agar jam hidup (startHeroClock) mengisinya.
// return: string HTML (inner content untuk #dash-hero).
// (Requirements 2.1, 2.3)
function renderHero(nama, role, opts) {
  const options = opts || {};

  const rawName = nama == null ? '' : String(nama).trim();
  const displayName = rawName === '' ? HERO_NAME_PLACEHOLDER : escapeHTML(rawName);

  const roleLabel = formatRoleLabel(role);
  const displayRole = roleLabel === '' ? HERO_ROLE_PLACEHOLDER : escapeHTML(roleLabel);

  const heroDate = options.date != null && String(options.date) !== ''
    ? escapeHTML(String(options.date)) : HERO_TIME_PLACEHOLDER;
  const heroTime = options.time != null && String(options.time) !== ''
    ? escapeHTML(String(options.time)) : HERO_TIME_PLACEHOLDER;
  const heroHijri = options.hijri != null && String(options.hijri) !== ''
    ? escapeHTML(String(options.hijri)) : HERO_TIME_PLACEHOLDER;

  return `
    <div class="absolute top-0 right-0 -mt-20 -mr-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-0 left-0 -mb-16 -ml-16 w-52 h-52 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
    <div class="relative z-10">
      <div class="flex justify-between items-start gap-4">
        <div class="min-w-0">
          <p id="greeting-text" class="text-white/80 text-sm md:text-base font-medium mb-1 tracking-wide break-words">${HERO_GREETING} 👋</p>
          <h2 id="user-greeting" class="text-2xl md:text-4xl font-extrabold tracking-tight break-words">${displayName}</h2>
          <span id="user-role-badge" class="inline-flex items-center mt-3 px-3.5 py-1.5 bg-white/15 backdrop-blur-md border border-white/20 rounded-full text-xs font-bold tracking-widest shadow-sm">${displayRole}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <div id="user-avatar" class="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-md flex items-center justify-center text-xl md:text-2xl font-extrabold shadow-lg shrink-0">${escapeHTML(getInitials(rawName))}</div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 md:gap-3 mt-6">
        <div class="bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl px-3 py-2.5">
          <p class="text-[9px] md:text-[10px] font-bold tracking-widest text-white/70 uppercase mb-0.5">Tanggal</p>
          <p id="hero-date" class="text-xs md:text-sm font-bold leading-tight break-words">${heroDate}</p>
        </div>
        <div class="bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl px-3 py-2.5">
          <p class="text-[9px] md:text-[10px] font-bold tracking-widest text-white/70 uppercase mb-0.5">Waktu</p>
          <p id="hero-time" class="text-xs md:text-sm font-bold leading-tight tabular-nums">${heroTime}</p>
        </div>
        <div class="bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl px-3 py-2.5">
          <p class="text-[9px] md:text-[10px] font-bold tracking-widest text-white/70 uppercase mb-0.5">Hijriyah</p>
          <p id="hero-hijri" class="text-xs md:text-sm font-bold leading-tight break-words">${heroHijri}</p>
        </div>
      </div>
    </div>`;
}

// Definisi tetap keempat kartu Widget_Statistik (Req 2.4, 2.5).
// Urutan tetap; kartu "Santri Pengabdian" selalu disertakan. Setiap definisi
// memetakan beberapa kemungkinan nama field pada objek statistik ke satu nilai.
const METRIC_CARDS = [
  { key: 'santri', label: 'Total Santri', fields: ['total_santri', 'santri'], accent: 'bg-primary', badge: 'users' },
  { key: 'pengabdian', label: 'Santri Pengabdian', fields: ['pengabdian', 'santri_pengabdian', 'total_pengabdian'], accent: 'bg-accent-gold', badge: 'heart-handshake' },
  { key: 'bagian', label: 'Total Bagian', fields: ['total_bagian', 'bagian'], accent: 'bg-emerald-500', badge: 'layout-grid' },
  { key: 'alumni', label: 'Total Alumni', fields: ['total_alumni', 'alumni'], accent: 'bg-amber-500', badge: 'graduation-cap' },
];

// Ambil nilai metrik pertama yang tersedia dari daftar nama field.
function pickMetricValue(stats, fields) {
  for (const f of fields) {
    if (stats && Object.prototype.hasOwnProperty.call(stats, f)) return stats[f];
  }
  return undefined;
}

// Render Widget_Statistik (Req 2.4, 2.5). SELALU menghasilkan tepat empat kartu.
// Setiap kartu memuat:
//   - garis aksen ([data-accent]),
//   - sebuah badge ([data-badge]),
//   - sebuah nilai metrik numerik ([data-metric-value], bilangan bulat non-negatif).
// Kartu "Santri Pengabdian" selalu termasuk. Nilai dinormalisasi via toDisplayCount.
// return: string HTML (empat kartu, untuk #dash-metrics).
// (Requirements 2.4, 2.5)
function renderMetrics(stats) {
  const s = stats && typeof stats === 'object' ? stats : {};
  return METRIC_CARDS.map((card) => {
    const value = toDisplayCount(pickMetricValue(s, card.fields));
    return `
    <div data-metric-card="${card.key}" class="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-5 border border-gray-100 dark:border-slate-700/60 shadow-sm">
      <div data-accent class="absolute top-0 left-0 h-full w-1 ${card.accent}"></div>
      <div class="flex items-center justify-between mb-2 md:mb-3">
        <span data-badge class="inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-xl bg-primary/10 text-primary">
          <i data-lucide="${card.badge}" class="w-4 h-4 md:w-5 md:h-5"></i>
        </span>
      </div>
      <div data-metric-value class="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums">${value}</div>
      <div class="text-[11px] md:text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5 md:mt-1">${escapeHTML(card.label)}</div>
    </div>`;
  }).join('');
}

// Definisi tetap ketiga blok ringkasan ponsel, berurutan Santri → Khidmah → Alumni.
const MOBILE_SUMMARY_BLOCKS = [
  { key: 'santri', label: 'Santri', fields: ['santri', 'total_santri'] },
  { key: 'khidmah', label: 'Khidmah', fields: ['khidmah', 'pengabdian', 'santri_pengabdian'] },
  { key: 'alumni', label: 'Alumni', fields: ['alumni', 'total_alumni'] },
];

// Render kartu ringkasan ponsel yang menumpang tepi bawah hero (Req 3.2).
// SELALU menghasilkan tepat tiga blok dengan urutan Santri → Khidmah → Alumni.
// Setiap blok memuat labelnya ([data-summary-label]) dan nilai ringkasan
// numeriknya ([data-summary-value], bilangan bulat non-negatif via toDisplayCount).
// return: string HTML (untuk #dash-mobile-summary).
// (Requirements 3.2)
function renderMobileSummary(summary) {
  const s = summary && typeof summary === 'object' ? summary : {};
  const blocks = MOBILE_SUMMARY_BLOCKS.map((block) => {
    const value = toDisplayCount(pickMetricValue(s, block.fields));
    return `
      <div data-summary-block="${block.key}" class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700/60 last:border-b-0">
        <span data-summary-label class="text-sm font-medium text-gray-500 dark:text-gray-400">${block.label}</span>
        <span data-summary-value class="text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">${value}</span>
      </div>`;
  }).join('');
  return `
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 shadow-lg overflow-hidden">
      ${blocks}
    </div>`;
}

// ==================== LAPISAN RENDER: GRAFIK, RINGKASAN, JADWAL, KALENDER ====================
// Fungsi render menghasilkan markup (string HTML) tanpa menyentuh jaringan, sehingga
// dapat diimpor & diuji berbasis properti. Grafik dirender CSS murni (linear-gradient
// untuk bar, conic-gradient untuk donut) tanpa pustaka chart pihak ketiga (Req 2.9).
// Seluruh teks yang berasal dari data di-escape via escapeHTML (xss.js).

// Markup Empty_State ramah untuk widget tanpa data.
function emptyStateMarkup(message) {
  return `<div data-empty-state class="text-center text-sm text-gray-400 dark:text-gray-500 py-8">${escapeHTML(String(message))}</div>`;
}

// Deteksi apakah masukan sudah berupa daftar kelompok {key, count} (hasil
// groupBy*) atau masih berupa daftar santri mentah yang perlu dikelompokkan.
function looksLikeGroups(list) {
  return list.length > 0 && list.every(
    (item) => item && typeof item === 'object' && 'key' in item && typeof item.count === 'number'
  );
}

// Normalisasi masukan Grafik_Tingkatan menjadi Array<{ key, count }>.
function toTingkatanGroups(input) {
  const list = Array.isArray(input) ? input : [];
  return looksLikeGroups(list) ? list : groupByTingkatan(list);
}

// Normalisasi masukan Grafik_Status menjadi Array<{ key, count }>.
function toStatusGroups(input) {
  const list = Array.isArray(input) ? input : [];
  return looksLikeGroups(list) ? list : groupByStatus(list);
}

// Render Grafik_Tingkatan: bar chart CSS murni (lebar %-relatif ke kelompok
// terbesar) memakai utility `.hero-gradient` (linear-gradient token). Menerima
// daftar kelompok {key, count} maupun daftar santri mentah. total 0 → Empty_State.
// return: string HTML (untuk #chart-tingkatan).
// (Requirements 2.7, 2.9)
function renderTingkatanChart(input) {
  const groups = toTingkatanGroups(input);
  const total = groups.reduce((sum, g) => sum + (g && Number.isFinite(g.count) ? g.count : 0), 0);
  if (total <= 0) {
    return emptyStateMarkup('Belum ada data distribusi tingkatan.');
  }
  const max = groups.reduce((m, g) => Math.max(m, g && Number.isFinite(g.count) ? g.count : 0), 0) || 1;
  const bars = groups.map((g) => {
    const count = toDisplayCount(g && g.count);
    const pct = Math.max(2, Math.round((count / max) * 100)); // minimal 2% agar bar tetap terlihat
    const label = escapeHTML(String(g && g.key != null ? g.key : UNKNOWN_GROUP_LABEL));
    return `
      <div data-tingkatan-bar class="space-y-1">
        <div class="flex items-center justify-between text-xs">
          <span data-bar-label class="font-medium text-gray-600 dark:text-gray-300 truncate pr-2">${label}</span>
          <span data-bar-value class="font-semibold text-gray-900 dark:text-white tabular-nums shrink-0">${count}</span>
        </div>
        <div class="h-2.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div class="h-full rounded-full hero-gradient" style="width: ${pct}%"></div>
        </div>
      </div>`;
  }).join('');
  return `<div data-chart="tingkatan" class="space-y-3">${bars}</div>`;
}

// Palet warna segmen Grafik_Status. Warna spesifik untuk status yang dikenal,
// selebihnya memakai daftar putar (cycle). Tidak memakai warna primary/hero
// yang dilarang di-hardcode pada HTML (Property 1 hanya memindai berkas HTML).
const STATUS_SEGMENT_COLORS = {
  aktif: '#14B8A6',
  pengabdian: '#E0A93B',
  'boyong-keluar': '#F97316',
  boyong: '#F97316',
  keluar: '#EF4444',
  alumni: '#8B5CF6',
  [UNKNOWN_GROUP_LABEL.toLowerCase()]: '#94A3B8',
};
const STATUS_FALLBACK_PALETTE = ['#14B8A6', '#E0A93B', '#F97316', '#8B5CF6', '#0EA5E9', '#94A3B8'];

// Tentukan warna segmen berdasarkan key status; fallback ke daftar putar per indeks.
function statusSegmentColor(key, index) {
  const k = String(key == null ? '' : key).toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(STATUS_SEGMENT_COLORS, k)) {
    return STATUS_SEGMENT_COLORS[k];
  }
  return STATUS_FALLBACK_PALETTE[index % STATUS_FALLBACK_PALETTE.length];
}

// Render Grafik_Status: donut chart CSS murni via conic-gradient, memakai segmen
// proporsional dari computeDonutSegments. Menerima daftar kelompok {key, count}
// maupun daftar santri mentah. total 0 → Empty_State tanpa segmen (Req 2.11).
// return: string HTML (untuk #chart-status).
// (Requirements 2.10, 2.11)
function renderStatusChart(input) {
  const groups = toStatusGroups(input);
  const segments = computeDonutSegments(groups);
  if (segments.length === 0) {
    return emptyStateMarkup('Belum ada data komposisi status santri.');
  }
  const stops = segments.map((seg, i) => {
    const color = statusSegmentColor(seg.key, i);
    return `${color} ${seg.startAngle}deg ${seg.endAngle}deg`;
  }).join(', ');
  const legend = segments.map((seg, i) => {
    const color = statusSegmentColor(seg.key, i);
    return `
      <div data-status-legend class="flex items-center gap-2 text-xs">
        <span class="w-3 h-3 rounded-full shrink-0" style="background:${color}"></span>
        <span class="text-gray-600 dark:text-gray-300 truncate">${escapeHTML(String(seg.key))}</span>
        <span class="ml-auto font-semibold text-gray-900 dark:text-white tabular-nums">${toDisplayCount(seg.count)}</span>
      </div>`;
  }).join('');
  return `
    <div data-chart="status" class="flex flex-col sm:flex-row items-center gap-6">
      <div class="relative w-40 h-40 shrink-0">
        <div class="w-full h-full rounded-full" style="background: conic-gradient(${stops})"></div>
        <div class="absolute inset-[22%] rounded-full bg-white dark:bg-slate-800"></div>
      </div>
      <div class="flex-1 w-full space-y-2">${legend}</div>
    </div>`;
}

// Render "Ringkasan Pengajar": jumlah pengajar sebagai bilangan bulat non-negatif
// (via toDisplayCount). return: string HTML (untuk #ringkasan-pengajar).
// (Requirements 7.5)
function renderRingkasanPengajar(count) {
  const value = toDisplayCount(count);
  return `
    <div data-ringkasan="pengajar" class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/60 shadow-sm">
      <div class="flex items-center gap-4">
        <span class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary shrink-0">
          <i data-lucide="users" class="w-5 h-5"></i>
        </span>
        <div class="min-w-0">
          <div data-pengajar-value class="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">${value}</div>
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400">Total Pengajar</div>
        </div>
      </div>
    </div>`;
}

// Render satu Kartu_Jadwal untuk widget Jadwal_Hari_Ini. Markup SELALU memuat
// nilai `jam_mulai`, `jam_selesai`, `nama_mapel`, `nama_bagian`, `tingkatan`, dan
// `kelas` (seluruhnya ter-escape). Kartu menautkan ke Deep_Link_Absensi via
// buildAbsensiDeepLink (Req 5.5). `today` opsional (Date/string); default hari ini.
// return: string HTML (satu kartu).
// (Requirements 5.4)
function renderJadwalCard(entry, today) {
  const j = entry && typeof entry === 'object' ? entry : {};
  const esc = (v) => escapeHTML(v == null ? '' : String(v));
  const jamMulai = esc(j.jam_mulai);
  const jamSelesai = esc(j.jam_selesai);
  const namaMapel = esc(j.nama_mapel);
  const namaBagian = esc(j.nama_bagian);
  const tingkatan = esc(j.tingkatan);
  const kelas = esc(j.kelas);
  const base = today instanceof Date ? today : (typeof today === 'string' ? today : new Date());
  const href = escapeHTML(buildAbsensiDeepLink(j.bagian_id, base));
  return `
    <a data-jadwal-card href="${href}" class="block bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm font-bold text-primary tabular-nums">
          <span data-jam-mulai>${jamMulai}</span>
          <span class="text-gray-300 dark:text-slate-600">–</span>
          <span data-jam-selesai>${jamSelesai}</span>
        </div>
        <span data-tingkatan class="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">${tingkatan}</span>
      </div>
      <div data-nama-mapel class="mt-2 font-bold text-gray-900 dark:text-white">${namaMapel}</div>
      <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        <span data-nama-bagian>${namaBagian}</span>
        <span class="mx-1">•</span>
        <span data-kelas>Kelas ${kelas}</span>
      </div>
    </a>`;
}

// Label singkat hari (indeks getDay() 0=Minggu).
const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Render widget Kalender_Agenda: strip minggu 7 hari (buildWeekStrip) dengan sel
// hari ini di-highlight; titik penanda HANYA pada tanggal beragenda (Req 6.4);
// daftar baris HANYA untuk tanggal beragenda (Req 6.5); pesan bila tak ada agenda
// pada rentang tersebut (Req 6.6). Sumber agenda hanya kuartal + Jadwal_Hari_Ini
// via buildAgendaIndex (Req 6.1). return: string HTML (untuk #widget-kalender).
// (Requirements 6.3, 6.4, 6.5, 6.6)
function renderKalenderAgenda(kuartalList, jadwalHariIni, today, agendaList) {
  const base = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const strip = buildWeekStrip(base);
  const agendaIndex = buildAgendaIndex(kuartalList, jadwalHariIni, base, agendaList);

  const cells = strip.map((day) => {
    const iso = toISODateLocal(day.date);
    const items = agendaIndex.get(iso);
    const hasAgenda = Array.isArray(items) && items.length > 0;
    const dow = WEEKDAY_SHORT[day.date.getDay()] || '';
    const dayNum = day.date.getDate();
    const cellCls = day.isToday
      ? 'hero-gradient text-white shadow'
      : 'bg-gray-50 dark:bg-slate-700/40 text-gray-700 dark:text-gray-200';
    const dot = hasAgenda
      ? '<span data-agenda-dot class="block w-1.5 h-1.5 rounded-full bg-accent-gold mx-auto mt-1"></span>'
      : '<span class="block w-1.5 h-1.5 mx-auto mt-1"></span>';
    return `
      <div data-week-cell${day.isToday ? ' data-today' : ''} class="flex-1 text-center rounded-xl py-2 ${cellCls}">
        <div class="text-[10px] font-semibold uppercase tracking-wide opacity-80">${escapeHTML(dow)}</div>
        <div class="text-sm font-bold tabular-nums">${dayNum}</div>
        ${dot}
      </div>`;
  }).join('');

  const rows = [];
  for (const day of strip) {
    const iso = toISODateLocal(day.date);
    const items = agendaIndex.get(iso);
    if (!Array.isArray(items) || items.length === 0) continue;
    const itemHtml = items.map((a) => `
        <div class="flex items-start gap-2 text-xs">
          <span class="mt-1 w-1.5 h-1.5 rounded-full bg-accent-gold shrink-0"></span>
          <span class="text-gray-600 dark:text-gray-300">${escapeHTML(String(a && a.label != null ? a.label : ''))}</span>
        </div>`).join('');
    rows.push(`
      <div data-agenda-row class="py-2 border-b border-gray-100 dark:border-slate-700/60 last:border-b-0">
        <div class="text-xs font-bold text-gray-800 dark:text-gray-100 mb-1">${escapeHTML(iso)}</div>
        ${itemHtml}
      </div>`);
  }

  const agendaSection = rows.length > 0
    ? `<div data-agenda-list class="mt-4 space-y-1">${rows.join('')}</div>`
    : '<div data-agenda-empty class="mt-4 text-center text-xs text-gray-400 dark:text-gray-500 py-4">Tidak ada agenda pada periode ini.</div>';

  // Bagian "Agenda Mendatang": acara bebas dalam 30 hari ke depan (Req: list
  // agenda mendatang). Hanya dirender bila ada acara mendatang.
  const upcoming = filterUpcomingAgenda(agendaList, base, 30);
  const upcomingSection = upcoming.length > 0
    ? `<div data-agenda-upcoming class="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/60">
        <h4 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Agenda Mendatang</h4>
        ${upcoming.map((a) => `
        <div data-upcoming-item class="flex items-start gap-2 text-xs py-1">
          <span class="mt-1 w-1.5 h-1.5 rounded-full bg-accent-gold shrink-0"></span>
          <div class="min-w-0">
            <div class="font-semibold text-gray-800 dark:text-gray-100 truncate">${escapeHTML(String(a && a.judul != null ? a.judul : 'Agenda'))}</div>
            <div class="text-gray-400">${escapeHTML(formatAgendaRange(a))}</div>
          </div>
        </div>`).join('')}
      </div>`
    : '';

  return `
    <div data-widget="kalender" class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/60 shadow-sm">
      <div class="flex gap-1.5">${cells}</div>
      ${agendaSection}
      ${upcomingSection}
    </div>`;
}

// Render Kalender_Agenda dalam mode DEGRADASI (Req 6.2): saat sumber data gagal /
// timeout, widget tetap menampilkan strip minggu 7 hari (tanpa titik penanda dan
// tanpa daftar agenda) disertai pesan kegagalan + tombol "Muat ulang".
// return: string HTML (untuk #widget-kalender).
function renderKalenderDegraded(today, message) {
  const base = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const strip = buildWeekStrip(base);
  const cells = strip.map((day) => {
    const dow = WEEKDAY_SHORT[day.date.getDay()] || '';
    const dayNum = day.date.getDate();
    const cellCls = day.isToday
      ? 'hero-gradient text-white shadow'
      : 'bg-gray-50 dark:bg-slate-700/40 text-gray-700 dark:text-gray-200';
    // Tidak ada titik penanda dalam mode degradasi (Req 6.2).
    return `
      <div data-week-cell${day.isToday ? ' data-today' : ''} class="flex-1 text-center rounded-xl py-2 ${cellCls}">
        <div class="text-[10px] font-semibold uppercase tracking-wide opacity-80">${escapeHTML(dow)}</div>
        <div class="text-sm font-bold tabular-nums">${dayNum}</div>
        <span class="block w-1.5 h-1.5 mx-auto mt-1"></span>
      </div>`;
  }).join('');
  const msg = escapeHTML(String(message || 'Gagal memuat agenda.'));
  return `
    <div data-widget="kalender" data-degraded class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/60 shadow-sm">
      <div class="flex gap-1.5">${cells}</div>
      <div data-kalender-error class="mt-4 text-center text-xs text-red-500 dark:text-red-400 py-3">
        <p class="mb-2">${msg}</p>
        <button data-retry type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition-colors">
          <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i> Muat ulang
        </button>
      </div>
    </div>`;
}

// ==================== LAPISAN ORKESTRASI: JARINGAN & STATUS ====================
// Fungsi `load*` memanggil endpoint yang SUDAH ADA dengan timeout (AbortController),
// menangani status loading/empty/error per widget, lalu memanggil lapisan render.
// Kegagalan tiap widget diisolasi dalam blok try/catch sehingga kegagalan satu
// widget tidak menjatuhkan widget lain (Req 7.7). Diekspor untuk interaction test
// (jsdom) sekaligus dipakai oleh wiring role-aware (task 9.1).

// Batas waktu tampil: 5 detik untuk Jadwal_Hari_Ini (Req 5.1); 10 detik untuk
// statistik/santri/pengabdian/pengajar dan sumber Kalender_Agenda (Req 6.2, 7.7).
const JADWAL_TIMEOUT_MS = 5000;
const DEFAULT_TIMEOUT_MS = 10000;

// `fetch` dengan timeout berbasis AbortController. Bila permintaan melampaui `ms`
// milidetik, controller dibatalkan (abort) sehingga fetch menolak (reject); timer
// SELALU dibersihkan via clearTimeout pada blok finally agar tidak bocor. Error
// (jaringan/abort/timeout) dilempar ke pemanggil untuk ditangani sebagai status
// error + aksi "Muat ulang". `ms` non-positif difallback ke DEFAULT_TIMEOUT_MS.
// (Requirements 5.1, 6.2, 7.7)
async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timeout = typeof ms === 'number' && ms > 0 ? ms : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Resolusi elemen target: gunakan elemen yang diberikan, atau cari via id pada
// document. Mengembalikan null bila tidak ada (mis. bukan halaman dashboard),
// sehingga fungsi load* aman dipanggil tanpa merusak halaman lain.
function resolveWidgetTarget(target, id) {
  if (target) return target;
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

// Aktifkan ikon lucide bila tersedia (no-op di jsdom/test).
function refreshIcons() {
  if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Markup indikator loading (Req 5.2). Ditampilkan selama permintaan berjalan.
function loadingMarkup(message) {
  return `
    <div data-loading class="flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500 py-8">
      <span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
      <span>${escapeHTML(String(message || 'Memuat...'))}</span>
    </div>`;
}

// Markup pesan kesalahan + tombol "Muat ulang" (Req 5.9, 7.7).
function errorMarkup(message) {
  return `
    <div data-error class="text-center py-6">
      <p class="text-sm text-red-500 dark:text-red-400 mb-3">${escapeHTML(String(message || 'Gagal memuat data.'))}</p>
      <button data-retry type="button" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors">
        <i data-lucide="rotate-cw" class="w-4 h-4"></i> Muat ulang
      </button>
    </div>`;
}

// Tampilkan status error pada `target` dan pasang handler tombol "Muat ulang"
// yang memanggil `retry` (biasanya fungsi load* itu sendiri) untuk mencoba lagi.
function showWidgetError(target, message, retry) {
  if (!target) return;
  target.innerHTML = errorMarkup(message);
  const btn = target.querySelector('[data-retry]');
  if (btn && typeof retry === 'function') {
    btn.addEventListener('click', () => { retry(); });
  }
  refreshIcons();
}

// State metrik bersama untuk Widget_Statistik. `loadStats` (santri/bagian/alumni)
// dan `loadPengabdian` (pengabdian) menulis ke state ini secara independen lalu
// me-render ulang #dash-metrics, sehingga kedua sumber dapat dimuat terpisah dan
// kartu "Santri Pengabdian" tetap terisi tanpa saling menimpa.
const metricsState = {};

// Render ulang Widget_Statistik dari metricsState ke elemen target.
function renderMetricsInto(target) {
  const el = resolveWidgetTarget(target, 'dash-metrics');
  if (!el) return;
  el.innerHTML = renderMetrics(metricsState);
  refreshIcons();
}

// Muat metrik pondok (total_santri, total_bagian, total_alumni, input_nilai) dari
// Endpoint_Statistik dan render Widget_Statistik. Loading → fetch (10 dtk) →
// render; gagal/timeout → error + "Muat ulang" (Req 7.1, 7.7). Nilai dinormalisasi
// via toDisplayCount pada lapisan render. (Requirements 7.1, 7.7)
async function loadStats(target) {
  const el = resolveWidgetTarget(target, 'dash-metrics');
  if (!el) return;
  el.innerHTML = loadingMarkup('Memuat statistik...');
  try {
    const res = await fetchWithTimeout('/api/dashboard/stats', DEFAULT_TIMEOUT_MS);
    if (!res.ok) throw new Error('Statistik gagal dimuat');
    const stats = (await res.json()) || {};
    Object.assign(metricsState, {
      total_santri: stats.total_santri,
      total_bagian: stats.total_bagian,
      total_alumni: stats.total_alumni,
      input_nilai: stats.input_nilai,
    });
    renderMetricsInto(el);
  } catch (err) {
    showWidgetError(el, 'Statistik gagal dimuat.', () => loadStats(el));
  }
}

// Muat jumlah "Santri Pengabdian" dari `/api/pengabdian` (array) dan perbarui
// kartu metrik terkait. Kegagalan diisolasi: bila #dash-metrics sudah berisi
// kartu, hanya nilai pengabdian yang diperbarui (0 saat gagal) tanpa menjatuhkan
// kartu lain (Req 7.4, 7.7). Bila belum ada kartu, state disimpan untuk render
// berikutnya. (Requirements 7.4, 7.7)
async function loadPengabdian(target) {
  const el = resolveWidgetTarget(target, 'dash-metrics');
  try {
    const res = await fetchWithTimeout('/api/pengabdian', DEFAULT_TIMEOUT_MS);
    if (!res.ok) throw new Error('Pengabdian gagal dimuat');
    const data = await res.json();
    metricsState.pengabdian = Array.isArray(data) ? data.length : toDisplayCount(data && data.total);
  } catch (err) {
    // Isolasi kegagalan: tampilkan 0 pada kartu pengabdian, biarkan kartu lain.
    metricsState.pengabdian = 0;
  }
  // Hanya render ulang bila kartu statistik sudah ada (mis. loadStats sukses),
  // agar tidak menimpa indikator loading/error milik loadStats.
  if (el && el.querySelector('[data-metric-card]')) {
    renderMetricsInto(el);
  }
}

// Widget Kesehatan Data Penilaian (khusus pimpinan/admin). Memanggil
// /api/data-health: jika ada anomali (nilai kelas lama nyasar, santri aktif
// belum punya Al-Bayan, absensi manual belum ter-mapping semester, nilai
// kuartal dobel lintas kelas), tampilkan banner peringatan. Jika bersih,
// widget tidak menampilkan apa pun (silent watchdog).
async function loadDataHealth(target) {
  const el = resolveWidgetTarget(target, 'dash-data-health');
  if (!el) return;
  try {
    const res = await fetchWithTimeout('/api/data-health', DEFAULT_TIMEOUT_MS);
    if (!res.ok) { el.innerHTML = ''; return; }
    const report = (await res.json()) || {};
    if (!report.ada_masalah) {
      el.innerHTML = `<div class="mb-2 px-1 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
        Kesehatan data penilaian TA ${escapeHTML(report.tahun_ajaran || '')}: tidak ada anomali</div>`;
      return;
    }
    const cards = (report.issues || []).map((it) => {
      const isBahaya = it.level === 'bahaya';
      const border = isBahaya ? 'border-red-300 dark:border-red-800' : 'border-amber-300 dark:border-amber-800';
      const badgeBg = isBahaya ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      const icon = isBahaya ? 'alert-triangle' : 'info';
      const nama = (it.nama && it.nama.length) ? `<div class="mt-1 text-gray-600 dark:text-gray-300">Santri: ${it.nama.map(escapeHTML).join(', ')}${it.jumlah > it.nama.length ? ` (+${it.jumlah - it.nama.length} lainnya)` : ''}</div>` : '';
      return `<div class="border ${border} rounded-xl p-3 mb-3 bg-white dark:bg-slate-800">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeBg}">${isBahaya ? 'BUTUH TINDAKAN' : 'PERHATIAN'}</span>
          <span class="font-semibold text-sm text-gray-800 dark:text-gray-200">${escapeHTML(it.judul)} (${escapeHTML(String(it.jumlah))})</span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${escapeHTML(it.deskripsi)}</p>
        ${nama}
      </div>`;
    }).join('');
    el.innerHTML = `<div class="mt-4 mb-2 px-1 flex items-center gap-2">
      <h3 class="text-sm font-bold text-red-700 dark:text-red-400">⚠️ Kesehatan Data Penilaian (TA ${escapeHTML(report.tahun_ajaran || '')})</h3>
    </div>${cards}`;
    refreshIcons();
  } catch (err) {
    el.innerHTML = '';
  }
}

// Muat jumlah pengajar dari `/api/pengajar` (array) dan render "Ringkasan Pengajar".
// Loading → fetch (10 dtk) → render; gagal/timeout → error + "Muat ulang"
// (Req 7.5, 7.7). (Requirements 7.5, 7.7)
async function loadPengajar(target) {
  const el = resolveWidgetTarget(target, 'ringkasan-pengajar');
  if (!el) return;
  el.innerHTML = loadingMarkup('Memuat data pengajar...');
  try {
    const res = await fetchWithTimeout('/api/pengajar', DEFAULT_TIMEOUT_MS);
    if (!res.ok) throw new Error('Pengajar gagal dimuat');
    const data = await res.json();
    const count = Array.isArray(data) ? data.length : toDisplayCount(data && data.total);
    el.innerHTML = renderRingkasanPengajar(count);
    refreshIcons();
  } catch (err) {
    showWidgetError(el, 'Ringkasan pengajar gagal dimuat.', () => loadPengajar(el));
  }
}

// Muat daftar santri dari `/api/santri` sekali, lalu render Grafik_Tingkatan dan
// Grafik_Status (dihitung di sisi klien via groupBy*). Kedua grafik berbagi satu
// permintaan; loading pada masing-masing kontainer, gagal/timeout → error +
// "Muat ulang" pada kedua kontainer (Req 7.2, 7.3, 7.7). Target opsional:
// `{ tingkatan, status }` elemen, jika tidak diberikan diambil via id.
// (Requirements 7.2, 7.3, 7.7, 7.8)
async function loadSantriCharts(targets) {
  const t = targets || {};
  const elTingkatan = resolveWidgetTarget(t.tingkatan, 'chart-tingkatan');
  const elStatus = resolveWidgetTarget(t.status, 'chart-status');
  if (!elTingkatan && !elStatus) return;
  if (elTingkatan) elTingkatan.innerHTML = loadingMarkup('Memuat distribusi tingkatan...');
  if (elStatus) elStatus.innerHTML = loadingMarkup('Memuat komposisi status...');
  try {
    const res = await fetchWithTimeout('/api/santri', DEFAULT_TIMEOUT_MS);
    if (!res.ok) throw new Error('Data santri gagal dimuat');
    const santri = (await res.json()) || [];
    // Data API sudah di-escape global oleh xss.js. Decode field string di batas ini
    // agar label chart (mis. tingkatan "I'dadiyyah") tidak ter-escape ganda saat
    // render meng-escape ulang. Render tetap murni (escape-only).
    const list = (Array.isArray(santri) ? santri : []).map((s) => {
      if (!s || typeof s !== 'object') return s;
      const o = {};
      for (const k in s) { o[k] = typeof s[k] === 'string' ? decodeEntities(s[k]) : s[k]; }
      return o;
    });
    if (elTingkatan) elTingkatan.innerHTML = renderTingkatanChart(list);
    if (elStatus) elStatus.innerHTML = renderStatusChart(list);
    refreshIcons();
  } catch (err) {
    if (elTingkatan) showWidgetError(elTingkatan, 'Distribusi tingkatan gagal dimuat.', () => loadSantriCharts({ tingkatan: elTingkatan, status: elStatus }));
    if (elStatus) showWidgetError(elStatus, 'Komposisi status gagal dimuat.', () => loadSantriCharts({ tingkatan: elTingkatan, status: elStatus }));
  }
}

// Muat widget Jadwal_Hari_Ini dari `GET /api/akademik/jadwal-saya-hari-ini`
// (batas 5 detik, Req 5.1). Loading (Req 5.2) → sukses: urutkan menaik jam_mulai
// (sortJadwal) & render tiap Kartu_Jadwal (Req 5.3, 5.4); `jadwal[]` kosong →
// Empty_State (Req 5.8); gagal/timeout → error + "Muat ulang" (Req 5.9).
// (Requirements 5.1, 5.2, 5.3, 5.4, 5.8, 5.9)
async function loadJadwalHariIni(target, today) {
  const el = resolveWidgetTarget(target, 'dash-jadwal');
  if (!el) return;
  const base = today instanceof Date ? today : new Date();
  el.innerHTML = loadingMarkup('Memuat jadwal hari ini...');
  try {
    const res = await fetchWithTimeout('/api/akademik/jadwal-saya-hari-ini', JADWAL_TIMEOUT_MS);
    if (!res.ok) throw new Error('Jadwal gagal dimuat');
    const data = (await res.json()) || {};
    const jadwal = Array.isArray(data) ? data : (Array.isArray(data.jadwal) ? data.jadwal : []);
    if (jadwal.length === 0) {
      el.innerHTML = `
        <div data-widget="jadwal" class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/60 shadow-sm">
          ${emptyStateMarkup('Tidak ada jadwal mengajar hari ini.')}
        </div>`;
      return;
    }
    // Data API sudah di-escape global oleh xss.js. Decode field string di batas ini
    // agar nilai seperti tingkatan "I'dadiyyah" tidak ter-escape ganda (tampil
    // "I&#39;dadiyyah") saat renderJadwalCard meng-escape ulang.
    const decoded = jadwal.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const o = {};
      for (const k in entry) { o[k] = typeof entry[k] === 'string' ? decodeEntities(entry[k]) : entry[k]; }
      return o;
    });
    const sorted = sortJadwal(decoded);
    const cards = sorted.map((entry) => renderJadwalCard(entry, base)).join('');
    el.innerHTML = `
      <div data-widget="jadwal" class="space-y-3">
        <h3 class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Jadwal Hari Ini</h3>
        ${cards}
      </div>`;
    refreshIcons();
  } catch (err) {
    showWidgetError(el, 'Jadwal hari ini gagal dimuat.', () => loadJadwalHariIni(el, base));
  }
}

// Muat widget Kalender_Agenda dari `/api/kalender`, `/api/kalender/tahun`, dan
// sumber Jadwal_Hari_Ini (batas 10 detik, Req 6.2). Sukses → render strip minggu
// + titik penanda + daftar agenda (Req 6.3–6.6). Bila salah satu sumber gagal /
// timeout → DEGRADASI: strip minggu tanpa titik & tanpa daftar + pesan gagal +
// "Muat ulang" (Req 6.2). (Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6)
async function loadKalenderAgenda(target, today) {
  const el = resolveWidgetTarget(target, 'widget-kalender');
  if (!el) return;
  const base = today instanceof Date ? today : new Date();
  el.innerHTML = loadingMarkup('Memuat kalender & agenda...');

  const fetchJson = async (url, ms) => {
    const res = await fetchWithTimeout(url, ms);
    if (!res.ok) throw new Error(`${url} gagal dimuat`);
    return res.json();
  };

  try {
    // Sumber kuartal WAJIB berhasil (Req 6.1); kegagalannya → degradasi (Req 6.2).
    // Sumber Jadwal_Hari_Ini bersifat BEST-EFFORT: endpoint jadwal hanya untuk
    // Peran_Guru dan dapat mengembalikan non-200 bagi Peran_Admin. Agar admin
    // tetap melihat kalender penuh (bukan degradasi total), kegagalan jadwal
    // ditelan dan diperlakukan sebagai "tidak ada jadwal" tanpa menjatuhkan
    // strip minggu/agenda kuartal.
    const jadwalBestEffort = fetchJson('/api/akademik/jadwal-saya-hari-ini', DEFAULT_TIMEOUT_MS)
      .catch(() => []);
    // Agenda bebas bersifat best-effort: kegagalannya tidak menjatuhkan widget
    // (sumber wajib tetap kalender kuartal), cukup tampil tanpa acara.
    const agendaBestEffort = fetchJson('/api/agenda', DEFAULT_TIMEOUT_MS).catch(() => []);
    const [kalender] = await Promise.all([
      fetchJson('/api/kalender', DEFAULT_TIMEOUT_MS),
      fetchJson('/api/kalender/tahun', DEFAULT_TIMEOUT_MS),
    ]);
    const jadwalRaw = await jadwalBestEffort;
    const agendaRaw = await agendaBestEffort;
    const kuartalList = Array.isArray(kalender) ? kalender : [];
    const agendaArr = Array.isArray(agendaRaw) ? agendaRaw : [];
    el.innerHTML = renderKalenderAgenda(kuartalList, jadwalRaw, base, agendaArr);
    refreshIcons();
  } catch (err) {
    // Degradasi anggun: tetap tampilkan strip minggu tanpa titik/daftar (Req 6.2).
    el.innerHTML = renderKalenderDegraded(base, 'Gagal memuat agenda. Strip minggu tetap ditampilkan.');
    const btn = el.querySelector('[data-retry]');
    if (btn) btn.addEventListener('click', () => { loadKalenderAgenda(el, base); });
    refreshIcons();
  }
}

// ==================== MENU LAUNCHER GRID (dashboard) ====================
// Dashboard tidak lagi menampilkan statistik/grafik (keputusan owner 2026-08),
// melainkan grid ikon menu sesuai role masing-masing pengguna — gaya
// home-screen app. Menu yang tampil = MENU_ACCESS role (sama dengan sidebar).
const DASH_MENU = {
  '/santri.html':         { label: 'Santri',          icon: 'users',            grad: 'from-indigo-500 via-blue-500 to-cyan-400',       glow: 'shadow-indigo-500/30' },
  '/penilaian.html':      { label: 'Penilaian',       icon: 'list-checks',      grad: 'from-teal-400 via-emerald-500 to-emerald-600',    glow: 'shadow-emerald-500/30' },
  '/absensi-manual.html': { label: 'Absensi',         icon: 'clipboard-check',  grad: 'from-lime-400 via-green-500 to-emerald-600',      glow: 'shadow-green-500/30' },
  '/rapot.html':          { label: 'Raport',          icon: 'scroll-text',      grad: 'from-amber-400 via-orange-500 to-orange-600',     glow: 'shadow-orange-500/30' },
  '/catatan.html':        { label: 'Pelanggaran',     icon: 'shield-alert',     grad: 'from-red-500 via-rose-500 to-rose-600',           glow: 'shadow-rose-500/30' },
  '/rekap.html':          { label: 'Rekap',           icon: 'bar-chart-3',      grad: 'from-cyan-400 via-sky-500 to-blue-500',           glow: 'shadow-sky-500/30' },
  '/pengajar.html':       { label: 'Pengajar',        icon: 'book-open',        grad: 'from-violet-500 via-purple-500 to-fuchsia-500',   glow: 'shadow-purple-500/30' },
  '/dewan-harian.html':  { label: 'Dewan Harian',    icon: 'crown',            grad: 'from-yellow-400 via-amber-500 to-amber-600',      glow: 'shadow-amber-500/30' },
  '/alumni.html':         { label: 'Alumni',          icon: 'graduation-cap',   grad: 'from-pink-400 via-fuchsia-500 to-purple-500',     glow: 'shadow-fuchsia-500/30' },
  '/arsip.html':          { label: 'Arsip',           icon: 'archive',          grad: 'from-slate-400 via-slate-500 to-slate-600',       glow: 'shadow-slate-500/25' },
  '/pengajar-purna.html': { label: 'Pengajar Purna',  icon: 'history',          grad: 'from-stone-400 via-stone-500 to-stone-600',       glow: 'shadow-stone-500/25' },
  '/kelas.html':          { label: 'Kelas',           icon: 'school',           grad: 'from-sky-400 via-blue-500 to-indigo-500',         glow: 'shadow-blue-500/30' },
  '/perpindahan.html':    { label: 'Perpindahan',     icon: 'arrow-right-left', grad: 'from-lime-400 via-lime-500 to-green-500',         glow: 'shadow-lime-500/30' },
  '/settings.html':       { label: 'Pengaturan',      icon: 'settings-2',       grad: 'from-gray-400 via-gray-500 to-slate-600',         glow: 'shadow-gray-500/25' },
};

// Menu utama = 6 menu inti yang paling sering dipakai (fixed, keputusan owner
// 2026-08). Tetap difilter sesuai MENU_ACCESS role. Jika menu utama yang
// diizinkan < 3, tab disembunyikan dan langsung tampil semua menu.
const MAIN_MENU_LINKS = [
  '/santri.html', '/penilaian.html', '/absensi-manual.html',
  '/rapot.html', '/catatan.html', '/rekap.html',
];

function menuTileHtml(l) {
  const m = DASH_MENU[l];
  return `
    <a href="${l}" class="group flex flex-col items-center gap-2.5 rounded-2xl p-2 pt-3 transition-all active:scale-95 hover:bg-gray-50 dark:hover:bg-slate-700/30">
      <div class="relative flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-gradient-to-br ${m.grad} text-white shadow-lg ${m.glow} ring-1 ring-inset ring-white/25 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105">
        <span class="pointer-events-none absolute inset-x-1 top-0.5 h-[45%] rounded-t-[1rem] bg-gradient-to-b from-white/30 to-transparent"></span>
        <i data-lucide="${m.icon}" class="relative h-7 w-7" style="stroke-width:2.25"></i>
      </div>
      <span class="max-w-[78px] text-center text-[11px] font-semibold leading-tight tracking-tight text-gray-700 dark:text-gray-200">${escapeHTML(m.label)}</span>
    </a>`;
}

function renderMenuGrid(roles, target) {
  const el = target || document.getElementById('dash-menu-grid');
  if (!el) return;
  const allowed = computeAllowedLinks(roles);
  const allLinks = Object.keys(DASH_MENU).filter(l => allowed.includes(l));
  if (allLinks.length === 0) { el.innerHTML = ''; return; }

  const mainLinks = MAIN_MENU_LINKS.filter(l => allLinks.includes(l));
  const useTabs = mainLinks.length >= 3 && mainLinks.length < allLinks.length;

  let currentTab = 'utama';

  function draw() {
    const links = (!useTabs || currentTab === 'utama') ? mainLinks : allLinks;
    const tiles = links.map(menuTileHtml).join('');
    const tabsHtml = useTabs ? `
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-slate-900/60">
          <button id="tab-menu-utama" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentTab === 'utama' ? 'bg-white text-teal-700 shadow dark:bg-slate-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400'}">Menu Utama</button>
          <button id="tab-menu-semua" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentTab === 'semua' ? 'bg-white text-teal-700 shadow dark:bg-slate-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400'}">Semua Menu</button>
        </div>
        <span class="hidden text-[11px] text-gray-400 dark:text-gray-500 md:block">${links.length} menu</span>
      </div>` : '';
    el.innerHTML = `
      <div class="rounded-3xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-800/50 md:p-5">
        ${tabsHtml}
        <div class="grid grid-cols-4 gap-y-5 gap-x-2 sm:grid-cols-5 lg:grid-cols-7">${tiles}</div>
      </div>`;
    if (useTabs) {
      const tU = document.getElementById('tab-menu-utama');
      const tS = document.getElementById('tab-menu-semua');
      if (tU) tU.addEventListener('click', () => { currentTab = 'utama'; draw(); });
      if (tS) tS.addEventListener('click', () => { currentTab = 'semua'; draw(); });
    }
    refreshIcons();
  }

  draw();
}

// ==================== WIRING ROLE-AWARE DASHBOARD ====================
// Berdasarkan peran pengguna (via resolveDashboardView), render region konten
// Dashboard sesuai peran dan orkestrasi widget yang relevan:
//   - admin   : Widget_Statistik + Grafik_Tingkatan + Grafik_Status + Kalender_Agenda
//               dimuat bersamaan pada tampilan awal (Req 4.1). Ringkasan Pengajar
//               juga dimuat sebagai bagian kolom kanan.
//   - guru    : Jadwal_Hari_Ini pada posisi paling atas area konten, TANPA
//               Widget_Statistik/Grafik_Tingkatan/Grafik_Status; Kalender_Agenda
//               tetap ditampilkan (Req 4.2, 4.4). Empty state jadwal ditangani
//               loadJadwalHariIni saat tak ada kelas berjadwal.
//   - unknown : pesan "konten tidak tersedia untuk peran ini", tanpa widget (Req 4.5).
// Aman dipanggil di luar halaman Dashboard: bila anchor tidak ada, keluar lebih awal.
// (Requirements 4.1, 4.2, 4.4, 4.5)
function initRoleAwareDashboard(role) {
  if (typeof document === 'undefined') return;

  const region = document.getElementById('dash-role-region');
  const jadwal = document.getElementById('dash-jadwal');
  const metrics = document.getElementById('dash-metrics');
  const chartsCol = document.getElementById('dash-charts');
  const side = document.getElementById('dash-side');

  // Bukan halaman Dashboard (tidak ada anchor role-aware) → tidak melakukan apa pun.
  if (!region && !jadwal && !metrics && !chartsCol) return;

  const show = (el) => { if (el) el.classList.remove('hidden'); };
  const hide = (el) => { if (el) el.classList.add('hidden'); };

  const roles = Array.isArray(role) ? role : [role];
  const hasAdmin = roles.some(r => ADMIN_DASHBOARD_ROLES.includes(r));
  const hasGuru = roles.some(r => GURU_DASHBOARD_ROLES.includes(r));

  // Dashboard = menu launcher grid (statistik/grafik dihapus total, jadwal
  // guru juga tidak ditampilkan — keputusan owner 2026-08). Widget jadwal,
  // statistik, grafik, dan kolom samping semuanya disembunyikan.
  hide(side);
  hide(metrics);
  hide(chartsCol);
  hide(jadwal);
  renderMenuGrid(roles);

  // Watchdog kesehatan data penilaian tetap ada untuk pimpinan/admin
  // (ini notifikasi, bukan statistik).
  if (hasAdmin && (roles.includes('pimpinan') || roles.includes('admin'))) {
    loadDataHealth();
  }

  if (!hasAdmin && !hasGuru) {
    if (region) {
      region.innerHTML = `
        <div data-role-unavailable class="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-gray-100 dark:border-slate-700/60 shadow-sm text-center">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-700 text-gray-400 mb-4">
            <i data-lucide="lock" class="w-7 h-7"></i>
          </div>
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Konten dashboard tidak tersedia untuk peran ini.</p>
        </div>`;
      refreshIcons();
    }
  }
}

// Fetch user data
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await response.json();
    
    if (document.getElementById('user-greeting')) {
      document.getElementById('user-greeting').textContent = data.nama;

      // Avatar inisial dari nama (tidak pakai foto)
      const avatar = document.getElementById('user-avatar');
      if (avatar) avatar.textContent = getInitials(data.nama);

      const roles = data.roles || [data.role];
      const primaryRole = roles[0] || data.role;
      const roleBadge = document.getElementById('user-role-badge');
      if (roleBadge) {
          roleBadge.textContent = roles.map(r => String(r).toUpperCase().replace(/_/g, ' ')).join(', ');
          
          // Coloring badge based on primary role
          if(primaryRole === 'pimpinan') roleBadge.classList.add('text-amber-900', 'bg-amber-100', 'dark:bg-amber-900/50', 'dark:text-amber-300');
          else if(primaryRole === 'mustahiq') roleBadge.classList.add('text-blue-900', 'bg-blue-100', 'dark:bg-blue-900/50', 'dark:text-blue-300');
          else if(primaryRole === 'muroqib') roleBadge.classList.add('text-emerald-900', 'bg-emerald-100', 'dark:bg-emerald-900/50', 'dark:text-emerald-300');
          else roleBadge.classList.add('text-gray-900', 'bg-gray-100');
      }
    }

    const allRoles = data.roles || [data.role];
    if (allRoles.includes('wali_santri')) {
      // Perilaku eksisting untuk wali_santri: beranda detail akademik anak.
      renderWaliHome();
    } else {
      // Dashboard sadar-peran (admin/guru/unknown) sesuai Req 4.1, 4.2, 4.4, 4.5.
      initRoleAwareDashboard(allRoles);
    }

  } catch (err) {
    console.error("Auth check failed:", err);
  }
}

// ==================== HERO: JAM HIDUP, AVATAR, HIJRIYAH ====================

// Inisial dari nama: huruf awal 1-2 kata pertama (mis. "Muhammad Fulan" -> "MF").
function getInitials(nama) {
  if (!nama) return '–';
  const parts = String(nama).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Nama bulan Hijriyah (transliterasi Indonesia).
const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban", 'Ramadhan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah'];

// Konversi tanggal Masehi -> Hijriyah lengkap (mis. "23 Muharram 1447 H") memakai
// kalender islamic-umalqura bawaan browser, dihitung pada zona waktu WIB.
function formatHijri(date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      timeZone: 'Asia/Jakarta', day: 'numeric', month: 'numeric', year: 'numeric'
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

// Jam hidup (per detik, WIB) + tanggal Masehi + tanggal Hijriyah di hero dashboard.
function startHeroClock() {
  const elDate = document.getElementById('hero-date');
  const elTime = document.getElementById('hero-time');
  const elHijri = document.getElementById('hero-hijri');
  if (!elDate && !elTime && !elHijri) return; // bukan halaman dashboard

  const dateFmt = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
  });
  const timeFmt = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  function tick() {
    const now = new Date();
    if (elDate) elDate.textContent = dateFmt.format(now);
    if (elTime) elTime.textContent = timeFmt.format(now) + ' WIB';
    if (elHijri) elHijri.textContent = formatHijri(now) || '—';
  }
  tick();
  setInterval(tick, 1000);
}

// ==================== WALI SANTRI HOME ====================
// Mengubah halaman Beranda menjadi detail akademik anak untuk role wali_santri.

function waliEscape(str) {
  if (str === null || str === undefined) return '-';
  return String(str);
}

function waliFmtNilai(n) {
  if (n === null || n === undefined || n === '') return '-';
  const num = Number(n);
  if (Number.isNaN(num)) return waliEscape(n);
  const rounded = Math.round(num * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

async function renderWaliHome() {
  const metrics = document.getElementById('dash-metrics');
  const quick = document.getElementById('dash-quickactions');
  const home = document.getElementById('wali-home');
  if (metrics) metrics.classList.add('hidden');
  if (quick) quick.classList.add('hidden');
  if (!home) return;
  home.classList.remove('hidden');
  home.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">Memuat data anak...</div>`;

  try {
    const res = await fetch('/api/wali/anak');
    if (!res.ok) throw new Error('Gagal memuat data anak');
    const anak = (await res.json()) || [];

    if (anak.length === 0) {
      home.innerHTML = `
        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
          <p class="font-semibold text-amber-800 dark:text-amber-300">Data anak belum tertaut ke akun ini.</p>
          <p class="text-sm text-amber-700 dark:text-amber-400 mt-1">Silakan hubungi pengurus madrasah untuk menautkan data putra/putri Anda.</p>
        </div>`;
      return;
    }

    if (anak.length === 1) {
      loadAnakDetail(anak[0].id);
      return;
    }

    // Lebih dari satu anak: tampilkan pemilih
    const cards = anak.map(a => `
      <button data-id="${a.id}" class="wali-anak-pick text-left bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/60 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all flex items-center gap-4">
        <div class="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">${waliEscape(a.nama).charAt(0)}</div>
        <div>
          <div class="font-bold text-gray-900 dark:text-white">${waliEscape(a.nama)}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">${waliEscape(a.bagian_nama || a.status)}</div>
        </div>
      </button>`).join('');
    home.innerHTML = `
      <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Pilih Anak</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${cards}</div>`;
    home.querySelectorAll('.wali-anak-pick').forEach(btn => {
      btn.addEventListener('click', () => loadAnakDetail(parseInt(btn.dataset.id, 10)));
    });
  } catch (err) {
    home.innerHTML = `<div class="text-center py-10 text-red-500 text-sm">${waliEscape(err.message)}</div>`;
  }
}

async function loadAnakDetail(santriId) {
  const home = document.getElementById('wali-home');
  if (!home) return;
  home.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">Memuat detail anak...</div>`;

  try {
    const [resS, resR] = await Promise.all([
      fetch(`/api/santri/${santriId}`),
      fetch(`/api/santri/${santriId}/riwayat-akademik`)
    ]);
    if (!resS.ok) throw new Error('Gagal memuat profil anak');
    const s = await resS.json();
    const riwayat = resR.ok ? ((await resR.json()) || []) : [];

    home.innerHTML = buildAnakBiodata(s) + buildAlphaAlert(riwayat) + buildRiwayatAkademik(riwayat);
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    home.innerHTML = `<div class="text-center py-10 text-red-500 text-sm">${waliEscape(err.message)}</div>`;
  }
}

function buildAnakBiodata(s) {
  const foto = s.foto_url
    ? (String(s.foto_url).startsWith('/uploads') ? s.foto_url : `/uploads/${s.foto_url}`)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(s.nama || 'Santri')}&background=e0e7ff&color=4f46e5&size=200`;
  const kelas = [s.tingkatan_nama, s.kelas_nama ? 'Kelas ' + s.kelas_nama : null, s.bagian_nama ? 'Bagian ' + s.bagian_nama : null].filter(Boolean).join(' • ') || 'Belum ada kelas aktif';
  const ttl = `${waliEscape(s.ttl_tempat)}${s.ttl_tanggal ? ', ' + new Date(s.ttl_tanggal).toLocaleDateString('id-ID') : ''}`;

  return `
    <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-slate-700/60 shadow-sm mb-6">
      <div class="flex flex-col md:flex-row items-center md:items-start gap-6">
        <img src="${foto}" alt="Foto ${waliEscape(s.nama)}" class="w-28 h-28 rounded-2xl object-cover border border-gray-200 dark:border-slate-700">
        <div class="flex-1 text-center md:text-left">
          <h2 class="text-2xl font-extrabold text-gray-900 dark:text-white">${waliEscape(s.nama)}</h2>
          <p class="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-1">${waliEscape(kelas)}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mt-4 text-sm text-left">
            <div><span class="text-gray-400">No. Stambuk:</span> <span class="font-medium text-gray-800 dark:text-gray-200">${waliEscape(s.stambuk)}</span></div>
            <div><span class="text-gray-400">NIK:</span> <span class="font-medium text-gray-800 dark:text-gray-200">${waliEscape(s.nik)}</span></div>
            <div><span class="text-gray-400">TTL:</span> <span class="font-medium text-gray-800 dark:text-gray-200">${ttl}</span></div>
            <div><span class="text-gray-400">Status:</span> <span class="font-medium text-gray-800 dark:text-gray-200">${waliEscape(s.status)}</span></div>
            <div><span class="text-gray-400">Wali:</span> <span class="font-medium text-gray-800 dark:text-gray-200">${waliEscape(s.nama_wali)}</span></div>
            <div><span class="text-gray-400">No. HP:</span> <span class="font-medium text-gray-800 dark:text-gray-200">${waliEscape(s.no_hp_wali)}</span></div>
          </div>
        </div>
      </div>
    </div>`;
}

function buildAlphaAlert(riwayat) {
  let totalAlpha = 0;
  const perTahun = [];
  (riwayat || []).forEach(ta => {
    let a = 0;
    if (Array.isArray(ta.absensi)) ta.absensi.forEach(m => { a += m.t || 0; });
    totalAlpha += a;
    if (a > 0) perTahun.push(`${waliEscape(ta.tahun_ajaran)}: ${a} hari`);
  });

  if (totalAlpha === 0) {
    return `
      <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 mb-6 flex items-center gap-4">
        <div class="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300"><i data-lucide="check-circle" class="w-6 h-6"></i></div>
        <div>
          <p class="font-bold text-emerald-800 dark:text-emerald-300">Belum ada alpha</p>
          <p class="text-sm text-emerald-700 dark:text-emerald-400">Alhamdulillah, tidak ada catatan ketidakhadiran tanpa izin (bi ghoiri idzin).</p>
        </div>
      </div>`;
  }

  return `
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5 mb-6 flex items-start gap-4">
      <div class="w-11 h-11 rounded-full bg-red-100 dark:bg-red-800/40 flex items-center justify-center text-red-600 dark:text-red-300 shrink-0"><i data-lucide="alert-triangle" class="w-6 h-6"></i></div>
      <div>
        <p class="font-bold text-red-800 dark:text-red-300">Ada ${totalAlpha} hari alpha (tanpa izin / bi ghoiri idzin)</p>
        <p class="text-sm text-red-700 dark:text-red-400 mt-0.5">Rincian: ${perTahun.join(' — ')}</p>
      </div>
    </div>`;
}

function buildRiwayatAkademik(riwayat) {
  if (!riwayat || riwayat.length === 0) {
    return `<div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700/60 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data akademik.</div>`;
  }

  const sorted = [...riwayat].sort((a, b) => String(b.tahun_ajaran).localeCompare(String(a.tahun_ajaran)));

  return sorted.map((ta, idx) => {
    let totS = 0, totI = 0, totA = 0;
    if (Array.isArray(ta.absensi)) ta.absensi.forEach(m => { totS += m.s || 0; totI += m.i || 0; totA += m.t || 0; });

    let sum1 = 0, c1 = 0, sum2 = 0, c2 = 0;
    (ta.raport || []).forEach(m => {
      const v1 = parseFloat(m.smt1); if (!isNaN(v1)) { sum1 += v1; c1++; }
      const v2 = parseFloat(m.smt2); if (!isNaN(v2)) { sum2 += v2; c2++; }
    });
    const avg1 = c1 > 0 ? sum1 / c1 : 0;
    const avg2 = c2 > 0 ? sum2 / c2 : 0;

    const rows = (ta.raport || []).map((m, i) => `
      <tr class="border-b border-gray-100 dark:border-slate-700">
        <td class="px-3 py-2 text-center text-gray-400">${i + 1}</td>
        <td class="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">${waliEscape(m.mapel)}</td>
        <td class="px-3 py-2 text-center font-bold">${waliFmtNilai(m.smt1)}</td>
        <td class="px-3 py-2 text-center font-bold">${waliFmtNilai(m.smt2)}</td>
      </tr>`).join('');

    return `
      <div class="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700/60 shadow-sm overflow-hidden mb-6">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">Tahun Ajaran ${waliEscape(ta.tahun_ajaran)}</h3>
            <p class="text-sm text-indigo-600 dark:text-indigo-400">${waliEscape(ta.nama_bagian || '-')}</p>
          </div>
          ${idx === 0 ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Terkini</span>' : ''}
        </div>
        <div class="p-6">
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rekap Absensi</h4>
          <div class="grid grid-cols-3 gap-3 max-w-md mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center"><div class="text-xs text-blue-600 dark:text-blue-400 font-medium">Sakit</div><div class="text-2xl font-bold text-blue-900 dark:text-blue-100">${totS}</div></div>
            <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center"><div class="text-xs text-amber-600 dark:text-amber-400 font-medium">Izin</div><div class="text-2xl font-bold text-amber-900 dark:text-amber-100">${totI}</div></div>
            <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center"><div class="text-xs text-red-600 dark:text-red-400 font-medium">Alpha</div><div class="text-2xl font-bold text-red-900 dark:text-red-100">${totA}</div></div>
          </div>
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Nilai Raport</h4>
          ${(ta.raport || []).length > 0 ? `
          <div class="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 dark:bg-slate-900/40">
                <tr>
                  <th class="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase w-12">No</th>
                  <th class="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Mapel</th>
                  <th class="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase w-20">Smt 1</th>
                  <th class="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase w-20">Smt 2</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot class="bg-indigo-50 dark:bg-indigo-900/20">
                <tr>
                  <td colspan="2" class="px-3 py-2 text-right font-bold text-indigo-900 dark:text-indigo-200">Rata-rata</td>
                  <td class="px-3 py-2 text-center font-bold text-indigo-900 dark:text-indigo-200">${waliFmtNilai(avg1)}</td>
                  <td class="px-3 py-2 text-center font-bold text-indigo-900 dark:text-indigo-200">${waliFmtNilai(avg2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>` : `<p class="text-sm text-gray-400 italic">Belum ada nilai untuk tahun ajaran ini.</p>`}
        </div>
      </div>`;
  }).join('');
}

async function fetchDashboardStats() {
  try {
    const response = await fetch('/api/dashboard/stats');
    if (response.ok) {
      const stats = await response.json();
      document.getElementById('stat-santri').textContent = stats.total_santri.toLocaleString('id-ID');
      document.getElementById('stat-bagian').textContent = stats.total_bagian.toLocaleString('id-ID');
      document.getElementById('stat-alumni').textContent = stats.total_alumni.toLocaleString('id-ID');
      document.getElementById('stat-nilai').textContent = stats.input_nilai + '%';
    }
  } catch(err) {
    console.error("Failed to fetch stats", err);
  }
}

// (Logout logic moved to xss.js for global coverage)


// Global search (modal + FAB/desktop button + Ctrl+K + scroll-lock) is handled
// globally in xss.js, which loads on EVERY page. That makes the bottom-nav FAB
// work on all pages, not just the dashboard, and avoids duplicated logic here.

// Run auth check
checkAuth();

// Hero clock, greeting, avatar & Hijri date (dashboard only)
startHeroClock();

// Note: Drawer sidebar behavior (open/close, backdrop, scroll-lock, resize reset)
// is handled globally in xss.js via the canonical #app-sidebar drawer.


// ES module exports for tests (jsdom/Vitest) and any module consumers.
// Pages load this file with <script type="module">, so named exports do not
// break plain-page usage; browser behavior still runs via the top-level calls above.
export {
  resolveDashboardView,
  toDisplayCount,
  groupByTingkatan,
  groupByStatus,
  computeDonutSegments,
  toISODateLocal,
  buildWeekStrip,
  buildAgendaIndex,
  filterUpcomingAgenda,
  sortJadwal,
  buildAbsensiDeepLink,
  renderHero,
  renderMetrics,
  renderMobileSummary,
  renderTingkatanChart,
  renderStatusChart,
  renderRingkasanPengajar,
  renderJadwalCard,
  renderKalenderAgenda,
  fetchWithTimeout,
  loadStats,
  loadPengabdian,
  loadPengajar,
  loadSantriCharts,
  loadJadwalHariIni,
  loadKalenderAgenda,
  initRoleAwareDashboard,
};

console.log('Cache bust 1');
