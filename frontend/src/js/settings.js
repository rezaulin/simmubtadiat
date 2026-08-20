// frontend/src/js/settings.js

const tableUsers = document.getElementById('table-users');
const btnAddUser = document.getElementById('btn-add-user');
const modalUser = document.getElementById('modal-user');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');
const btnCancel = document.getElementById('btn-cancel');
const formUser = document.getElementById('form-user');
const modalTitle = document.getElementById('modal-title');
const userIdField = document.getElementById('user_id');
const passwordHint = document.getElementById('password-hint');
const modalError = document.getElementById('modal-error');
const fieldPengajar = document.getElementById('field-pengajar');


let allPengajar = [];

// Toggle tampil/sembunyi password pada form tambah/edit user.
const toggleUserPwd = document.getElementById('toggle-user-password');
const userPwdInput = document.getElementById('user-password-input');
const userIconEye = document.getElementById('user-icon-eye');
const userIconEyeOff = document.getElementById('user-icon-eye-off');
if (toggleUserPwd && userPwdInput) {
  toggleUserPwd.addEventListener('click', () => {
    const show = userPwdInput.type === 'password';
    userPwdInput.type = show ? 'text' : 'password';
    if (userIconEye) userIconEye.classList.toggle('hidden', show);
    if (userIconEyeOff) userIconEyeOff.classList.toggle('hidden', !show);
  });
}

// --- Load Pengajar List ---
async function loadPengajarList() {
  try {
    const res = await fetch('/api/pengajar');
    if (res.ok) {
      allPengajar = await res.json();
    }
  } catch (err) {
    console.error('Failed to load pengajar:', err);
  }
}

function populatePengajarDropdown(selectedId) {
  const sel = formUser.pengajar_id;
  sel.innerHTML = '<option value="">-- Buat profil pengajar baru otomatis --</option>';
  if (allPengajar && allPengajar.length > 0) {
    allPengajar.forEach(p => {
      const selected = (selectedId && selectedId == p.id) ? 'selected' : '';
      sel.innerHTML += `<option value="${p.id}" ${selected}>${p.nama} (${p.status || '-'})</option>`;
    });
  }
}

// Show/hide pengajar field based on role
function togglePengajarField() {
  const checkboxes = document.querySelectorAll('input[name="roles"]');
  const roles = Array.from(checkboxes).filter(chk => chk.checked).map(chk => chk.value);
  const guruRoles = ['mufatish', 'mustahiq', 'muroqib'];
  const isGuru = roles.some(r => guruRoles.includes(r));
  if (isGuru) {
    fieldPengajar.classList.remove('hidden');
  } else {
    fieldPengajar.classList.add('hidden');
    formUser.pengajar_id.value = '';
  }
}

document.querySelectorAll('input[name="roles"]').forEach(chk => chk.addEventListener('change', togglePengajarField));

// Auto-fill nama when pengajar is selected
formUser.pengajar_id.addEventListener('change', () => {
  const pengajarId = parseInt(formUser.pengajar_id.value);
  if (pengajarId) {
    const p = allPengajar.find(x => x.id === pengajarId);
    if (p && !formUser.nama.value) {
      formUser.nama.value = p.nama;
    }
  }
});

// --- User Management ---

const userFilterRole = document.getElementById('user-filter-role');
const userSearch = document.getElementById('user-search');
const userPrev = document.getElementById('user-prev');
const userNext = document.getElementById('user-next');
const userPaginationInfo = document.getElementById('user-pagination-info');

// State filter/paginasi Manajemen Pengguna. Default: hanya Staf (bukan wali).
const userState = { role: 'staf', q: '', limit: 25, offset: 0, total: 0 };
let userSearchTimer = null;

function updateUserPagination() {
  const start = userState.total === 0 ? 0 : userState.offset + 1;
  const end = Math.min(userState.offset + userState.limit, userState.total);
  if (userPaginationInfo) userPaginationInfo.textContent = `${start}\u2013${end} dari ${userState.total}`;
  if (userPrev) userPrev.disabled = userState.offset <= 0;
  if (userNext) userNext.disabled = userState.offset + userState.limit >= userState.total;
}

