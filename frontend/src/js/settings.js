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


// --- Kalender Kuartal ---
// Admin cukup isi tanggal MULAI tiap kuartal + akhir tahun. Akhir kuartal N
// dihitung otomatis = sehari sebelum mulai kuartal N+1; kuartal terakhir sampai
// akhir tahun. Disimpan ke kalender_kuartal via POST /api/kalender (array).
(function initKalenderSettings() {
  const form = document.getElementById('form-kalender');
  if (!form) return;

  const inpTA = document.getElementById('kalender-ta');
  const k = [1, 2, 3, 4].map((n) => document.getElementById('kalender-k' + n));
  const inpAkhir = document.getElementById('kalender-akhir');
  const btnLoad = document.getElementById('kalender-load');
  const btnSetActive = document.getElementById('kalender-set-active');
  const spanActive = document.getElementById('kalender-ta-active');
  const preview = document.getElementById('kalender-preview');

  // Tambah/kurangi hari pada tanggal 'YYYY-MM-DD' (zona lokal).
  function addDays(iso, delta) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Bangun baris kuartal dari input (hanya kuartal yang tanggal mulainya diisi).
  // return: { rows } atau { error }.
  function buildRows() {
    const ta = inpTA.value.trim();
    const akhir = inpAkhir.value;
    const filled = [];
    for (let i = 0; i < 4; i++) {
      if (k[i].value) filled.push({ kuartal: i + 1, mulai: k[i].value });
    }
    for (let i = 1; i < filled.length; i++) {
      if (filled[i].mulai <= filled[i - 1].mulai) {
        return { error: 'Tanggal mulai kuartal harus urut menaik (K1 < K2 < K3 < K4).' };
      }
    }
    if (akhir && filled.length && akhir < filled[filled.length - 1].mulai) {
      return { error: 'Akhir tahun tidak boleh sebelum tanggal mulai kuartal terakhir.' };
    }
    const rows = filled.map((f, idx) => {
      let selesai;
      if (idx < filled.length - 1) selesai = addDays(filled[idx + 1].mulai, -1);
      else selesai = akhir || f.mulai;
      return { kuartal: f.kuartal, tahun_ajaran: ta, tgl_mulai: f.mulai, tgl_selesai: selesai };
    });
    return { rows };
  }

  function renderPreview() {
    const b = buildRows();
    if (b.error) { preview.innerHTML = `<span class="text-red-500">${b.error}</span>`; return; }
    if (!b.rows || !b.rows.length) { preview.textContent = ''; return; }
    const smt = (q) => (q <= 2 ? '1' : '2');
    const tipe = (q) => (q % 2 !== 0 ? 'Tamrin' : 'Ujian');
    preview.innerHTML = b.rows
      .map((r) => `Kuartal ${r.kuartal} (${tipe(r.kuartal)} Smt ${smt(r.kuartal)}): <b>${r.tgl_mulai}</b> → <b>${r.tgl_selesai}</b>`)
      .join('<br>');
  }

  async function loadKalender() {
    const ta = inpTA.value.trim();
    if (!ta) { alert('Isi Tahun Ajaran dulu.'); return; }
    try {
      const res = await fetch(`/api/kalender?tahun_ajaran=${encodeURIComponent(ta)}`);
      const data = (await res.json()) || [];
      k.forEach((el) => (el.value = ''));
      inpAkhir.value = '';
      (Array.isArray(data) ? data : []).forEach((row) => {
        if (row.kuartal >= 1 && row.kuartal <= 4) k[row.kuartal - 1].value = row.tgl_mulai || '';
        if (row.kuartal === 4) inpAkhir.value = row.tgl_selesai || '';
      });
      renderPreview();
    } catch (e) {
      alert('Gagal memuat kalender.');
    }
  }

  [...k, inpAkhir].forEach((el) => el.addEventListener('change', renderPreview));
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

  // Jadikan tahun ajaran yang diketik sebagai tahun aktif global.
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

  // Tahun Hijriyah Aktif
  const inpTH = document.getElementById('kalender-th');
  const btnSetHijri = document.getElementById('kalender-set-hijri');
  const spanTHActive = document.getElementById('kalender-th-active');

  async function refreshActiveHijri() {
    try {
      const res = await fetch('/api/settings/umum');
      if (res.ok) {
        const d = await res.json();
        const th = d && d.tahun_hijri_aktif ? d.tahun_hijri_aktif : '-';
        if (spanTHActive) spanTHActive.textContent = th;
        if (inpTH && th !== '-') inpTH.value = th;
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

  refreshActiveHijri();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ta = inpTA.value.trim();
    if (!ta) { alert('Isi Tahun Ajaran dulu.'); return; }
    const b = buildRows();
    if (b.error) { alert(b.error); return; }
    if (!b.rows.length) { alert('Isi minimal tanggal mulai Kuartal 1.'); return; }
    try {
      const res = await fetch('/api/kalender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b.rows),
      });
      if (!res.ok) throw new Error('Gagal menyimpan kalender');
      alert('Kalender kuartal tersimpan!');
    } catch (err) {
      alert(err.message);
    }
  });

  // Prefill tahun ajaran aktif, tampilkan indikatornya, lalu muat kalendernya.
  (async () => {
    const ta = await refreshActiveTA();
    if (ta) { inpTA.value = ta; loadKalender(); }
  })();
})();

