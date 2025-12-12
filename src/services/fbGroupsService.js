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
// Open is an ES module, use dynamic import only when needed locally
let open = null;
async function getOpen() {
  if (process.env.VERCEL) return null; // Can't open browsers on Vercel
  if (!open) {
    open = (await import('open')).default;
  }
  return open;
}

// Danny's FB Groups & Profiles
const FB_GROUPS = {
  // Chadix - Local SEO community
  'chadix': {
    name: 'Chadix Local SEO',
    url: 'https://www.facebook.com/groups/991392238948400',
    category: 'tech',
    brand: 'chadix',
    postType: 'full', // Full feature announcements
    description: 'Local SEO tools and strategies'
  },
  // Chiropractic Marketing - Main bread winner ($120K MRR)
  'chiro-marketing': {
    name: 'Chiropractic Marketing & Practice Growth',
    url: 'https://www.facebook.com/groups/671382746877005',
    category: 'chiropractic',
    brand: 'chiroflow',
    postType: 'full', // Full feature announcements
    description: 'ChiroFlow CRM and App community'
  },
  // Personal FB profile - light updates only
  'personal-fb': {
    name: 'Danny Veiga (Personal FB)',
    url: 'https://www.facebook.com/',
    category: 'personal',
    brand: 'danny-personal',
    postType: 'light', // Quick updates, don't reveal too much
    description: 'Personal profile for light updates'
  }
};

// Platform routing per project
const PLATFORM_ROUTING = {
  'chiroflow-crm': {
    full: ['chiro-marketing'],           // FB Group - full posts
    light: ['twitter', 'personal-fb']     // X & Personal FB - light updates
  },
  'chiroflow-app': {
    full: ['chiro-marketing'],
    light: ['twitter', 'personal-fb']
  },
  'chadix': {
    full: ['chadix', 'linkedin'],         // Chadix FB + LinkedIn - full posts
    light: ['twitter', 'personal-fb']     // X & Personal FB - light updates
  },
  'shippost': {
    full: ['twitter'],                    // X - full posts (it's open source)
    light: ['personal-fb']                // Personal FB - light updates
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
   * Note: This only works locally, not on Vercel
   */
  async openGroupForPosting(groupId, content) {
    const group = this.groups[groupId];
    if (!group) {
      return { success: false, error: `Group not found: ${groupId}` };
    }

    // Skip browser operations on Vercel
    if (process.env.VERCEL) {
      return {
        success: false,
        error: 'Cannot open browser on serverless platform',
        group: group.name,
        url: group.url
      };
    }

    // Copy content to clipboard (macOS)
    const { execSync } = require('child_process');
    try {
      execSync(`echo ${JSON.stringify(content)} | pbcopy`);
    } catch (err) {
      console.warn('[FBGroups] Could not copy to clipboard:', err.message);
    }

    // Open browser to the group
    const openBrowser = await getOpen();
    if (openBrowser) {
      await openBrowser(group.url);
    }

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
  PLATFORM_ROUTING,

  /**
   * Get platforms for a project
   */
  getPlatformsForProject(projectId) {
    return PLATFORM_ROUTING[projectId] || { full: [], light: [] };
  },

  /**
   * Quick function to queue and open groups for a post
   */
  async postToFBGroups(content, groupIds) {
    const postId = fbGroupsService.queuePost(content, groupIds);
    return fbGroupsService.postToAllGroups(postId);
  }
};
