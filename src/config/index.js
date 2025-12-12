/**
 * ShipPost Configuration
 */
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3100,

  // Anthropic
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,

  // Slack
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  slackChannel: process.env.SLACK_CHANNEL || 'social',

  // Post-Bridge
  postBridgeApiKey: process.env.POST_BRIDGE_API_KEY,
  postBridgeApiUrl: process.env.POST_BRIDGE_API_URL || 'https://api.post-bridge.com',

  // Firebase (for storing projects/commits)
  firebaseCredentials: process.env.FIREBASE_CREDENTIALS,

  // GitHub webhook secret
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
};