async function loadUsers() {
  try {
    const params = new URLSearchParams({
      role: userState.role,
      q: userState.q,
      limit: String(userState.limit),
      offset: String(userState.offset),
    });
    const res = await fetch(`/api/settings/users?${params.toString()}`);
    if (!res.ok) throw new Error('Gagal memuat data pengguna');
    const data = await res.json();
    const users = Array.isArray(data.items) ? data.items : [];
    userState.total = data.total || 0;

    tableUsers.innerHTML = '';
    if (users.length === 0) {
      tableUsers.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-gray-400">Tidak ada pengguna.</td></tr>`;
      updateUserPagination();
      return;
    }

    users.forEach(u => {
      const rolesArr = u.roles && u.roles.length > 0 ? u.roles : [u.role];
      const roleBadges = rolesArr.map(r => {
        let rc = 'text-gray-700 bg-gray-100';
        if (r === 'pimpinan') rc = 'text-amber-800 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300';
        else if (r === 'mufatish') rc = 'text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300';
        else if (r === 'mustahiq') rc = 'text-emerald-800 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300';
        else if (r === 'muroqib') rc = 'text-purple-800 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300';
        else if (r === 'tim_rapot') rc = 'text-teal-800 bg-teal-100 dark:bg-teal-900/50 dark:text-teal-300';
        else if (r === 'keamanan') rc = 'text-orange-800 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-300';
        return `<span class="inline-block mr-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${rc}">${r}</span>`;
      }).join('');
      
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50 group';
      tr.innerHTML = `
        <td class="px-4 py-3">
          <div class="font-medium text-gray-900 dark:text-white">${u.nama || '-'}</div>
          <div class="text-[10px] text-gray-400">${u.username}</div>
        </td>
        <td class="px-4 py-3">
          ${roleBadges}
        </td>
        <td class="px-4 py-3 text-right">
          <button class="btn-edit text-blue-500 hover:text-blue-700 mr-3 transition-colors" data-id="${u.id}" data-username="${u.username}" data-roles='${JSON.stringify(u.roles || [u.role])}' data-nama="${u.nama || ''}" data-pengajar="${u.pengajar_id || ''}">Edit</button>
          <button class="btn-delete text-red-500 hover:text-red-700 transition-colors" data-id="${u.id}">Hapus</button>
        </td>
      `;
      tableUsers.appendChild(tr);
    });
    
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ds = e.target.dataset;
        const roles = ds.roles ? JSON.parse(ds.roles) : [];
        openUserModal({ id: ds.id, username: ds.username, roles: roles, nama: ds.nama, pengajar_id: ds.pengajar });
      });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Yakin ingin menghapus pengguna ini?')) {
          try {
            const res = await fetch(`/api/settings/users/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus user');
            // Bila baris terakhir di halaman ini terhapus, mundur satu halaman.
            if (userState.offset > 0 && userState.offset >= userState.total - 1) {
              userState.offset = Math.max(0, userState.offset - userState.limit);
            }
            loadUsers();
          } catch (err) {
            alert(err.message);
          }
        }
      });
    });

    updateUserPagination();
  } catch (err) {
    tableUsers.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-red-500">${err.message}</td></tr>`;
  }
}

// Filter peran → reset ke halaman pertama.
if (userFilterRole) userFilterRole.addEventListener('change', () => {
  userState.role = userFilterRole.value;
  userState.offset = 0;
  loadUsers();
});
// Pencarian (debounce 300ms).
if (userSearch) userSearch.addEventListener('input', () => {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(() => {
    userState.q = userSearch.value.trim();
    userState.offset = 0;
    loadUsers();
  }, 300);
});
// Paginasi.
if (userPrev) userPrev.addEventListener('click', () => {
  if (userState.offset > 0) { userState.offset = Math.max(0, userState.offset - userState.limit); loadUsers(); }
});
if (userNext) userNext.addEventListener('click', () => {
  if (userState.offset + userState.limit < userState.total) { userState.offset += userState.limit; loadUsers(); }
});

// Modal Logic
function openUserModal(user = null) {
  modalError.classList.add('hidden');
  populatePengajarDropdown(user ? user.pengajar_id : null);
  
  if (user) {
    modalTitle.textContent = 'Edit User';
    userIdField.value = user.id;
    formUser.username.value = user.username;
    formUser.nama.value = user.nama || '';
    Array.from(formUser.roles).forEach(chk => chk.checked = false);
    if (user.roles) {
      user.roles.forEach(r => {
        const chk = Array.from(formUser.roles).find(c => c.value === r);
        if (chk) chk.checked = true;
      });
    }
    formUser.password.required = false;
    passwordHint.classList.remove('hidden');
    if (user.pengajar_id) {
      formUser.pengajar_id.value = user.pengajar_id;
    }
  } else {
    modalTitle.textContent = 'Tambah User';
    formUser.reset();
    userIdField.value = '';
    formUser.password.required = true;
    passwordHint.classList.add('hidden');
  }
  
  togglePengajarField();
  modalUser.classList.remove('hidden');
  setTimeout(() => {
    modalContent.classList.remove('scale-95', 'opacity-0');
    modalContent.classList.add('scale-100', 'opacity-100');
  }, 10);
}

