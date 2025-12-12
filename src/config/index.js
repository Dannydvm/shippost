/**
 * ShipPost Configuration
 */
// Only load dotenv if .env file exists (not in Vercel)
if (!process.env.VERCEL) {
  require('dotenv').config();
}

module.exports = {
  port: process.env.PORT || 3100,

  // Anthropic (trim to handle any whitespace in env vars)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim(),

  // Slack
  slackBotToken: process.env.SLACK_BOT_TOKEN?.trim(),
  slackChannel: process.env.SLACK_CHANNEL?.trim() || 'social',

  // Post-Bridge
  postBridgeApiKey: process.env.POST_BRIDGE_API_KEY?.trim(),
  postBridgeApiUrl: process.env.POST_BRIDGE_API_URL?.trim() || 'https://api.post-bridge.com',

  // Firebase (for storing projects/commits)
  firebaseCredentials: process.env.FIREBASE_CREDENTIALS?.trim(),

  // GitHub webhook secret
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET?.trim(),
};
