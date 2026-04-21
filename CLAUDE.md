# Fashion Fit — Claude Code Instructions

## CRITICAL: Usage Limit Protection

These rules exist to prevent burning through weekly Claude Code usage limits.
They are **non-negotiable** and override all default behavior.

---

## Token Conservation — Mandatory Rules

### Before touching any file, think first
- State the exact change needed in one sentence before calling any tool.
- If you can answer from context already in the conversation, do NOT read files again.
- Never re-read a file you already read in this session.

### Read minimally
- **Never read an entire large file.** Use `offset` + `limit` to read only the relevant section.
- Before reading, state the line range you expect to need.
- Files over ~200 lines: read in focused 60–80 line slices only.
- Key large files and their rough sizes (read surgically):
  - `api/routes/recommendations.js` — ~1200 lines, DO NOT read whole
  - `api/utils/fashionIntelligence.js` — ~400 lines, DO NOT read whole
  - `api/routes/chat.js` — large, read relevant sections only
  - `api/routes/ai.js` — large, read relevant sections only

### Search before reading
- Use `Grep` to find the exact location before reading any file.
- Use `Glob` for file discovery — never run `ls` or `find` recursively.
- If Grep gives you the line number, read only ±20 lines around it.

### Edit surgically
- Use `Edit` for all file changes — never rewrite a whole file with `Write` unless creating a brand new file.
- One edit = one focused change. Do not batch unrelated edits.
- Do NOT refactor, clean up, or improve code beyond what was explicitly asked.

### No speculative exploration
- Do not read files "just to understand the codebase."
- Do not browse directory trees unless the user asks where something is.
- Do not read config files, package.json, or env files unless directly relevant to the task.

### No unsolicited work
- Do not add error handling, comments, console.logs, or type annotations unless asked.
- Do not suggest follow-up improvements after completing a task.
- Do not open or read files the user didn't mention.

---

## Response Style — Keep It Short

- Answer in the fewest words possible.
- No summaries of what you just did — the user can see the diff.
- No bullet-point recaps. No "here's what I changed."
- No preamble. Lead with the action or answer.
- Code blocks only when showing code the user needs to copy or review.

---

## Tool Call Discipline

- Max 2–3 tool calls per response unless the task genuinely requires more.
- Parallel tool calls only for truly independent operations.
- Never call a tool to verify something you already know from context.
- Never re-run a search you already ran earlier in the session.
- If you already have the information, use it — don't fetch it again.

---

## Task Scope Rules

- Do exactly what was asked. No more.
- A bug fix does not warrant touching other files.
- A one-line change does not warrant reading 10 files.
- If a task seems large, ask the user to confirm scope before proceeding.
- Do not use agents (subagents) unless the user explicitly asks.

---

## Project Structure Reference

Use this to avoid unnecessary exploration:

```
Fashion changes/
├── App.tsx                        # Root app entry
├── api/                           # Express backend
│   ├── server.js                  # Server setup, middleware, routes
│   ├── models/                    # Mongoose models
│   ├── routes/                    # Route handlers
│   │   ├── ai.js                  # Image categorization, style DNA AI calls (gpt-4o)
│   │   ├── chat.js                # AI stylist chat (gpt-4o-mini)
│   │   ├── recommendations.js     # Outfit recommendations (gpt-4o-mini + algorithm)
│   │   ├── styleDNA.js            # Style DNA analysis (gpt-4o)
│   │   ├── wardrobe.js            # Wardrobe CRUD
│   │   ├── auth.js                # Auth routes
│   │   ├── social.js              # Social feed, follows, posts
│   │   ├── notifications.js       # Push notifications
│   │   ├── payments.js            # Paystack subscriptions
│   │   └── admin.js               # Admin dashboard
│   ├── middleware/
│   │   └── planLimits.js          # Subscription plan enforcement
│   └── utils/
│       └── fashionIntelligence.js # Occasion/weather/style scoring logic (pure JS, no AI)
├── src/
│   ├── screens/                   # React Native screens
│   ├── services/
│   │   ├── apiClient.ts           # Axios client, base URL config
│   │   ├── socialApi.ts           # Social feature API calls
│   │   └── notificationService.ts # Notification registration
│   ├── navigation/
│   │   └── TabNavigator.tsx       # Bottom tab navigation
│   └── i18n/                      # Translations (en, sw)
├── app.json                       # Expo config
└── package.json                   # Dependencies
```

## Key Tech Stack
- **Frontend:** React Native + Expo ~51, Zustand, TanStack Query, i18next
- **Backend:** Node.js + Express, MongoDB/Mongoose
- **AI:** OpenAI gpt-4o (image analysis, style DNA) + gpt-4o-mini (chat, outfit enhancement)
- **Storage:** Cloudinary (images)
- **Payments:** Paystack
- **Auth:** JWT

## Environment
- Backend `.env` is at `api/.env`
- OpenAI key is `OPENAI_API_KEY` (app uses OpenAI, not Anthropic)
- No `.env` file should ever be read unless specifically debugging env config

---

## When to Ask Before Acting

Ask the user before proceeding if:
- The task requires touching more than 3 files
- The change is destructive (deleting logic, removing fields, rewriting a function)
- The scope is ambiguous ("fix the chat" — which part?)
- A refactor would be needed to cleanly implement the ask

---

## What This App Does (Quick Context)

Fashion Fit is a React Native mobile app for outfit recommendations:
- Users upload wardrobe items (photos → Cloudinary → AI categorization)
- AI generates outfit recommendations based on occasion, weather, and style DNA
- Social feed for sharing outfits
- Subscription tiers (Paystack) enforce daily usage limits via `planLimits.js`
- Style DNA is built from quiz answers + item uploads, used to personalize all AI calls
