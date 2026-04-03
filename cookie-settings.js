// Cookie settings panel (legal.html)
(function(){
  var STORAGE_KEY = 'charming_cookie_prefs';
  var analyticsEl = document.getElementById('cookie-analytics');
  var marketingEl = document.getElementById('cookie-marketing');
  var saveBtn = document.getElementById('cookie-save-prefs');
  var acceptAllBtn = document.getElementById('cookie-page-accept-all');
  var msg = document.getElementById('cookie-save-msg');
  if (!saveBtn) return;

  // Load saved prefs into toggles
  var saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    var p = JSON.parse(saved);
    if (analyticsEl) analyticsEl.checked = !!p.analytics;
    if (marketingEl) marketingEl.checked = !!p.marketing;
  }

  function save(prefs) {
    prefs.ts = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    if (typeof gtag === 'function') {
      gtag('consent','update',{
        'analytics_storage': prefs.analytics ? 'granted' : 'denied',
        'ad_storage': prefs.marketing ? 'granted' : 'denied',
        'ad_user_data': prefs.marketing ? 'granted' : 'denied',
        'ad_personalization': prefs.marketing ? 'granted' : 'denied'
      });
    }
    // Hide banner if still visible
    var banner = document.getElementById('cookie-banner');
    if (banner) { banner.classList.remove('is-visible'); banner.addEventListener('transitionend', function(){ banner.remove(); }, {once:true}); }
    // Show confirmation
    if (msg) { msg.textContent = 'ההעדפות נשמרו בהצלחה'; msg.style.display = 'block'; setTimeout(function(){ msg.style.display = 'none'; }, 3000); }
  }

  saveBtn.addEventListener('click', function(){
    save({ analytics: analyticsEl.checked, marketing: marketingEl.checked });
  });
  acceptAllBtn.addEventListener('click', function(){
    analyticsEl.checked = true;
    marketingEl.checked = true;
    save({ analytics: true, marketing: true });
  });
})();
