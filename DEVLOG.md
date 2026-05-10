# Dev log

Informal day-to-day notes for collaborators. GitHub renders this file like any other Markdown in the repo (open `DEVLOG.md`, or use the link from `README.md`).

## How to add the next day

1. Scroll to **just below this intro** (right after the `---` line).
2. Paste a **new** block at the **top** of the list of days (newest day always first).
3. Use one heading per day, then bullets:

```markdown
## 05/08/2026

- Your note here
- Another note
```

That’s it. Older days stay below; you never reorder past days.

**Tip:** You can use `05/08/2026` or `2026-05-08` in the heading—whatever is easiest to read.

---

## 05/07/2026

- Implementing expansion on AI 

## 05/05/2026

- Make AI explanations reliable and cheaper (cache in the database, sensible Gemini setup, fewer failures when the DB schema lags)
- Make limits and errors clearer in the app (how many follow-up questions are left)
- Keep the repo tidy and shareable (migrations in Git, ignore CLI junk, typecheck only the app, push work to GitHub)
- Devlog markdown creation
- AI API changed (Gemini default chain now tries `gemini-3-flash-preview` first, then fallbacks).
- Deployed `explain-question` and `ai-tutor`; documented `GEMINI_MODEL_CHAIN` override.
- Edge function: resilient insert if snapshot columns are missing on older DBs.
- Smoke-tested Explain with AI after metadata migration; cache rows show `category` / `question_text`.
- Tweaked copy for “remaining questions” in review + AI Tutor header.