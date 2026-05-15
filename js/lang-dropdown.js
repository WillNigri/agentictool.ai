/*
 * ATO language dropdown toggle
 * ----------------------------
 * Wires up `<div class="lang-dropdown">` instances:
 *   - Click on the button toggles `data-open` on the parent
 *   - Click anywhere outside closes any open dropdowns
 *   - Esc key closes any open dropdown
 *   - aria-expanded is kept in sync for screen readers
 *
 * No external dependencies. ~700 bytes minified.
 */
(function () {
  'use strict';

  function closeAll() {
    document.querySelectorAll('.lang-dropdown[data-open="true"]').forEach(function (d) {
      d.dataset.open = 'false';
      var btn = d.querySelector('.lang-dropdown-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function onButtonClick(e) {
    var btn = e.currentTarget;
    var parent = btn.parentElement;
    if (!parent || !parent.classList.contains('lang-dropdown')) return;
    e.stopPropagation();
    var wasOpen = parent.dataset.open === 'true';
    closeAll();
    if (!wasOpen) {
      parent.dataset.open = 'true';
      btn.setAttribute('aria-expanded', 'true');
    }
  }

  function init() {
    document.querySelectorAll('.lang-dropdown-btn').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', onButtonClick);
    });
    document.addEventListener('click', function (e) {
      var open = document.querySelector('.lang-dropdown[data-open="true"]');
      if (open && !open.contains(e.target)) closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
