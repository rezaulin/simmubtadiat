
// Global XSS Sanitizer intercepting fetch JSON responses
const originalJson = Response.prototype.json;

function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return escapeHTML(obj);
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeObject(obj[i]);
    }
  } else if (typeof obj === 'object') {
    for (let key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        obj[key] = sanitizeObject(obj[key]);
      }
    }
  }
  return obj;
}

Response.prototype.json = function() {
  const url = this.url || '';
  return originalJson.call(this).then(data => {
    // Auto-apply role UI when /api/me is fetched
    if (url.endsWith('/api/me') && data && (data.roles || data.role)) {
      const activeRole = Array.isArray(data.roles) ? data.roles[0] : data.role;
      if (typeof window.applyRoleUI === 'function') {
        window.applyRoleUI(data.roles || data.role);
      }
      if (typeof window.renderBottomNav === 'function') {
        window.renderBottomNav(activeRole);
      }
    }
    return sanitizeObject(data);
  });
};

console.log("XSS Sanitizer active");

// Roles allowed to perform write actions (create/update/delete) globally.
// Pimpinan is the only full administrator.
window.isAdminRole = function(roles) {
  if (Array.isArray(roles)) {
    return roles.includes('pimpinan') || roles.includes('admin');
  }
  return roles === 'pimpinan' || roles === 'admin';
};

// Roles allowed to WRITE to Alumni & Dewan Harian: pimpinan only.
// Admin is a READ-ONLY viewer for those features, so their write buttons must
// be gated on this stricter check — NOT isAdminRole (which also matches admin).
window.isPimpinanRole = function(roles) {
  if (Array.isArray(roles)) {
    return roles.includes('pimpinan');
  }
  return roles === 'pimpinan';
};

// Role-based UI hiding

// Canonical RBAC menu access map (single source of truth).
// Every page's synchronous head-guard MUST embed a list identical to this one.
// See design.md → Data Models → MenuAccess for the canonical values.
const MENU_ACCESS = {
  pimpinan: ['/index.html', '/santri.html', '/perpindahan.html', '/kelas.html', '/penilaian.html', '/absensi-manual.html', '/rapot.html', '/pengajar.html', '/dewan-harian.html', '/arsip.html', '/alumni.html', '/rekap.html', '/catatan.html', '/settings.html', '/pengajar-purna.html'],
  admin: ['/index.html', '/santri.html', '/pengajar.html', '/pengajar-purna.html', '/alumni.html', '/dewan-harian.html'],
  mufatish: ['/index.html', '/santri.html', '/penilaian.html', '/absensi-manual.html', '/rapot.html', '/pengajar.html', '/dewan-harian.html', '/arsip.html', '/rekap.html', '/catatan.html'],
  mustahiq: ['/index.html', '/santri.html', '/perpindahan.html', '/penilaian.html', '/rapot.html', '/rekap.html', '/catatan.html', '/pengajar.html', '/dewan-harian.html'],
  muroqib: ['/index.html', '/santri.html', '/absensi-manual.html', '/catatan.html', '/dewan-harian.html', '/pengajar.html'],
  tim_rapot: ['/index.html', '/penilaian.html', '/rapot.html', '/rekap.html'],
  keamanan: ['/index.html', '/santri.html', '/arsip.html', '/alumni.html', '/catatan.html'],
  wali_santri: ['/index.html', '/rapot.html']
};

// Pure function: compute the links a role or array of roles is allowed to see.
// Returns an empty array for unknown/empty roles so no disallowed menu leaks.
function computeAllowedLinks(roles) {
  if (Array.isArray(roles)) {
    let allowed = new Set();
    for (const r of roles) {
      if (Object.prototype.hasOwnProperty.call(MENU_ACCESS, r)) {
        MENU_ACCESS[r].forEach(link => allowed.add(link));
      }
    }
    return Array.from(allowed);
  }
  return Object.prototype.hasOwnProperty.call(MENU_ACCESS, roles) ? MENU_ACCESS[roles] : [];
}

// Expose on window so plain-page scripts and head-guards can reference the
// single source of truth without importing the module.
window.MENU_ACCESS = MENU_ACCESS;
window.computeAllowedLinks = computeAllowedLinks;

// Active Bottom_Nav marking (Requirement 3.3)

// CSS classes applied to the nav link matching the active page.
const ACTIVE_NAV_CLASSES = ['text-indigo-600', 'dark:text-indigo-400'];

// Pure function: given the active page pathname and a list of nav items
// (each with an `href`), return the single item whose href matches the
// pathname, or null when none match. Matching is exact pathname equality;
// when multiple items share the same href, the first match wins so the
// result is deterministic.
function resolveActiveNav(pathname, items) {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (item && item.href === pathname) return item;
  }
  return null;
}

