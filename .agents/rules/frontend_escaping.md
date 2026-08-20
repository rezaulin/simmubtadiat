---
description: Constraints for frontend HTML escaping to prevent double-escaping issues.
---

# Frontend HTML Escaping Guardrails

**CRITICAL CONSTRAINT:** DO NOT implement local `escapeHtml` or manually escape HTML entities when rendering data in the frontend components (e.g., `alumni.js`, `rapot.js`, etc.).

**Context:**
This repository uses a global XSS sanitizer (`frontend/src/js/xss.js`) that automatically intercepts `Response.prototype.json()` and recursively escapes all API responses (replacing `&`, `<`, `>`, `"`, and `'` with their HTML entities).

**Rules:**
1. Assume all data fetched from `/api/*` endpoints via JSON is **already safe** and HTML-escaped.
2. Using local `escapeHtml` functions on this data will cause **double-escaping bugs** (e.g., the apostrophe `'` becomes `&#39;` via `xss.js`, and local escaping turns the `&` into `&amp;`, resulting in `&amp;#39;` rendering literally on the page).
3. If you must use a fallback value or process the string, simply return the string as is, for example: `const nama = item.nama || '-';`
