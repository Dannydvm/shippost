# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Run server on port 3100
npm run dev            # Run with --watch for auto-reload
npm run digest         # Run daily digest (generates posts for all projects)
node scripts/setup-projects.js  # Initialize Chad's projects
```

## Architecture

ShipPost auto-generates social media posts from git commits. The flow:

1. **Webhook receives push** → `src/routes/webhooks.js` stores commits in projectManager
2. **Daily digest runs** → `scripts/daily-digest.js` processes unposted commits
3. **AI analyzes commits** → `contentGenerator.analyzeCommits()` picks the most interesting
4. **AI generates posts** → `contentGenerator.generatePost()` creates platform-specific content
5. **Slack preview** → `slackService.sendBatchPreview()` shows posts with approve/edit/skip buttons
6. **Post-Bridge publishes** → `postBridgeService.publishPost()` sends to Twitter/LinkedIn/etc

### Key Services

- **projectManager** (`src/services/projectManager.js`): Manages projects and commits. Uses Firebase if configured, otherwise in-memory.
- **contentGenerator** (`src/services/contentGenerator.js`): Claude-powered content generation with brand voices (`casual-founder`, `professional`, `technical`, `playful`) and platform-specific formatting.
- **slackService** (`src/services/slackService.js`): Sends interactive Slack messages with approval buttons.
- **postBridgeService** (`src/services/postBridgeService.js`): Wrapper for Post-Bridge API ($5/mo for multi-platform posting).

### Project Schema

Projects define how commits become posts:
```javascript
{
  name: "ChiroFlow",
  githubRepo: "seogrowthmode/chiroflow",
  brand: {
    voice: "casual-founder",  // or professional, technical, playful
    platforms: ["twitter", "linkedin"],
    accountHandle: "@chiroflowapp"
  },
  tagging: {
    alwaysTag: [],
    topicTags: { ai: ["@AnthropicAI"], saas: ["@nathanbarry"] }
  },
  postFrequency: "daily-digest"
}
```

### Strategic Tagging

`STRATEGIC_TAGS` in contentGenerator maps topics to accounts for reach:
- `ai`: @AnthropicAI, @OpenAI, @ClaudeAI
- `indie-hacker`: @levelsio, @marcloudon
- `vibe-coding`: @cursor_ai

## API Endpoints

- `POST /webhooks/github` - GitHub push webhook (add to repo settings)
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project (returns webhook URL)
- `POST /api/projects/:id/generate` - Manually trigger post generation
