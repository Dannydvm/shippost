/**
 * FB Groups Service
 *
 * Hybrid approach for Facebook Groups/Personal profile posting.
 * Post-Bridge doesn't support FB Groups, so we:
 * 1. Generate content via AI
 * 2. Open browser to the specific group/profile
 * 3. User pastes and posts (one-click feel)
 *
 * Optionally uses Puppeteer to connect to existing Chrome session
 * for semi-automated posting.
 */
const open = require('open');

// Danny's FB Groups (add more as needed)
const FB_GROUPS = {
  // Chiropractic groups
  'chiro-marketing': {
    name: 'Chiropractic Marketing & Practice Growth',
    url: 'https://www.facebook.com/groups/chiromarketinggroup',
    category: 'chiropractic'
  },
  'chiro-tech': {
    name: 'Chiropractic Technology',
    url: 'https://www.facebook.com/groups/chirotechnology',
    category: 'chiropractic'
  },
  // Vibe coding / dev groups
  'indie-hackers': {
    name: 'Indie Hackers',
    url: 'https://www.facebook.com/groups/indiehackers',
    category: 'tech'
  },
  'saas-growth': {
    name: 'SaaS Growth Hacks',
    url: 'https://www.facebook.com/groups/saasgrowth',
    category: 'tech'
  },
  // Personal profile
  'personal': {
    name: 'Danny Veiga (Personal)',
    url: 'https://www.facebook.com/',
    category: 'personal'
  }
};

class FBGroupsService {
  constructor() {
    this.groups = FB_GROUPS;
    this.pendingPosts = new Map(); // postId -> { content, groups, status }
  }

  /**
   * Get all configured groups
   */
  getGroups() {
    return Object.entries(this.groups).map(([id, group]) => ({
      id,
      ...group
    }));
  }

  /**
   * Get groups by category
   */
  getGroupsByCategory(category) {
    return this.getGroups().filter(g => g.category === category);
  }

  /**
   * Add a new group
   */
  addGroup(id, name, url, category = 'general') {
    this.groups[id] = { name, url, category };
    return this.groups[id];
  }

  /**
   * Queue a post for FB groups
   * Returns a postId that can be used to track/open posts
   */
  queuePost(content, groupIds = []) {
    const postId = `fb_${Date.now()}`;

    this.pendingPosts.set(postId, {
      content,
      groups: groupIds.length > 0 ? groupIds : Object.keys(this.groups),
      status: 'pending',
      createdAt: new Date()
    });

    return postId;
  }

  /**
   * Open browser to a specific group with content ready to paste
   * Copies content to clipboard first
   */
  async openGroupForPosting(groupId, content) {
    const group = this.groups[groupId];
    if (!group) {
      return { success: false, error: `Group not found: ${groupId}` };
    }

    // Copy content to clipboard (macOS)
    const { execSync } = require('child_process');
    try {
      execSync(`echo ${JSON.stringify(content)} | pbcopy`);
    } catch (err) {
      console.warn('[FBGroups] Could not copy to clipboard:', err.message);
    }

    // Open browser to the group
    await open(group.url);

    console.log(`[FBGroups] Opened ${group.name} - content copied to clipboard`);

    return {
      success: true,
      group: group.name,
      message: 'Content copied to clipboard. Paste and post!'
    };
  }

  /**
   * Open all groups sequentially for a queued post
   * User can paste and post in each one
   */
  async postToAllGroups(postId) {
    const post = this.pendingPosts.get(postId);
    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    const results = [];

    for (const groupId of post.groups) {
      const result = await this.openGroupForPosting(groupId, post.content);
      results.push({ groupId, ...result });

      // Wait a bit between opens so user can post
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    post.status = 'opened';
    return { success: true, results };
  }

  /**
   * Get the compose URL for a group (with post text pre-filled if possible)
   * Note: FB doesn't support pre-filled text in URLs anymore, but we try
   */
  getComposeUrl(groupId) {
    const group = this.groups[groupId];
    if (!group) return null;

    // For groups, the compose dialog opens when clicking "Write something..."
    return group.url;
  }

  /**
   * Generate a Slack message with buttons to open each group
   */
  generateSlackMessage(postId, content) {
    const post = this.pendingPosts.get(postId);
    if (!post) return null;

    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📘 FB Groups Post Ready*\n\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Click to open each group:*'
          }
        },
        {
          type: 'actions',
          elements: post.groups.slice(0, 5).map(groupId => {
            const group = this.groups[groupId];
            return {
              type: 'button',
              text: {
                type: 'plain_text',
                text: group?.name?.substring(0, 20) || groupId,
                emoji: true
              },
              url: group?.url || '#',
              action_id: `open_group_${groupId}`
            };
          })
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Post ID: ${postId} | Content copied when you click`
            }
          ]
        }
      ]
    };
  }
}

const fbGroupsService = new FBGroupsService();

module.exports = {
  fbGroupsService,
  FB_GROUPS,

  /**
   * Quick function to queue and open groups for a post
   */
  async postToFBGroups(content, groupIds) {
    const postId = fbGroupsService.queuePost(content, groupIds);
    return fbGroupsService.postToAllGroups(postId);
  }
};
