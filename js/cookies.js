(function () {
    var CONSENT_KEY = 'climalens_consent';
    var CLARITY_ID = 'wkozj5faqa';
    var STATCOUNTER_PROJECT = 13371610;
    var STATCOUNTER_SECURITY = '3d8aad12';

    function loadClarity() {
        (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
            t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, 'clarity', 'script', CLARITY_ID);
    }

    function loadStatcounter() {
        window.sc_project = STATCOUNTER_PROJECT;
        window.sc_invisible = 1;
        window.sc_security = STATCOUNTER_SECURITY;
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.statcounter.com/counter/counter.js';
        document.body.appendChild(s);
    }

    function loadAnalytics() {
        loadClarity();
        loadStatcounter();
    }

    function dismiss(value) {
        localStorage.setItem(CONSENT_KEY, value);
        var banner = document.getElementById('cookie-banner');
        if (banner) banner.remove();
        if (value === 'accepted') loadAnalytics();
    }

    function showBanner() {
        var banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Cookie consent');
        banner.innerHTML =
            '<p>ClimaLens uses <strong>Microsoft Clarity</strong> and <strong>Statcounter</strong> to count visitors and understand how they use this site. <a href="/about.html">Learn more</a></p>' +
            '<div class="cookie-banner-actions">' +
            '<button class="cookie-btn-reject" id="cookie-reject">Decline</button>' +
            '<button class="cookie-btn-accept" id="cookie-accept">Accept</button>' +
            '</div>';
        document.body.appendChild(banner);
        document.getElementById('cookie-accept').addEventListener('click', function () { dismiss('accepted'); });
        document.getElementById('cookie-reject').addEventListener('click', function () { dismiss('rejected'); });
    }

    var consent = localStorage.getItem(CONSENT_KEY);
    if (consent === 'accepted') {
        loadAnalytics();
    } else if (!consent) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showBanner);
        } else {
            showBanner();
        }
    }
})();