// DOM effect: read the current pathname, collect every `a[data-nav]` link,
// resolve the matching item, then apply the active classes to that link and
// remove them from all others (non-active state).
function markActiveNav() {
  const links = Array.from(document.querySelectorAll('a[data-nav]'));
  const pathname = window.location.pathname;
  const items = links.map(link => ({ href: link.getAttribute('href'), el: link }));
  const active = resolveActiveNav(pathname, items);

  links.forEach(link => {
    if (active && active.el === link) {
      link.classList.add(...ACTIVE_NAV_CLASSES);
    } else {
      link.classList.remove(...ACTIVE_NAV_CLASSES);
    }
  });

  return active;
}

const BOTTOM_NAV = {
  default: [
    { href: '/index.html', icon: 'home', label: 'Beranda' },
    { href: '/santri.html', icon: 'users', label: 'Santri' },
    { href: '/absensi-manual.html', icon: 'clipboard-check', label: 'Absen' },
    { href: '/penilaian.html', icon: 'file-check-2', label: 'Nilai' }
  ],
  admin: [
    { href: '/index.html', icon: 'home', label: 'Beranda' },
    { href: '/santri.html', icon: 'users', label: 'Santri' },
    { href: '/pengajar.html', icon: 'graduation-cap', label: 'Pengajar' },
    { id: 'btn-mobile-logout', icon: 'log-out', label: 'Keluar', isAction: true }
  ],
  keamanan: [
    { href: '/index.html', icon: 'home', label: 'Beranda' },
    { href: '/santri.html', icon: 'users', label: 'Santri' },
    { href: '/alumni.html', icon: 'graduation-cap', label: 'Alumni' },
    { href: '/catatan.html', icon: 'alert-triangle', label: 'Pelanggaran' }
  ],
  muroqib: [
    { href: '/index.html', icon: 'home', label: 'Beranda' },
    { href: '/santri.html', icon: 'users', label: 'Santri' },
    { href: '/absensi-manual.html', icon: 'clipboard-check', label: 'Absen' },
    { href: '/catatan.html', icon: 'alert-triangle', label: 'Pelanggaran' },
    { href: '/dewan-harian.html', icon: 'user-check', label: 'Dewan Harian' },
    { href: '/pengajar.html', icon: 'book-open', label: 'Pengajar' }
  ],
  mustahiq: [
    { href: '/index.html', icon: 'home', label: 'Beranda' },
    { href: '/santri.html', icon: 'users', label: 'Santri' },
    { href: '/rekap.html', icon: 'clipboard-check', label: 'Absen' },
    { href: '/penilaian.html', icon: 'file-check-2', label: 'Nilai' }
  ]
};

window.renderBottomNav = function(role) {
  const navContainer = document.querySelector('nav.md\\:hidden > div');
  if (!navContainer) return;
  
  let navItems = BOTTOM_NAV.default;
  if (role && BOTTOM_NAV[role]) {
    navItems = BOTTOM_NAV[role];
  }

  // Preserve the FAB if it exists
  const fab = navContainer.querySelector('.absolute.left-1\\/2');
  let newHtml = '';
  
  navItems.forEach((item, index) => {
    // Insert FAB spacer in the middle (after 2 items)
    if (index === 2) {
      newHtml += '<div class="w-1/5 h-full pointer-events-none"></div>';
    }
    
    if (item.isAction) {
      newHtml += `
        <button id="${item.id}" class="w-1/5 flex flex-col items-center gap-1 text-gray-400 hover:text-red-600 transition-colors bg-transparent border-none p-0 cursor-pointer">
          <i data-lucide="${item.icon}" class="w-5 h-5"></i>
          <span class="text-[10px] font-semibold">${item.label}</span>
        </button>
      `;
    } else {
      newHtml += `
        <a href="${item.href}" data-nav class="w-1/5 flex flex-col items-center gap-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          <i data-lucide="${item.icon}" class="w-5 h-5"></i>
          <span class="text-[10px] font-semibold">${item.label}</span>
        </a>
      `;
    }
  });

  if (fab) {
    navContainer.innerHTML = newHtml;
    navContainer.appendChild(fab);
  } else {
    navContainer.innerHTML = newHtml;
  }
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
  markActiveNav();
  
  // Attach event listener for dynamic logout action if rendered
  const logoutBtn = document.getElementById('btn-mobile-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      window.location.href = '/login.html';
    });
  }
};

// Expose so plain-page scripts can reference them without importing the module.
window.resolveActiveNav = resolveActiveNav;
window.markActiveNav = markActiveNav;

