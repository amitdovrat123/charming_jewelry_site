// Navbar: transparent → solid background on scroll
const navbar = document.querySelector('.navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// Hamburger menu toggle
const hamburger = document.querySelector('.nav-hamburger');
const navLinks  = document.querySelector('.nav-links');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close menu when any nav link is tapped
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

// ===== Testimonials Marquee — auto-scroll + drag/swipe =====
(function () {
  var m = document.querySelector('.tst-marquee');
  if (!m) return;

  var speed = 0.8; // px per frame
  var paused = false, dragging = false;
  var startX, scrollStart;

  // Auto-scroll loop
  function tick() {
    if (!paused && !dragging) {
      m.scrollLeft += speed;
      // Loop: when we've scrolled past half (the duplicate set), reset
      if (m.scrollLeft >= m.scrollWidth / 2) m.scrollLeft = 0;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Pause on hover (desktop)
  m.addEventListener('mouseenter', function () { paused = true; });
  m.addEventListener('mouseleave', function () { paused = false; dragging = false; m.classList.remove('is-dragging'); });

  // Drag (desktop + mobile)
  function onDown(e) {
    dragging = true;
    m.classList.add('is-dragging');
    startX = (e.touches ? e.touches[0].clientX : e.clientX);
    scrollStart = m.scrollLeft;
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    var x = (e.touches ? e.touches[0].clientX : e.clientX);
    m.scrollLeft = scrollStart - (x - startX);
  }
  function onUp() {
    dragging = false;
    m.classList.remove('is-dragging');
  }

  m.addEventListener('mousedown', onDown);
  m.addEventListener('mousemove', onMove);
  m.addEventListener('mouseup', onUp);
  m.addEventListener('touchstart', onDown, { passive: false });
  m.addEventListener('touchmove', onMove, { passive: true });
  m.addEventListener('touchend', onUp);
})();

// ===== Product Image Gallery (arrows) =====
(function () {
  function switchSlide(container, dir) {
    const slides = Array.from(container.querySelectorAll('.product-slide'));
    const cur = slides.findIndex(function(s) { return s.classList.contains('product-slide--active'); });
    const next = (cur + dir + slides.length) % slides.length;
    slides.forEach(function(s, i) { s.classList.toggle('product-slide--active', i === next); });
    return next;
  }

  document.querySelectorAll('.shop-card-img').forEach(function(container) {
    var prev = container.querySelector('.img-arrow--prev');
    var next = container.querySelector('.img-arrow--next');
    if (prev) prev.addEventListener('click', function(e) { e.stopPropagation(); switchSlide(container, -1); });
    if (next) next.addEventListener('click', function(e) { e.stopPropagation(); switchSlide(container, +1); });
  });

  // Expose for lightbox sync
  window._switchSlide = switchSlide;
})();

// ===== Lightbox =====
(function () {
  const lightbox    = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const closeBtn    = document.getElementById('lightboxClose');
  const prevBtn     = document.getElementById('lightboxPrev');
  const nextBtn     = document.getElementById('lightboxNext');
  if (!lightbox || !lightboxImg) return;

  var activeContainer = null;

  function syncImage() {
    if (!activeContainer) return;
    var active = activeContainer.querySelector('.product-slide--active');
    if (active) { lightboxImg.src = active.src; lightboxImg.alt = active.alt || ''; }
  }

  function openLightbox(container) {
    activeContainer = container;
    syncImage();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    activeContainer = null;
  }

  document.querySelectorAll('.shop-card-img').forEach(function(container) {
    container.addEventListener('click', function(e) {
      if (e.target.classList.contains('img-arrow')) return;
      openLightbox(container);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

  if (prevBtn) prevBtn.addEventListener('click', function() {
    if (!activeContainer) return;
    window._switchSlide(activeContainer, -1);
    syncImage();
  });

  if (nextBtn) nextBtn.addEventListener('click', function() {
    if (!activeContainer) return;
    window._switchSlide(activeContainer, +1);
    syncImage();
  });

  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function(e) {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') { window._switchSlide(activeContainer, -1); syncImage(); }
    if (e.key === 'ArrowLeft')  { window._switchSlide(activeContainer, +1); syncImage(); }
  });
})();

// ===== Card Pricing — Dynamic Total =====
(function () {
  const SHIPPING_COST = 35;

  document.querySelectorAll('.shop-card').forEach(function(card) {
    var btn = card.querySelector('.shop-order-btn');
    if (!btn) return;
    var basePrice = parseInt(btn.dataset.price) || 0;
    var noteEl  = card.querySelector('.shop-shipping-note');
    var totalEl = card.querySelector('.js-total-price');

    function updatePrice() {
      var checked = card.querySelector('.delivery-group input[type="radio"]:checked');
      var isPickup = checked && checked.value.indexOf('איסוף') !== -1;
      var total = isPickup ? basePrice : basePrice + SHIPPING_COST;
      if (noteEl) {
        noteEl.textContent = isPickup
          ? '(איסוף עצמי — חינם)'
          : '+ 35 ₪ משלוח (בהתאם לתקנון)';
      }
      if (totalEl) totalEl.textContent = total + ' ₪';
    }

    card.querySelectorAll('.delivery-group input[type="radio"]').forEach(function(r) {
      r.addEventListener('change', updatePrice);
    });
    updatePrice();
  });
})();

// ===== FAQ Accordion =====
(function () {
  document.querySelectorAll('.faq-question').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var answer = btn.nextElementSibling;
      var isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Close all others in the same category
      var allBtns = btn.closest('.faq-list').querySelectorAll('.faq-question');
      allBtns.forEach(function(other) {
        if (other !== btn) {
          other.setAttribute('aria-expanded', 'false');
          other.nextElementSibling.classList.remove('is-open');
        }
      });

      btn.setAttribute('aria-expanded', String(!isOpen));
      answer.classList.toggle('is-open', !isOpen);
    });
  });
})();

// ===== Shop — Order Buttons → WhatsApp =====
(function () {
  const WA_NUMBER = '972524131991';
  const SHIPPING_COST = 35;

  document.querySelectorAll('.shop-order-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var card    = btn.closest('.shop-card');
      var product = btn.dataset.product || '';
      var price   = parseInt(btn.dataset.price) || 0;

      // Color, charm, and other non-delivery non-personalisation selections
      var parts = [];
      card.querySelectorAll('.option-group:not(.personalisation-group):not(.delivery-group)').forEach(function(group) {
        var label   = group.querySelector('.option-label');
        var checked = group.querySelector('input[type="radio"]:checked');
        if (label && checked) {
          parts.push(label.textContent.trim().replace(/:$/, '') + ': ' + checked.value);
        }
      });

      // Delivery
      var deliveryChecked = card.querySelector('.delivery-group input[type="radio"]:checked');
      var isPickup = deliveryChecked && deliveryChecked.value.indexOf('איסוף') !== -1;
      var deliveryText = isPickup
        ? 'איסוף עצמי מראשון לציון (חינם)'
        : 'משלוח עד הבית (+35 ש"ח)';
      var totalPrice = isPickup ? price : price + SHIPPING_COST;

      // Personalisation
      var personal = card.querySelector('.personal-input');
      var personalVal = personal && personal.value.trim();

      var msg = 'היי ויק, הגעתי אלייך דרך האתר ואני מעוניינת להזמין את *' + product + '*:\n\n';
      parts.forEach(function(p) { msg += p + '\n'; });
      if (personalVal) msg += 'בחירה אישית: ' + personalVal + '\n';
      msg += '\nאופן קבלה: ' + deliveryText;
      msg += '\n\nסה"כ לתשלום: ' + totalPrice + ' ש"ח';

      window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
    });
  });
})();
