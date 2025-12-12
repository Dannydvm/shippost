/**
 * AI Urgency Classifier
 *
 * Decides if commits should be posted immediately or batched for daily digest.
 * Uses Claude to analyze commit significance.
 */
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * Classify commits by urgency
 *
 * Returns: { immediate: [...commits], batch: [...commits] }
 */
async function classifyCommits(commits, projectContext) {
  if (commits.length === 0) {
    return { immediate: [], batch: [] };
  }

  const commitList = commits.map(c =>
    `- ${c.message} (${c.filesChanged || 0} files)`
  ).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You're deciding which commits deserve an immediate "build in public" post vs. which should be batched for a daily digest.

PROJECT: ${projectContext.config?.product || 'SaaS product'}
GOAL: ${projectContext.config?.goal || 'Build audience'}

COMMITS:
${commitList}

CLASSIFY each commit as IMMEDIATE or BATCH:

**IMMEDIATE** (post right away) - these create excitement:
- Major new features users will love
- Milestones (MRR, users, launches)
- Interesting technical breakthroughs
- "Shipped!" moments worth celebrating
- Anything that would make a great standalone post

**BATCH** (save for daily digest) - these are routine:
- Bug fixes (unless major)
- Refactoring/cleanup
- Documentation updates
- Minor tweaks
- Internal changes users don't see
- Multiple small commits that work better as one story

Return JSON:
{
  "immediate": ["exact commit message 1"],
  "batch": ["exact commit message 2", "exact commit message 3"],
  "reasoning": "brief explanation"
}`
    }]
  });

  try {
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Default to batch if parsing fails
      return { immediate: [], batch: commits, reasoning: 'Parse failed, defaulting to batch' };
    }

    const result = JSON.parse(jsonMatch[0]);

    // Map back to full commit objects
    const immediateCommits = commits.filter(c =>
      result.immediate?.some(msg => c.message.includes(msg) || msg.includes(c.message))
    );
    const batchCommits = commits.filter(c =>
      !immediateCommits.includes(c)
    );

    console.log(`[UrgencyClassifier] ${immediateCommits.length} immediate, ${batchCommits.length} batched`);
    console.log(`[UrgencyClassifier] Reasoning: ${result.reasoning}`);

    return {
      immediate: immediateCommits,
      batch: batchCommits,
      reasoning: result.reasoning
    };

  } catch (e) {
    console.error('[UrgencyClassifier] Parse error:', e.message);
    // Default to batch on error
    return { immediate: [], batch: commits, reasoning: 'Error, defaulting to batch' };
  }
}

/**
 * Quick check if a single commit is post-worthy
 */
async function isImmediateWorthy(commit, projectContext) {
  const result = await classifyCommits([commit], projectContext);
  return result.immediate.length > 0;
}

module.exports = {
  classifyCommits,
  isImmediateWorthy
};
