# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Run server on port 3100
npm run dev            # Run with --watch for auto-reload
npm run digest         # Run daily digest (generates posts for all projects)
node scripts/setup-projects.js   # Initialize Danny's projects
node scripts/setup-webhooks.js   # Set up GitHub webhooks
```

## Architecture

ShipPost auto-generates social media posts from git commits with brand-aware voice learning.

### Core Flow

```
Git Commit → Webhook → Store Commits → [per-commit OR daily-digest] → AI Generate → Slack Approval → Post-Bridge Publish
```

1. **Webhook receives push** → `src/routes/webhooks.js` stores commits
2. **Mode check**:
   - `per-commit` / `immediate` → generates post immediately
   - `daily-digest` → queues for end-of-day batch
3. **Load project context** → `voiceAnalyzer.getProjectContext()` reads SHIPPOST.md
4. **AI analyzes commits** → picks most interesting updates using hook type (mrr/shipped/til/journey/contrarian)
5. **AI generates posts** → uses vibe creator framework (400 tweets analysis) + project voice
6. **Slack preview** → approve/edit/schedule/skip
7. **Post-Bridge publishes** → Twitter, LinkedIn, Instagram, FB Page
8. **FB Groups hybrid** → opens browser with content copied

### Key Services

- **contentGenerator** (`src/services/contentGenerator.js`): AI post generation using vibe creator framework. Loads `templates/SHIPPOST.md` for guidelines.
- **voiceAnalyzer** (`src/services/voiceAnalyzer.js`): Learns writing voice from project's SHIPPOST.md example posts. Extracts tone, phrases, style patterns using Claude Sonnet 4.5.
- **fbGroupsService** (`src/services/fbGroupsService.js`): FB Groups posting (hybrid approach) + platform routing config.
- **postBridgeService** (`src/services/postBridgeService.js`): Post-Bridge API for Twitter/LinkedIn/Instagram/FB Page.
- **projectManager** (`src/services/projectManager.js`): Manages projects and commits.
- **slackService** (`src/services/slackService.js`): Interactive approval flow with buttons.

### Vibe Creator Framework

Based on 400 tweet analysis from @levelsio, @marclou, @tibo_maker, @jackfriks:

- **85%** use MRR/"shipped"/"TIL" hooks
- **92%** casual lowercase voice
- **75%** close with #buildinpublic
- **40%** include specific numbers/metrics

Framework stored in `templates/SHIPPOST.md`. AI uses this to generate authentic "build in public" posts.

### Post Generation Modes

| Mode | Behavior |
|------|----------|
| `smart` / `ai` | **AI decides** - major features post immediately, minor fixes batched |
| `per-commit` | Everything posts immediately on push |
| `immediate` | Same as per-commit |
| `daily-digest` | Everything queues for 6pm cron |

Set `postFrequency` in project config. **Recommended: `smart`**

#### Smart Mode Logic

AI classifies each commit:
- **IMMEDIATE**: Major features, milestones, user-facing changes, "shipped!" moments
- **BATCH**: Bug fixes, refactors, docs, internal changes

Example: Push 5 commits → AI says 1 is exciting (posts now) + 4 are routine (batched for digest)

### Platform Routing

Each project has `full` and `light` post destinations:

| Project | Full Posts | Light Updates |
|---------|-----------|---------------|
| chiroflow-crm | ChiroFlow FB Group | X, Personal FB |
| chiroflow-app | ChiroFlow FB Group | X, Personal FB |
| chadix | Chadix FB, LinkedIn | X, Personal FB |
| shippost | X | Personal FB |

Routing config in `fbGroupsService.js` → `PLATFORM_ROUTING`.

### SHIPPOST.md Config Files

Each project has a `SHIPPOST.md` at root with:
- Product description & goal
- Target audience
- Competitors to avoid tipping off
- Post guidelines (full vs light)
- Voice notes
- Example posts (for voice learning)

Template at `templates/SHIPPOST.md`.

### Post-Bridge Accounts (Danny's)

```javascript
const ACCOUNT_IDS = {
  twitter: 38571,      // @dannyveigatx
  instagram: 38572,    // @iamdannyveiga
  facebook: 38573,     // Danny Veiga (Page)
  linkedin: 38574,     // Danny Veiga (Personal)
  linkedin_company: 38575  // Danny Veiga Marketing
};
```

### FB Groups

- `chadix`: Chadix Local SEO (991392238948400)
- `chiro-marketing`: Chiropractic Marketing (671382746877005) - $120K MRR group
- `personal-fb`: Danny's personal profile

### Slack Integration

- Channel: `#social` (C0A32BHDM38)
- Approval buttons: Approve & Post, Edit First, Schedule, Skip
- Batch preview for multiple posts

## API Endpoints

### Webhooks
- `POST /webhooks/github` - GitHub push webhook (supports per-commit mode)
- `POST /webhooks/gitlab` - GitLab push webhook
- `POST /webhooks/test` - Manual test endpoint
- `POST /webhooks/generate` - Generate post on demand

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `POST /api/projects/:id/generate` - Manual post generation

### FB Groups
- `GET /api/fbgroups` - List FB groups
- `POST /api/fbgroups/queue` - Queue post for FB groups
- `POST /api/fbgroups/open/:groupId` - Open group with content copied

## Files to Update When Shipping Features

1. **CLAUDE.md** - This file (architecture, services, how it works)
2. **CHANGELOG.md** - Version history with dates
3. **README.md** - User-facing docs (if public-facing change)

## Environment Variables

```
# AI
ANTHROPIC_API_KEY=     # Claude Sonnet 4.5

# Post-Bridge
POST_BRIDGE_API_KEY=   # Post-Bridge API
POST_BRIDGE_API_URL=   # https://api.post-bridge.com

# Slack
SLACK_BOT_TOKEN=       # Slack bot token (xoxb-xxx)
SLACK_CHANNEL=         # Channel for previews (social)

# GitHub (optional)
GITHUB_WEBHOOK_SECRET= # For webhook signature verification
```

## Skip Post Generation

Add `[skip-post]` to any commit message to prevent it from being processed.

```bash
git commit -m "fix typo [skip-post]"
```
