(function () {
  function resolvedTheme() {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function updateButton(theme) {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var sun  = btn.querySelector('.theme-icon-sun');
    var moon = btn.querySelector('.theme-icon-moon');
    if (theme === 'light') {
      sun.style.display  = 'none';
      moon.style.display = 'inline';
      btn.setAttribute('aria-label', 'Switch to dark mode');
    } else {
      sun.style.display  = 'inline';
      moon.style.display = 'none';
      btn.setAttribute('aria-label', 'Switch to light mode');
    }
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', theme === 'light' ? '#f0f3fa' : '#0c0f14');
  }

  function init() {
    var theme = resolvedTheme();
    updateButton(theme);

    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = resolvedTheme() === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      location.reload();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
