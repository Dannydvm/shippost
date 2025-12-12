/**
 * AI Content Generator
 *
 * Generates natural, engaging social media posts from git commits
 */
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

// Brand voice templates
const VOICE_TEMPLATES = {
  'casual-founder': {
    tone: 'casual, authentic, slightly technical',
    style: 'lowercase okay, emojis sparingly, real talk',
    example: 'just shipped a wild feature - auto-matching FB pages to clients. 37/38 worked first try'
  },
  'professional': {
    tone: 'polished, insightful, thought-leadership',
    style: 'proper capitalization, minimal emojis, focus on value/lessons',
    example: 'Launched automatic Facebook page integration today. Key insight: name normalization solves 90% of matching problems.'
  },
  'technical': {
    tone: 'dev-focused, code snippets welcome, nerdy',
    style: 'technical terms okay, show the how, celebrate clever solutions',
    example: 'TIL: fuzzy string matching with Levenshtein distance is overkill. Simple normalization (lowercase, strip punctuation) got us 97% accuracy.'
  },
  'playful': {
    tone: 'fun, energetic, celebratory',
    style: 'emojis welcome, exclamation points, build hype',
    example: 'BIG UPDATE INCOMING! Your FB pages now auto-connect when you add clients. Zero manual setup!'
  }
};

// Platform-specific formatting
const PLATFORM_FORMATS = {
  twitter: {
    maxLength: 280,
    hashtagStyle: 'inline-minimal', // #buildinpublic at end
    mentionStyle: 'strategic', // tag relevant accounts
    threadable: true
  },
  linkedin: {
    maxLength: 3000,
    hashtagStyle: 'bottom-block', // hashtags at bottom
    mentionStyle: 'professional',
    threadable: false
  },
  threads: {
    maxLength: 500,
    hashtagStyle: 'minimal',
    mentionStyle: 'casual',
    threadable: true
  }
};

// Strategic accounts to tag based on topic
const STRATEGIC_TAGS = {
  ai: ['@AnthropicAI', '@OpenAI', '@ClaudeAI'],
  'vibe-coding': ['@cursor_ai', '@vaborators'],
  'indie-hacker': ['@levelsio', '@marcloudon', '@tdinh_me'],
  saas: ['@pjrvs', '@nathanbarry'],
  chiropractic: ['@ChiroEcon'],
  automation: ['@zapier', '@n8n_io']
};

/**
 * Analyze commits and pick the most "postable" ones
 */
async function analyzeCommits(commits, brand) {
  const commitSummary = commits.map(c => `- ${c.message} (${c.filesChanged} files)`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are analyzing git commits for "${brand.name}" to pick the most interesting ones for a "build in public" social media post.

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
  "suggestedTopics": ["ai", "automation", etc] // for tagging
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
 * Generate a social media post
 */
async function generatePost(commits, brand, platform) {
  const voice = VOICE_TEMPLATES[brand.voice] || VOICE_TEMPLATES['casual-founder'];
  const format = PLATFORM_FORMATS[platform] || PLATFORM_FORMATS.twitter;

  // First analyze which commits to feature
  const analysis = await analyzeCommits(commits, brand);
  if (!analysis) {
    console.log('No postable commits found');
    return null;
  }

  // Generate the actual post
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Generate a ${platform} post for "${brand.name}" about today's shipping progress.

BRAND VOICE:
- Tone: ${voice.tone}
- Style: ${voice.style}
- Example: "${voice.example}"

WHAT WE SHIPPED:
${analysis.selectedCommits.map(c => `- ${c}`).join('\n')}

NARRATIVE: ${analysis.mainTheme}
ANGLE: ${analysis.interestingAngle}

PLATFORM CONSTRAINTS:
- Max length: ${format.maxLength} chars
- Hashtags: ${format.hashtagStyle}

STRATEGIC TAGS TO CONSIDER (only if genuinely relevant):
${analysis.suggestedTopics.map(t => STRATEGIC_TAGS[t] ? `${t}: ${STRATEGIC_TAGS[t].join(', ')}` : '').filter(Boolean).join('\n')}

Generate ONE natural, engaging post. Don't be salesy. Be authentic.
${brand.accountHandle ? `The post is from @${brand.accountHandle}` : ''}

Return ONLY the post text, nothing else.`
    }]
  });

  const postText = response.content[0].text.trim();

  return {
    platform,
    content: postText,
    analysis,
    brand: brand.name,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate posts for all platforms
 */
async function generateAllPosts(commits, brand, platforms = ['twitter', 'linkedin']) {
  const posts = [];

  for (const platform of platforms) {
    try {
      const post = await generatePost(commits, brand, platform);
      if (post) posts.push(post);
    } catch (e) {
      console.error(`Failed to generate ${platform} post:`, e.message);
    }
  }

  return posts;
}

module.exports = {
  analyzeCommits,
  generatePost,
  generateAllPosts,
  VOICE_TEMPLATES,
  PLATFORM_FORMATS,
  STRATEGIC_TAGS
};
