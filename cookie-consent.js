// Cookie consent banner + openCookieSettings
(function(){
  var STORAGE_KEY = 'charming_cookie_prefs';
  var saved = localStorage.getItem(STORAGE_KEY);
  if (saved) { applyConsent(JSON.parse(saved)); return; }
  var banner = document.getElementById('cookie-banner');
  if (!banner) return;
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ banner.classList.add('is-visible'); }); });
  document.getElementById('cookie-accept-all').addEventListener('click', function(){
    var prefs = {analytics:true, marketing:true, ts:Date.now()};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    applyConsent(prefs);
    banner.classList.remove('is-visible');
    banner.addEventListener('transitionend', function(){ banner.remove(); }, {once:true});
  });
  function applyConsent(p){
    if(typeof gtag==='function'){
      gtag('consent','update',{
        'analytics_storage': p.analytics ? 'granted' : 'denied',
        'ad_storage': p.marketing ? 'granted' : 'denied',
        'ad_user_data': p.marketing ? 'granted' : 'denied',
        'ad_personalization': p.marketing ? 'granted' : 'denied'
      });
    }
  }
})();
window.openCookieSettings = function(){ window.location.href = 'legal.html#cookie-settings'; };