function closeUserModal() {
  modalContent.classList.remove('scale-100', 'opacity-100');
  modalContent.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modalUser.classList.add('hidden');
  }, 300);
}

btnAddUser.addEventListener('click', () => openUserModal());
modalClose.addEventListener('click', closeUserModal);
btnCancel.addEventListener('click', closeUserModal);
modalOverlay.addEventListener('click', closeUserModal);

formUser.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalError.classList.add('hidden');
  
  const id = userIdField.value;
  const username = formUser.username.value;
  const nama = formUser.nama.value;
  const password = formUser.password.value;
  const roles = Array.from(formUser.roles).filter(chk => chk.checked).map(chk => chk.value);
  const pengajarIdVal = formUser.pengajar_id.value;
  
  if (roles.length === 0) {
    modalError.textContent = 'Pilih setidaknya satu role.';
    modalError.classList.remove('hidden');
    return;
  }

  // Catatan: untuk role guru, profil Pengajar dibuat otomatis di backend bila
  // tidak ditautkan ke pengajar yang sudah ada. Jadi tidak ada validasi wajib.
  const payload = { 
    username, 
    nama,
    role: roles[0], // primary/legacy role
    roles: roles,
    is_active: true 
  };
  if (password) payload.password = password;
  if (pengajarIdVal) payload.pengajar_id = parseInt(pengajarIdVal);
  
  try {
    let url = '/api/settings/users';
    let method = 'POST';
    
    if (id) {
      url = `/api/settings/users/${id}`;
      method = 'PUT';
    }
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menyimpan user');
    
    closeUserModal();
    loadUsers();
  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.remove('hidden');
  }
});


// --- Mudir per Tingkatan ---
const listMudir = document.getElementById('list-mudir');

function escapeAttr(str) {
    // Data API sudah di-escape global oleh xss.js. Decode dulu (agar tak double-escape,
    // mis. "I&#39;dadiyyah"), baru escape ulang → net single-escape yang benar.
    var s = String(str == null ? '' : str)
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadMudirTingkatan() {
    if (!listMudir) return;
    try {
        const res = await fetch('/api/settings/mudir-tingkatan');
        if (!res.ok) throw new Error('Gagal memuat data tingkatan');
        const data = await res.json();
        if (!data || data.length === 0) {
            listMudir.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Belum ada tingkatan.</p>';
            return;
        }
        listMudir.innerHTML = '';
        data.forEach(t => {
            const ttd = t.tanda_tangan || '';
            const wrap = document.createElement('div');
            wrap.className = 'flex flex-col gap-2 p-3 bg-gray-50/50 dark:bg-slate-700/30 rounded-xl border border-gray-100 dark:border-slate-700';
            wrap.innerHTML = `
                <label class="text-xs font-semibold text-gray-500 dark:text-gray-400">${escapeAttr(t.tingkatan_nama)}</label>
                <div class="flex gap-2">
                    <input type="text" data-tingkatan="${t.tingkatan_id}" value="${escapeAttr(t.nama_mudir)}" placeholder="Nama Mudir" class="glass-input px-3 py-2 rounded-lg text-sm w-full">
                    <button type="button" data-save-mudir="${t.tingkatan_id}" class="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0">Simpan</button>
                </div>
                <div class="flex items-center gap-3">
                    <div class="shrink-0 w-28 h-14 rounded-lg border border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center bg-white overflow-hidden">
                        <img data-ttd-preview="${t.tingkatan_id}" src="${ttd}" class="${ttd ? '' : 'hidden'} max-h-14 object-contain" alt="Tanda tangan">
                        <span data-ttd-empty="${t.tingkatan_id}" class="${ttd ? 'hidden' : ''} text-[10px] text-gray-400">Belum ada TTD</span>
                    </div>
                    <div class="flex flex-col gap-1 min-w-0">
                        <span class="text-[11px] font-medium text-gray-500 dark:text-gray-400">Tanda Tangan Mudir (PNG/JPG)</span>
                        <div class="flex items-center gap-2 flex-wrap">
                            <input type="file" accept="image/png,image/jpeg" data-ttd-file="${t.tingkatan_id}" class="text-xs text-gray-600 dark:text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100">
                            <button type="button" data-ttd-del="${t.tingkatan_id}" class="text-xs text-red-500 hover:text-red-700 ${ttd ? '' : 'hidden'}">Hapus</button>
                        </div>
                    </div>
                </div>`;
            listMudir.appendChild(wrap);
        });
    } catch (e) {
        listMudir.innerHTML = `<p class="text-sm text-red-500">${escapeAttr(e.message)}</p>`;
    }
}

// Kecilkan gambar ke PNG data URL (jaga aspek, lebar maks) agar payload ringkas.
function imageFileToDataURL(file, maxW) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / (img.width || maxW));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function saveMudirTtd(tingkatanId, dataURL) {
  const res = await fetch('/api/settings/mudir-tingkatan/tanda-tangan', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tingkatan_id: tingkatanId, tanda_tangan: dataURL })
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.message || d.error || 'Gagal menyimpan tanda tangan');
}

