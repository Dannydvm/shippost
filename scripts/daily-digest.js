#!/usr/bin/env node
/**
 * Daily Digest Script
 *
 * Run this via cron at 6pm to generate daily posts for all projects
 *
 * Cron example (6pm daily):
 * 0 18 * * * cd /path/to/shippost && node scripts/daily-digest.js
 */
require('dotenv').config();
const projectManager = require('../src/services/projectManager');
const contentGenerator = require('../src/services/contentGenerator');
const slackService = require('../src/services/slackService');

async function runDailyDigest() {
  console.log('\n🚀 ShipPost Daily Digest\n');
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log('─'.repeat(40));

  try {
    // Get all active projects
    const projects = await projectManager.getActiveProjects();
    console.log(`\nFound ${projects.length} active projects\n`);

    const allPosts = [];

    for (const project of projects) {
      console.log(`\n📦 ${project.name}`);

      // Get today's unprocessed commits
      const commits = await projectManager.getUnprocessedCommits(project.id);
      console.log(`   ${commits.length} commits today`);

      if (commits.length === 0) {
        console.log('   ⏭️  No new commits, skipping');
        continue;
      }

      // Only generate for daily-digest projects (not per-milestone)
      if (project.postFrequency !== 'daily-digest' && project.postFrequency !== 'daily') {
        console.log(`   ⏭️  Post frequency is ${project.postFrequency}, skipping daily digest`);
        continue;
      }

      // Generate posts for each platform
      console.log('   🧠 Generating posts...');
      const posts = await contentGenerator.generateAllPosts(
        commits,
        project.brand,
        project.brand.platforms
      );

      // Add metadata
      posts.forEach((post, i) => {
        post.id = `${project.id}-${Date.now()}-${i}`;
        post.projectId = project.id;
        post.slackChannel = project.slackChannel;
      });

      allPosts.push(...posts);
      console.log(`   ✅ Generated ${posts.length} posts`);

      // Mark commits as processed
      await projectManager.markCommitsProcessed(commits.map(c => c.id || c.sha));
    }

    // Send all posts to Slack
    if (allPosts.length > 0) {
      console.log(`\n📱 Sending ${allPosts.length} posts to Slack for review...`);

      // Group by slack channel
      const byChannel = {};
      for (const post of allPosts) {
        const channel = post.slackChannel || 'social';
        byChannel[channel] = byChannel[channel] || [];
        byChannel[channel].push(post);
      }

      for (const [channel, posts] of Object.entries(byChannel)) {
        await slackService.sendBatchPreview(posts, channel);
        console.log(`   ✅ Sent ${posts.length} posts to #${channel}`);
      }
    } else {
      console.log('\n📭 No posts to generate today');
    }

    console.log('\n' + '─'.repeat(40));
    console.log('✨ Daily digest complete!\n');

  } catch (error) {
    console.error('\n❌ Error running daily digest:', error);
    process.exit(1);
  }
}

// Run
runDailyDigest().then(() => process.exit(0));
