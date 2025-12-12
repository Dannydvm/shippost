/**
 * Voice Analyzer Service
 *
 * Learns Danny's writing voice from:
 * 1. SHIPPOST.md example posts in each project
 * 2. Scraped posts from social platforms
 * 3. Stored voice fingerprints
 */
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

// Cache for voice fingerprints
const voiceCache = new Map();

class VoiceAnalyzer {
  /**
   * Load SHIPPOST.md from a project directory
   */
  loadProjectConfig(projectPath) {
    const configPath = path.join(projectPath, 'SHIPPOST.md');

    if (!fs.existsSync(configPath)) {
      console.log(`[VoiceAnalyzer] No SHIPPOST.md found at ${configPath}`);
      return null;
    }

    const content = fs.readFileSync(configPath, 'utf8');
    return this.parseShippostMd(content);
  }

  /**
   * Parse SHIPPOST.md into structured config
   */
  parseShippostMd(content) {
    const sections = {};
    let currentSection = null;
    let currentContent = [];

    for (const line of content.split('\n')) {
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        currentSection = line.replace('## ', '').toLowerCase().replace(/ /g, '_');
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    // Extract example posts
    const examplePosts = [];
    const exampleMatches = content.match(/```[\s\S]*?```/g) || [];
    for (const match of exampleMatches) {
      const post = match.replace(/```/g, '').trim();
      if (post.length > 20) {
        examplePosts.push(post);
      }
    }

    return {
      ...sections,
      examplePosts
    };
  }

  /**
   * Analyze voice from example posts using Claude
   */
  async analyzeVoice(projectId, examplePosts) {
    if (examplePosts.length === 0) {
      return null;
    }

    const cacheKey = `${projectId}_${examplePosts.length}`;
    if (voiceCache.has(cacheKey)) {
      return voiceCache.get(cacheKey);
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analyze these social media posts and extract the writer's voice/style fingerprint.

Posts:
${examplePosts.map((p, i) => `--- Post ${i + 1} ---\n${p}`).join('\n\n')}

Extract:
1. Tone (casual, professional, technical, etc.)
2. Sentence structure patterns
3. Common phrases or expressions
4. Emoji usage pattern
5. Capitalization style
6. How they start posts
7. How they end posts
8. Unique quirks

Format as a JSON object with these fields.`
      }]
    });

    const voiceFingerprint = response.content[0].text;
    voiceCache.set(cacheKey, voiceFingerprint);

    return voiceFingerprint;
  }

  /**
   * Get full context for a project (config + voice)
   */
  async getProjectContext(projectId, projectPath) {
    const config = this.loadProjectConfig(projectPath);

    if (!config) {
      return { projectId, config: null, voice: null };
    }

    const voice = await this.analyzeVoice(projectId, config.examplePosts || []);

    return {
      projectId,
      config,
      voice,
      platforms: this.extractPlatforms(config)
    };
  }

  /**
   * Extract platform routing from config
   */
  extractPlatforms(config) {
    const platforms = {
      full: [],
      light: []
    };

    const platformsSection = config.platforms || '';

    // Parse "Full Posts: X, LinkedIn" format
    const fullMatch = platformsSection.match(/Full Posts[:\s]+([^\n]+)/i);
    if (fullMatch) {
      platforms.full = fullMatch[1]
        .split(/[,&]/)
        .map(p => p.trim().toLowerCase())
        .filter(Boolean);
    }

    const lightMatch = platformsSection.match(/Light Updates[:\s]+([^\n]+)/i);
    if (lightMatch) {
      platforms.light = lightMatch[1]
        .split(/[,&]/)
        .map(p => p.trim().toLowerCase())
        .filter(Boolean);
    }

    return platforms;
  }

  /**
   * Learn from a collection of viral/successful posts
   */
  async learnFromExamples(posts, platform) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyze these successful ${platform} posts and extract what makes them work.

Posts:
${posts.map((p, i) => `--- Post ${i + 1} (${p.engagement || 'high engagement'}) ---\n${p.content}`).join('\n\n')}

Extract:
1. Hook patterns (how they grab attention)
2. Structure patterns
3. Emotional triggers used
4. Call-to-action patterns
5. Hashtag/mention strategies
6. Optimal length observations
7. What makes these specifically good for ${platform}

Format as actionable guidelines I can use when writing new posts.`
      }]
    });

    return response.content[0].text;
  }

  /**
   * Store learned patterns for a platform
   */
  async savePlatformLearnings(platform, learnings) {
    const learningsPath = path.join(__dirname, '..', '..', 'data', 'learnings');

    if (!fs.existsSync(learningsPath)) {
      fs.mkdirSync(learningsPath, { recursive: true });
    }

    fs.writeFileSync(
      path.join(learningsPath, `${platform}.json`),
      JSON.stringify({
        platform,
        learnings,
        updatedAt: new Date().toISOString()
      }, null, 2)
    );
  }

  /**
   * Load platform learnings
   */
  loadPlatformLearnings(platform) {
    const filePath = path.join(__dirname, '..', '..', 'data', 'learnings', `${platform}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
}

const voiceAnalyzer = new VoiceAnalyzer();

module.exports = {
  voiceAnalyzer,
  VoiceAnalyzer
};
