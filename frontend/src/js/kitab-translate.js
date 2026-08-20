// kitab-translate.js — Kamus transliterasi nama kitab Arab → Latin/Indonesia.
//
// Dipakai di halaman Penilaian (spreadsheet header) dan Detail Santri (Riwayat
// Akademik) untuk menampilkan nama kitab dalam ejaan Latin/Indonesia, sementara
// database dan raport cetak tetap menyimpan/menampilkan nama Arab-nya.
//
// Cara pakai:
//   import { translateKitab } from './kitab-translate.js';
//   const label = translateKitab(m.nama_kitab); // "Alfiyah Ibnu Malik"
//
// Cara nambah kitab baru: tambahkan pasangan { 'nama arab': 'Nama Latin' } di
// KITAB_MAP di bawah. Kunci di-normalisasi otomatis (trim + strip ال awal +
// hapus tashkil) sehingga tak perlu menuliskan varian ejaan berulang.

// -------------------- Normalisasi teks Arab --------------------
// Menghapus tanda baca vokal (harakat/tashkil), alif dengan berbagai bentuk,
// dan spasi ekstra supaya pencocokan tak sensitif terhadap variasi input.
const TASHKIL_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g; // fathatan..ttk, tashdid, dll
function normalizeArabic(s) {
  if (!s) return '';
  return String(s)
    .replace(TASHKIL_RE, '')
    .replace(/[أإآٱ]/g, 'ا')  // varian alif dengan hamza/madd → alif polos
    .replace(/ى/g, 'ي')       // alif maksura → ya
    .replace(/ة/g, 'ه')       // ta marbuta → ha
    .replace(/ؤ/g, 'و')       // waw+hamza → waw
    .replace(/ئ/g, 'ي')       // ya+hamza → ya
    .replace(/[ءٕٔ]/g, '')    // buang standalone hamza dan diacritic hamza
    //                          agar "القرءان"/"القرآن"/"القران" seragam
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '') // strip RTL marker/BOM
    .replace(/\s+/g, ' ')
    .trim();
}

// Hapus "ال" (definite article) di awal, agar "الفية" cocok dengan "فية".
function stripAl(s) {
  const n = normalizeArabic(s);
  return n.replace(/^ال/, '');
}

