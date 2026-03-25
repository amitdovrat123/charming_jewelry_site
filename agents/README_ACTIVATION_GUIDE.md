# מדריך הפעלה: Charming AI Project Engine v2.0

פעל לפי השלבים הבאים כדי להפעיל את מערכת הסוכנים:

---

## שלב 1: התעוררות המנצח (The Orchestrator)

בשיחה חדשה עם קלוד, אמור:

> "קלוד, קרא את `agents/agent_orchestrator.md` ופעל כמנצח הפרויקט. אני רוצה לעבוד על **[תיאור המשימה]**."

---

## שלב 2: קריאה למומחים (On-Demand Experts)

המנצח ינהל אותך, אבל אפשר גם להפעיל סוכן ספציפי:

> "קלוד, קרא את `agents/agent_[name].md` ופעל לפי ההנחיות. המשימה: **[תיאור]**."

### הסוכנים הזמינים:
| סוכן | קובץ | תפקיד |
|-------|-------|--------|
| המנצח (Orchestrator) | `agent_orchestrator.md` | ניהול כללי של הפרויקט |
| מנהל מוצר (PM) | `agent_pm.md` | אפיון עסקי ומבנה מערכת |
| המעצב (Designer) | `agent_designer.md` | UI/UX, שפה ויזואלית וקופי |
| האדריכל (ERP Architect) | `agent_erp_architect.md` | לוח ניהול, DB, לוגיקה עסקית |
| השומר (Guardian) | `agent_guardian.md` | אבטחה, נגישות, QA |
| היועמ"ש (Legal) | `agent_legal.md` | תקנונים, פרטיות, רגולציה |
| מנטור הרעיונות (Idea Deepener) | `agent_idea_deepener.md` | העמקה אסטרטגית של רעיונות |

---

## שלב 3: כספת הידע (Reference Vault)

אם צריך לרענן את הסטנדרטים:

> "קלוד, קרא את `agents/reference_vault.md` ווודא שאתה פועל לפי העקרונות."

---

## עקרונות מפתח ב-Charming Edition:

1. **Explain Before Execute** — כל סוכן חייב להסביר מה הוא מתכנן לעשות ולחכות לאישור לפני שינוי קוד.

2. **Respect the Stack** — Plain HTML/CSS + Firebase. הסוכנים מותאמים ל-Stack הזה ולא יציעו frameworks.

3. **One Question at a Time** — שאלה אחת בכל פעם, ללא הנחות.

4. **RTL-First** — כל רכיב חדש נבנה עברית-ימין מההתחלה.

5. **Destructive Warning** — התראה ברורה לפני כל פעולה הרסנית.

6. **No Auto-Push** — אין git push אוטומטי. רק באישור מפורש.

---

## טיפים:

- **הקשר**: אם קלוד "שוכח" את הסטנדרטים — "תקרא את `agents/reference_vault.md`"
- **לפני עבודה**: ודא שקלוד קרא את `project_rules.md`, `skills/design_expert.md` ו-`skills/copywriting_skill.md`
- **סדר**: אל תיתן לו לכתוב קוד לפני שסיימת לתכנן עם Idea Deepener או PM
