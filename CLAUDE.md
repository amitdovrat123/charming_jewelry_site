# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

**Charming by Vik** is a jewelry and workshop brand. The website is its primary digital presence — a static, multi-page Hebrew RTL site with a luxury, minimalist aesthetic built around Soft Rose Gold, Cream White, and Charcoal.

## Tech Stack

Plain HTML and CSS — no frameworks, no build tools, no package manager. RTL/Hebrew support is mandatory on every page. The only external dependency is Google Fonts (`Assistant`).

## Viewing the Site

Open `index.html` directly in a browser. No build step required.

For a proper local server (avoids some `file://` restrictions):
```bash
python3 -m http.server 8000
```

## Key Instructions

**Before starting any task**, always check:
- `task_list.md` — current progress, open to-dos, and missing assets
- `project_rules.md` — source of truth for HTML structure, CSS conventions, and design rules
- `skills/design_expert.md` — UI/UX design system, interaction rules, and image integration
- `skills/copywriting_skill.md` — brand voice, approved CTAs, and content guidelines

## תקשורת עם המשתמשת — חשוב

**כל סיכום פעולה / הודעה למשתמשת חייב להיות בעברית בלבד.** אסור להשתמש באנגלית בסיכומים אלא אם חובה טכנית (שמות פונקציות, קבצים, נתיבים, מונחי קוד).

- אסור להוסיף בלוקים באנגלית כמו "What changed", "Summary", או רשימות תכונות באנגלית.
- אסור לערבב משפטים באנגלית בתוך הסיכום.
- אם צריך להזכיר שם פונקציה / משתנה / קובץ — מותר רק את המונח עצמו, השאר בעברית.
- הסיכום צריך להיות **קצר**: 2–4 שורות. רק מה השתנה ומה לבדוק.
- שמות מקטעי קוד / מספרי שורות מותרים אך לא חובה.

## Site Architecture

**Static site** with a single shared stylesheet:
- `index.html` — Home page (hero, charm jewelry shop, workshops overview)
- `workshops.html` — Workshops page (gallery, signup form)
- `shop.html` — Shop page (product catalog, filters, cart)
- `legal.html` — Legal page (privacy, terms, cookie settings)
- `terms.html` — Terms page
- `mgmt-7k9x.html` — Admin dashboard (**hidden path — do NOT rename or expose**)
- `style.css` — One global stylesheet, shared by all pages
- `main.js` — navbar scroll, hamburger menu, testimonials, lightbox
- `project_rules.md` — source of truth for design and technical rules
- `skills/copywriting_skill.md` — brand voice and content guidelines

**CSS is organized into named sections** with `/* ===== Section Name ===== */` comments. New styles are appended to `style.css` — never create page-specific CSS files.

## Mandatory HTML Rules

Every HTML file must have:
```html
<html lang="he" dir="rtl">
```
Plus: `<!DOCTYPE html>`, `meta charset="UTF-8"`, viewport meta, `style.css` link, Google Fonts `Assistant` (weights 300/400/600/700), the standard navbar, and the standard footer (see `project_rules.md` for copy-paste templates).

## Design System

All colors are CSS custom properties — **never hardcode hex values**:

| Variable | Value | Role |
|---|---|---|
| `--sand` | `#fdf8f5` | Main background |
| `--sand-dark` | `#e8cfc4` | Borders |
| `--sand-light` | `#ffffff` | Surfaces |
| `--sand-deep` / `--pink` | `#c9957a` | Rose Gold primary accent |
| `--pink-deep` | `#a8705a` | Hover/interactive |
| `--pink-light` | `#f5ece7` | Section alternate background |
| `--ink` | `#2c2a29` | Headings |
| `--ink-soft` | `#4a3f3c` | Body text |
| `--muted` | `#9a8e8a` | Secondary text |

Key layout values: container max `1120px`, section padding `110px` desktop / `80px` tablet. Cards: `border-radius: 18–20px`. Buttons: `border-radius: 50px` (pill). Card hover: `translateY(-6 to -8px)` + Rose Gold box-shadow. All transitions: `0.25–0.3s ease`.

Responsive breakpoints: `1200px` / `768px` / `375px`.

## Content Rules

- All visible text must be in **Hebrew**. Only exceptions: brand name "Charming by Vik" and technical values (URLs, emails).
- Address the reader as **את** (singular feminine).
- No `!important` in CSS. No inline styles. No page-specific JS (only `main.js`).
- For new pages: `lowercase-kebab-case.html` in the root directory.
- Social: TikTok is the only platform — `https://www.tiktok.com/@charming.by.vik`.

