#!/usr/bin/env node
/**
 * Quick Setup - Add Danny's Projects
 *
 * Run: node scripts/setup-projects.js
 */
require('dotenv').config();
const projectManager = require('../src/services/projectManager');

const DANNY_PROJECTS = [
  {
    name: 'Chadix',
    id: 'chadix',
    githubRepo: 'seogrowthmode/chadixv2',
    localPath: '/Users/chadix/Cline/chadixv2',
    brand: {
      name: 'Chadix',
      tagline: 'SEO & Business Optimization Platform',
      voice: 'casual-founder',
      platforms: ['twitter', 'linkedin'],
      accountHandle: '@dannyveigatx',
      fbGroups: ['chadix'] // Local SEO FB group
    },
    tagging: {
      alwaysTag: [],
      topicTags: {
        'vibe-coding': ['@cursor_ai', '@ClaudeAI'],
        'indie-hacker': ['@levelsio'],
        'ai': ['@AnthropicAI'],
        'seo': ['@aaborjrern', '@ahrefs']
      }
    },
    postFrequency: 'daily-digest'
  },
  {
    name: 'ChiroFlow App',
    id: 'chiroflow-app',
    githubRepo: 'seogrowthmode/chiroflow-app',
    brand: {
      name: 'ChiroFlow',
      tagline: 'AI-Powered Chiropractic Practice Management',
      voice: 'professional',
      platforms: ['twitter', 'linkedin', 'facebook'],
      accountHandle: '@chiroflowapp',
      fbGroups: ['chiro-marketing'] // $120K MRR chiro group
    },
    tagging: {
      alwaysTag: [],
      topicTags: {
        'saas': ['@pjrvs'],
        'healthcare-tech': [],
        'chiropractic': []
      }
    },
    postFrequency: 'daily-digest'
  },
  {
    name: 'ChiroFlow CRM',
    id: 'chiroflow-crm',
    githubRepo: 'seogrowthmode/chiroflow-calendly',
    localPath: '/Users/chadix/Cline/ChiroFlow Vapi Calendly Integration - New Sales Calls and Onboarding for Upgrades',
    brand: {
      name: 'ChiroFlow CRM',
      tagline: 'AI Voice & Automation for Chiropractic Practices',
      voice: 'professional',
      platforms: ['linkedin', 'facebook'],
      accountHandle: '@chiroflowcrm',
      fbGroups: ['chiro-marketing']
    },
    tagging: {
      alwaysTag: [],
      topicTags: {
        'crm': [],
        'automation': ['@zapier'],
        'voice-ai': ['@vaborjrerni_']
      }
    },
    postFrequency: 'daily-digest'
  },
  {
    name: 'ShipPost',
    id: 'shippost',
    githubRepo: 'Dannydvm/shippost',
    localPath: '/Users/chadix/Cline/ShipPost',
    brand: {
      name: 'ShipPost',
      tagline: 'Build in Public on Autopilot',
      voice: 'casual-founder',
      platforms: ['twitter'],
      accountHandle: '@dannyveigatx',
      fbGroups: ['chadix']
    },
    tagging: {
      alwaysTag: [],
      topicTags: {
        'build-in-public': ['#buildinpublic'],
        'vibe-coding': ['@cursor_ai', '@ClaudeAI']
      }
    },
    postFrequency: 'per-commit' // ShipPost itself should post on every commit
  }
];

async function setup() {
  console.log('\n🚀 Setting up ShipPost for Danny\'s projects\n');

  for (const projectConfig of DANNY_PROJECTS) {
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
      console.log(`   FB Groups: ${project.brand.fbGroups?.join(', ') || 'none'}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to create ${projectConfig.name}:`, error.message);
    }
  }

  console.log('\n📋 Configuration complete!');
  console.log('\nFB Groups configured:');
  console.log('  • chadix -> Chadix Local SEO group');
  console.log('  • chiro-marketing -> Chiropractic Marketing ($120K MRR)');
  console.log('\nPost-Bridge accounts:');
  console.log('  • Twitter: @dannyveigatx');
  console.log('  • Instagram: @iamdannyveiga');
  console.log('  • Facebook Page: Danny Veiga');
  console.log('  • LinkedIn: Danny Veiga (personal + company)');
  console.log('');
}

setup().then(() => process.exit(0));
