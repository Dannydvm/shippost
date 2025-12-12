/**
 * Manual Announcement Routes
 *
 * For posting about specific features directly to FB groups/platforms
 * without waiting for commit-based generation
 */
const express = require('express');
const router = express.Router();
const contentGenerator = require('../services/contentGenerator');
const slackService = require('../services/slackService');
const { voiceAnalyzer } = require('../services/voiceAnalyzer');
const config = require('../config');

// Project configs with paths and FB group targets
const PROJECTS = {
  'chiroflow': {
    id: 'chiroflow-crm',
    name: 'ChiroFlow',
    localPath: '/Users/chadix/Cline/ChiroFlow Vapi Calendly Integration - New Sales Calls and Onboarding for Upgrades',
    fbGroup: '671382746877005', // ChiroFlow FB Group
    fbGroupName: 'Chiropractic Marketing'
  },
  'chadix': {
    id: 'chadix',
    name: 'Chadix',
    localPath: '/Users/chadix/Cline/chadixv2',
    fbGroup: '991392238948400', // Chadix Local SEO
    fbGroupName: 'Chadix Local SEO'
  },
  'shippost': {
    id: 'shippost',
    name: 'ShipPost',
    localPath: '/Users/chadix/Cline/ShipPost',
    fbGroup: null, // Posts to X instead
    fbGroupName: null
  }
};

/**
 * Generate a feature announcement post
 * POST /announce/feature
 *
 * Body:
 * {
 *   "project": "chiroflow",
 *   "feature": "Playwright automation for GHL workflows",
 *   "description": "Full automation of GHL workflow modifications - something not available via API yet",
 *   "platforms": ["fb-group", "x"] // optional, defaults to project's immediate platforms
 * }
 */
router.post('/feature', async (req, res) => {
  const { project, feature, description, platforms, customMessage } = req.body;

  if (!project || !feature) {
    return res.status(400).json({
      error: 'project and feature required',
      availableProjects: Object.keys(PROJECTS)
    });
  }

  const projectConfig = PROJECTS[project.toLowerCase()];
  if (!projectConfig) {
    return res.status(400).json({
      error: `Unknown project: ${project}`,
      availableProjects: Object.keys(PROJECTS)
    });
  }

  console.log(`[Announce] Feature announcement for ${projectConfig.name}: ${feature}`);

  try {
    // Get project context for voice
    const projectContext = await voiceAnalyzer.getProjectContext(
      projectConfig.id,
      projectConfig.localPath
    );

    // Create a fake commit for the content generator
    const fakeCommit = {
      message: `feat: ${feature}`,
      filesChanged: 5,
      description: description || feature
    };

    // Generate post using the vibe framework
    const post = await contentGenerator.generatePost(
      [fakeCommit],
      {
        ...projectContext,
        config: {
          ...projectContext.config,
          product: projectConfig.name,
          // Override with custom message if provided
          customContext: customMessage || description
        }
      },
      'twitter' // Generate twitter-style first, we'll adapt
    );

    if (!post) {
      return res.json({ success: false, message: 'Could not generate post' });
    }

    // Add FB group context if targeting FB
    const fbPost = projectConfig.fbGroup ? {
      ...post,
      platform: 'fb-group',
      fbGroupId: projectConfig.fbGroup,
      fbGroupName: projectConfig.fbGroupName,
      // FB group posts can be longer and more conversational
      content: post.content.replace(/#\w+/g, '').trim() // Remove hashtags for FB
    } : null;

    // Send to Slack for approval
    const posts = [post];
    if (fbPost) posts.unshift(fbPost); // FB first

    await slackService.sendBatchPreview(posts.map((p, i) => ({
      ...p,
      id: `announce-${Date.now()}-${i}`,
      brand: projectConfig.name
    })));

    res.json({
      success: true,
      project: projectConfig.name,
      feature,
      postsGenerated: posts.length,
      platforms: posts.map(p => p.platform),
      message: 'Posts sent to #social for approval'
    });

  } catch (error) {
    console.error('[Announce] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Quick announce - just provide the message
 * POST /announce/quick
 *
 * Body:
 * {
 *   "project": "chiroflow",
 *   "message": "just shipped playwright automation for GHL workflows - full control without API limitations"
 * }
 */
router.post('/quick', async (req, res) => {
  const { project, message } = req.body;

  if (!project || !message) {
    return res.status(400).json({ error: 'project and message required' });
  }

  const projectConfig = PROJECTS[project.toLowerCase()];
  if (!projectConfig) {
    return res.status(400).json({
      error: `Unknown project: ${project}`,
      availableProjects: Object.keys(PROJECTS)
    });
  }

  const posts = [];

  // Create FB group post if applicable
  if (projectConfig.fbGroup) {
    posts.push({
      id: `quick-${Date.now()}-fb`,
      platform: 'fb-group',
      fbGroupId: projectConfig.fbGroup,
      fbGroupName: projectConfig.fbGroupName,
      content: message.replace(/#\w+/g, '').trim(),
      brand: projectConfig.name,
      generatedAt: new Date().toISOString()
    });
  }

  // Create X post
  posts.push({
    id: `quick-${Date.now()}-x`,
    platform: 'twitter',
    content: message.length > 280 ? message.substring(0, 277) + '...' : message,
    brand: projectConfig.name,
    generatedAt: new Date().toISOString()
  });

  // Send to Slack
  await slackService.sendBatchPreview(posts);

  res.json({
    success: true,
    project: projectConfig.name,
    postsGenerated: posts.length,
    message: 'Posts sent to #social for approval'
  });
});

/**
 * List available projects
 * GET /announce/projects
 */
router.get('/projects', (req, res) => {
  res.json({
    projects: Object.entries(PROJECTS).map(([key, config]) => ({
      key,
      name: config.name,
      fbGroup: config.fbGroupName || 'None (posts to X)',
      immediatePlatforms: config.fbGroup ? ['FB Group', 'X'] : ['X']
    }))
  });
});

module.exports = router;