See `skills/copywriting_skill.md` for the full brand voice guide before writing or editing any content.

## Security Rules (DO NOT REMOVE OR WEAKEN)

### Netlify Configuration
Two files control security headers and access rules. **Both must stay in sync:**
- `netlify.toml` — primary config (headers + redirects)
- `_headers` — fallback headers

### HTTP Security Headers (applied to all pages)
These headers are defined in `netlify.toml` and `_headers`. **Never remove them:**

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | Full whitelist policy | Prevents XSS — only allows scripts/styles from approved domains |
| `X-Frame-Options` | `DENY` | Prevents clickjacking (iframe embedding) |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Prevents URL leakage to external sites |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Blocks browser APIs not needed by the site |

### CSP Whitelist
When adding a **new external script, font, image CDN, or API**, you must update the CSP in **both** `netlify.toml` and `_headers`. The relevant directives:
- `script-src` — JavaScript sources
- `style-src` — CSS sources
- `img-src` — Image sources
- `font-src` — Font sources
- `connect-src` — API/fetch destinations
- `frame-src` — iframe sources

### Admin Dashboard Protection
- The admin page is at `mgmt-7k9x.html` — **do NOT rename back to `admin.html`**
- `/admin` and `/admin.html` return 404 (redirect in `netlify.toml`)
- `X-Robots-Tag: noindex, nofollow` is set on the admin page
- The admin path must NOT appear in `robots.txt`

### Sensitive File Blocking
These files are blocked from public access via redirects in `netlify.toml` (return 404):
- `*.md` files (CLAUDE.md, task_list.md, project_rules.md, etc.)
- `firestore.rules`
- `netlify.toml`, `_headers`
- `agents/`, `skills/` directories

**When adding new `.md` files or config files**, add a corresponding redirect in `netlify.toml`.

### Firebase Security
- **Firestore Rules** (`firestore.rules`) — validation on `inquiries`, `logs`, `site_traffic` to prevent spam flooding
- **App Check** (reCAPTCHA v3) — configured in `firebase-config.js`, blocks requests not from the real site
- **Rate limiting** — `tracker.js` limits to 200 events per session

### No Inline Scripts in Public Pages
All JavaScript was extracted to external files to enable strict CSP. **Do NOT add inline `<script>` blocks or `onclick` handlers to HTML files.** Use external `.js` files instead. Shared scripts:
- `lang-init.js` — language detection (loaded in `<head>`)
- `gtag-init.js` — Google Analytics consent + config
- `cookie-consent.js` — cookie banner logic
- `nav-handler.js` — `[data-nav]` attribute click handler (replaces onclick)

## Universal Agents (תיקיית `agents/`)

7 סוכנים מומחים זמינים בתיקיית `agents/`. ניתן להפעיל אותם לפי הצורך:

| סוכן | קובץ | מתי להשתמש |
|---|---|---|
| המנצח (Orchestrator) | `agents/agent_orchestrator.md` | ניהול כללי, תכנון שלבים, חלוקת משימות |
| מנהל מוצר (PM) | `agents/agent_pm.md` | אפיון עסקי, PRD, מבנה מערכת |
| המעצב (Designer) | `agents/agent_designer.md` | UI/UX, שפה ויזואלית, קופי |
| האדריכל (ERP Architect) | `agents/agent_erp_architect.md` | לוח ניהול, DB, לוגיקה עסקית |
| השומר (Guardian) | `agents/agent_guardian.md` | אבטחה, נגישות, QA |
| היועמ"ש (Legal) | `agents/agent_legal.md` | תקנונים, פרטיות, רגולציה |
| מנטור הרעיונות (Idea Deepener) | `agents/agent_idea_deepener.md` | העמקה אסטרטגית של רעיונות |

קבצים נוספים: `agents/reference_vault.md` (כספת ידע משותפת) ו-`agents/README_ACTIVATION_GUIDE.md` (מדריך הפעלה).

**שימוש:** קרא את קובץ הסוכן הרלוונטי לפני ביצוע משימה מורכבת ופעל לפי ההנחיות שלו. הסוכנים הם **אגנוסטיים לטכנולוגיה** — יש להתאים את ההמלצות שלהם ל-Stack הנוכחי (Plain HTML/CSS, לא Tailwind).