// Global Search badge resolution (Requirements 5.2, 5.3)
//
// Pure function: given a search-result item, compute the presentation used by
// the global search list — the avatar color classes, the badge label, the
// destination href, and the subtext line. Kept side-effect free so it can be
// unit/property tested without a DOM.
//
// Branching by item.tipe:
//   - 'santri' with data_utama.status === 'pengabdian' → label 'PENGABDIAN',
//     purple badge, subtext carrying khidmah_tempat (Requirements 5.2, 5.3).
//   - other 'santri' → label 'SANTRI', emerald badge, stambuk/bagian subtext.
//   - 'alumni' → label 'ALUMNI', amber badge.
//   - anything else (pengajar) → label 'PENGAJAR', blue badge.
// Santri and alumni both navigate to profil-santri.html?id=... so navigation
// stays consistent for pengabdian santri.
function searchBadgeFor(item) {
  item = item || {};
  if (item.tipe === 'santri') {
    const sd = item.data_utama || {};
    const href = `/profil-santri.html?id=${item.id}`;
    if (sd.status === 'pengabdian') {
      return {
        color: 'bg-purple-100 text-purple-600',
        label: 'PENGABDIAN',
        href,
        subtext: `Khidmah: ${sd.khidmah_tempat || '-'}`
      };
    }
    return {
      color: 'bg-emerald-100 text-emerald-600',
      label: 'SANTRI',
      href,
      subtext: `Stambuk: ${sd.stambuk || item.detail || '-'} | ${sd.bagian || 'Belum di kelas'}`
    };
  }
  if (item.tipe === 'alumni') {
    return {
      color: 'bg-amber-100 text-amber-600',
      label: 'ALUMNI',
      href: `/profil-santri.html?id=${item.id}`,
      subtext: `Stambuk: ${item.detail || '-'}`
    };
  }
  if (item.tipe === 'dewan_harian') {
    return {
      color: 'bg-indigo-100 text-indigo-600',
      label: 'DEWAN HARIAN',
      href: `/dewan-harian.html#${item.id}`,
      subtext: item.detail || '-'
    };
  }
  return {
    color: 'bg-blue-100 text-blue-600',
    label: 'PENGAJAR',
    href: `/pengajar.html#${item.id}`,
    subtext: item.detail || '-'
  };
}

window.searchBadgeFor = searchBadgeFor;

// Mark the active Bottom_Nav link once the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
  markActiveNav();
});

window.applyRoleUI = function(role) {
  window._roleApplied = true;
  window.currentUserRoles = Array.isArray(role) ? role : [role];

  const allowed = computeAllowedLinks(role);
  
  // Hide sidebar links, mobile bottom nav links, AND dashboard quick-action
  // shortcuts ([data-menu-link]) that are not allowed for this role.
  document.querySelectorAll('aside nav a, nav.md\\:hidden a, [data-menu-link]').forEach(link => {
    const href = link.getAttribute('href');
    // Item di Bottom_Nav ponsel (nav.md:hidden) memakai layout 4-slot dengan FAB
    // di tengah. Menghapusnya (display:none) membuat sisa item bergeser & menumpuk
    // di bawah FAB. Maka untuk Bottom_Nav dipakai `invisible` (tetap memakan ruang)
    // agar posisi tetap sejajar; sidebar & shortcut tetap pakai `!hidden` (collapse).
    const parentNav = link.closest('nav');
    const inBottomNav = parentNav && parentNav.classList.contains('md:hidden');
    if (href && !allowed.includes(href)) {
      if (inBottomNav) {
        link.classList.add('invisible', 'pointer-events-none');
      } else {
        link.classList.add('!hidden'); // using !hidden to force override display:flex
      }
    } else {
      link.classList.remove('!hidden', 'invisible', 'pointer-events-none');
    }
  });
  
  // Also hide section headers (<li> with uppercase text) if all their links are hidden
  document.querySelectorAll('aside nav li.uppercase').forEach(li => {
     let next = li.nextElementSibling;
     let hasVisible = false;
     while(next && next.tagName === 'LI') {
       const link = next.querySelector('a');
       if (link) {
           if(!link.classList.contains('!hidden')) {
             hasVisible = true;
             break;
           }
       } else if (next.classList.contains('uppercase')) {
           // Reached the next section
           break;
       }
       next = next.nextElementSibling;
     }
     if(!hasVisible) li.classList.add('!hidden');
     else li.classList.remove('!hidden');
  });
  
  // Backwards compatibility for <p> headers if any exist
  document.querySelectorAll('aside nav p').forEach(p => {
     let next = p.nextElementSibling;
     let hasVisible = false;
     while(next && next.tagName === 'A') {
       if(!next.classList.contains('!hidden')) {
         hasVisible = true;
         break;
       }
       next = next.nextElementSibling;
     }
     if(!hasVisible) p.classList.add('!hidden');
     else p.classList.remove('!hidden');
  });

  // Reveal the nav now that the correct items are resolved. The synchronous
  // head guard keeps nav items invisible until this class is applied, which
  // prevents disallowed (e.g. admin) menus from flashing on reload.
  document.querySelectorAll('aside nav, nav.md\\:hidden').forEach(n => n.classList.add('role-ready'));
};

