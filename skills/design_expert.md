# UI/UX Expert Skill
## Charming by Vik — Design System Guide

> Activate this skill whenever making any visual, layout, or interaction decision.
> Every pixel should feel like it belongs in a Tiffany, Cartier, or Pandora window — refined, intentional, effortless.

---

## 1. Design Philosophy

Charming by Vik is a **luxury handmade jewelry brand**. The design language must communicate:

| Principle      | What it means in practice                                                              |
|----------------|----------------------------------------------------------------------------------------|
| Minimalist     | If an element doesn't earn its place, remove it. Whitespace is a design element.       |
| Luxury         | Think Tiffany, Cartier, Pandora — refined, not flashy. Elegance over decoration.      |
| Warm           | Cold luxury feels distant. Use Cream and Rose Gold to keep the warmth alive.           |
| Feminine       | Soft curves, delicate borders, considered typography — never harsh or boxy.            |
| RTL-first      | Every layout decision must be verified in RTL context. Animations travel right-to-left.|

---

## 2. Color — Non-negotiable Rules

**Always use CSS variables. Never hardcode hex values.**

```css
/* Primary palette */
var(--sand)        /* #fdf8f5 — main background */
var(--sand-dark)   /* #e8cfc4 — borders, dividers */
var(--sand-light)  /* #ffffff — card surfaces */
var(--pink)        /* #c9957a — Rose Gold, primary accent */
var(--pink-deep)   /* #a8705a — hover states, active elements */
var(--pink-light)  /* #f5ece7 — alternate section backgrounds */
var(--ink)         /* #2c2a29 — headings */
var(--ink-soft)    /* #4a3f3c — body text */
var(--muted)       /* #9a8e8a — captions, eyebrows, placeholder text */
```

### Color usage rules:
- **Backgrounds**: alternate between `--sand` and `--pink-light` across sections for visual rhythm.
- **Borders**: use `--sand-dark` or `rgba(201,149,122,0.2)` (Rose Gold glow) — never gray.
- **Interactive accent**: `--pink` at rest → `--pink-deep` on hover.
- **Text on dark surfaces** (footer): use `rgba(255,255,255,0.85)` for body, `#fff` for headings.

---

## 3. Typography

- **Font**: `Assistant` (Google Fonts) — the only permitted body/UI font.
- **Display headings**: `Heebo` — weights 700/800/900 only, for hero titles and large section headers.
- **Eyebrow labels**: `Assistant` weight 700, `font-size: 0.75rem`, `letter-spacing: 2–3px`, `text-transform: uppercase`, color `--muted`.
- **Body**: `Assistant` weight 300–400, `line-height: 1.75–1.9`.
- **Headings**: negative `letter-spacing` (`-0.5px` to `-2px`) for a refined, typeset feel.

---

## 4. Spacing & Layout

- Container max-width: `1120px`, horizontal padding `40px` desktop / `24px` mobile.
- Section vertical padding: `110px` desktop → `80px` tablet → `64px` mobile.
- Use **generous whitespace between sections**. If it looks tight, add more space.
- Card `border-radius: 18–20px`. Buttons `border-radius: 50px` (pill shape).
- Dividers: use `1px solid var(--sand-dark)` — thin and delicate.

---

## 5. Interactions & Transitions

**Every interactive element must have a smooth transition. No bare state changes.**

### Required transition table:

| Element          | Transition rule                                              |
|------------------|--------------------------------------------------------------|
| All buttons      | `transition: background 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease` |
| Cards on hover   | `transform: translateY(-6px)` to `-8px` + Rose Gold shadow  |
| Nav links        | Animated underline from right (RTL-aware) over `0.25s`      |
| Social icons     | `transform: translateY(-3px)` + color shift over `0.25s`    |
| Images on load   | Fade in: `opacity: 0 → 1` over `0.7–0.8s ease`              |
| Form inputs      | Border color shift to `--pink` on `:focus` over `0.25s`     |

### Primary button shimmer:
On hover, the primary `.btn` gets a shimmer sweep (a `linear-gradient` pseudo-element sliding left-to-right). Background darkens to `--pink-deep`.

