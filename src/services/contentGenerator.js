/**
 * AI Content Generator
 *
 * Generates natural, engaging social media posts from git commits
 * Uses vibe creator framework (400 tweets analysis) for authentic voice
 */
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const { voiceAnalyzer } = require('./voiceAnalyzer');

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

// Load vibe creator framework
function loadVibeFramework() {
  const frameworkPath = path.join(__dirname, '..', '..', 'templates', 'SHIPPOST.md');
  if (fs.existsSync(frameworkPath)) {
    return fs.readFileSync(frameworkPath, 'utf8');
  }
  return null;
}

// Platform-specific formatting
const PLATFORM_FORMATS = {
  twitter: {
    maxLength: 280,
    hashtagStyle: '1-2 max, #buildinpublic primary',
    name: 'X (Twitter)'
  },
  linkedin: {
    maxLength: 3000,
    hashtagStyle: 'bottom block, 3-5 tags',
    name: 'LinkedIn'
  },
  facebook: {
    maxLength: 5000,
    hashtagStyle: 'minimal, community-focused',
    name: 'Facebook'
  },
  instagram: {
    maxLength: 2200,
    hashtagStyle: 'separate comment or bottom block',
    name: 'Instagram'
  }
};

/**
 * Analyze commits and pick the most "postable" ones
 */
async function analyzeCommits(commits, projectContext) {
  const commitSummary = commits.map(c => `- ${c.message} (${c.filesChanged || 0} files)`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are analyzing git commits for "${projectContext.config?.product || 'a project'}" to pick the most interesting ones for a "build in public" social media post.

PROJECT GOAL: ${projectContext.config?.goal || 'Build audience and share progress'}

COMMITS TODAY:
${commitSummary}

Pick 1-3 commits that would make the most engaging social post. Consider:
- User-facing features > internal refactors
- Interesting technical challenges > routine updates
- Milestones > incremental progress
- Things that show personality/struggle > dry updates

Return JSON:
{
  "selectedCommits": ["commit message 1", "commit message 2"],
  "mainTheme": "brief description of the narrative",
  "interestingAngle": "what makes this postable",
  "hookType": "mrr|shipped|til|journey|contrarian",
  "suggestedTopics": ["ai", "automation", etc]
}`
    }]
  });

  try {
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('Failed to parse commit analysis:', e);
    return null;
  }
}

/**
 * Generate a social media post using vibe framework
 */
async function generatePost(commits, projectContext, platform) {
  const format = PLATFORM_FORMATS[platform] || PLATFORM_FORMATS.twitter;
  const vibeFramework = loadVibeFramework();

  // First analyze which commits to feature
  const analysis = await analyzeCommits(commits, projectContext);
  if (!analysis) {
    console.log('No postable commits found');
    return null;
  }

  // Build the prompt with vibe framework
  const systemPrompt = `You are a "build in public" content creator who writes like successful indie hackers (@levelsio, @marclou, @tibo_maker, @jackfriks).

VIBE CREATOR FRAMEWORK (based on 400 tweet analysis):
${vibeFramework ? vibeFramework.substring(0, 8000) : `
## Quick Stats
- 85% use MRR/"shipped"/"TIL" hooks
- 92% casual lowercase voice
- 75% close with #buildinpublic

## Voice Rules
- lowercase everything
- specific numbers ("$9,275 mrr" not "good revenue")
- short punchy sentences
- authentic struggles, not just wins
- questions end posts ("growth hack?" "thoughts?")

## DON'T:
- Corporate speak ("We're excited to announce...")
- Vague metrics ("great results")
- More than 2 hashtags
- Long paragraphs
`}

PROJECT VOICE FINGERPRINT:
${projectContext.voice || 'casual, authentic founder voice'}

PROJECT CONFIG:
- Product: ${projectContext.config?.product || 'SaaS product'}
- Goal: ${projectContext.config?.goal || 'Build audience'}
- Target: ${projectContext.config?.target_audience || 'developers and founders'}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Generate a ${format.name} post about today's shipping progress.

WHAT WE SHIPPED:
${analysis.selectedCommits.map(c => `- ${c}`).join('\n')}

NARRATIVE: ${analysis.mainTheme}
ANGLE: ${analysis.interestingAngle}
HOOK TYPE TO USE: ${analysis.hookType}

PLATFORM CONSTRAINTS:
- Max length: ${format.maxLength} chars
- Hashtags: ${format.hashtagStyle}

Generate ONE natural, engaging post. Be authentic, not salesy.
Return ONLY the post text, nothing else.`
    }]
  });

  const postText = response.content[0].text.trim();

  return {
    id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    platform,
    content: postText,
    analysis,
    brand: projectContext.config?.product || 'Unknown',
    projectId: projectContext.projectId,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate posts for all platforms based on project routing
 */
async function generateAllPosts(commits, projectContext, platforms = ['twitter']) {
  const posts = [];
  const errors = [];

  console.log(`[ContentGenerator] Generating posts for platforms: ${platforms.join(', ')}`);
  console.log(`[ContentGenerator] Commits count: ${commits.length}`);
  console.log(`[ContentGenerator] Project config: ${JSON.stringify(projectContext.config)?.substring(0, 200)}`);

  for (const platform of platforms) {
    try {
      console.log(`[ContentGenerator] Generating ${platform} post...`);
      const post = await generatePost(commits, projectContext, platform);
      if (post) {
        posts.push(post);
        console.log(`[ContentGenerator] ${platform} post generated: ${post.content?.substring(0, 100)}...`);
      } else {
        console.log(`[ContentGenerator] ${platform} post returned null`);
        errors.push({ platform, error: 'Post returned null' });
      }
    } catch (e) {
      console.error(`[ContentGenerator] Failed to generate ${platform} post:`, e.message);
      errors.push({ platform, error: e.message });
    }
  }

  console.log(`[ContentGenerator] Generated ${posts.length} posts, ${errors.length} errors`);
  return posts;
}

/**
 * Generate post for a specific project using its SHIPPOST.md
 */
async function generateForProject(commits, projectId, projectPath) {
  // Load project context (includes voice analysis)
  const projectContext = await voiceAnalyzer.getProjectContext(projectId, projectPath);

  if (!projectContext.config) {
    console.log(`[ContentGenerator] No SHIPPOST.md found for ${projectId}`);
    return [];
  }

  // Determine platforms from routing
  const platforms = projectContext.platforms?.full || ['twitter'];

  return generateAllPosts(commits, projectContext, platforms);
}

module.exports = {
  analyzeCommits,
  generatePost,
  generateAllPosts,
  generateForProject,
  PLATFORM_FORMATS
};