// Guarantee applyRoleUI runs even if page JS doesn't call response.json()
document.addEventListener('DOMContentLoaded', () => {
    // Only fetch if we haven't already applied it (we can set a flag)
    if (!window._roleApplied) {
        let savedRole = localStorage.getItem('user_roles');
        if (!savedRole) {
            savedRole = localStorage.getItem('user_role');
        }
        if (savedRole) {
            try {
                savedRole = JSON.parse(savedRole);
            } catch (e) {
                // Ignore parsing errors and treat as string
            }
            window.applyRoleUI(savedRole);
            return;
        }
        
        fetch('/api/me').then(res => {
            if (res.ok) return res.json();
            return null;
        }).then(data => {
            if (data && (data.roles || data.role)) {
                window.applyRoleUI(data.roles || data.role);
            }
        }).catch(err => console.error("Error auto-fetching role", err));
    }
});

// Global Logout Handler
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn-desktop');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        localStorage.removeItem('user_role');
        await fetch('/api/logout', { method: 'POST' });
      } catch (e) {
        console.error('Logout error:', e);
      }
      window.location.href = '/login.html';
    });
  }
});

// Global Mobile Sidebar Drawer Handler
//
// initSidebar() wires the drawer against the current DOM and returns the
// { openSidebar, closeSidebar } controls (also exposed on window) so tests and
// page scripts can drive the drawer directly. It is called automatically on
// DOMContentLoaded for normal page behavior. Guards on a missing #app-sidebar
// (e.g. login.html / change-password.html) so it never throws when the drawer
// is absent.
function initSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const btnOpen = document.getElementById('btn-open-sidebar');
  const btnClose = document.getElementById('btn-close-sidebar');

  if (!sidebar) return null;

  // Open: slide the drawer in, show the backdrop, and lock body scroll on
  // mobile (md:overflow-auto keeps desktop scrollable). (Req 2.1, 2.6)
  function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    if (backdrop) backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden', 'md:overflow-auto');
  }

  // Close: slide the drawer out, hide the backdrop, and release the scroll
  // lock. (Req 2.2)
  function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden', 'md:overflow-auto');
  }

  if (btnOpen) btnOpen.addEventListener('click', openSidebar);   // Req 2.1
  if (btnClose) btnClose.addEventListener('click', closeSidebar); // Req 2.2
  if (backdrop) backdrop.addEventListener('click', closeSidebar); // Req 2.3

  // Close drawer when a nav link is tapped on mobile navigation. (Req 2.5)
  sidebar.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 767px)').matches) closeSidebar();
    });
  });

  // Close on Escape while the drawer is open. (Req 2.4)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // Reset drawer & backdrop when resizing up to desktop so it's never stuck
  // hidden; md:translate-x-0 restores the fixed desktop sidebar. (Req 2.7)
  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      if (backdrop) backdrop.classList.add('hidden');
      document.body.classList.remove('overflow-hidden', 'md:overflow-auto');
      sidebar.classList.add('-translate-x-full');
    }
  });

  // Mobile theme toggle in the top bar (present on pages that expose the drawer).
  const themeToggleMobile = document.getElementById('theme-toggle-mobile');
  if (themeToggleMobile) {
    themeToggleMobile.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    });
  }

  // Expose the controls so tests (jsdom/Vitest) and plain-page scripts can
  // drive the drawer without reaching into the closure.
  window.openSidebar = openSidebar;
  window.closeSidebar = closeSidebar;

  return { openSidebar, closeSidebar };
}

// Auto-init on page load; preserves the existing browser drawer behavior.
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
});


// Global focused-field visibility (Requirement 7.3)
//
// On Viewport_Mobile the virtual keyboard covers the lower half of the screen,
// which can hide the input a user just focused. A single delegated `focusin`
// listener centers any focused form field in the viewport so it stays visible
// above the keyboard. Paired with the `scroll-margin` reserved on form fields
// in style.css. Guarded so it is a no-op for non-field targets and degrades
// gracefully where scrollIntoView options are unsupported.
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (!el || !el.matches || !el.matches('input, select, textarea')) return;
  try {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch (_) {
    // Older engines: ignore unsupported options object.
  }
});