function setTtdPreview(tingkatanId, dataURL) {
  const img = listMudir.querySelector(`[data-ttd-preview="${tingkatanId}"]`);
  const empty = listMudir.querySelector(`[data-ttd-empty="${tingkatanId}"]`);
  const del = listMudir.querySelector(`[data-ttd-del="${tingkatanId}"]`);
  if (img) { img.src = dataURL || ''; img.classList.toggle('hidden', !dataURL); }
  if (empty) empty.classList.toggle('hidden', !!dataURL);
  if (del) del.classList.toggle('hidden', !dataURL);
}

if (listMudir) {
    // Simpan nama mudir & hapus tanda tangan (delegasi klik).
    listMudir.addEventListener('click', async (e) => {
        const saveBtn = e.target.closest('[data-save-mudir]');
        if (saveBtn) {
            const tingkatanId = parseInt(saveBtn.getAttribute('data-save-mudir'), 10);
            const input = listMudir.querySelector(`input[data-tingkatan="${tingkatanId}"]`);
            if (!input) return;
            saveBtn.disabled = true;
            const oldText = saveBtn.textContent;
            saveBtn.textContent = '...';
            try {
                const res = await fetch('/api/settings/mudir-tingkatan', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tingkatan_id: tingkatanId, nama_mudir: input.value.trim() })
                });
                if (!res.ok) throw new Error('Gagal menyimpan nama mudir');
                alert('Nama Mudir berhasil disimpan');
            } catch (err) {
                alert(err.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = oldText;
            }
            return;
        }

        const delBtn = e.target.closest('[data-ttd-del]');
        if (delBtn) {
            const tingkatanId = parseInt(delBtn.getAttribute('data-ttd-del'), 10);
            if (!confirm('Hapus tanda tangan Mudir untuk tingkatan ini?')) return;
            try {
                await saveMudirTtd(tingkatanId, '');
                setTtdPreview(tingkatanId, '');
            } catch (err) {
                alert(err.message);
            }
        }
    });

    // Unggah tanda tangan (delegasi change pada input file).
    listMudir.addEventListener('change', async (e) => {
        const fileInput = e.target.closest('[data-ttd-file]');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
        const tingkatanId = parseInt(fileInput.getAttribute('data-ttd-file'), 10);
        const file = fileInput.files[0];
        try {
            const dataURL = await imageFileToDataURL(file, 400);
            if (dataURL.length > 690 * 1024) throw new Error('Gambar terlalu besar setelah dikompres. Gunakan gambar lebih kecil.');
            await saveMudirTtd(tingkatanId, dataURL);
            setTtdPreview(tingkatanId, dataURL);
            alert('Tanda tangan tersimpan');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            fileInput.value = '';
        }
    });
}

// Init
loadPengajarList();
loadUsers();
loadMudirTingkatan();



