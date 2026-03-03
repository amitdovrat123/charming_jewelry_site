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

## Site Architecture

**Static site** with a single shared stylesheet:
- `index.html` — Home page (hero, charm jewelry shop, workshops overview)
- `workshops.html` — Workshops page (gallery, signup form)
- `style.css` — One global stylesheet, shared by all pages (~960 lines, 19 sections)
- `main.js` — 8 lines; toggles `.scrolled` on `<header class="navbar">` at `scrollY > 60px`
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