### Avoid:
- `transition: all` — always specify the exact properties.
- Jumpy, instant state changes on any visible element.
- `!important` to override transitions.

---

## 6. Images

- All images use `object-fit: cover` to fill their containers without distortion.
- Images inside `.step-image`, `.gallery-img`, and `.bonus-image` are `position: absolute; inset: 0;`.
- **Fade-in on load**: all page images animate in with `opacity: 0 → 1` via the `imgFadeIn` keyframe in `style.css`.
- Always include a descriptive Hebrew `alt` attribute on every `<img>`.
- Use `loading="lazy"` on all images below the fold.

### Image folder map:
```
images/
├── logo/       → brand logo variants (use IMG_0993.jpg)
├── jewelry/    → product photography for shop cards and galleries
└── workshop/   → event and process photos for step sections and workshop gallery
```

### Missing assets to request from Vik:
- **Homepage hero image**: A wide landscape/horizontal photo (minimum 1920×800px). Ideal: a flat-lay of charms and jewelry on a cream surface, or Vik's hands creating a bracelet. This image is used as the homepage hero background.

---

## 7. Mobile-First Rules

The primary audience is smartphone users. Every design decision must pass the mobile test first.

### Typography on mobile:
- Body text minimum **16px** (`font-size: 1rem`) — never smaller on any visible paragraph.
- Headings use `clamp()` so they scale gracefully: e.g. `clamp(2.4rem, 10vw, 3.2rem)`.
- Line-height minimum `1.75` for body; `1.05–1.15` for large display headings.

### Buttons must be thumb-friendly:
- Minimum height **50px** (`min-height: 50px`) on all screen sizes.
- On mobile, full-width CTAs in hero and key sections (`width: 100%`).
- Tap targets always ≥ 44×44px (Apple/Google HIG standard).

### Spacing stays generous on narrow screens:
- Section padding scales down gracefully: `110px → 72px → 60px → 52px` at breakpoints.
- Padding is controlled by `--section-pad` variable — never hard-code values in component rules.
- Cards and content blocks keep at least `16px` horizontal margin from screen edges.

### Images:
- Use `loading="lazy"` on all images below the fold (hero images excluded).
- All images in containers use `object-fit: cover` + `position: absolute; inset: 0`.
- The `imgFadeIn` keyframe animation (defined in style.css) auto-applies to all container images.

### Hero on mobile (magazine cover):
- Full viewport height: `min-height: 100svh` (with `100vh` fallback).
- Gradient fades from mostly-transparent at top to near-opaque at bottom, so image is visible but text is readable.
- Content pushed to bottom (`align-items: flex-end` on flex container).
- Text left-aligned for RTL (`text-align: start`).

### Hamburger menu:
- Shown at `≤ 768px`. The `.nav-links` becomes a full-screen overlay (`position: fixed; inset: 0`).
- Toggle via `.is-open` class. JS in `main.js` handles the toggle and scroll lock.
- Hamburger button is `z-index: 500` (within navbar stacking context) — always above overlay.

### WhatsApp FAB:
- Fixed at `bottom: 28px; right: 28px` (bottom-right corner, clear of content).
- On mobile: `width/height: 54px`, moved to `right: 16px; bottom: 20px` to avoid overlap with content.
- `z-index: 90` — below navbar (z-index: 100) but above all page content.

## 8. New Components Checklist

Before adding any new UI component:

- [ ] Uses only `var(--...)` color tokens
- [ ] Has smooth `transition` on all interactive states
- [ ] Follows `border-radius` conventions (cards 18–20px, buttons 50px)
- [ ] Verified in RTL layout (text flows right-to-left)
- [ ] Images have `alt` text in Hebrew and `loading="lazy"` where appropriate
- [ ] CSS added to `style.css` with a `/* ===== Component Name ===== */` section header
- [ ] No inline styles, no page-specific CSS files, no `!important`

---

*Read `project_rules.md` alongside this file. Design decisions that conflict with project_rules.md must defer to project_rules.md.*
