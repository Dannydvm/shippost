# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Run server on port 3100
npm run dev            # Run with --watch for auto-reload
npm run digest         # Run daily digest (generates posts for all projects)
node scripts/setup-projects.js  # Initialize Danny's projects
```

## Architecture

ShipPost auto-generates social media posts from git commits with brand-aware voice learning.

### Core Flow

1. **Webhook receives push** → `src/routes/webhooks.js` stores commits
2. **Daily digest or per-commit** → processes unposted commits
3. **Load project context** → `voiceAnalyzer.getProjectContext()` reads SHIPPOST.md
4. **AI analyzes commits** → picks most interesting updates
5. **AI generates posts** → matches Danny's voice from example posts
6. **Platform routing** → full posts vs light updates per project
7. **Slack preview** → approve/edit/skip
8. **Post-Bridge publishes** → Twitter, LinkedIn, Instagram, FB Page
9. **FB Groups hybrid** → opens browser with content copied

### Key Services

- **voiceAnalyzer** (`src/services/voiceAnalyzer.js`): Learns writing voice from SHIPPOST.md example posts. Extracts tone, phrases, style patterns using Claude Sonnet 4.5.
- **contentGenerator** (`src/services/contentGenerator.js`): Claude-powered content with learned voice. Uses Sonnet 4.5.
- **fbGroupsService** (`src/services/fbGroupsService.js`): FB Groups posting (hybrid approach) + platform routing config.
- **postBridgeService** (`src/services/postBridgeService.js`): Post-Bridge API for Twitter/LinkedIn/Instagram/FB Page.
- **projectManager** (`src/services/projectManager.js`): Manages projects and commits.
- **slackService** (`src/services/slackService.js`): Interactive approval flow.

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

## API Endpoints

- `POST /webhooks/github` - GitHub push webhook
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `POST /api/projects/:id/generate` - Manual post generation
- `GET /api/fbgroups` - List FB groups
- `POST /api/fbgroups/queue` - Queue post for FB groups
- `POST /api/fbgroups/open/:groupId` - Open group with content copied

## Files to Update When Shipping Features

1. **CLAUDE.md** - This file (architecture, services, how it works)
2. **CHANGELOG.md** - Version history with dates
3. **README.md** - User-facing docs (if public-facing change)

## Environment Variables

```
ANTHROPIC_API_KEY=     # Claude Sonnet 4.5
POST_BRIDGE_API_KEY=   # Post-Bridge API
SLACK_BOT_TOKEN=       # Slack approval flow
SLACK_CHANNEL=         # Channel for previews
```