// ES module exports for tests (jsdom/Vitest) and any module consumers.
// Pages load this file with <script type="module">, so named exports do not
// break plain-page usage; browser behavior still relies on the window.* globals above.
export { MENU_ACCESS, computeAllowedLinks, resolveActiveNav, markActiveNav, initSidebar, searchBadgeFor, escapeHTML };


// ==================== GLOBAL SEARCH (semua halaman) ====================
// Logika pencarian dipindah ke sini (dimuat di SETIAP halaman) supaya tombol
// FAB bottom-nav (#btn-mobile-search) dan pintasan desktop (#btn-global-search)
// berfungsi di mana saja — bukan cuma di dashboard.
document.addEventListener('DOMContentLoaded', () => {
  // Suntikkan modal pencarian bila halaman belum punya (index.html sudah punya inline).
  if (!document.getElementById('search-modal')) {
    document.body.insertAdjacentHTML('beforeend', `
  <div id="search-modal" class="hidden fixed inset-0 z-[60] flex-col p-4 sm:p-6 md:p-12 items-center">
    <div class="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" id="search-overlay"></div>
    <div class="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl z-10 overflow-hidden flex flex-col scale-95 opacity-0 transition-all duration-300 h-[80vh] md:h-[600px]" id="search-content">
      <div class="p-4 md:p-6 border-b border-gray-100 dark:border-slate-800 relative flex items-center bg-white dark:bg-slate-900">
        <i data-lucide="search" class="w-6 h-6 text-gray-400 absolute left-8"></i>
        <input type="text" id="global-search-input" class="w-full bg-transparent border-none focus:ring-0 text-lg md:text-xl pl-12 pr-12 text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 font-medium" placeholder="Ketik NIK, Nama, atau Stambuk..." autocomplete="off">
        <button id="search-close" class="tap-target absolute right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full" aria-label="Tutup pencarian">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-3" id="search-results">
        <div class="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center" id="search-empty">
          <div class="w-20 h-20 rounded-3xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-6">
            <i data-lucide="search-x" class="w-10 h-10 text-gray-300 dark:text-slate-600"></i>
          </div>
          <p class="text-sm font-medium">Gunakan pencarian untuk menemukan Santri dengan cepat di seluruh database, termasuk arsip.</p>
        </div>
        <div id="search-results-list" class="hidden flex flex-col gap-2 pb-4"></div>
      </div>
    </div>
  </div>`);
    if (window.lucide) window.lucide.createIcons();
  }

  const modal = document.getElementById('search-modal');
  if (!modal) return;
  const overlay = document.getElementById('search-overlay');
  const content = document.getElementById('search-content');
  const closeBtn = document.getElementById('search-close');
  const input = document.getElementById('global-search-input');
  const resultsList = document.getElementById('search-results-list');
  const emptyState = document.getElementById('search-empty');
  const btnGlobalSearch = document.getElementById('btn-global-search');
  const btnMobileSearch = document.getElementById('btn-mobile-search');

  function openSearchModal() {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden'); // scroll-lock (Req 8.4)
    setTimeout(() => {
      if (content) { content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100'); }
      if (input) input.focus();
    }, 10);
  }
  function closeSearchModal() {
    if (content) { content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-95', 'opacity-0'); }
    document.body.classList.remove('overflow-hidden');
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      if (input) input.value = '';
      if (resultsList) { resultsList.innerHTML = ''; resultsList.classList.add('hidden'); }
      if (emptyState) emptyState.classList.remove('hidden');
    }, 300);
  }
  window.openSearchModal = openSearchModal;
  window.closeSearchModal = closeSearchModal;

  if (btnGlobalSearch) btnGlobalSearch.addEventListener('click', (e) => { e.preventDefault(); openSearchModal(); });
  if (btnMobileSearch) btnMobileSearch.addEventListener('click', (e) => { e.preventDefault(); openSearchModal(); });
  if (closeBtn) closeBtn.addEventListener('click', closeSearchModal);
  if (overlay) overlay.addEventListener('click', closeSearchModal);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearchModal(); }
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeSearchModal();
  });

  if (input) {
    let debounceTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      const q = e.target.value.trim();
      if (q.length < 2) {
        if (resultsList) resultsList.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }
      debounceTimeout = setTimeout(() => fetchSearchResults(q), 400);
    });
  }

  async function fetchSearchResults(query) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Pencarian gagal');
      const data = await res.json();
      if (emptyState) emptyState.classList.add('hidden');
      if (resultsList) { resultsList.classList.remove('hidden'); resultsList.innerHTML = ''; }
      if (!data || data.length === 0) {
        resultsList.innerHTML = `<div class="p-4 text-center text-gray-500 text-sm">Tidak ada hasil untuk "${query}"</div>`;
        return;
      }
      data.forEach(item => {
        const { color, label, href, subtext } = searchBadgeFor(item);
        let linkAttr = `href="${href}"`;
        if (item.tipe === 'pengajar') {
          linkAttr = `href="#" onclick="event.preventDefault(); openGlobalDetailPengajar(${item.id}, '${item.nama.replace(/'/g, "\\'")}'); return false;"`;
        }
        const html = `
          <a ${linkAttr} class="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors group">
            <div class="w-10 h-10 rounded-full ${color} flex items-center justify-center font-bold text-sm shrink-0">${(item.nama || '?').charAt(0)}</div>
            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-gray-900 dark:text-white text-sm truncate">${item.nama} <span class="px-2 py-0.5 rounded text-[10px] ${color} font-bold ml-1">${label}</span></h4>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${subtext}</p>
            </div>
          </a>`;
        resultsList.insertAdjacentHTML('beforeend', html);
      });
    } catch (err) {
      if (resultsList) resultsList.innerHTML = `<div class="p-4 text-center text-red-500 text-sm">Gagal mencari: ${err.message}</div>`;
    }
  }
});

