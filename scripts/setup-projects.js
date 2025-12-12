#!/usr/bin/env node
/**
 * Quick Setup - Add Chad's Projects
 *
 * Run: node scripts/setup-projects.js
 */
require('dotenv').config();
const projectManager = require('../src/services/projectManager');

const CHAD_PROJECTS = [
  {
    name: 'Chadix',
    id: 'chadix',
    githubRepo: 'seogrowthmode/chadix', // Update with actual repo
    brand: {
      name: 'Chadix',
      voice: 'casual-founder',
      platforms: ['twitter', 'linkedin'],
      accountHandle: '@caborjrern'
    },
    tagging: {
      alwaysTag: [],
      topicTags: {
        'vibe-coding': ['@cursor_ai', '@ClaudeAI'],
        'indie-hacker': ['@levelsio'],
        'ai': ['@AnthropicAI']
      }
    },
    postFrequency: 'daily-digest'
  },
  {
    name: 'ChiroFlow App',
    id: 'chiroflow-app',
    githubRepo: 'seogrowthmode/chiroflow-app', // Update with actual repo
    brand: {
      name: 'ChiroFlow',
      voice: 'professional',
      platforms: ['twitter', 'linkedin'],
      accountHandle: '@chiroflowapp'
    },
    tagging: {
      alwaysTag: [],
      topicTags: {
        'saas': ['@pjrvs'],
        'healthcare-tech': []
      }
    },
    postFrequency: 'daily-digest'
  },
  {
    name: 'ChiroFlow CRM',
    id: 'chiroflow-crm',
    githubRepo: 'seogrowthmode/chiroflow-calendly',
    brand: {
      name: 'ChiroFlow CRM',
      voice: 'professional',
      platforms: ['linkedin'],
      accountHandle: '@chiroflowcrm'
    },
    tagging: {
      alwaysTag: [],
      topicTags: {
        'crm': [],
        'automation': ['@zapier']
      }
    },
    postFrequency: 'daily-digest'
  }
];

async function setup() {
  console.log('\n🚀 Setting up ShipPost for Chad\'s projects\n');

  for (const projectConfig of CHAD_PROJECTS) {
    try {
      // Check if already exists
      const existing = await projectManager.getProject(projectConfig.id);
      if (existing) {
        console.log(`⏭️  ${projectConfig.name} already exists`);
        continue;
      }

      const project = await projectManager.createProject(projectConfig);
      console.log(`✅ Created: ${project.name}`);
      console.log(`   Repo: ${project.githubRepo}`);
      console.log(`   Voice: ${project.brand.voice}`);
      console.log(`   Platforms: ${project.brand.platforms.join(', ')}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to create ${projectConfig.name}:`, error.message);
    }
  }

  console.log('\n📋 Next steps:');
  console.log('1. Update GitHub repo names in this script if needed');
  console.log('2. Add webhook to each repo:');
  console.log('   URL: https://your-shippost-url/webhooks/github');
  console.log('   Events: Just the push event');
  console.log('3. Add ANTHROPIC_API_KEY to .env');
  console.log('4. Sign up for Post-Bridge and add API key');
  console.log('5. Run: npm start');
  console.log('');
}

setup().then(() => process.exit(0));
