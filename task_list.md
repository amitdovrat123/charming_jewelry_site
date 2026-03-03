# Task List — Charming by Vik Website

> This file tracks development progress. Update it as tasks are completed or new tasks are discovered.

---

## ✅ Done

- [x] Basic HTML structure — `index.html` and `workshops.html`
- [x] Hebrew copywriting — all visible text in Hebrew, RTL layout, feminine register (את)
- [x] Folder organization — `images/` structured into `logo/`, `jewelry/`, `workshop/`
- [x] Global stylesheet — `style.css` with CSS custom properties and responsive breakpoints
- [x] Design skill created — `skills/design_expert.md`
- [x] Copywriting skill created — `skills/copywriting_skill.md`
- [x] Real images integrated — step sections and workshop gallery now use real photos with fade-in animation
- [x] Homepage hero background image — `images/workshop/1112.png` applied with cream overlay for text legibility
- [x] Mobile-first strategy — hamburger menu, thumb-friendly buttons, hero magazine-cover layout, improved responsive breakpoints
- [x] WhatsApp FAB — floating button on both pages with pre-filled Hebrew message
- [x] Contact links integration — Instagram, Facebook, WhatsApp (with pre-filled message), TikTok all live on both pages
- [x] **Homepage full redesign** — High-converting landing page with:
  - [x] Hero section with logo image (`images/logo/IMG_0993.jpg`) displayed as branded circle
  - [x] About section — two-column image + text layout, mobile-stacked
  - [x] Workshop Journey — 3 visual steps (IMG_7607, 1112.png, IMG_7968) + Gift/Bonus stage with `giftimage.png`
  - [x] "הזמיני סדנה בוואצאפ" CTA button after journey
  - [x] Testimonials — `rAF`-based auto-scroll ticker, pause on hover/touch, manual arrows
  - [x] Gallery Collage — 8-image asymmetric CSS grid from `images/workshop/`
  - [x] Shop section — 4 product cards (Necklace 149₪, Bracelet 119₪, Home Kit Basic 349₪, Home Kit Premium 489₪) with color + charm radio-pill selectors
  - [x] WhatsApp order flow — JS builds contextual message with product name, price, and all selected options
  - [x] Footer enhanced — WhatsApp link + TikTok + all social icons (Instagram, Facebook)

---

## 🔲 To-Do

### 🔴 HIGH PRIORITY
- [ ] **Mobile responsive check** — manual review at 375px on a real iPhone; test hamburger menu, hero logo, journey steps, testimonials, shop cards

### 🟡 MEDIUM PRIORITY
- [ ] **Real testimonial screenshots** — replace styled placeholder cards in the testimonials ticker with actual WhatsApp screenshot images once Vik provides them
- [ ] **Product images** — verify that the 4 jewelry images selected for shop cards match the correct products; replace if needed
- [ ] **About section portrait** — add a portrait of Vik or workspace to the about section image slot (currently `IMG_8463.jpeg`)
- [ ] **Build contact form** — connect the signup form on `workshops.html` (currently `action="#"`) to Formspree or Netlify Forms

### 🟢 LOW PRIORITY
- [ ] **Charm/model images** — add a small thumbnail row within each shop card to show different charm options visually
- [ ] **Fill missing assets** — see "Missing Assets" section below

---

## 🖼️ Missing Assets

| # | Asset | Where used | Specs |
|---|-------|------------|-------|
| 1 | Real WhatsApp testimonial screenshot images | Testimonials ticker | PNG/JPG, portrait orientation, ~375×700px each |
| 2 | *(Optional)* Portrait of Vik or workspace | `index.html` — About section | Portrait or square crop, minimum 800×800px |

---

## 📁 Image Folder Map

```
images/
├── logo/        → IMG_0993.jpg (hero logo — circle display)
├── jewelry/     → product photography (bracelets, necklaces, earrings, home kits)
└── workshop/    → event and process photos
```

> Note: `images/logo/IMG_0993 (1).jpg` and `images/logo/IMG_0993.jpg` both exist. Use `IMG_0993.jpg` (no spaces).

---

## 🛍️ Shop Product Reference

| Product | Price | Image used | Color options | Charm options |
|---------|-------|------------|---------------|---------------|
| שרשרת מותאמת אישית | 149 ₪ | `images/jewelry/IMG_7326.jpeg` | זהב ורוד / כסף / זהב | לב / כוכב / אות / פרפר |
| צמיד צ'ארם | 119 ₪ | `images/jewelry/IMG_4339.jpeg` | זהב ורוד / כסף / זהב | לב ירח / פרחים / כוכבים / פרפרים |
| ערכת בית — בסיסית | 349 ₪ | `images/jewelry/IMG_5635.jpeg` | זהב / כסף | קיץ / חורף / חיות |
| ערכת בית — פרימיום | 489 ₪ | `images/jewelry/IMG_5637.jpeg` | זהב / כסף | קיץ / חורף / חיות |

---

*Last updated: 2026-03-04*