// --- Mapping Bulan Hijriyah -> Semester (Absensi Manual) ---
// Setiap bulan Hijri (1-12) pada satu tahun Hijri dipetakan ke Semester 1/2.
// Saat absensi manual disimpan, sistem otomatis menandai semesternya dari
// mapping ini. Menyimpan mapping juga meng-update baris absensi manual lama.
(function initHijriSemesterMap() {
  const grid = document.getElementById('hsm-grid');
  if (!grid) return;

  const inpTahun = document.getElementById('hsm-tahun');
  const btnLoad = document.getElementById('hsm-load');
  const btnSave = document.getElementById('hsm-save');
  const spanStatus = document.getElementById('hsm-status');

  const BULAN = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal',
    'Jumadil Akhir', 'Rajab', "Sya'ban", 'Ramadhan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah'];

  // Default tahun = tahun Hijri aktif dari settings umum.
  (async () => {
    try {
      const res = await fetch('/api/settings/umum');
      if (res.ok) {
        const d = await res.json();
        if (d && d.tahun_hijri_aktif) inpTahun.value = d.tahun_hijri_aktif;
      }
    } catch (_) {}
  })();

  function renderGrid(mapping) {
    const sem = {};
    (mapping || []).forEach((m) => { sem[m.bulan_hijri] = m.semester; });
    grid.innerHTML = BULAN.map((nama, i) => {
      const bulan = i + 1;
      const cur = sem[bulan] || 0;
      return `<div class="flex items-center gap-2 bg-gray-50 dark:bg-slate-700/50 rounded-xl px-3 py-2">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">${bulan}. ${nama}</span>
        <select id="hsm-b${bulan}" class="glass-input px-2 py-1.5 rounded-lg text-sm w-32">
          <option value="0"${cur === 0 ? ' selected' : ''}>— Belum —</option>
          <option value="1"${cur === 1 ? ' selected' : ''}>Semester 1</option>
          <option value="2"${cur === 2 ? ' selected' : ''}>Semester 2</option>
        </select>
      </div>`;
    }).join('');
  }

  async function loadMapping() {
    const th = parseInt(inpTahun.value, 10);
    if (!th || th < 1300 || th > 1600) { alert('Isi tahun Hijriyah yang valid.'); return; }
    try {
      const res = await fetch(`/api/kalender/hijri-semester?tahun_hijri=${th}`);
      if (!res.ok) throw new Error('Gagal memuat mapping');
      const data = await res.json();
      renderGrid(data);
      const mapped = (data || []).length;
      spanStatus.textContent = mapped
        ? `${mapped} bulan sudah ter-mapping untuk tahun ${th}.`
        : `Belum ada mapping untuk tahun ${th}. Pilih semester tiap bulan lalu Simpan.`;
    } catch (e) {
      alert(e.message || 'Gagal memuat mapping.');
    }
  }

  btnLoad.addEventListener('click', loadMapping);

  btnSave.addEventListener('click', async () => {
    const th = parseInt(inpTahun.value, 10);
    if (!th || th < 1300 || th > 1600) { alert('Isi tahun Hijriyah yang valid.'); return; }
    const entries = [];
    let unmapped = 0;
    for (let b = 1; b <= 12; b++) {
      const sel = document.getElementById('hsm-b' + b);
      const s = parseInt(sel ? sel.value : '0', 10);
      if (s === 1 || s === 2) entries.push({ tahun_hijri: th, bulan_hijri: b, semester: s });
      else unmapped++;
    }
    if (!entries.length) { alert('Pilih semester minimal untuk satu bulan.'); return; }
    if (!confirm(unmapped ? `Ada ${unmapped} bulan belum di-mapping (dibiarkan tanpa semester). Lanjut simpan?` : 'Simpan mapping ini?')) return;
    try {
      const res = await fetch('/api/kalender/hijri-semester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries),
      });
      if (!res.ok) throw new Error('Gagal menyimpan mapping');
      alert('Mapping tersimpan! Baris absensi manual bulan terkait otomatis di-update semesternya.');
      loadMapping();
    } catch (e) {
      alert(e.message);
    }
  });

  renderGrid([]);
})();

console.log('Cache bust 2');
