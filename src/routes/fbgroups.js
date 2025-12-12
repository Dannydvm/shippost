/**
 * FB Groups Routes
 *
 * API for managing FB Groups posting (hybrid approach)
 */
const express = require('express');
const router = express.Router();
const { fbGroupsService, postToFBGroups } = require('../services/fbGroupsService');
const { generateContent } = require('../services/contentGenerator');

/**
 * GET /api/fbgroups
 * List all configured FB groups
 */
router.get('/', (req, res) => {
  const groups = fbGroupsService.getGroups();
  res.json({ groups });
});

/**
 * GET /api/fbgroups/category/:category
 * Get groups by category (chiropractic, tech, personal)
 */
router.get('/category/:category', (req, res) => {
  const groups = fbGroupsService.getGroupsByCategory(req.params.category);
  res.json({ groups });
});

/**
 * POST /api/fbgroups
 * Add a new FB group
 */
router.post('/', (req, res) => {
  const { id, name, url, category } = req.body;

  if (!id || !name || !url) {
    return res.status(400).json({ error: 'id, name, and url are required' });
  }

  const group = fbGroupsService.addGroup(id, name, url, category);
  res.json({ success: true, group });
});

/**
 * POST /api/fbgroups/queue
 * Queue a post for FB groups
 * Body: { content: string, groups?: string[] }
 */
router.post('/queue', (req, res) => {
  const { content, groups } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  const postId = fbGroupsService.queuePost(content, groups);

  res.json({
    success: true,
    postId,
    message: `Post queued for ${groups?.length || Object.keys(fbGroupsService.groups).length} groups`
  });
});

/**
 * POST /api/fbgroups/post/:postId
 * Open all groups for a queued post
 */
router.post('/post/:postId', async (req, res) => {
  try {
    const result = await fbGroupsService.postToAllGroups(req.params.postId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/fbgroups/open/:groupId
 * Open a specific group with content copied to clipboard
 */
router.post('/open/:groupId', async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  try {
    const result = await fbGroupsService.openGroupForPosting(req.params.groupId, content);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/fbgroups/generate-and-open
 * Generate content from commits and open groups
 * Body: { commits: [...], brand: string, groups?: string[] }
 */
router.post('/generate-and-open', async (req, res) => {
  const { commits, brand, groups } = req.body;

  if (!commits || !commits.length) {
    return res.status(400).json({ error: 'commits array is required' });
  }

  try {
    // Generate content using AI
    const content = await generateContent(commits, {
      brand: brand || 'danny-personal',
      platform: 'facebook' // FB style content
    });

    // Queue and open groups
    const postId = fbGroupsService.queuePost(content.content, groups);
    const result = await fbGroupsService.postToAllGroups(postId);

    res.json({
      success: true,
      content: content.content,
      postId,
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/fbgroups/slack-message/:postId
 * Get Slack message format for a queued post
 */
router.get('/slack-message/:postId', (req, res) => {
  const post = fbGroupsService.pendingPosts.get(req.params.postId);

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const message = fbGroupsService.generateSlackMessage(req.params.postId, post.content);
  res.json(message);
});

module.exports = router;
