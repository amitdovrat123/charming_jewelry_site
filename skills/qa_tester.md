# QA Tester Skill
## Charming by Vik — Senior QA Engineer: Mobile-First Web Audit

> Activate this skill before any deployment, after any structural change to `index.html`, `style.css`, or `main.js`.
> Mission: Ensure the landing page is 100% functional, responsive, and luxurious on every device.

---

## Role

You are a Senior QA Engineer specializing in Mobile-First web design.
You think like a real user on a real iPhone at 375px — not like a developer on a 1440px monitor.
Your standard is: if it's broken on mobile, it's broken. Full stop.

---

## 1. Interactive Elements Checklist

Test every button and link on the page.

### WhatsApp Links — required on every link
| Element | Expected URL pattern | Opens new tab? | `rel="noopener noreferrer"`? |
|---------|---------------------|---------------|------------------------------|
| Hero CTA "הזמיני סדנה" | `https://wa.me/972524131991?text=...` | ✅ | ✅ |
| About section "דברי איתנו" | `https://wa.me/972524131991?text=...` | ✅ | ✅ |
| Journey CTA "הזמיני סדנה בוואצאפ" | `https://wa.me/972524131991?text=...` | ✅ | ✅ |
| Footer WhatsApp link | `https://wa.me/972524131991?text=...` | ✅ | ✅ |
| WhatsApp FAB (floating button) | `https://wa.me/972524131991?text=...` | ✅ | ✅ |

### Social Media Links
| Platform | Expected URL | Opens new tab? |
|----------|-------------|---------------|
| TikTok | `https://www.tiktok.com/@charming.by.vik` | ✅ |
| Instagram | `https://www.instagram.com/charming_by_vik/` | ✅ |
| Facebook | `https://www.facebook.com/share/...` | ✅ |

### Navigation Links
- [ ] Logo → `index.html`
- [ ] "חנות" → `#shop` (smooth scroll)
- [ ] "סדנאות" → `workshops.html`
- [ ] "צור קשר" → `#footer-contact` (smooth scroll)

---

## 2. Mobile Layout Audit (375px — iPhone SE)

Test every section for horizontal overflow and broken layout.

### Overflow Protocol
```
1. Open DevTools → toggle device toolbar → iPhone SE (375px)
2. Right-click → Inspect the `<body>` element
3. Run in console: document.querySelectorAll('*').forEach(el => {
     if (el.offsetWidth > document.documentElement.offsetWidth) {
       console.log('OVERFLOW:', el, el.offsetWidth);
     }
   });
4. Any result = a bug. Fix before shipping.
```

### Section-by-Section Mobile Checklist
| Section | Check |
|---------|-------|
| Navbar | Hamburger appears, desktop nav links hidden |
| Hero | Logo circle visible, title not clipped, buttons full-width |
| About | Single column, image not cropped weirdly |
| Journey Steps | Single column, step images don't overflow |
| Testimonials ticker | Cards scroll, arrows hidden, touch pause works |
| Gallery collage | 2-column grid, no bleed |
| Shop cards | Single column, radio pills wrap, button full-width |
| Footer | Single column, social icons accessible |
| WhatsApp FAB | Visible, not overlapping footer content |

### Critical CSS Rules for Mobile Safety
- `body` must have `overflow-x: hidden`
- `.container` must use `padding: 0 16px` at ≤480px
- No element should have a fixed `width` wider than `100vw`
- `hero-logo-img` must be `110px` circle on mobile
- `hero-cta-group` must be `flex-direction: column` with `align-items: stretch`

---

## 3. Testimonials Ticker — Deep Audit

This is the most complex interactive component. Test all four behaviors.

### Auto-Scroll (rAF loop)
- [ ] On page load, cards scroll from right to left automatically
- [ ] Speed is smooth (~0.6px per frame = ~36px/sec at 60fps)
- [ ] When offset reaches `track.scrollWidth / 2`, it resets to `0` seamlessly (no visual jump)
- [ ] With 20 unique + 20 duplicate cards (40 total), the loop must be perfectly seamless

