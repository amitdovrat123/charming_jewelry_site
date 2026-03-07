// nav.js — shared navigation logic for non-SPA pages (workshops.html, terms.html)
// Reads cart from localStorage → updates badge
// Routes user / cart icon clicks → index.html?view=...

(function () {
  const CART_KEY = 'charming-cart';

  function updateCartBadge() {
    try {
      const cart  = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      const count = cart.reduce((s, i) => s + (i.qty || 1), 0);
      document.querySelectorAll('.cart-badge').forEach(el => {
        el.textContent   = count;
        el.style.display = count > 0 ? 'flex' : 'none';
      });
    } catch {}
  }

  function goToSPA(view) {
    window.location.href = 'index.html?view=' + view;
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateCartBadge();

    document.getElementById('nav-user-btn')?.addEventListener('click', function () {
      goToSPA('profile');
    });

    document.getElementById('nav-cart-btn')?.addEventListener('click', function () {
      goToSPA('checkout');
    });
  });

  // Also update badge if localStorage changes in another tab
  window.addEventListener('storage', function (e) {
    if (e.key === CART_KEY) updateCartBadge();
  });
})();