// -------------------- Kamus --------------------
// Kunci ditulis dalam bentuk Arab TANPA harakat. Sistem otomatis mencocokkan
// varian dengan/tanpa "ال" di awal.
const RAW_MAP = {
  // Fann/mata pelajaran umum
  'نحو':                     'Nahwu',
  'تحو':                     'Nahwu',              // typo yang sering ada di data
  'صرف':                     'Shorof',
  'حديث':                    'Hadits',
  'فقه':                     'Fiqh',
  'اصول الفقه':              'Ushul Fiqh',
  'عقيده':                   'Aqidah',
  'عقيدة':                   'Aqidah',
  'توحيد':                   'Tauhid',
  'تصوف':                    'Tashawwuf',
  'اخلاق':                   'Akhlaq',
  'أخلاق':                   'Akhlaq',
  'تفسير':                   'Tafsir',
  'قراءه':                   'Qira\'ah',
  'قراءة':                   'Qira\'ah',
  'قراءة الكتب':             'Qira\'atul Kutub',
  'قراءه الكتب':             'Qira\'atul Kutub',
  'إملاء':                   'Imla\'',
  'املاء':                   'Imla\'',
  'الاملاء':                 'Imla\'',
  'خط':                      'Khat',
  'الخط':                    'Khat',
  'تجويد':                   'Tajwid',
  'بلاغه':                   'Balaghah',
  'بلاغة':                   'Balaghah',
  'منطق':                    'Manthiq',
  'تاريخ':                   'Tarikh',
  // Al-Qur'an — banyak varian ejaan (dengan/tanpa hamza, madd, dst).
  // Karena normalizeArabic() menghilangkan hamza, cukup satu bentuk saja
  // yang perlu ditulis, tapi kita cantumkan varian umum agar mudah dibaca
  // dan lebih toleran terhadap variasi input.
  'قرآن':                    'Al-Qur\'an',
  'القرآن':                  'Al-Qur\'an',
  'قرءان':                   'Al-Qur\'an',
  'القرءان':                 'Al-Qur\'an',
  'قران':                    'Al-Qur\'an',
  'القران':                  'Al-Qur\'an',
  // Al-Furqan adalah nama lain Al-Qur'an dalam Al-Qur'an sendiri; di
  // kurikulum pesantren nama kolom ini dimaksudkan sebagai pelajaran
  // Al-Qur'an, sehingga di-map ke "Al-Qur'an" (bukan "Al-Furqan").
  'الفرقان':                 'Al-Qur\'an',
  'فرقان':                   'Al-Qur\'an',

  // Kitab-kitab pesantren umum (Nahwu-Shorof)
  'الفيه ابن مالك':           'Alfiyah Ibnu Malik',
  'الفية ابن مالك':           'Alfiyah Ibnu Malik',
  'الفيه بن مالك':            'Alfiyah Ibnu Malik',
  'الفية بن مالك':            'Alfiyah Ibnu Malik',
  'الفيه':                    'Alfiyah',
  'الفية':                    'Alfiyah',
  'العمريطي':                 'Imrithi',
  'عمريطي':                   'Imrithi',
  'الاجروميه':                'Jurumiyah',
  'الآجرومية':                'Jurumiyah',
  'الجرومية':                 'Jurumiyah',
  'شرح ابن عقيل':             'Syarah Ibnu Aqil',
  'كيلاني':                   'Kailani',
  'الامثله التصريفيه':        'Amtsilah Tashrifiyah',
  'الأمثلة التصريفية':        'Amtsilah Tashrifiyah',
  'قواعد الصرف':              'Qawa\'idus Shorof',

  // Fiqh
  'فتح المعين':               'Fathul Mu\'in',
  'فتح القريب':               'Fathul Qorib',
  'تقريب':                    'Taqrib',
  'التقريب':                  'Taqrib',
  'سلم التوفيق':              'Sullam Taufiq',
  'سفينه النجاه':             'Safinatun Naja',
  'سفينة النجاة':             'Safinatun Naja',
  'كفايه الاخيار':            'Kifayatul Akhyar',
  'كفاية الأخيار':            'Kifayatul Akhyar',
  'المهذب':                   'Al-Muhadzdzab',
  'الرحبيه':                  'Rahbiyah',
  'الرحبية':                  'Rahbiyah',

  // Hadits
  'رياض الصالحين':            'Riyadhus Shalihin',
  'بلوغ المرام':              'Bulughul Maram',
  'الاربعين النوويه':         'Arba\'in Nawawi',
  'الأربعين النووية':         'Arba\'in Nawawi',
  'صحيح البخاري':             'Shahih Bukhari',
  'صحيح مسلم':                'Shahih Muslim',
  'مختار الاحاديث':           'Mukhtarul Ahadits',
  'مختار الأحاديث':           'Mukhtarul Ahadits',

  // Tafsir & Ulumul Qur'an
  'تفسير الجلالين':           'Tafsir Jalalain',
  'الجلالين':                 'Jalalain',
  'تفسير ابن كثير':           'Tafsir Ibnu Katsir',
  'تفسير المنير':             'Tafsir Al-Munir',
  'التبيان':                  'At-Tibyan',

  // Tauhid & Aqidah
  'عقيده العوام':             'Aqidatul Awam',
  'عقيدة العوام':             'Aqidatul Awam',
  'جوهره التوحيد':            'Jauharatut Tauhid',
  'جوهرة التوحيد':            'Jauharatut Tauhid',
  'كفايه العوام':             'Kifayatul Awam',
  'كفاية العوام':             'Kifayatul Awam',
  'الحصون الحميديه':          'Al-Hushunul Hamidiyah',
  'الحصون الحميدية':          'Al-Hushunul Hamidiyah',

  // Tashawwuf / Akhlaq
  'تعليم المتعلم':            'Ta\'lim Muta\'allim',
  'بدايه الهدايه':            'Bidayatul Hidayah',
  'بداية الهداية':            'Bidayatul Hidayah',
  'احياء علوم الدين':         'Ihya Ulumuddin',
  'إحياء علوم الدين':         'Ihya Ulumuddin',
  'تنوير القلوب':             'Tanwirul Qulub',
  'اخلاق البنات':             'Akhlaqul Banat',
  'أخلاق البنات':             'Akhlaqul Banat',
  'اخلاق البنين':             'Akhlaqul Banin',
  'أخلاق البنين':             'Akhlaqul Banin',
  'تيسير الخلاق':             'Taisirul Khallaq',
  'الاخلاق للبنات':           'Al-Akhlaq lil Banat',
  'الأخلاق للبنات':           'Al-Akhlaq lil Banat',
  'مراقي العبوديه':           'Maraqil Ubudiyah',
  'مراقي العبودية':           'Maraqil Ubudiyah',

  // Balaghah / Manthiq / Lain-lain
  'جوهر المكنون':             'Jauharul Maknun',
  'السلم المنورق':            'Sullam Munauraq',
  'ايساغوجي':                 'Isaghuji',
  'إيساغوجي':                 'Isaghuji',

  // Al-Bayan (label yang kadang muncul)
  'البيان':                   'Al-Bayan',
  'العامة':                   'Al-\'Ammah',
  'الخاصة':                   'Al-Khashshah',
};

