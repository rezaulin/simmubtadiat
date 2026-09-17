// CSRF-aware fetch wrapper.
// Reads csrf_token cookie and injects X-CSRF-Token header on non-GET requests.
// Drop-in replacement for window.fetch.
(function() {
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  const _origFetch = window.fetch;
  window.fetch = function(url, opts) {
    opts = opts || {};
    const method = (opts.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      const csrf = getCookie('csrf_token');
      if (csrf) {
        opts.headers = opts.headers || {};
        if (opts.headers instanceof Headers) {
          opts.headers.set('X-CSRF-Token', csrf);
        } else {
          opts.headers['X-CSRF-Token'] = csrf;
        }
      }
    }
    return _origFetch.call(this, url, opts);
  };

  console.log('CSRF-aware fetch active');
})();
