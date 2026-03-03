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

// ===== Testimonials Auto-Scroll =====
(function () {
  const track    = document.getElementById('testimonialsTrack');
  const viewport = document.getElementById('testimonialsViewport');
  const prevBtn  = document.querySelector('.testimonials-prev');
  const nextBtn  = document.querySelector('.testimonials-next');

  if (!track || !viewport) return;

  let offset  = 0;
  let paused  = false;
  const SPEED = 0.6; // px per rAF frame (~36px/sec at 60fps)
  const CARD_STEP = 320; // approx card width + gap

  function getHalfWidth() {
    return track.scrollWidth / 2;
  }

  function tick() {
    if (!paused) {
      offset += SPEED;
      if (offset >= getHalfWidth()) offset = 0;
      track.style.transform = 'translateX(-' + offset + 'px)';
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  // Pause on hover
  viewport.addEventListener('mouseenter', () => { paused = true; });
  viewport.addEventListener('mouseleave', () => { paused = false; });

  // Pause on touch
  viewport.addEventListener('touchstart', () => { paused = true; }, { passive: true });
  viewport.addEventListener('touchend', () => {
    setTimeout(() => { paused = false; }, 2500);
  }, { passive: true });

  // Manual arrows
  function clampOffset(val) {
    return Math.max(0, Math.min(val, getHalfWidth() - 1));
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      paused = true;
      offset = clampOffset(offset + CARD_STEP);
      track.style.transform = 'translateX(-' + offset + 'px)';
      setTimeout(() => { paused = false; }, 1800);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      paused = true;
      offset = clampOffset(offset - CARD_STEP);
      track.style.transform = 'translateX(-' + offset + 'px)';
      setTimeout(() => { paused = false; }, 1800);
    });
  }
})();

// ===== Shop — Product Order Buttons → WhatsApp =====
(function () {
  const WA_NUMBER = '972524131991';

  document.querySelectorAll('.shop-order-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card    = btn.closest('.shop-card');
      const product = btn.dataset.product || '';
      const price   = btn.dataset.price   || '';

      // Collect all selected radio options within this card
      const parts = [];
      card.querySelectorAll('.option-group').forEach(group => {
        const label   = group.querySelector('.option-label');
        const checked = group.querySelector('input[type="radio"]:checked');
        if (label && checked) {
          parts.push(label.textContent.trim().replace(/:$/, '') + ': ' + checked.value);
        }
      });

      let message = 'היי ויק, אשמח להזמין *' + product + '*';
      if (price) message += ' (' + price + ' ₪)';
      if (parts.length) message += '\n' + parts.join('\n');
      message += '\nאשמח לפרטים נוספים 😊';

      const url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(message);
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  });
})();
