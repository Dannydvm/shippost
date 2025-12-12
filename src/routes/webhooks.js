/**
 * Webhook Routes
 *
 * Handles GitHub/GitLab webhooks for capturing commits
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const projectManager = require('../services/projectManager');
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

  // Store commits
  const commits = payload.commits || [];
  const storedCommits = [];

  for (const commit of commits) {
    // Skip merge commits and bot commits
    if (commit.message.startsWith('Merge ')) continue;
    if (commit.author?.name?.toLowerCase().includes('bot')) continue;

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

  res.json({
    success: true,
    project: project.name,
    commitsStored: storedCommits.length,
    postFrequency: project.postFrequency
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
  const { projectId, commits } = req.body;

  if (!projectId || !commits) {
    return res.status(400).json({ error: 'projectId and commits required' });
  }

  const project = await projectManager.getProject(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  for (const commit of commits) {
    await projectManager.storeCommit(projectId, commit);
  }

  res.json({ success: true, commitsStored: commits.length });
});

module.exports = router;
