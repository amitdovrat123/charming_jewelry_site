# כספת הידע (Reference Vault) v2.0 — Charming Edition

מטרה: מרכז סטנדרטים, לקחים ועקרונות ליבה עבור פרויקט Charming by Vik. כל סוכן חייב לפעול לפי עקרונות אלו.



---

## 1. אבטחת מידע (Security)

### חוקי גישה (Firestore Rules):
- נתיבים ציבוריים: קריאה לכולם, כתיבה לאף אחד.
- נתיבים פרטיים: גישה רק לבעל ה-UID המאומת.
- **Zero Trust**: לעולם אל תסמוך על Frontend. אבטחה ב-Firestore Rules.

### אימות נתונים:
- כל קלט משתמש — ניקוי (Sanitization) לפני שמירה ב-Firestore.
- מניעת XSS בכל שדה טופס.

### הודעות שגיאה:
- מובנות בעברית, **לא חושפות מידע טכני** פנימי.

### פעולות הרסניות:
- לפני כל פעולה הרסנית (מחיקת קבצים, דריסת נתונים, force push) — **"התראה קיצונית — פעולה הרסנית"** + אישור.

---

## 2. נגישות (Accessibility - A11y)

### דרישות בסיס:
- `aria-label` לכל רכיב אינטראקטיבי.
- סטטוס `focus` ברור וויזואלי.
- ניגודיות צבעים WCAG AA.
- Touch targets מינימליים: `44x44px`.

### שפה:
- כל תקנון ומסמך משפטי — "עברית פשוטה".

---

## 3. עיצוב וחוויית משתמש (UI/UX)

### פלטת צבעים (CSS Custom Properties בלבד):
```css
--sand: #fdf8f5;        /* רקע ראשי */
--sand-dark: #e8cfc4;   /* גבולות */
--sand-light: #ffffff;  /* משטחים */
--pink: #c9957a;        /* Rose Gold — אקסנט ראשי */
--pink-deep: #a8705a;   /* Hover */
--pink-light: #f5ece7;  /* רקע חלופי */
--ink: #2c2a29;         /* כותרות */
--ink-soft: #4a3f3c;    /* טקסט גוף */
--muted: #9a8e8a;       /* טקסט משני */
```
**לעולם לא hardcode hex — רק `var(--name)`.**

### טיפוגרפיה:
- גופן: `Assistant` (Google Fonts, weights 300/400/600/700)
- Letter-spacing שלילי בכותרות

### Layout:
- Container: `max-width: 1120px; margin: 0 auto; padding: 0 40px` (מובייל: `padding: 0 24px`)
- Section padding: `110px` desktop / `80px` tablet
- Cards: `border-radius: 18–20px`
- Buttons: `border-radius: 50px` (pill)
- Breakpoints: `1200px` / `768px` / `375px`

### חוק ה-Spacing הנדיב:
- מרווח מינימלי `8px` בין כל שני אלמנטים שכנים.
- טקסט לעולם לא "דבוק" לקצה:
  - כפתורים: `padding: 12px 32px` לפחות
  - כרטיסים: `padding: 24px 32px` לפחות
  - Pills: `padding: 4px 11px`
  - שדות קלט: `padding: 6px 12px`
- **כשיש ספק — יותר מרווח.**

### אינטראקציות:
- Card hover: `translateY(-6px to -8px)` + Rose Gold box-shadow
- כל transitions: `0.25–0.3s ease`

### Popups:
- מובייל: ממורכז (`position: fixed; inset: 0; display: flex; align-items: center; justify-content: center`)
- דסקטופ: `position: absolute` ביחס לכפתור
- חובה: סגירה בלחיצה חיצונית

### RTL:
- כותרות — FIRST child ב-flex (ימין)
- כפתורים — LAST child (שמאל)
- לא `justify-content: flex-end` בתוך RTL
- כל רכיב חדש נבדק RTL

### CSS Conventions:
- קובץ אחד: `style.css`
- סקשנים עם `/* ===== Section Name ===== */`
- אין `!important`. אין inline styles.
- אין קבצי CSS נפרדים לדף.

---

## 4. תוכן ושפה (Copywriting)

### טון מותג:
- חם, אלגנטי, אישי, אמנותי, מעצים
- פנייה ב-**את** (נקבה יחיד)
- שלושה עמודים: קסם, ייחודיות, רגעים בלתי נשכחים

### מילים מותרות:
קסם, עדין, ייחודי, מיוחד, בעבודת יד, אישי, זיכרון, אלגנטי

### מילים אסורות:
זול, מבצע, קני, מוצר/פריט (במקום: תכשיט)

### מבנה תוכן:
Hook → Body → CTA (לעולם לא דרישה — תמיד הזמנה)

### שפה:
- הכל בעברית. חריגים: "Charming by Vik", URLs, אימיילים.

---

## 5. משפט ורגולציה (Legal)

- חוק ישראלי (הגנת פרטיות, הגנת הצרכן, חוק הספאם)
- מדיניות פרטיות ותקנון בעברית פשוטה
- GA4 Consent gate (`charming_cookie_accepted`)
- דפים משפטיים נגישים מה-Footer

---

## 6. תהליך עבודה (Process)

### כלל על:
**פקודה רגילה — בצע מיד. שינוי גדול (ארכיטקטורה, דף חדש, רפקטור) — שאל 2-3 שאלות דיוק קצרות ואז בצע.**

### One Question at a Time:
שאלה אחת בכל פעם. חכה לתשובה. אל תניח.

### Destructive Warning:
לפני פעולה הרסנית — התראה בעברית + אישור.

### Respect the Stack:
Plain HTML/CSS + Firebase. אל תציע frameworks אלא אם עמית מבקש.

### No Auto-Push:
לעולם לא `git push` ללא אישור מפורש.

### MVP First:
קודם MVP ממוקד. פיצ'רים נוספים בשלבים.