// ==================== TOMBOL PASANG APLIKASI (PWA INSTALL) ====================
// Menampilkan tombol melayang "Pasang Aplikasi" di atas layar.
// - Chrome/Edge/Android (secure context / localhost): pakai event beforeinstallprompt
//   sehingga sekali klik memunculkan dialog install native.
// - iOS Safari: tidak ada API install; tombol menampilkan instruksi Bagikan →
//   Tambahkan ke Layar Utama.
// Tombol otomatis tersembunyi bila aplikasi sudah terpasang (display standalone).
(function initPwaInstall() {
  var deferredPrompt = null;

  function isStandalone() {
    try {
      return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isDismissed() {
    try { return sessionStorage.getItem('pwa_install_dismissed') === '1'; } catch (e) { return false; }
  }
  // Banner mengambang di atas layar (gaya app-banner): ikon + teks + tombol Pasang + tutup.
  function ensureButton() {
    var bar = document.getElementById('pwa-install-bar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'pwa-install-bar';
    bar.className = 'fixed top-0 left-0 right-0 z-[70] hidden print:hidden px-2 pt-2';
    bar.innerHTML =
      '<div class="mx-auto max-w-3xl flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-black/10 px-3 py-2">' +
        '<img src="/icon-192.png" alt="" class="w-10 h-10 rounded-xl bg-white object-contain shrink-0 ring-1 ring-gray-100 dark:ring-slate-700">' +
        '<div class="min-w-0 flex-1">' +
          '<p class="text-sm font-bold text-gray-800 dark:text-white leading-tight truncate">Pasang SIM Mubtadiat</p>' +
          '<p class="text-xs text-gray-500 dark:text-gray-400 leading-tight truncate">Buka langsung dari layar utama, lebih cepat.</p>' +
        '</div>' +
        '<button id="pwa-install-do" type="button" class="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shrink-0 transition-colors">Pasang</button>' +
        '<button id="pwa-install-close" type="button" aria-label="Tutup" class="tap-target text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 p-1.5 rounded-lg">' +
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(bar);
    bar.querySelector('#pwa-install-do').addEventListener('click', onInstallClick);
    bar.querySelector('#pwa-install-close').addEventListener('click', function () {
      try { sessionStorage.setItem('pwa_install_dismissed', '1'); } catch (e) {}
      hideButton();
    });
    return bar;
  }
  function showButton() {
    if (isStandalone() || isDismissed()) return;
    ensureButton().classList.remove('hidden');
  }
  function hideButton() {
    var bar = document.getElementById('pwa-install-bar');
    if (bar) bar.classList.add('hidden');
  }

  function onInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      var uc = deferredPrompt.userChoice;
      if (uc && uc.finally) uc.finally(function () { deferredPrompt = null; hideButton(); });
    } else if (isIOS()) {
      showIosInstructions();
    }
  }

  function showIosInstructions() {
    if (document.getElementById('pwa-ios-help')) return;
    var wrap = document.createElement('div');
    wrap.id = 'pwa-ios-help';
    wrap.className = 'fixed inset-0 z-[101] flex items-end justify-center p-4';
    wrap.innerHTML =
      '<div class="absolute inset-0 bg-black/50"></div>' +
      '<div class="relative bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl mb-6">' +
        '<h3 class="font-bold text-gray-800 dark:text-white mb-2">Pasang ke Layar Utama</h3>' +
        '<p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">Di Safari: ketuk tombol <b>Bagikan</b> (ikon kotak dengan panah ke atas) di bar bawah, lalu pilih <b>Tambahkan ke Layar Utama</b> / <b>Add to Home Screen</b>.</p>' +
        '<button id="pwa-ios-close" class="mt-4 w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-xl text-sm font-semibold">Mengerti</button>' +
      '</div>';
    document.body.appendChild(wrap);
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    wrap.querySelector('#pwa-ios-close').addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target === wrap.firstChild) close(); });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showButton();
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideButton();
  });

  function onReady() {
    try {
      if (isStandalone()) return;       // sudah terpasang → tak perlu tombol
      if (isIOS()) showButton();        // iOS: tampilkan tombol instruksi (tak ada beforeinstallprompt)
    } catch (e) { /* abaikan di lingkungan non-browser */ }
  }
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
  } catch (e) { /* abaikan */ }
})();


