# Project Rules — Source of Truth
## Charming by Vik | Jewelry & Workshops

> This file is the single source of truth for the project.
> Before making any change — design, content, or code — refer to these rules first.

---

## 1. Project Identity

| Field        | Value                                      |
|--------------|--------------------------------------------|
| Project Name | Charming by Vik — Jewelry & Workshops      |
| Owner        | Vik                                        |
| Type         | Static multi-page website                  |
| Language     | Hebrew (עברית)                             |
| Direction    | Right-to-Left (RTL)                        |

---

## 2. Core Language & Text Rules

- **Every** HTML file must declare `lang="he"` and `dir="rtl"` on the `<html>` tag.
- All visible text, labels, placeholders, and buttons must be written in **Hebrew**.
- Latin characters are allowed only for the brand name "Charming by Vik" and technical values (URLs, emails, etc.).
- Tone of voice: **inviting, professional, and artistic** — warm but never casual.

```html
<!-- Required on every page -->
<html lang="he" dir="rtl">
```

---

## 3. Design Identity

### Color Palette

| Role            | Name            | Hex       |
|-----------------|-----------------|-----------|
| Primary Accent  | Rose Gold       | `#c9957a` |
| Deep Accent     | Rose Gold Deep  | `#a8705a` |
| Accent Light    | Rose Gold Light | `#e8cfc4` |
| Accent Glow     | Rose Gold Glow  | `rgba(201,149,122,0.25)` |
| Background      | Cream           | `#fdf8f5` |
| Section Alt BG  | Cream Section   | `#f5ece7` |
| Surface         | White           | `#ffffff` |
| Primary Text    | Charcoal        | `#2c2a29` |
| Body Text       | Warm Text       | `#4a3f3c` |
| Subtle Text     | Muted           | `#9a8e8a` |

> Never introduce new brand colors without updating this table first.

### Typography

- **Font**: `Assistant` (Google Fonts) — weights 300, 400, 600, 700.
- Include on every page via the standard `<link>` tag in `<head>`.
- Headings: weight 700, slight negative letter-spacing.
- Body: weight 300–400, `line-height: 1.75`.
- Labels / eyebrows: weight 700, uppercase, `letter-spacing: 2–3px`.

### Layout & Spacing

- Container max-width: `1120px`, horizontal padding: `40px` (desktop) / `24px` (mobile).
- Section vertical padding: `110px` desktop, `80px` tablet, proportionally reduced on mobile.
- Cards and feature boxes: `border-radius: 18–20px`.
- Buttons: `border-radius: 50px` (pill shape).
- Aesthetic is **minimalist** — generous whitespace, no visual clutter.

### Interactions

- Hover on cards: `translateY(-6 to -8px)` + soft Rose Gold box-shadow.
- Primary button hover: background darkens to `--rose-gold-deep` + shimmer sweep animation.
- Navigation links: animated underline from right (RTL-aware).
- All transitions: `0.25–0.3s ease`.

---

## 4. File Structure

```
newalias/
├── index.html          # Home page
├── workshops.html      # Workshops page
├── style.css           # Global stylesheet (single source of styles)
└── project_rules.md    # This file — Source of Truth
```

> New pages go in the same root directory and follow the naming convention: `lowercase-kebab-case.html`.

---

## 5. Technical Rules

### Every HTML file MUST include:

1. `<!DOCTYPE html>` declaration
2. `<html lang="he" dir="rtl">`
3. `<meta charset="UTF-8" />` and viewport meta tag
4. Link to `style.css` — **no inline styles, no separate page-level CSS files**
5. Google Fonts link for `Assistant`
6. The **standard Navigation Bar** (see template below)
7. The **standard Footer** (see template below)

### Navigation Bar Template

```html
<header class="navbar">
  <div class="nav-container">
    <a href="index.html" class="logo">Charming <span>by Vik</span></a>
    <nav>
      <ul class="nav-links">
        <li><a href="index.html">דף הבית</a></li>
        <li><a href="index.html#shop">חנות</a></li>
        <li><a href="workshops.html">סדנאות</a></li>
        <li><a href="#contact">צור קשר</a></li>
      </ul>
    </nav>
  </div>
</header>
```

### Footer Template

```html
<footer class="footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <h3 class="footer-logo">Charming by Vik</h3>
      <p>תכשיטים ייחודיים בעבודת יד — כי כל אישה ראויה לפריט שנוצר במיוחד בשבילה.</p>
      <span class="footer-tagline">עיצוב • יצירה • אהבה</span>
    </div>
    <div class="footer-links">
      <h4>ניווט מהיר</h4>
      <ul>
        <li><a href="index.html">דף הבית</a></li>
        <li><a href="index.html#shop">הקולקציה</a></li>
        <li><a href="workshops.html">סדנאות</a></li>
        <li><a href="#contact">צור קשר</a></li>
      </ul>
    </div>
    <div class="footer-contact">
      <h4>עקבו אחרינו</h4>
      <p>לעדכונים, השראה, והצצות מאחורי הקלעים — בואו לבקר אותנו בטיקטוק:</p>
      <a href="https://www.tiktok.com/@charming.by.vik" target="_blank" class="tiktok-link">
        <!-- TikTok SVG icon here -->
        @charming.by.vik
      </a>
    </div>
  </div>
  <div class="footer-bottom">
    <p>© 2025 Charming by Vik. כל הזכויות שמורות. עוצב באהבה.</p>
  </div>
</footer>
```

### CSS Rules

- **One global stylesheet**: `style.css`. Never create page-specific `.css` files.
- New component styles are appended to `style.css` with a clear section comment (`/* ===== Component Name ===== */`).
- Use CSS custom properties (`var(--name)`) for all colors and spacing — never hardcode hex values in component rules.
- No `!important` unless absolutely unavoidable.

### No JavaScript by Default

- The site is intentionally JS-free for simplicity and performance.
- If JS is ever needed, it must be in a separate `main.js` file — no inline scripts.

---

## 6. Page Checklist

Before delivering any new page or update, verify:

- [ ] `lang="he"` and `dir="rtl"` on `<html>`
- [ ] `style.css` linked correctly (relative path)
- [ ] Google Fonts `Assistant` linked
- [ ] Standard navbar included with correct links
- [ ] Standard footer included
- [ ] All text is in Hebrew
- [ ] Colors use `var(--...)` tokens only
- [ ] No inline styles
- [ ] Responsive: tested mentally at 1200px / 768px / 375px

---

## 7. Pages Inventory

| File             | Status   | Description                        |
|------------------|----------|------------------------------------|
| `index.html`     | ✅ Live  | Home — hero, charm jewelry, workshops overview |
| `workshops.html` | ✅ Live  | Workshops — gallery of 3, signup form |

---

## 8. Social & Brand Links

| Platform | Handle / URL                                      |
|----------|---------------------------------------------------|
| TikTok   | [@charming.by.vik](https://www.tiktok.com/@charming.by.vik) |

---

*Last updated: 2025 — update this file whenever the project structure or design rules change.*
