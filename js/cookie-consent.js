/*
 * ATO cookie consent banner — staged (disabled today)
 * ----------------------------------------------------
 * This script is bundled so the infrastructure exists, but it does NOT show
 * a banner until at least one non-essential category is registered via
 * AtoCookies.register(...). Today we have zero non-essential trackers.
 *
 * When the time comes to add Sentry, Plausible, PostHog, GA4, or any marketing
 * pixel, register the category here and the banner activates.
 *
 * Public API:
 *   AtoCookies.register({ key, label, description, categoryRequired, runWhenAccepted, runWhenRejected })
 *   AtoCookies.openPreferences()       // re-open the preferences modal
 *   AtoCookies.getConsent(key)          // → 'accepted' | 'rejected' | 'unknown'
 *   AtoCookies.onConsent(key, callback) // run callback when consent changes
 *
 * Storage:
 *   localStorage key: 'ato-cookie-consent.v1'
 *   Format: { decisions: {<key>: 'accepted'|'rejected'}, decided_at: <iso>, version: 1, gpc: <bool> }
 *
 * GPC (Global Privacy Control):
 *   If navigator.globalPrivacyControl is true and the user has not made an
 *   explicit choice yet, ALL non-essential categories default to 'rejected'
 *   and the banner is auto-dismissed (per CCPA/CPRA + Colorado + Connecticut
 *   compliance approach).
 *
 * Strictly necessary cookies / storage:
 *   Authentication tokens, CSRF cookies, language preference. These do not
 *   pass through this consent layer — they are unavoidably required for the
 *   site/product to function.
 *
 * License: MIT (same as the rest of agentictool.ai).
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'ato-cookie-consent.v1';
  var CONSENT_VERSION = 1;

  // Registered non-essential categories. Empty today.
  // Example future entries (commented for reference):
  //
  // AtoCookies.register({
  //   key: 'analytics',
  //   label: 'Analytics',
  //   description: 'Plausible Analytics — aggregate page-view counts. Cookie-free, no personal data.',
  //   runWhenAccepted: function () {
  //     var s = document.createElement('script');
  //     s.src = 'https://plausible.io/js/script.js';
  //     s.defer = true;
  //     s.dataset.domain = 'agentictool.ai';
  //     document.head.appendChild(s);
  //   },
  //   runWhenRejected: function () {
  //     // Plausible doesn't set cookies, but we still don't load the script.
  //   }
  // });
  var registry = [];
  var listeners = {};

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed.version !== CONSENT_VERSION) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // localStorage disabled — banner will re-prompt every visit. Acceptable.
    }
  }

  function gpcEnabled() {
    return !!(navigator && navigator.globalPrivacyControl);
  }

  function applyDecisions(state) {
    for (var i = 0; i < registry.length; i++) {
      var entry = registry[i];
      var decision = state.decisions[entry.key] || 'rejected';
      try {
        if (decision === 'accepted' && typeof entry.runWhenAccepted === 'function') {
          entry.runWhenAccepted();
        } else if (decision === 'rejected' && typeof entry.runWhenRejected === 'function') {
          entry.runWhenRejected();
        }
        notifyListeners(entry.key, decision);
      } catch (e) {
        // Don't let a single bad entry kill the others.
        if (window.console && console.error) console.error('AtoCookies entry failed:', entry.key, e);
      }
    }
  }

  function notifyListeners(key, decision) {
    var subs = listeners[key] || [];
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](decision); } catch (e) {}
    }
  }

  function makeDecision(decisions) {
    var state = {
      decisions: decisions,
      decided_at: new Date().toISOString(),
      version: CONSENT_VERSION,
      gpc: gpcEnabled()
    };
    writeState(state);
    applyDecisions(state);
    closeBanner();
  }

  function acceptAll() {
    var d = {};
    for (var i = 0; i < registry.length; i++) {
      d[registry[i].key] = 'accepted';
    }
    makeDecision(d);
  }

  function rejectAll() {
    var d = {};
    for (var i = 0; i < registry.length; i++) {
      d[registry[i].key] = 'rejected';
    }
    makeDecision(d);
  }

  function applyCustom() {
    var d = {};
    for (var i = 0; i < registry.length; i++) {
      var key = registry[i].key;
      var checkbox = document.getElementById('ato-cc-cb-' + key);
      d[key] = (checkbox && checkbox.checked) ? 'accepted' : 'rejected';
    }
    makeDecision(d);
  }

  function buildBanner() {
    if (document.getElementById('ato-cc-banner')) return;
    if (registry.length === 0) return; // nothing to ask about

    var bar = document.createElement('div');
    bar.id = 'ato-cc-banner';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie preferences');
    bar.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:9999',
      'background:#0f0f0f',
      'border-top:1px solid rgba(0,255,213,0.35)',
      'color:#f0f0f0',
      'padding:20px 24px',
      'font-family:-apple-system,BlinkMacSystemFont,"Space Grotesk",sans-serif',
      'font-size:14px',
      'line-height:1.5',
      'box-shadow:0 -8px 32px rgba(0,0,0,0.4)'
    ].join(';');

    var inner = document.createElement('div');
    inner.style.cssText = 'max-width:980px;margin:0 auto;display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between;';

    var msg = document.createElement('div');
    msg.style.cssText = 'flex:1;min-width:280px;color:#c0c0c0;';
    msg.innerHTML =
      '<strong style="color:#f0f0f0;display:block;margin-bottom:6px;">We use a few cookies and similar technologies.</strong>' +
      'You can accept all, reject the non-essential ones, or customize. Read more in our ' +
      '<a href="/legal/cookies.html" style="color:#00ffd5;">Cookie Notice</a>.';

    var buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    var rejectBtn = makeBtn('Reject non-essential', rejectAll, false);
    var customizeBtn = makeBtn('Customize', openCustomize, false);
    var acceptBtn = makeBtn('Accept all', acceptAll, true);

    buttons.appendChild(rejectBtn);
    buttons.appendChild(customizeBtn);
    buttons.appendChild(acceptBtn);

    inner.appendChild(msg);
    inner.appendChild(buttons);
    bar.appendChild(inner);
    document.body.appendChild(bar);
  }

  function makeBtn(label, onclick, primary) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'padding:10px 18px',
      'border-radius:4px',
      'font-family:"JetBrains Mono",monospace',
      'font-size:12px',
      'cursor:pointer',
      'font-weight:600',
      'letter-spacing:0.04em',
      primary
        ? 'background:#00ffd5;color:#0f0f0f;border:1px solid #00ffd5;'
        : 'background:transparent;color:#f0f0f0;border:1px solid rgba(255,255,255,0.2);'
    ].join(';');
    b.onclick = onclick;
    return b;
  }

  function openCustomize() {
    closeBanner();
    var modal = document.createElement('div');
    modal.id = 'ato-cc-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Cookie preferences');
    modal.style.cssText = [
      'position:fixed',
      'top:0;left:0;right:0;bottom:0',
      'z-index:10000',
      'background:rgba(0,0,0,0.7)',
      'display:flex;align-items:center;justify-content:center',
      'padding:24px',
      'font-family:-apple-system,BlinkMacSystemFont,"Space Grotesk",sans-serif'
    ].join(';');

    var card = document.createElement('div');
    card.style.cssText = [
      'background:#1a1a1a',
      'color:#f0f0f0',
      'border:1px solid rgba(255,255,255,0.12)',
      'border-radius:6px',
      'padding:32px',
      'max-width:560px',
      'width:100%',
      'max-height:80vh',
      'overflow:auto'
    ].join(';');

    var title = document.createElement('h2');
    title.textContent = 'Cookie preferences';
    title.style.cssText = 'margin:0 0 8px 0;font-size:1.4rem;color:#f0f0f0;';
    card.appendChild(title);

    var intro = document.createElement('p');
    intro.style.cssText = 'color:#c0c0c0;font-size:14px;margin-bottom:20px;';
    intro.innerHTML = 'Choose which categories to allow. You can change this any time via the &ldquo;Cookie preferences&rdquo; link in the footer.';
    card.appendChild(intro);

    var alwaysOn = document.createElement('div');
    alwaysOn.style.cssText = 'padding:14px;background:#0f0f0f;border-radius:4px;margin-bottom:14px;font-size:13px;color:#888;';
    alwaysOn.innerHTML = '<strong style="color:#f0f0f0;">Strictly necessary</strong><br>Authentication, security, language preference. Always active. Cannot be disabled.';
    card.appendChild(alwaysOn);

    for (var i = 0; i < registry.length; i++) {
      var entry = registry[i];
      var row = document.createElement('div');
      row.style.cssText = 'padding:14px;background:#0f0f0f;border-radius:4px;margin-bottom:14px;font-size:13px;color:#c0c0c0;display:flex;gap:12px;align-items:flex-start;';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'ato-cc-cb-' + entry.key;
      cb.style.cssText = 'margin-top:4px;';
      // Default: unchecked (most privacy-preserving), respecting GPC if active
      cb.checked = false;

      var labelWrap = document.createElement('label');
      labelWrap.htmlFor = cb.id;
      labelWrap.style.cssText = 'flex:1;cursor:pointer;';
      labelWrap.innerHTML =
        '<strong style="color:#f0f0f0;display:block;margin-bottom:4px;">' + escapeHtml(entry.label) + '</strong>' +
        escapeHtml(entry.description || '');

      row.appendChild(cb);
      row.appendChild(labelWrap);
      card.appendChild(row);
    }

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px;';
    actions.appendChild(makeBtn('Reject non-essential', rejectAll, false));
    actions.appendChild(makeBtn('Save preferences', applyCustom, true));
    card.appendChild(actions);

    modal.appendChild(card);
    document.body.appendChild(modal);
  }

  function closeBanner() {
    var b = document.getElementById('ato-cc-banner');
    if (b) b.parentNode.removeChild(b);
    var m = document.getElementById('ato-cc-modal');
    if (m) m.parentNode.removeChild(m);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function maybeShowBanner() {
    if (registry.length === 0) return; // nothing to ask about — banner stays dormant
    var state = readState();
    if (state) {
      // Already decided. Re-apply decisions in case the page reloaded.
      applyDecisions(state);
      return;
    }
    // GPC short-circuit: treat as "rejected all" without showing the banner.
    if (gpcEnabled()) {
      rejectAll();
      return;
    }
    // Otherwise prompt.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildBanner);
    } else {
      buildBanner();
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────
  window.AtoCookies = {
    register: function (entry) {
      if (!entry || !entry.key) return;
      registry.push(entry);
      // If the user already decided in a prior session, apply now for this entry.
      var state = readState();
      if (state && state.decisions[entry.key]) {
        var decision = state.decisions[entry.key];
        try {
          if (decision === 'accepted' && typeof entry.runWhenAccepted === 'function') {
            entry.runWhenAccepted();
          } else if (decision === 'rejected' && typeof entry.runWhenRejected === 'function') {
            entry.runWhenRejected();
          }
        } catch (e) {}
      } else {
        // No decision yet — banner will show via maybeShowBanner on next tick.
      }
    },
    openPreferences: function () {
      openCustomize();
    },
    getConsent: function (key) {
      var state = readState();
      if (!state) return 'unknown';
      return state.decisions[key] || 'unknown';
    },
    onConsent: function (key, cb) {
      if (!listeners[key]) listeners[key] = [];
      listeners[key].push(cb);
      // Fire immediately if we already have a decision.
      var state = readState();
      if (state && state.decisions[key]) cb(state.decisions[key]);
    }
  };

  // Bootstrap: run after registrations have had a chance to land.
  setTimeout(maybeShowBanner, 0);
})();
