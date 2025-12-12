/**
 * Webhook Routes
 *
 * Handles GitHub/GitLab webhooks for capturing commits
 * Supports both daily-digest and per-commit generation modes
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const projectManager = require('../services/projectManager');
const contentGenerator = require('../services/contentGenerator');
const slackService = require('../services/slackService');
const { voiceAnalyzer } = require('../services/voiceAnalyzer');
const urgencyClassifier = require('../services/urgencyClassifier');
const config = require('../config');

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(req) {
  if (!config.githubWebhookSecret) return true; // Skip if not configured

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', config.githubWebhookSecret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * Process commits immediately (per-commit mode)
 */
async function processCommitsNow(project, commits) {
  console.log(`[Webhook] Per-commit mode: Processing ${commits.length} commits for ${project.name}`);

  try {
    // Get project context
    const projectContext = await voiceAnalyzer.getProjectContext(
      project.id,
      project.localPath
    );

    if (!projectContext.config) {
      console.log(`[Webhook] No SHIPPOST.md found for ${project.name}, skipping generation`);
      return { generated: 0, reason: 'No SHIPPOST.md' };
    }

    // Determine platforms
    const platforms = projectContext.platforms?.full || ['twitter'];

    // Generate posts
    const posts = await contentGenerator.generateAllPosts(commits, projectContext, platforms);

    if (posts.length === 0) {
      console.log(`[Webhook] No postable content found`);
      return { generated: 0, reason: 'No postable commits' };
    }

    // Add metadata
    posts.forEach((post, i) => {
      post.id = `${project.id}-${Date.now()}-${i}`;
      post.projectId = project.id;
      post.slackChannel = project.slackChannel || config.slackChannel;
    });

    // Send to Slack for approval
    if (posts.length === 1) {
      await slackService.sendPostPreview(posts[0]);
    } else {
      await slackService.sendBatchPreview(posts);
    }

    console.log(`[Webhook] Sent ${posts.length} posts to Slack for approval`);
    return { generated: posts.length, posts };

  } catch (error) {
    console.error(`[Webhook] Error processing commits:`, error);
    return { generated: 0, error: error.message };
  }
}

/**
 * GitHub Push Webhook
 * POST /webhooks/github
 *
 * Add this URL to your repo's webhook settings:
 * https://your-shippost-url.com/webhooks/github
 *
 * Events to subscribe: Push events
 */
