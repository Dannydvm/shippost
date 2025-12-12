/**
 * Projects API
 *
 * REST API for managing projects/brands
 */
const express = require('express');
const router = express.Router();
const projectManager = require('../services/projectManager');
const contentGenerator = require('../services/contentGenerator');
const slackService = require('../services/slackService');
const { publishPost } = require('../services/postBridgeService');

/**
 * List all projects
 * GET /api/projects
 */
router.get('/', async (req, res) => {
  try {
    const projects = await projectManager.getActiveProjects();
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a project
 * GET /api/projects/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const project = await projectManager.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a project
 * POST /api/projects
 *
 * Body:
 * {
 *   "name": "ChiroFlow",
 *   "githubRepo": "username/chiroflow",
 *   "brand": {
 *     "name": "ChiroFlow",
 *     "voice": "casual-founder",
 *     "platforms": ["twitter", "linkedin"],
 *     "accountHandle": "@chiroflowapp"
 *   },
 *   "tagging": {
 *     "alwaysTag": ["@levelsio"],
 *     "topicTags": { "ai": ["@AnthropicAI"] }
 *   },
 *   "postFrequency": "daily-digest"
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { name, githubRepo } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    // Check if repo already configured
    if (githubRepo) {
      const existing = await projectManager.getProjectByRepo(githubRepo);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Repository already configured',
          existingProject: existing.id
        });
      }
    }

    const project = await projectManager.createProject(req.body);

    // Generate webhook URL for response
    const webhookUrl = `${req.protocol}://${req.get('host')}/webhooks/github`;

    res.json({
      success: true,
      project,
      setup: {
        webhookUrl,
        instructions: [
          `1. Go to https://github.com/${githubRepo}/settings/hooks`,
          `2. Add webhook URL: ${webhookUrl}`,
          `3. Content type: application/json`,
          `4. Events: Just the push event`,
          `5. Done! Commits will now generate posts automatically`
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a project
 * PUT /api/projects/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const project = await projectManager.updateProject(req.params.id, req.body);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a project
 * DELETE /api/projects/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await projectManager.deleteProject(req.params.id);
    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate posts for a project (manual trigger)
 * POST /api/projects/:id/generate
 */
router.post('/:id/generate', async (req, res) => {
  try {
    const project = await projectManager.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Get unprocessed commits
    const commits = await projectManager.getUnprocessedCommits(project.id);

    if (commits.length === 0) {
      return res.json({
        success: true,
        message: 'No new commits to process',
        posts: []
      });
    }

    console.log(`[Generate] Processing ${commits.length} commits for ${project.name}`);

    // Generate posts
    const posts = await contentGenerator.generateAllPosts(
      commits,
      project.brand,
      project.brand.platforms
    );

    // Add IDs to posts
    posts.forEach((post, i) => {
      post.id = `${project.id}-${Date.now()}-${i}`;
      post.projectId = project.id;
    });

    // Send to Slack for approval
    if (posts.length > 0) {
      await slackService.sendBatchPreview(posts, project.slackChannel);
    }

    // Mark commits as processed
    await projectManager.markCommitsProcessed(commits.map(c => c.id || c.sha));

    res.json({
      success: true,
      commitsProcessed: commits.length,
      postsGenerated: posts.length,
      posts
    });
  } catch (error) {
    console.error('[Generate] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Publish a post immediately
 * POST /api/projects/:id/publish
 */
router.post('/:id/publish', async (req, res) => {
  try {
    const { content, platform } = req.body;

    if (!content || !platform) {
      return res.status(400).json({ success: false, error: 'content and platform required' });
    }

    const project = await projectManager.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const result = await publishPost({
      content,
      platform,
      brand: project.brand.name
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get available voice templates
 * GET /api/voices
 */
router.get('/meta/voices', async (req, res) => {
  res.json({
    success: true,
    voices: contentGenerator.VOICE_TEMPLATES
  });
});

/**
 * Get available platforms
 * GET /api/platforms
 */
router.get('/meta/platforms', async (req, res) => {
  res.json({
    success: true,
    platforms: contentGenerator.PLATFORM_FORMATS
  });
});

module.exports = router;