// Bangun map ternormalisasi. Simpan dua kunci: dengan-al dan tanpa-al.
const MAP = new Map();
for (const [k, v] of Object.entries(RAW_MAP)) {
  const withAl  = normalizeArabic(k);
  const noAl    = stripAl(k);
  if (withAl) MAP.set(withAl, v);
  if (noAl && noAl !== withAl) MAP.set(noAl, v);
}

// -------------------- API publik --------------------
/**
 * Terjemahkan sebuah nama kitab dari Arab ke ejaan Latin/Indonesia.
 * Bila tidak ada di kamus, teks asli dikembalikan apa adanya.
 * @param {string} raw
 * @returns {string}
 */
export function translateKitab(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';

  // Deteksi cepat: kalau sudah tidak mengandung karakter Arab, kembalikan asli.
  if (!/[\u0600-\u06FF]/.test(s)) return s;

  const key = normalizeArabic(s);
  if (MAP.has(key)) return MAP.get(key);

  const keyNoAl = stripAl(s);
  if (MAP.has(keyNoAl)) return MAP.get(keyNoAl);

  // Coba pecah menjadi kata-kata; kalau tiap kata ada di kamus, gabungkan.
  const parts = key.split(' ').filter(Boolean);
  if (parts.length > 1) {
    const mapped = parts.map(p => MAP.get(p) || MAP.get(stripAl(p)) || p);
    // Kalau paling sedikit satu kata berhasil diterjemahkan, tampilkan hasil gabungan.
    if (mapped.some((w, i) => w !== parts[i])) return mapped.join(' ');
  }

  // Fallback: kembalikan Arab apa adanya.
  return s;
}

/**
 * Pilih nama untuk display di UI: prefer kitab (di-translate), fallback ke mapel.
 * Object bisa berisi field `nama_kitab`, `nama_mapel`, atau `nama`.
 * @param {{ nama_kitab?: string, nama_mapel?: string, nama?: string }} m
 * @returns {string}
 */
export function displayMapelName(m) {
  if (!m) return '';
  const kitab = (m.nama_kitab || '').trim();
  if (kitab) {
    const t = translateKitab(kitab);
    if (t) return t;
  }
  const mapel = (m.nama_mapel || m.nama || '').trim();
  if (mapel) return translateKitab(mapel);
  return '';
}