// ==================== TOAST NOTIFIKASI (semua halaman) ====================
// Mengganti dialog bawaan browser (window.alert -> "situs menyatakan ...") dengan
// notifikasi gaya aplikasi yang muncul melayang lalu hilang sendiri. Dimuat di
// SETIAP halaman lewat xss.js. `confirm()` (aksi destruktif) TIDAK diubah.
(function initToast() {
  function ensureContainer() {
    let c = document.getElementById('app-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'app-toast-container';
      // Melayang di atas-tengah, aman dari notch (safe-area) & di atas segalanya.
      c.style.cssText = [
        'position:fixed', 'top:calc(env(safe-area-inset-top,0px) + 16px)',
        'left:50%', 'transform:translateX(-50%)', 'z-index:2147483647',
        'display:flex', 'flex-direction:column', 'gap:8px', 'align-items:center',
        'width:calc(100% - 32px)', 'max-width:420px', 'pointer-events:none'
      ].join(';');
      document.body.appendChild(c);
    }
    return c;
  }

  // Tebak jenis pesan agar warnanya sesuai. Default: sukses/info (teal).
  function detectType(msg) {
    const m = String(msg || '').toLowerCase();
    if (/(error|gagal|tidak boleh|wajib|minimal|ditolak|salah|maksimal|dulu|pilih )/.test(m)) return 'error';
    return 'success';
  }

  window.showToast = function showToast(message, type) {
    const text = String(message == null ? '' : message);
    const kind = type || detectType(text);
    const container = ensureContainer();

    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    const isErr = kind === 'error';
    const bg = isErr ? '#dc2626' : '#0d9488'; // red-600 / teal-600
    toast.style.cssText = [
      'pointer-events:auto', 'display:flex', 'align-items:flex-start', 'gap:10px',
      'width:100%', 'box-sizing:border-box', 'padding:12px 14px', 'border-radius:16px',
      'background:' + bg, 'color:#fff', 'font-size:14px', 'line-height:1.4',
      'font-family:inherit', 'box-shadow:0 10px 30px rgba(0,0,0,0.18)',
      'opacity:0', 'transform:translateY(-8px)', 'transition:opacity .2s ease, transform .2s ease'
    ].join(';');

    const icon = document.createElement('span');
    icon.style.cssText = 'flex:0 0 auto;font-weight:700;font-size:15px;line-height:1.4';
    icon.textContent = isErr ? '⚠' : '✓';

    const span = document.createElement('span');
    span.style.cssText = 'flex:1 1 auto;word-break:break-word';
    span.textContent = text; // textContent -> aman dari HTML injection

    toast.appendChild(icon);
    toast.appendChild(span);
    container.appendChild(toast);

    // Animasi masuk.
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    const remove = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => toast.remove(), 220);
    };
    // Durasi lebih lama untuk pesan error/panjang.
    const dur = isErr || text.length > 60 ? 4500 : 3000;
    const timer = setTimeout(remove, dur);
    toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
  };

  // Alihkan semua alert() lama ke toast aplikasi tanpa mengubah tiap pemanggilan.
  window.alert = function (msg) { window.showToast(msg); };
})();

