# Community Hub — Discord Bot

A modular, production-ready Discord bot built with **Node.js**, **Discord.js v14** and **SQLite (better-sqlite3)**. Slash commands only, config-driven, with logging, error handling and an orange theme throughout.

## Features

- **Profiles** — modal-based create/edit, view, delete, browse (13 fields)
- **Advanced search** — by location, skills, profession, interests, category, gender
- **Profile browsing** — paginated cards with Previous / Next / Like buttons
- **Likes & matches** — mutual likes create a match automatically (no duplicates)
- **Friends** — `/friends`, `/friend-remove`
- **Category systems** — Networking, Co-Founder, Freelancing, Dating (18+)
- **Admin tools** — stats, broadcast, delete profile, ban / unban
- **Ban system** — banned users are blocked from all commands
- **File logging** — errors, profiles, likes, matches and admin actions in `/logs`

## Folder Structure

```
commands/      slash commands grouped by domain
  admin/ dating/ founder/ freelance/ general/
  networking/ profile/ search/ social/
config/        config.js (master) + legacy re-exports
database/      database.js, schema.js, *Queries.js
events/        ready.js, interactionCreate.js
handlers/      commandHandler.js, eventHandler.js
logs/          generated log files
utils/         embed, logger, validation, session, constants, etc.
index.js       entry point
deploy-commands.js
```

## Required npm Packages

Runtime: `discord.js`, `better-sqlite3`, `dotenv`
Dev: `nodemon`

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Configure `.env` in the project root:
   ```
   TOKEN=your-bot-token
   CLIENT_ID=your-application-id
   GUILD_ID=your-test-guild-id   # optional; omit for a global deploy
   ```
3. Set your admin IDs and branding in `config/config.js` (`ADMIN_IDS`, `WEBSITE`, `SUPPORT_SERVER`, `LOGO_URL`, etc.). Admin commands only work for IDs listed here.

## Deploy & Run

1. Register the slash commands with Discord:
   ```
   npm run deploy
   ```
   - With `GUILD_ID` set, commands appear instantly in that server.
   - Without it, commands deploy globally (can take up to an hour).
2. Start the bot:
   ```
   npm start
   ```
   Or during development:
   ```
   npm run dev
   ```

## Commands

| Command | Description |
| --- | --- |
| `/ping` | Bot latency |
| `/profile create\|view\|edit\|delete\|browse` | Manage and browse profiles |
| `/search` | Search by location, skills, profession, interests, category, gender |
| `/like` | Like a user (mutual = match) |
| `/matches` | View your matches |
| `/friends`, `/friend-remove` | Manage matched friends |
| `/dating browse\|matches` | 18+ dating (gender + preference filtered) |
| `/networking browse\|matches` | Networking category |
| `/founder browse\|matches` | Co-Founder category |
| `/freelance browse\|browse-skills\|browse-profession` | Freelancing category |
| `/admin stats\|broadcast\|delete-profile\|ban-user\|unban-user` | Admin only |

## Security Note
Your bot token is stored in `.env` (now git-ignored). If this token was ever committed or shared, rotate it in the Discord Developer Portal.

## Website (Public Showcase)

A read-only website (in `web/`) displays members grouped by category, each
category with its own look (Dating is romantic, Co-Founder is professional,
Gaming is neon, etc.). Profiles are created/edited/deleted only from the bot —
the site shows just the member's **name** and **Discord username**, plus a
**Like** button. Likes flow into the same database, so mutual likes become
matches automatically. "Who liked you" names stay a Premium perk.

### Run the website

```
npm run web        # production
npm run web:dev    # auto-reload during development
```

Then open `http://localhost:3000`. The bot and website share
`database/database.sqlite` (WAL mode), so you can run both at once.

### Enable Discord login (required for liking)

1. In the Discord Developer Portal → your app → OAuth2, copy the Client Secret
   and add a redirect: `http://localhost:3000/auth/callback` (use your real
   domain in production).
2. Fill these in `.env`:
   ```
   CLIENT_SECRET=your-oauth-client-secret
   SESSION_SECRET=any-long-random-string
   WEB_BASE_URL=http://localhost:3000
   OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
   ```
3. Restart the website. Visitors can now "Login with Discord" and like members.

Without `CLIENT_SECRET`, the site still runs and shows everyone — only the
liking/login features are disabled.

### Web endpoints

- `GET /` — the site
- `GET /api/categories`, `GET /api/profiles?category=...`, `GET /api/stats`
- `POST /api/like` (login required), `GET /api/admirers` (Premium for names)
- `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout`
