# ShipPost 🚀

**Build in Public on Autopilot** - Auto-generate social media posts from your git commits.

## What it does

1. **Captures commits** via GitHub/GitLab webhooks
2. **AI picks the best ones** - not every commit, just the interesting stuff
3. **Generates platform-specific posts** - Twitter, LinkedIn, Threads
4. **Sends to Slack for approval** - review before posting
5. **Posts via Post-Bridge** - one API for all platforms

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Add your ANTHROPIC_API_KEY
# Add your POST_BRIDGE_API_KEY (from post-bridge.com)

# 3. Run
npm start

# 4. Add a project
curl -X POST http://localhost:3100/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My SaaS",
    "githubRepo": "username/my-saas",
    "brand": {
      "voice": "casual-founder",
      "platforms": ["twitter", "linkedin"]
    }
  }'

# 5. Add webhook to your GitHub repo
# URL: https://your-domain/webhooks/github
# Events: Push
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project |
| PUT | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project |
| POST | `/api/projects/:id/generate` | Manually trigger post generation |
| POST | `/webhooks/github` | GitHub push webhook |
| POST | `/webhooks/gitlab` | GitLab push webhook |

## Brand Voices

- `casual-founder` - Lowercase okay, real talk, build-in-public style
- `professional` - Polished, thought-leadership, LinkedIn-ready
- `technical` - Dev-focused, code snippets welcome
- `playful` - Fun, emojis, celebratory

## Daily Digest

Run via cron at 6pm to batch all commits into one post:

```bash
# Add to crontab
0 18 * * * cd /path/to/shippost && node scripts/daily-digest.js
```

## Environment Variables

```bash
ANTHROPIC_API_KEY=     # Required - for AI content generation
SLACK_BOT_TOKEN=       # Required - for Slack previews
SLACK_CHANNEL=social   # Channel for post previews
POST_BRIDGE_API_KEY=   # Required - for posting ($5/mo)
```

## Slack Integration

Posts appear in #social for approval:
- ✅ Approve & Post - publishes immediately
- ✏️ Edit - opens editor
- ⏰ Schedule - pick a time
- ❌ Skip - don't post

## License

MIT