// --- Agenda / Acara (agenda bebas) ---
// CRUD agenda yang tampil di widget Kalender & Agenda dashboard semua peran
// (kecuali wali_santri). Nilai teks dari /api/agenda sudah ter-escape oleh
// sanitizer global (xss.js) sehingga aman disisipkan ke innerHTML pada daftar.
(function initAgendaSettings() {
  const formAgenda = document.getElementById('form-agenda');
  if (!formAgenda) return; // bukan halaman settings / kartu tidak ada

  const inpId = document.getElementById('agenda-id');
  const inpJudul = document.getElementById('agenda-judul');
  const inpDeskripsi = document.getElementById('agenda-deskripsi');
  const inpMulai = document.getElementById('agenda-tgl-mulai');
  const inpSelesai = document.getElementById('agenda-tgl-selesai');
  const btnSubmit = document.getElementById('agenda-submit');
  const btnCancel = document.getElementById('agenda-cancel');
  const listEl = document.getElementById('agenda-list');

  // Decode entitas HTML kembali ke teks mentah untuk mengisi input saat edit
  // (respons JSON sudah ter-escape oleh sanitizer global).
  function decodeEntities(str) {
    if (str == null) return '';
    const ta = document.createElement('textarea');
    ta.innerHTML = String(str);
    return ta.value;
  }

  function fmtRange(a) {
    const start = a.tgl_mulai || '';
    const end = a.tgl_selesai || '';
    return end && end !== start ? `${start} \u2013 ${end}` : start;
  }

  function resetForm() {
    inpId.value = '';
    inpJudul.value = '';
    inpDeskripsi.value = '';
    inpMulai.value = '';
    inpSelesai.value = '';
    btnSubmit.textContent = 'Tambah Agenda';
    btnCancel.classList.add('hidden');
  }

  async function loadAgenda() {
    try {
      const res = await fetch('/api/agenda');
      if (!res.ok) throw new Error('Gagal memuat agenda');
      const data = (await res.json()) || [];
      if (!Array.isArray(data) || data.length === 0) {
        listEl.innerHTML = '<p class="text-gray-400 text-sm">Belum ada agenda mendatang.</p>';
        return;
      }
      listEl.innerHTML = data.map((a) => `
        <div class="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/40">
          <div class="min-w-0">
            <div class="font-semibold text-gray-800 dark:text-gray-100 truncate">${a.judul || 'Agenda'}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${fmtRange(a)}</div>
            ${a.deskripsi ? `<div class="text-xs text-gray-400 mt-0.5 truncate">${a.deskripsi}</div>` : ''}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-agenda-edit="${a.id}" class="p-1.5 rounded-lg text-primary hover:bg-primary/10" title="Edit"><i data-lucide="pencil" class="w-4 h-4"></i></button>
            <button type="button" data-agenda-del="${a.id}" class="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </div>`).join('');
      if (window.lucide) window.lucide.createIcons();

      // Simpan data mentah (untuk edit) via dataset JSON pada tiap tombol edit.
      listEl.querySelectorAll('[data-agenda-edit]').forEach((btn) => {
        const id = btn.getAttribute('data-agenda-edit');
        const item = data.find((x) => String(x.id) === String(id));
        btn.addEventListener('click', () => startEdit(item));
      });
      listEl.querySelectorAll('[data-agenda-del]').forEach((btn) => {
        const id = btn.getAttribute('data-agenda-del');
        btn.addEventListener('click', () => removeAgenda(id));
      });
    } catch (e) {
      listEl.innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>`;
    }
  }

  function startEdit(a) {
    if (!a) return;
    inpId.value = a.id;
    inpJudul.value = decodeEntities(a.judul);
    inpDeskripsi.value = decodeEntities(a.deskripsi);
    inpMulai.value = a.tgl_mulai || '';
    inpSelesai.value = a.tgl_selesai || '';
    btnSubmit.textContent = 'Simpan Perubahan';
    btnCancel.classList.remove('hidden');
    inpJudul.focus();
  }

  async function removeAgenda(id) {
    if (!confirm('Hapus agenda ini?')) return;
    try {
      const res = await fetch(`/api/agenda/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus agenda');
      await loadAgenda();
    } catch (e) {
      alert(e.message);
    }
  }

  formAgenda.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      judul: inpJudul.value.trim(),
      deskripsi: inpDeskripsi.value.trim(),
      tgl_mulai: inpMulai.value,
      tgl_selesai: inpSelesai.value ? inpSelesai.value : null,
    };
    if (!payload.judul || !payload.tgl_mulai) {
      alert('Judul dan Tanggal Mulai wajib diisi!');
      return;
    }
    const id = inpId.value;
    try {
      const res = await fetch(id ? `/api/agenda/${id}` : '/api/agenda', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = 'Gagal menyimpan agenda';
        try { const j = await res.json(); if (j && (j.message || j.error)) msg = j.message || j.error; } catch (_) {}
        throw new Error(msg);
      }
      resetForm();
      await loadAgenda();
    } catch (e) {
      alert(e.message);
    }
  });

  btnCancel.addEventListener('click', resetForm);

  loadAgenda();
})();


