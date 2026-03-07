# Charming by Vik — Master Dev Guide

## Project Identity & Stack

**Charming by Vik** — jewelry and workshop brand. Hebrew RTL, luxury minimalist aesthetic.

- **Stack:** Plain HTML + CSS + vanilla JS. No frameworks, no build tools, no package manager.
- **External dep:** Google Fonts (`Assistant`, weights 300/400/600/700).
- **Pages:** `index.html` (SPA shell), `workshops.html`, `terms.html`, `accessibility.html`

---

## Local Dev Setup

```bash
# Option A (recommended)
npx serve . -l 8000

# Option B
python3 -m http.server 8000
```

Open: `http://localhost:8000/index.html`

> `file://` protocol blocks ES module imports — always use a local server.

---

## Publish Policy — MANUAL ONLY

**Never push automatically.** Publish only when the user explicitly says:
- **"Perform Publish"** — git push to remote
- **"Push to Cloud"** — git push to remote

Local saves: `git add + git commit` is fine after each change. **No `git push` without explicit instruction.**

> ~~Auto-push~~ **DEPRECATED as of V9.2**

---

## JS Architecture

| File | Type | Scope |
|---|---|---|
| `catalog.js` | `type="module"` | Module (isolated) |
| `auth.js` | `type="module"` | Module (isolated) |
| `accessibility.js` | `type="module"` | Module (isolated) |
| `nav.js` | Standard script | Global / IIFE |
| `main.js` | Standard script | Global / IIFE |

**Module scope isolation:** Functions in module files are NOT on `window` by default.
`window.switchView` is explicitly attached in `catalog.js` so HTML event listeners can reach it.

---

## Key localStorage Keys

| Key | Purpose |
|---|---|
| `charming-cart` | Cart items array (JSON) — persists across pages |
| `charming-a11y-*` | Accessibility settings (set by `accessibility.js`) |

These work identically on `localhost` and production — no environment-specific handling needed.

---

## isLocal Debug Flag

Both `catalog.js` and `auth.js` define:
```js
const isLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';
```

Debug logs gated on `isLocal`:
- `[switchView] <view>` — fires on every view change
- `[auth] state changed: <email|'signed out'>` — fires on every auth state change

These logs are **silent in production** and **visible in DevTools on localhost**.

---

## Local Testing Checklist

```
1. npx serve . -l 8000   (or: python3 -m http.server 8000)
2. Open http://localhost:8000/index.html

3. Log in → check console for:
      [auth] state changed: your@email.com

4. Add item to cart → verify cart badge increments

5. Call in DevTools console:
      switchView('shop')   → verify it works (window scope exposed)

6. Navigate to http://localhost:8000/workshops.html
   - Verify: green dot on user icon (logged-in state synced)
   - Verify: cart badge shows correct count
   - Click user icon  → redirects to index.html?view=profile ✓
   - Click cart icon  → redirects to index.html?view=checkout ✓

7. DevTools > Application > Local Storage
   - Verify `charming-cart` key exists and survives page navigation
   - Verify accessibility settings key is present if changed

8. Incognito tab → verify guest cart persists in localStorage
   (no Firebase write, badge still updates)

9. Confirm NO automatic git push happens after any save
```

---

## Design System Quick Reference

| Variable | Value | Role |
|---|---|---|
| `--sand` | `#fdf8f5` | Main background |
| `--sand-dark` | `#e8cfc4` | Borders |
| `--pink` / `--sand-deep` | `#c9957a` | Rose Gold primary accent |
| `--pink-deep` | `#a8705a` | Hover/interactive |
| `--pink-light` | `#f5ece7` | Alternate section bg |
| `--ink` | `#2c2a29` | Headings |
| `--ink-soft` | `#4a3f3c` | Body text |
| `--muted` | `#9a8e8a` | Secondary text |

**Never hardcode hex values.** Always use CSS custom properties.

---

## Key Rules (Summary)

- All visible text in **Hebrew**. Only exceptions: brand name, technical values (URLs, emails).
- Address the reader as **את** (singular feminine).
- No `!important`. No inline styles. No page-specific JS beyond `main.js`.
- Every HTML file: `<html lang="he" dir="rtl">` + standard navbar + standard footer.
- CSS: all new styles appended to `style.css`. Never create page-specific CSS files.
- Social: TikTok only — `https://www.tiktok.com/@charming.by.vik`

See `project_rules.md` and `skills/copywriting_skill.md` for full rules.
