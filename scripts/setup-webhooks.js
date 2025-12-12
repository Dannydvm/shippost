#!/usr/bin/env node
/**
 * GitHub Webhook Setup Script
 *
 * Sets up webhooks for configured projects using GitHub API
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx WEBHOOK_URL=https://shippost.yoursite.com node scripts/setup-webhooks.js
 *
 * Or run interactively:
 *   node scripts/setup-webhooks.js
 */
require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const GITHUB_API = 'https://api.github.com';

// Projects to set up webhooks for
// postFrequency options: 'smart' (AI decides), 'per-commit', 'daily-digest'
const PROJECTS = [
  {
    id: 'shippost',
    repo: 'danny-veiga/ShipPost', // Update with your actual repo
    localPath: '/Users/chadix/Cline/ShipPost',
    postFrequency: 'smart' // AI decides immediate vs batch
  },
  {
    id: 'chadix',
    repo: 'danny-veiga/chadixv2', // Update with your actual repo
    localPath: '/Users/chadix/Cline/chadixv2',
    postFrequency: 'smart'
  },
  {
    id: 'chiroflow-crm',
    repo: 'danny-veiga/ChiroFlow', // Update with your actual repo
    localPath: '/Users/chadix/Cline/ChiroFlow Vapi Calendly Integration - New Sales Calls and Onboarding for Upgrades',
    postFrequency: 'smart'
  }
];

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createWebhook(repo, webhookUrl, githubToken, secret) {
  try {
    const response = await axios.post(
      `${GITHUB_API}/repos/${repo}/hooks`,
      {
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: `${webhookUrl}/webhooks/github`,
          content_type: 'json',
          secret: secret || undefined,
          insecure_ssl: '0'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    console.log(`✅ Webhook created for ${repo}: ${response.data.id}`);
    return { success: true, id: response.data.id };
  } catch (error) {
    if (error.response?.status === 422) {
      console.log(`⚠️  Webhook already exists for ${repo}`);
      return { success: true, exists: true };
    }
    console.error(`❌ Failed to create webhook for ${repo}:`, error.response?.data?.message || error.message);
    return { success: false, error: error.message };
  }
}

async function listWebhooks(repo, githubToken) {
  try {
    const response = await axios.get(
      `${GITHUB_API}/repos/${repo}/hooks`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Failed to list webhooks for ${repo}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('\n🚀 ShipPost GitHub Webhook Setup\n');
  console.log('─'.repeat(40));

  // Get configuration
  let githubToken = process.env.GITHUB_TOKEN;
  let webhookUrl = process.env.WEBHOOK_URL;
  let webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!githubToken) {
    console.log('\nYou need a GitHub Personal Access Token with "repo" and "admin:repo_hook" scopes.');
    console.log('Create one at: https://github.com/settings/tokens\n');
    githubToken = await prompt('GitHub Token (ghp_xxx): ');
  }

  if (!webhookUrl) {
    console.log('\nEnter the URL where ShipPost is deployed.');
    console.log('Example: https://shippost.vercel.app or https://your-ngrok-url.ngrok.io\n');
    webhookUrl = await prompt('Webhook URL: ');
  }

  if (!webhookSecret) {
    console.log('\nOptional: Enter a webhook secret for verification (leave blank to skip):');
    webhookSecret = await prompt('Webhook Secret: ');
  }

  console.log('\n─'.repeat(40));
  console.log('Setting up webhooks...\n');

  // Process each project
  for (const project of PROJECTS) {
    console.log(`\n📦 ${project.id} (${project.repo})`);

    // Check existing webhooks
    const existing = await listWebhooks(project.repo, githubToken);
    const hasShippost = existing.some(h =>
      h.config?.url?.includes('/webhooks/github')
    );

    if (hasShippost) {
      console.log('   ⚠️  ShipPost webhook already configured');
      continue;
    }

    // Create webhook
    const result = await createWebhook(project.repo, webhookUrl, githubToken, webhookSecret);

    if (result.success) {
      console.log(`   ✅ Webhook active`);
    }
  }

  console.log('\n─'.repeat(40));
  console.log('\n✨ Setup complete!\n');

  if (webhookSecret) {
    console.log('Add this to your .env file:');
    console.log(`GITHUB_WEBHOOK_SECRET=${webhookSecret}\n`);
  }

  console.log('Next steps:');
  console.log('1. Make sure ShipPost is running at', webhookUrl);
  console.log('2. Push a commit to test the webhook');
  console.log('3. Check #social in Slack for post previews\n');
}

// Run
main().catch(console.error);