router.post('/github', async (req, res) => {
  // Verify signature
  if (!verifyGitHubSignature(req)) {
    console.log('[Webhook] Invalid GitHub signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.headers['x-github-event'];

  // Only process push events
  if (event !== 'push') {
    return res.json({ message: `Ignored event: ${event}` });
  }

  const payload = req.body;
  const repoFullName = payload.repository?.full_name;

  if (!repoFullName) {
    return res.status(400).json({ error: 'Missing repository info' });
  }

  console.log(`[Webhook] Push to ${repoFullName}: ${payload.commits?.length || 0} commits`);

  // Find the project for this repo
  const project = await projectManager.getProjectByRepo(repoFullName);

  if (!project) {
    console.log(`[Webhook] No project configured for ${repoFullName}`);
    return res.json({
      message: 'Repository not configured',
      hint: 'Create a project with this githubRepo to enable auto-posting'
    });
  }

  if (!project.active) {
    return res.json({ message: 'Project is paused' });
  }

  // Process commits
  const commits = payload.commits || [];
  const filteredCommits = commits.filter(commit => {
    // Skip merge commits and bot commits
    if (commit.message.startsWith('Merge ')) return false;
    if (commit.author?.name?.toLowerCase().includes('bot')) return false;
    if (commit.message.includes('[skip-post]')) return false;
    return true;
  });

  if (filteredCommits.length === 0) {
    return res.json({ message: 'No postable commits', filtered: commits.length });
  }

  // Store commits regardless of mode
  const storedCommits = [];
  for (const commit of filteredCommits) {
    const stored = await projectManager.storeCommit(project.id, {
      sha: commit.id,
      message: commit.message,
      author: commit.author?.name || commit.author?.username,
      timestamp: commit.timestamp,
      filesChanged: (commit.added?.length || 0) + (commit.modified?.length || 0) + (commit.removed?.length || 0)
    });
    storedCommits.push(stored);
  }

  console.log(`[Webhook] Stored ${storedCommits.length} commits for ${project.name}`);

  // Check post frequency mode
  if (project.postFrequency === 'per-commit' || project.postFrequency === 'immediate') {
    // Generate and send to Slack immediately
    const result = await processCommitsNow(project, storedCommits);

    return res.json({
      success: true,
      project: project.name,
      mode: 'per-commit',
      commitsStored: storedCommits.length,
      postsGenerated: result.generated,
      slackNotified: result.generated > 0
    });
  }

  // Smart mode: AI decides what's immediate vs batch
  if (project.postFrequency === 'smart' || project.postFrequency === 'ai') {
    console.log(`[Webhook] Smart mode: AI classifying ${storedCommits.length} commits`);

    // Get project context for classification
    const projectContext = await voiceAnalyzer.getProjectContext(
      project.id,
      project.localPath
    );

    // AI classifies commits
    const classification = await urgencyClassifier.classifyCommits(storedCommits, projectContext);

    let immediateResult = { generated: 0 };
    if (classification.immediate.length > 0) {
      console.log(`[Webhook] ${classification.immediate.length} commits marked for immediate posting`);
      immediateResult = await processCommitsNow(project, classification.immediate);

      // Mark immediate commits as processed
      await projectManager.markCommitsProcessed(
        classification.immediate.map(c => c.id || c.sha)
      );
    }

    if (classification.batch.length > 0) {
      console.log(`[Webhook] ${classification.batch.length} commits queued for daily digest`);
    }

    return res.json({
      success: true,
      project: project.name,
      mode: 'smart',
      commitsStored: storedCommits.length,
      immediateCommits: classification.immediate.length,
      batchedCommits: classification.batch.length,
      postsGenerated: immediateResult.generated,
      reasoning: classification.reasoning
    });
  }

  // Default: daily-digest mode (just store, process later)
  res.json({
    success: true,
    project: project.name,
    mode: project.postFrequency || 'daily-digest',
    commitsStored: storedCommits.length,
    message: 'Commits queued for daily digest'
  });
});

/**
 * GitLab Push Webhook
 * POST /webhooks/gitlab
 */
router.post('/gitlab', async (req, res) => {
  const event = req.headers['x-gitlab-event'];

  if (event !== 'Push Hook') {
    return res.json({ message: `Ignored event: ${event}` });
  }

  const payload = req.body;
  const repoFullName = payload.project?.path_with_namespace;

  if (!repoFullName) {
    return res.status(400).json({ error: 'Missing repository info' });
  }

  const project = await projectManager.getProjectByRepo(repoFullName);

  if (!project) {
    return res.json({ message: 'Repository not configured' });
  }

  // Store commits
  const commits = payload.commits || [];
  const storedCommits = [];

  for (const commit of commits) {
    if (commit.message.startsWith('Merge ')) continue;

    const stored = await projectManager.storeCommit(project.id, {
      sha: commit.id,
      message: commit.message,
      author: commit.author?.name,
      timestamp: commit.timestamp,
      filesChanged: (commit.added?.length || 0) + (commit.modified?.length || 0) + (commit.removed?.length || 0)
    });

    storedCommits.push(stored);
  }

  // Check for per-commit mode
  if (project.postFrequency === 'per-commit' || project.postFrequency === 'immediate') {
    const result = await processCommitsNow(project, storedCommits);
    return res.json({
      success: true,
      project: project.name,
      mode: 'per-commit',
      commitsStored: storedCommits.length,
      postsGenerated: result.generated
    });
  }

  res.json({
    success: true,
    project: project.name,
    commitsStored: storedCommits.length
  });
});

/**
 * Manual trigger for testing
 * POST /webhooks/test
 */
router.post('/test', async (req, res) => {
  const { projectId, commits, immediate } = req.body;

  if (!projectId || !commits) {
    return res.status(400).json({ error: 'projectId and commits required' });
  }

  const project = await projectManager.getProject(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Store commits
  const storedCommits = [];
  for (const commit of commits) {
    const stored = await projectManager.storeCommit(projectId, commit);
    storedCommits.push(stored);
  }

  // If immediate flag, process now
  if (immediate) {
    const result = await processCommitsNow(project, storedCommits);
    return res.json({
      success: true,
      commitsStored: storedCommits.length,
      postsGenerated: result.generated,
      posts: result.posts
    });
  }

  res.json({ success: true, commitsStored: commits.length });
});

/**
 * Generate post on demand
 * POST /webhooks/generate
 */
router.post('/generate', async (req, res) => {
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId required' });
  }

  const project = await projectManager.getProject(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Get unprocessed commits
  const commits = await projectManager.getUnprocessedCommits(projectId);

  if (commits.length === 0) {
    return res.json({ success: false, message: 'No unprocessed commits' });
  }

  const result = await processCommitsNow(project, commits);

  // Mark as processed
  if (result.generated > 0) {
    await projectManager.markCommitsProcessed(commits.map(c => c.id || c.sha));
  }

  res.json({
    success: true,
    commitsProcessed: commits.length,
    postsGenerated: result.generated
  });
});

module.exports = router;