// ==================== GLOBAL PENGAJAR DETAIL MODAL ====================
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('modal-detail-pengajar-global')) {
    document.body.insertAdjacentHTML('beforeend', `
  <div id="modal-detail-pengajar-global" class="hidden fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
    <div class="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" id="modal-detail-pengajar-global-overlay"></div>
    <div class="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl z-10 overflow-hidden shadow-2xl scale-95 opacity-0 transition-all duration-300 flex flex-col max-h-[90vh]" id="modal-detail-pengajar-global-content">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h3 class="text-xl font-bold text-gray-800 dark:text-white" id="global-detail-nama-pengajar">Nama Pengajar</h3>
        <button id="modal-detail-pengajar-global-close" class="tap-target absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Tutup">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div class="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        <div>
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 dark:border-slate-700 pb-2">Informasi Pribadi</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="global-detail-pengajar-info">
            <!-- Dimuat via JS -->
          </div>
        </div>
        <div>
          <h4 class="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 uppercase tracking-wide border-b border-gray-200 dark:border-slate-700 pb-2">Riwayat Penugasan</h4>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-xl">
              <thead class="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 uppercase font-semibold text-xs border-b dark:border-slate-700">
                <tr><th class="px-6 py-4">Tingkatan</th><th class="px-6 py-4">Peran</th><th class="px-6 py-4 text-center">Tahun Ajaran</th></tr>
              </thead>
              <tbody id="global-tbody-riwayat-pengajar" class="divide-y divide-gray-100 dark:divide-slate-700/50">
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>`);
    
    document.getElementById('modal-detail-pengajar-global-close').addEventListener('click', closeGlobalDetailPengajar);
    document.getElementById('modal-detail-pengajar-global-overlay').addEventListener('click', closeGlobalDetailPengajar);
  }
});

function closeGlobalDetailPengajar() {
  const modal = document.getElementById('modal-detail-pengajar-global');
  const content = document.getElementById('modal-detail-pengajar-global-content');
  if (content) {
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
  }
  setTimeout(() => {
    if (modal) modal.classList.add('hidden');
  }, 300);
}

window.openGlobalDetailPengajar = async function(id, nama) {
  // First close search modal if open
  if (typeof closeSearchModal === 'function') {
    closeSearchModal();
  }

  const modal = document.getElementById('modal-detail-pengajar-global');
  const content = document.getElementById('modal-detail-pengajar-global-content');
  const infoContainer = document.getElementById('global-detail-pengajar-info');
  const tbodyRiwayat = document.getElementById('global-tbody-riwayat-pengajar');
  
  document.getElementById('global-detail-nama-pengajar').textContent = nama;
  infoContainer.innerHTML = '<div class="col-span-2 text-center text-gray-400">Memuat data...</div>';
  tbodyRiwayat.innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-gray-400">Memuat riwayat penugasan...</td></tr>';
  
  modal.classList.remove('hidden');
  setTimeout(() => {
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-100', 'opacity-100');
  }, 10);

  try {
    const res = await fetch('/api/pengajar/' + id);
    if (!res.ok) throw new Error('Data tidak ditemukan');
    const p = await res.json();
    
    let jenis = '-';
    if (p.status === 'mustahiq') jenis = 'Mustahiq';
    else if (p.status === 'munawwib') jenis = 'Munawwib';
    
    infoContainer.innerHTML = `
      <div><p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama (Arab)</p><p class="font-medium text-gray-900 dark:text-white" dir="rtl">${p.nama_arab || '-'}</p></div>
      <div><p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jenis Pengajar</p><p class="font-medium text-gray-900 dark:text-white">${jenis}</p></div>
      <div><p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nomor HP</p><p class="font-medium text-gray-900 dark:text-white">${p.no_hp || '-'}</p></div>
      <div><p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tempat, Tanggal Lahir</p><p class="font-medium text-gray-900 dark:text-white">${p.ttl || '-'}</p></div>
      <div><p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Wali</p><p class="font-medium text-gray-900 dark:text-white">${p.nama_wali || '-'}</p></div>
      <div><p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tahun Mulai Mengajar</p><p class="font-medium text-gray-900 dark:text-white">${p.tahun_mengajar || '-'}</p></div>
      <div class="md:col-span-2"><p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alamat Lengkap</p><p class="font-medium text-gray-900 dark:text-white">${p.alamat || '-'}</p></div>
    `;
  } catch(e) {
    infoContainer.innerHTML = '<div class="col-span-2 text-center text-red-500">Gagal memuat profil pengajar.</div>';
  }

  try {
    const res2 = await fetch('/api/penugasan?pengajar_id=' + id);
    const data = await res2.json();
    if (!data || data.length === 0) {
      tbodyRiwayat.innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-gray-400">Belum ada riwayat penugasan.</td></tr>';
      return;
    }
    tbodyRiwayat.innerHTML = '';
    data.forEach(p => {
      tbodyRiwayat.innerHTML += `
        <tr>
          <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">${p.nama_bagian}</td>
          <td class="px-4 py-3 uppercase text-xs font-bold text-gray-500">${p.peran}</td>
          <td class="px-4 py-3 text-center">${p.tahun_ajaran}</td>
        </tr>`;
    });
  } catch(e) {
    tbodyRiwayat.innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-red-500">Gagal memuat riwayat penugasan.</td></tr>';
  }
};


console.log('Cache bust 1');