// --- Kalender Akademik (Hijriyah) ---
// Rentang Semester 1 & 2 diinput dalam tanggal Hijriyah (tgl/bulan/tahun).
// Ekuivalen Masehi dihitung browser (Intl islamic-umalqura, WIB) lalu disimpan
// agar absensi sesi (input Masehi) bisa lookup semester. Absensi manual bulanan
// masuk semester berdasarkan kalender ini (backend).
(function initKalenderHijri() {
  const form = document.getElementById('form-kalender');
  if (!form) return;

  const inpTA = document.getElementById('kalender-ta');
  const btnLoad = document.getElementById('kalender-load');
  const btnSetActive = document.getElementById('kalender-set-active');
  const spanActive = document.getElementById('kalender-ta-active');
  const preview = document.getElementById('kalender-preview');

  const BULAN = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal',
    'Jumadil Akhir', 'Rajab', "Sya'ban", 'Ramadhan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah'];

  const TRIPLES = ['s1-mulai', 's1-selesai', 's2-mulai', 's2-selesai'];
  const els = {};
  TRIPLES.forEach((p) => {
    els[p] = {
      tgl: document.getElementById(p + '-tgl'),
      bln: document.getElementById(p + '-bln'),
      thn: document.getElementById(p + '-thn'),
    };
  });

  function hijriOrdinal(y, m, d) { return y * 360 + m * 30 + d; }

  function readTriple(p) {
    const t = parseInt(els[p].tgl.value, 10);
    const b = parseInt(els[p].bln.value, 10);
    const th = parseInt(els[p].thn.value, 10);
    return { tgl: t || 0, bln: b || 0, thn: th || 0 };
  }

  function writeTriple(p, tgl, bln, thn) {
    els[p].tgl.value = tgl || '';
    els[p].bln.value = bln || '';
    els[p].thn.value = thn || '';
  }

  // --- Konversi Hijri -> Masehi (WIB) via Intl islamic-umalqura ---
  function jdToGregorian(jd) {
    const l = jd + 68569;
    const n = Math.floor((4 * l) / 146097);
    const l2 = l - Math.floor((146097 * n + 3) / 4);
    const i = Math.floor((4000 * (l2 + 1)) / 1461001);
    const l3 = l2 - Math.floor((1461 * i) / 4) + 31;
    const j = Math.floor((80 * l3) / 2447);
    const day = l3 - Math.floor((2447 * j) / 80);
    const l4 = Math.floor(j / 11);
    const month = j + 2 - 12 * l4;
    const year = 100 * (n - 49) + i + l4;
    return { year, month, day };
  }

  function gregorianToHijri(date) {
    try {
      const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
        timeZone: 'Asia/Jakarta', day: 'numeric', month: 'numeric', year: 'numeric',
      }).formatToParts(date);
      let d = 0, m = 0, y = 0;
      parts.forEach((pt) => {
        if (pt.type === 'day') d = parseInt(pt.value, 10);
        else if (pt.type === 'month') m = parseInt(pt.value, 10);
        else if (pt.type === 'year') y = parseInt(pt.value, 10);
      });
      return { d, m, y };
    } catch (e) { return null; }
  }

  // Hijri (y,m,d) -> 'YYYY-MM-DD' Masehi. Estimasi via kalender tabular, lalu
  // dikoreksi +-4 hari agar cocok dengan islamic-umalqura zona WIB.
  function hijriToMasehi(y, m, d) {
    const jd = d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + 1948439;
    const g = jdToGregorian(jd);
    for (let delta = -4; delta <= 4; delta++) {
      const date = new Date(Date.UTC(g.year, g.month - 1, g.day + delta, 12));
      const h = gregorianToHijri(date);
      if (h && h.y === y && h.m === m && h.d === d) {
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        return `${date.getUTCFullYear()}-${mm}-${dd}`;
      }
    }
    return null;
  }

  function fmtHijri(t) {
    return `${t.tgl} ${BULAN[t.bln - 1] || '?'} ${t.thn} H`;
  }

  function buildEntries() {
    const ta = inpTA.value.trim();
    const s1a = readTriple('s1-mulai'), s1b = readTriple('s1-selesai');
    const s2a = readTriple('s2-mulai'), s2b = readTriple('s2-selesai');

    const complete = (t) => t.tgl >= 1 && t.tgl <= 30 && t.bln >= 1 && t.bln <= 12 && t.thn >= 1300 && t.thn <= 1600;
    const empty = (t) => !t.tgl && !t.bln && !t.thn;

    if (!complete(s1a) || !complete(s1b)) {
      return { error: 'Lengkapi semua field Mulai & Selesai Semester 1 (tgl, bulan, tahun).' };
    }
    if (hijriOrdinal(s1a.thn, s1a.bln, s1a.tgl) > hijriOrdinal(s1b.thn, s1b.bln, s1b.tgl)) {
      return { error: 'Semester 1: tanggal mulai harus sebelum/sama dengan tanggal selesai.' };
    }
    if ((!empty(s2a) || !empty(s2b)) && (!complete(s2a) || !complete(s2b))) {
      return { error: 'Semester 2 terisi sebagian. Lengkapi atau kosongkan semua.' };
    }
    const hasS2 = complete(s2a) && complete(s2b);
    if (hasS2) {
      if (hijriOrdinal(s2a.thn, s2a.bln, s2a.tgl) > hijriOrdinal(s2b.thn, s2b.bln, s2b.tgl)) {
        return { error: 'Semester 2: tanggal mulai harus sebelum/sama dengan tanggal selesai.' };
      }
      if (hijriOrdinal(s2a.thn, s2a.bln, s2a.tgl) <= hijriOrdinal(s1b.thn, s1b.bln, s1b.tgl)) {
        return { error: 'Semester 2 harus dimulai setelah Semester 1 selesai.' };
      }
    }

    const conv = (t) => hijriToMasehi(t.thn, t.bln, t.tgl);
    const entries = [{
      tahun_ajaran: ta, semester: 1,
      mulai_tahun_hijri: s1a.thn, mulai_bulan_hijri: s1a.bln, mulai_tanggal: s1a.tgl,
      selesai_tahun_hijri: s1b.thn, selesai_bulan_hijri: s1b.bln, selesai_tanggal: s1b.tgl,
      masehi_mulai: conv(s1a), masehi_selesai: conv(s1b),
    }];
    if (hasS2) {
      entries.push({
        tahun_ajaran: ta, semester: 2,
        mulai_tahun_hijri: s2a.thn, mulai_bulan_hijri: s2a.bln, mulai_tanggal: s2a.tgl,
        selesai_tahun_hijri: s2b.thn, selesai_bulan_hijri: s2b.bln, selesai_tanggal: s2b.tgl,
        masehi_mulai: conv(s2a), masehi_selesai: conv(s2b),
      });
    }
    for (const e of entries) {
      if (!e.masehi_mulai || !e.masehi_selesai) {
        return { error: `Gagal menghitung ekuivalen Masehi Semester ${e.semester}. Periksa kembali tanggal Hijriyah.` };
      }
    }
    return { entries };
  }

  function renderPreview() {
    const b = buildEntries();
    if (b.error) { preview.innerHTML = `<span class="text-red-500">${b.error}</span>`; return; }
    preview.innerHTML = b.entries.map((e) => {
      const m = e.masehi_mulai ? `<b>${e.masehi_mulai}</b>` : '?';
      const s = e.masehi_selesai ? `<b>${e.masehi_selesai}</b>` : '?';
      return `Semester ${e.semester}: ${e.mulai_tanggal} ${BULAN[e.mulai_bulan_hijri - 1]} ${e.mulai_tahun_hijri} H (<b>≈ ${m}</b>) → ${e.selesai_tanggal} ${BULAN[e.selesai_bulan_hijri - 1]} ${e.selesai_tahun_hijri} H (<b>≈ ${s}</b>)`;
    }).join('<br>');
  }

  async function loadKalender() {
    const ta = inpTA.value.trim();
    if (!ta) { alert('Isi Tahun Ajaran dulu.'); return; }
    try {
      const res = await fetch(`/api/kalender/hijri-semester?tahun_ajaran=${encodeURIComponent(ta)}`);
      if (!res.ok) throw new Error('Gagal memuat kalender');
      const data = (await res.json()) || [];
      TRIPLES.forEach((p) => writeTriple(p, '', '', ''));
      data.forEach((row) => {
        if (row.semester === 1) {
          writeTriple('s1-mulai', row.mulai_tanggal, row.mulai_bulan_hijri, row.mulai_tahun_hijri);
          writeTriple('s1-selesai', row.selesai_tanggal, row.selesai_bulan_hijri, row.selesai_tahun_hijri);
        } else if (row.semester === 2) {
          writeTriple('s2-mulai', row.mulai_tanggal, row.mulai_bulan_hijri, row.mulai_tahun_hijri);
          writeTriple('s2-selesai', row.selesai_tanggal, row.selesai_bulan_hijri, row.selesai_tahun_hijri);
        }
      });
      renderPreview();
    } catch (e) {
      alert(e.message);
    }
  }

  TRIPLES.forEach((p) => ['tgl', 'bln', 'thn'].forEach((k) => els[p][k].addEventListener('change', renderPreview)));
  btnLoad.addEventListener('click', loadKalender);

  // Tampilkan tahun ajaran aktif saat ini.
  async function refreshActiveTA() {
    try {
      const res = await fetch('/api/settings/umum');
      if (res.ok) {
        const d = await res.json();
        if (spanActive) spanActive.textContent = (d && d.tahun_ajaran_aktif) ? d.tahun_ajaran_aktif : '-';
        return d && d.tahun_ajaran_aktif ? d.tahun_ajaran_aktif : '';
      }
    } catch (_) {}
    return '';
  }

  if (btnSetActive) {
    btnSetActive.addEventListener('click', async () => {
      const ta = inpTA.value.trim();
      if (!ta) { alert('Isi Tahun Ajaran dulu.'); return; }
      if (!confirm(`Jadikan ${ta} sebagai tahun ajaran aktif? Semua input absensi & nilai akan default ke tahun ini.`)) return;
      try {
        const res = await fetch('/api/settings/umum', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tahun_ajaran_aktif: ta }),
        });
        if (!res.ok) throw new Error('Gagal menyimpan tahun ajaran aktif');
        await refreshActiveTA();
        alert('Tahun ajaran aktif berhasil disimpan!');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Tahun Hijriyah Aktif (dipakai halaman Absensi Manual).
  const inpTH = document.getElementById('kalender-th');
  const btnSetHijri = document.getElementById('kalender-set-hijri');
  const spanTHActive = document.getElementById('kalender-th-active');

  async function refreshActiveHijri() {
    try {
      const res = await fetch('/api/settings/umum');
      if (res.ok) {
        const d = await res.json();
        const thRaw = d && d.tahun_hijri_aktif ? d.tahun_hijri_aktif : '-';
        if (spanTHActive) spanTHActive.textContent = thRaw;
        if (inpTH && thRaw !== '-') inpTH.value = thRaw;
        // Prefill tahun Hijri pada form kalender jika masih kosong.
        // tahun_hijri_aktif bisa pasangan "1447/1448"; ambil tahun kedua (berjalan)
        // agar prefill berupa satu angka tahun Hijri yang valid.
        if (thRaw !== '-') {
          const hijriNums = String(thRaw).split('/').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
          const prefYear = hijriNums.length >= 2 ? hijriNums[1] : (hijriNums[0] || null);
          if (prefYear) TRIPLES.forEach((p) => { if (!els[p].thn.value) els[p].thn.value = String(prefYear); });
        }
      }
    } catch (_) {}
  }

  if (btnSetHijri) {
    btnSetHijri.addEventListener('click', async () => {
      const th = inpTH.value.trim();
      if (!th) { alert('Isi Tahun Hijriyah dulu.'); return; }
      try {
        const currentTA = spanActive ? spanActive.textContent : '';
        const res = await fetch('/api/settings/umum', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tahun_ajaran_aktif: currentTA || inpTA.value.trim(), tahun_hijri_aktif: th }),
        });
        if (!res.ok) throw new Error('Gagal menyimpan tahun Hijri');
        await refreshActiveHijri();
        alert('Tahun Hijriyah aktif berhasil disimpan!');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ta = inpTA.value.trim();
    if (!ta) { alert('Isi Tahun Ajaran dulu.'); return; }
    const b = buildEntries();
    if (b.error) { alert(b.error); return; }
    if (!confirm(`Simpan kalender akademik ${ta}?\nDaftar hadir akan otomatis masuk semester sesuai rentang ini.`)) return;
    try {
      const res = await fetch('/api/kalender/hijri-semester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b.entries),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Gagal menyimpan kalender');
      }
      alert('Kalender akademik tersimpan!');
    } catch (err) {
      alert(err.message);
    }
  });

  // Prefill tahun ajaran aktif, tampilkan indikator, lalu muat kalendernya.
  (async () => {
    await refreshActiveHijri();
    const ta = await refreshActiveTA();
    if (ta) { inpTA.value = ta; loadKalender(); }
  })();
})();

console.log('Cache bust 3');
