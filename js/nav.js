// Site navigation, shared by every page.
//
// One list (PAGES) renders the whole nav, in three presentations chosen by
// viewport width and set as <html data-nav="…">:
//   ≥1440px      expanded rail (default), user-collapsible, remembered
//   1281–1439px  collapsed icon rail; the page layouts need the width
//   ≤1280px      off-canvas drawer opened by the header Menu button
//
// Loaded synchronously right after the empty <nav id="sideNav"> at the top of
// <body>, so the nav and the page offset exist before first paint.
//
// To add a section: give its heading an id and add [id, label] to the page's
// `sections` below.
//
// Icons: Line Awesome 1.3.0 by Icons8 (MIT / Good Boy License), inlined.

(function () {
  var ICONS = {
    'cloud-sun': 'M 9 6 L 9 9.09375 C 8.367188 9.222656 7.773438 9.496094 7.25 9.84375 L 5.0625 7.625 L 3.625 9.0625 L 5.84375 11.25 C 5.496094 11.773438 5.222656 12.367188 5.09375 13 L 2 13 L 2 15 L 5.125 15 C 5.253906 15.628906 5.507813 16.199219 5.84375 16.71875 L 3.625 18.9375 L 4.25 19.5625 C 4.113281 20.019531 4 20.5 4 21 C 4 23.757813 6.242188 26 9 26 L 25 26 C 27.757813 26 30 23.757813 30 21 C 30 18.980469 28.789063 17.179688 26.96875 16.40625 C 26.6875 13.988281 24.65625 12.097656 22.1875 12 C 21.125 10.152344 19.164063 9 17 9 C 16.773438 9 16.5625 9.007813 16.34375 9.03125 L 14.9375 7.625 L 12.75 9.84375 C 12.226563 9.507813 11.628906 9.253906 11 9.125 L 11 6 Z M 10 11 C 10.765625 11 11.445313 11.285156 11.96875 11.75 C 11.707031 12.152344 11.472656 12.597656 11.3125 13.0625 C 9.730469 13.332031 8.460938 14.542969 8.09375 16.09375 C 8.039063 16.101563 7.988281 16.113281 7.9375 16.125 C 7.378906 15.582031 7 14.847656 7 14 C 7 12.332031 8.332031 11 10 11 Z M 17 11 C 18.605469 11 20.054688 11.960938 20.6875 13.4375 L 20.96875 14.125 L 21.875 14.03125 C 21.917969 14.023438 21.953125 14 22 14 C 23.652344 14 24.996094 15.351563 25 16.9375 L 24.96875 17.90625 L 25.75 18.09375 C 27.082031 18.433594 28 19.636719 28 21 C 28 22.652344 26.652344 24 25 24 L 9 24 C 7.347656 24 6 22.652344 6 21 C 6 19.347656 7.347656 18 9 18 L 10 18 L 10 17 C 10 15.898438 10.894531 15.003906 11.90625 15 L 12.90625 15.0625 L 13.09375 14.21875 C 13.46875 12.359375 15.101563 11 17 11 Z',
    'chart-line': 'M 27.21875 5.375 L 23.71875 9.75 L 20.4375 8.09375 L 19.65625 7.71875 L 19.15625 8.4375 L 15.75 13.5625 L 12.59375 11.1875 L 12 10.75 L 11.40625 11.1875 L 7.78125 13.90625 L 4.25 13.03125 L 3.75 14.96875 L 7.75 15.96875 L 8.21875 16.09375 L 8.59375 15.8125 L 12 13.25 L 15.40625 15.8125 L 16.25 16.4375 L 16.84375 15.5625 L 20.34375 10.3125 L 23.5625 11.90625 L 24.28125 12.25 L 28.78125 6.625 Z M 20.0625 18.3125 L 19.21875 19.375 L 15.8125 23.625 L 12.59375 21.1875 L 12 20.75 L 11.40625 21.1875 L 7.90625 23.8125 L 4.4375 22.09375 L 3.5625 23.90625 L 7.5625 25.90625 L 8.09375 26.15625 L 8.59375 25.8125 L 12 23.25 L 15.40625 25.8125 L 16.1875 26.375 L 16.78125 25.625 L 19.90625 21.71875 L 23.15625 26.5625 L 23.9375 27.6875 L 24.78125 26.625 L 28.78125 21.625 L 27.21875 20.375 L 24.09375 24.28125 L 20.84375 19.4375 Z',
    'water': 'M 0 7 C 0 8.625 1.832031 10 4 10 C 5.1875 10 6.261719 9.582031 7 8.941406 C 7.738281 9.582031 8.8125 10 10 10 C 11.1875 10 12.261719 9.582031 13 8.941406 C 13.738281 9.582031 14.8125 10 16 10 C 17.1875 10 18.261719 9.582031 19 8.941406 C 19.738281 9.582031 20.8125 10 22 10 C 23.1875 10 24.261719 9.582031 25 8.941406 C 25.738281 9.582031 26.8125 10 28 10 C 30.167969 10 32 8.625 32 7 L 30 7 C 30 7.304688 29.242188 8 28 8 C 26.777344 8 26 7.296875 26 7 L 24 7 C 24 7.304688 23.242188 8 22 8 C 20.777344 8 20 7.296875 20 7 L 18 7 C 18 7.304688 17.242188 8 16 8 C 14.777344 8 14 7.296875 14 7 L 12 7 C 12 7.304688 11.246094 8 10 8 C 8.777344 8 8 7.296875 8 7 L 6 7 C 6 7.304688 5.246094 8 4 8 C 2.777344 8 2 7.296875 2 7 Z M 0 15 C 0 16.625 1.832031 18 4 18 C 5.1875 18 6.261719 17.582031 7 16.941406 C 7.738281 17.582031 8.8125 18 10 18 C 11.1875 18 12.261719 17.582031 13 16.941406 C 13.738281 17.582031 14.8125 18 16 18 C 17.1875 18 18.261719 17.582031 19 16.941406 C 19.738281 17.582031 20.8125 18 22 18 C 23.1875 18 24.261719 17.582031 25 16.941406 C 25.738281 17.582031 26.8125 18 28 18 C 30.167969 18 32 16.625 32 15 L 30 15 C 30 15.304688 29.242188 16 28 16 C 26.777344 16 26 15.296875 26 15 L 24 15 C 24 15.304688 23.242188 16 22 16 C 20.777344 16 20 15.296875 20 15 L 18 15 C 18 15.304688 17.242188 16 16 16 C 14.777344 16 14 15.296875 14 15 L 12 15 C 12 15.304688 11.246094 16 10 16 C 8.777344 16 8 15.296875 8 15 L 6 15 C 6 15.304688 5.246094 16 4 16 C 2.777344 16 2 15.296875 2 15 Z M 0 23 C 0 24.625 1.832031 26 4 26 C 5.1875 26 6.261719 25.582031 7 24.941406 C 7.738281 25.582031 8.8125 26 10 26 C 11.1875 26 12.261719 25.582031 13 24.941406 C 13.738281 25.582031 14.8125 26 16 26 C 17.1875 26 18.261719 25.582031 19 24.941406 C 19.738281 25.582031 20.8125 26 22 26 C 23.1875 26 24.261719 25.582031 25 24.941406 C 25.738281 25.582031 26.8125 26 28 26 C 30.167969 26 32 24.625 32 23 L 30 23 C 30 23.304688 29.242188 24 28 24 C 26.777344 24 26 23.296875 26 23 L 24 23 C 24 23.304688 23.242188 24 22 24 C 20.777344 24 20 23.296875 20 23 L 18 23 C 18 23.304688 17.242188 24 16 24 C 14.777344 24 14 23.296875 14 23 L 12 23 C 12 23.304688 11.246094 24 10 24 C 8.777344 24 8 23.296875 8 23 L 6 23 C 6 23.304688 5.246094 24 4 24 C 2.777344 24 2 23.296875 2 23 Z',
    'tree': 'M 16 3.59375 L 15.28125 4.28125 L 9.34375 10.25 L 8.34375 11.21875 L 9.625 11.84375 C 9.625 11.84375 10.640625 12.210938 12.0625 12.53125 L 7.65625 16.9375 L 6.65625 17.90625 L 7.90625 18.53125 C 7.90625 18.53125 8.984375 18.835938 9.53125 19.03125 L 5.9375 22.625 L 4.96875 23.625 L 6.21875 24.25 C 6.21875 24.25 8.65625 25.425781 13 25.84375 L 13 29 L 15 29 L 15 25.96875 C 15.335938 25.980469 15.648438 26 16 26 C 16.351563 26 16.664063 25.980469 17 25.96875 L 17 29 L 19 29 L 19 25.84375 C 23.351563 25.425781 25.8125 24.25 25.8125 24.25 L 27.03125 23.625 L 26.0625 22.625 L 22.46875 19.03125 C 23.015625 18.835938 24.09375 18.53125 24.09375 18.53125 L 25.34375 17.90625 L 24.34375 16.9375 L 19.9375 12.53125 C 21.359375 12.210938 22.375 11.84375 22.375 11.84375 L 23.65625 11.21875 L 22.65625 10.25 L 16.71875 4.28125 Z M 16 6.4375 L 20 10.40625 C 19.40625 10.605469 19.285156 10.761719 17.8125 10.90625 L 16 11.09375 L 14.1875 10.90625 C 12.714844 10.761719 12.59375 10.605469 12 10.40625 Z M 16 11.4375 L 17.1875 12.59375 L 21.78125 17.1875 C 21.316406 17.351563 21.328125 17.40625 20.375 17.59375 L 18.53125 17.96875 L 19.875 19.28125 L 23.53125 22.9375 C 22.257813 23.394531 20.078125 24 16 24 C 11.960938 24 9.789063 23.394531 8.5 22.9375 L 12.125 19.28125 L 13.46875 17.96875 L 11.625 17.59375 C 10.671875 17.40625 10.683594 17.351563 10.21875 17.1875 L 14.8125 12.59375 Z',
    'industry': 'M 20 5 L 20 10.46875 L 17 12.25 L 17 9.21875 L 15.5 10.15625 L 12 12.25 L 12 9.21875 L 10.5 10.15625 L 5.5 13.15625 L 5 13.4375 L 5 27 L 27 27 L 27 5 Z M 22 7 L 25 7 L 25 25 L 7 25 L 7 14.53125 L 10 12.75 L 10 15.78125 L 11.5 14.84375 L 15 12.75 L 15 15.78125 L 16.5 14.84375 L 21.5 11.84375 L 22 11.5625 Z M 9 17 L 9 19 L 11 19 L 11 17 Z M 13 17 L 13 19 L 15 19 L 15 17 Z M 17 17 L 17 19 L 19 19 L 19 17 Z M 21 17 L 21 19 L 23 19 L 23 17 Z M 9 21 L 9 23 L 11 23 L 11 21 Z M 13 21 L 13 23 L 15 23 L 15 21 Z M 17 21 L 17 23 L 19 23 L 19 21 Z M 21 21 L 21 23 L 23 23 L 23 21 Z',
    'info-circle': 'M 16 3 C 8.832031 3 3 8.832031 3 16 C 3 23.167969 8.832031 29 16 29 C 23.167969 29 29 23.167969 29 16 C 29 8.832031 23.167969 3 16 3 Z M 16 5 C 22.085938 5 27 9.914063 27 16 C 27 22.085938 22.085938 27 16 27 C 9.914063 27 5 22.085938 5 16 C 5 9.914063 9.914063 5 16 5 Z M 15 10 L 15 12 L 17 12 L 17 10 Z M 15 14 L 15 22 L 17 22 L 17 14 Z',
    'angle-down': 'M 4.21875 10.78125 L 2.78125 12.21875 L 15.28125 24.71875 L 16 25.40625 L 16.71875 24.71875 L 29.21875 12.21875 L 27.78125 10.78125 L 16 22.5625 Z',
    'angle-double-left': 'M 15.90625 4.78125 L 4.6875 16 L 15.90625 27.21875 L 17.3125 25.78125 L 7.53125 16 L 17.3125 6.21875 Z M 22.90625 4.78125 L 11.6875 16 L 22.90625 27.21875 L 24.3125 25.78125 L 14.53125 16 L 24.3125 6.21875 Z'
  };

  var PAGES = [
    { href: 'index.html', label: 'Weather', short: 'Weather', icon: 'cloud-sun', sections: [
      ['section-forecast', 'Forecast'],
      ['section-map', 'Weather map'],
      ['section-aq', 'Air quality']
    ] },
    { href: 'history.html', label: 'History', short: 'History', icon: 'chart-line', sections: [
      ['section-climate', 'Climate trends'],
      ['section-jetstream', 'Jet stream & vortex'],
      ['section-historical', 'Historical data']
    ] },
    { href: 'sea.html', label: 'Sea', short: 'Sea', icon: 'water', sections: [
      ['section-water-level', 'Sea level'],
      ['section-sst', 'Surface temperature'],
      ['section-enso', 'El Niño'],
      ['section-polar-ice', 'Polar ice'],
      ['section-currents-live', 'Ocean currents'],
      ['section-paleo', 'Paleocoastlines']
    ] },
    { href: 'forest.html', label: 'Land Cover', short: 'Land', icon: 'tree', sections: [
      ['section-landcover', 'Current state'],
      ['section-landcover-change', 'Change 2001–2024'],
      ['section-grassland', 'Grassland']
    ] },
    { href: 'footprint.html', label: 'Footprint', short: 'Footprint', icon: 'industry', sections: [] },
    { href: 'about.html', label: 'About', short: 'About', icon: 'info-circle', sections: [] }
  ];

  var nav = document.getElementById('sideNav');
  if (!nav) return;
  var root = document.documentElement;

  function svg(name, cls) {
    return '<svg class="' + cls + '" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="' + ICONS[name] + '"/></svg>';
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // Cloudflare Pages serves /history for history.html, and / for index.html
  var path = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';

  // ── Render ────────────────────────────────────────────────────────────────
  var html = '<div class="sn-top">' +
      '<a class="sn-logo" href="index.html"><img src="img/climalens.svg" width="32" height="32" alt="ClimaLens home"></a>' +
      '<button class="sn-close" type="button" aria-label="Close navigation">&#x2715;</button>' +
    '</div><ul class="sn-pages">';

  PAGES.forEach(function (p, i) {
    var current = p.href.replace(/\.html$/, '') === path;
    var has = p.sections.length > 0;
    var secId = 'sn-sec-' + i;
    html += '<li class="sn-item' + (current ? ' current' : '') + (current && has ? ' open' : '') + '">' +
      '<div class="sn-row">' +
        '<a class="sn-page" href="' + p.href + '"' + (current ? ' aria-current="page"' : '') + '>' +
          svg(p.icon, 'sn-icon') +
          '<span class="sn-label">' + esc(p.label) + '</span>' +
          '<span class="sn-short" aria-hidden="true">' + esc(p.short) + '</span>' +
        '</a>' +
        (has ? '<button class="sn-disclose" type="button" aria-expanded="' + (current ? 'true' : 'false') + '" aria-controls="' + secId + '" aria-label="' + esc(p.label) + ' sections">' + svg('angle-down', 'sn-chevron') + '</button>' : '') +
      '</div>';
    if (has) {
      html += '<ul class="sn-sections" id="' + secId + '">' +
        '<li class="sn-flyout-title"><a href="' + p.href + '" tabindex="-1">' + esc(p.label) + '</a></li>';
      p.sections.forEach(function (s) {
        html += '<li><a href="' + (current ? '' : p.href) + '#' + s[0] + '">' + esc(s[1]) + '</a></li>';
      });
      html += '</ul>';
    }
    html += '</li>';
  });

  html += '</ul><div class="sn-bottom">' +
      '<button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle theme">' +
        '<span class="theme-icon-sun" aria-hidden="true">☀</span>' +
        '<span class="theme-icon-moon" aria-hidden="true">◑</span>' +
      '</button>' +
      '<button class="sn-collapse" type="button" aria-label="Collapse navigation" aria-expanded="true">' + svg('angle-double-left', 'sn-collapse-icon') + '</button>' +
    '</div>';
  nav.innerHTML = html;

  // ── Mode (expanded / collapsed / drawer) ──────────────────────────────────
  var STORE = 'navCollapsed';
  var mqDrawer = window.matchMedia('(max-width: 1280px)');
  var mqWide   = window.matchMedia('(min-width: 1440px)');
  var collapseBtn = nav.querySelector('.sn-collapse');

  function storedCollapsed() {
    try { return localStorage.getItem(STORE) === '1'; } catch (e) { return false; }
  }
  function applyMode() {
    var m = mqDrawer.matches ? 'drawer' : (!mqWide.matches || storedCollapsed()) ? 'collapsed' : 'expanded';
    if (m !== 'drawer') closeDrawer(false);
    root.setAttribute('data-nav', m);
    // 1281–1439px is collapsed by necessity, so there's nothing to expand to
    collapseBtn.hidden = !mqWide.matches;
    collapseBtn.setAttribute('aria-expanded', m === 'expanded' ? 'true' : 'false');
    collapseBtn.setAttribute('aria-label', m === 'expanded' ? 'Collapse navigation' : 'Expand navigation');
  }

  collapseBtn.addEventListener('click', function () {
    try { localStorage.setItem(STORE, root.getAttribute('data-nav') === 'expanded' ? '1' : '0'); } catch (e) {}
    applyMode();
    // The content width changed without a window resize: let Leaflet maps and
    // other resize listeners re-measure
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  });

  // ── Drawer (≤1280px) ──────────────────────────────────────────────────────
  var overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  var hamburger = null;

  function openDrawer() {
    nav.classList.add('open');
    overlay.classList.add('open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    var first = nav.querySelector('.sn-item.current .sn-page') || nav.querySelector('.sn-page');
    if (first) first.focus();
  }
  function closeDrawer(restoreFocus) {
    if (!nav.classList.contains('open')) return;
    nav.classList.remove('open');
    overlay.classList.remove('open');
    if (hamburger) {
      hamburger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) hamburger.focus();
    }
  }

  nav.querySelector('.sn-close').addEventListener('click', function () { closeDrawer(true); });
  overlay.addEventListener('click', function () { closeDrawer(true); });

  // ── Section disclosure (expanded rail and drawer) ─────────────────────────
  nav.querySelectorAll('.sn-disclose').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.closest('.sn-item').classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  // ── Flyouts (collapsed rail) ──────────────────────────────────────────────
  // Open on hover or focus via CSS. Touch screens have no hover, so the first
  // tap on a page icon opens its flyout and a second tap navigates.
  var noHover = window.matchMedia('(hover: none)');
  function isCollapsed() { return root.getAttribute('data-nav') === 'collapsed'; }
  function closeFlyouts(except) {
    nav.querySelectorAll('.sn-item.flyout-open').forEach(function (it) {
      if (it !== except) it.classList.remove('flyout-open');
    });
  }

  nav.querySelectorAll('.sn-item').forEach(function (item) {
    var page = item.querySelector('.sn-page');
    if (item.querySelector('.sn-sections')) {
      page.addEventListener('click', function (e) {
        if (!isCollapsed() || !noHover.matches || item.classList.contains('flyout-open')) return;
        e.preventDefault();
        closeFlyouts(item);
        item.classList.add('flyout-open');
      });
    }
    // Re-arm a dismissed flyout only when the pointer returns to the icon:
    // hiding the flyout fires mouseleave, which would otherwise reopen it
    item.querySelector('.sn-row').addEventListener('mouseenter', function () { item.classList.remove('flyout-dismissed'); });
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) item.classList.remove('flyout-dismissed', 'flyout-open');
    });
  });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) closeFlyouts(null); });

  // ── Keyboard: Esc closes the drawer / dismisses a flyout; Tab stays in the drawer
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (nav.classList.contains('open')) { closeDrawer(true); return; }
      var item = document.activeElement && document.activeElement.closest && document.activeElement.closest('.sn-item');
      if (isCollapsed() && item && nav.contains(item)) {
        item.classList.add('flyout-dismissed');
        item.classList.remove('flyout-open');
        item.querySelector('.sn-page').focus();
      }
    } else if (e.key === 'Tab' && nav.classList.contains('open')) {
      var f = Array.prototype.filter.call(nav.querySelectorAll('a[href], button'), function (el) {
        return el.offsetParent !== null && el.tabIndex >= 0;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ── Same-page section links: eased scroll ─────────────────────────────────
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function scrollToSection(target) {
    var targetY = target.getBoundingClientRect().top + window.scrollY - 16;
    if (reduceMotion.matches) { window.scrollTo(0, targetY); return; }
    var startY = window.scrollY, dist = targetY - startY, duration = 900, t0 = null;
    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var step = function (ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / duration, 1);
      window.scrollTo(0, startY + dist * ease(p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  nav.querySelectorAll('.sn-sections a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      closeDrawer(false);
      var item = a.closest('.sn-item');
      if (isCollapsed()) { item.classList.add('flyout-dismissed'); item.classList.remove('flyout-open'); }
      scrollToSection(target);
    });
  });

  // In-page links to a section (a.section-link) scroll the same way. Delegated,
  // because this script runs before the page content exists.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.section-link[href^="#"]');
    var target = a && document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    scrollToSection(target);
  });

  // ── Wire-up ───────────────────────────────────────────────────────────────
  applyMode();
  if (mqDrawer.addEventListener) {
    mqDrawer.addEventListener('change', applyMode);
    mqWide.addEventListener('change', applyMode);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(overlay);
    hamburger = document.getElementById('navHamburger');
    if (hamburger) hamburger.addEventListener('click', openDrawer);
  });

  // Arriving at page.html#section: content above loads async and pushes the
  // section down, so re-align once everything has loaded
  window.addEventListener('load', function () {
    var target = location.hash && document.getElementById(location.hash.slice(1));
    if (target) setTimeout(function () { window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 16); }, 0);
  });
})();