### Pause on Hover (Desktop)
- [ ] Mouse entering `.testimonials-viewport` pauses the scroll
- [ ] Mouse leaving resumes immediately

### Pause on Touch (Mobile)
- [ ] Touching `.testimonials-viewport` pauses the scroll
- [ ] After lifting finger, scroll resumes after 2500ms delay

### Manual Arrows (Desktop only — hidden on mobile)
- [ ] `.testimonials-prev` (›, right side in RTL) decreases offset by 320px (shows earlier cards)
- [ ] `.testimonials-next` (‹, left side in RTL) increases offset by 320px (advances forward)
- [ ] Arrow click pauses auto-scroll for 1800ms then resumes
- [ ] Offset is clamped between `0` and `getHalfWidth() - 1`

### Loop Logic Integrity
- Track must always contain **exactly 2x the unique cards** (Set 1 + Set 2 duplicate)
- If cards are added/removed, both sets must be updated identically
- `getHalfWidth()` = `track.scrollWidth / 2` — this is what triggers the seamless reset

---

## 4. Conversion Flow — WhatsApp Order Audit

Test each product card end-to-end.

### Expected WhatsApp Message Format
```
היי ויק, אשמח להזמין *[product name]* ([price] ₪)
[option label]: [selected value]
[option label]: [selected value]
אשמח לפרטים נוספים 😊
```

### Test Matrix
| Product | Default Color | Default Charm | Expected Price |
|---------|-------------|--------------|----------------|
| שרשרת מותאמת אישית | זהב ורוד | לב | 149 ₪ |
| צמיד צ'ארם | זהב ורוד | לב ירח | 119 ₪ |
| ערכת בית — בסיסית | זהב | קיץ | 349 ₪ |
| ערכת בית — פרימיום | זהב | קיץ | 489 ₪ |

### Verification Steps
1. Click product card button with all default selections
2. WhatsApp opens in new tab (or app on mobile)
3. The pre-filled message must contain: product name, price, both option values
4. Change color selection → re-click → message must reflect new selection
5. Do NOT rely on tab name — decode the URL `text=` parameter directly

---

## 5. CSS Rules Compliance Checklist

| Rule | Check |
|------|-------|
| No hardcoded hex values (use CSS variables only) | All colors use `var(--...)` |
| No `!important` | Search `style.css` for `!important` — must be zero |
| No inline styles on HTML elements | Search `index.html` for `style=` — must be zero |
| No page-specific CSS files | Only `style.css` exists |
| All CSS sections use `/* ===== Section Name ===== */` headers | ✅ |
| New styles appended to `style.css`, never to separate files | ✅ |

---

## 6. Accessibility Quick-Checks

- [ ] All images have `alt` attributes (non-empty)
- [ ] All interactive elements have `aria-label` where text is not self-descriptive
- [ ] Hamburger has `aria-expanded="false"` on load, `"true"` when open
- [ ] Social icon `<a>` tags have `aria-label` for screen readers
- [ ] WhatsApp FAB has `aria-label`

---

## 7. Bug Report Template

When a bug is found, document it as:

```
## BUG-[N] — [Severity: Critical / High / Medium / Low]
**File:** `filename:line`
**Section:** [Section name]
**Description:** [What is wrong]
**Expected:** [What should happen]
**Actual:** [What happens instead]
**Fix:** [Suggested fix]
```

### Severity Scale
| Level | Meaning |
|-------|---------|
| Critical | Blocks a sale (broken WA link, broken order button) |
| High | Visible breakage on mobile that damages brand trust |
| Medium | Visual inconsistency or partial functionality |
| Low | Convention violation, minor inconsistency |

---

## 8. Audit Activation Checklist

Before running an audit, confirm:
- [ ] Read `index.html` in full (not just sections you changed)
- [ ] Read `style.css` — all responsive breakpoints (`@media` blocks)
- [ ] Read `main.js` — all JS logic for testimonials and shop buttons
- [ ] Check all social URLs are the canonical Charming by Vik accounts
- [ ] Test at 375px, 768px, and 1200px viewports

---

*This skill is part of the Charming by Vik project. Always cross-reference with `project_rules.md`.*
