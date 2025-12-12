/**
 * Post-Bridge Service
 *
 * Integration with Post-Bridge API for multi-platform posting
 * https://www.post-bridge.com/
 */
const axios = require('axios');
const config = require('../config');

class PostBridgeService {
  constructor() {
    this.apiUrl = config.postBridgeApiUrl;
    this.apiKey = config.postBridgeApiKey;
  }

  /**
   * Get headers for API requests
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create a post on specified platforms
   *
   * @param {Object} options
   * @param {string} options.content - The post content
   * @param {string[]} options.platforms - Platforms to post to ['twitter', 'linkedin', etc]
   * @param {string[]} options.accountIds - Specific account IDs to use (optional)
   * @param {Date} options.scheduledFor - Schedule for later (optional)
   * @param {Object} options.media - Media attachments (optional)
   */
  async createPost(options) {
    const { content, platforms, accountIds, scheduledFor, media } = options;

    // Build the request based on Post-Bridge API format
    // Note: Actual API format may differ - update once you have access to their docs
    const payload = {
      content,
      platforms: platforms || ['twitter'],
      ...(accountIds && { accountIds }),
      ...(scheduledFor && { scheduledFor: scheduledFor.toISOString() }),
      ...(media && { media })
    };

    try {
      const response = await axios.post(
        `${this.apiUrl}/posts`,
        payload,
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        postId: response.data.id,
        platforms: response.data.platforms,
        status: response.data.status
      };
    } catch (error) {
      console.error('Post-Bridge API error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Schedule a post for optimal engagement time
   */
  async schedulePost(content, platforms, scheduledFor) {
    return this.createPost({
      content,
      platforms,
      scheduledFor
    });
  }

  /**
   * Get list of connected accounts
   */
  async getAccounts() {
    try {
      const response = await axios.get(
        `${this.apiUrl}/accounts`,
        { headers: this.getHeaders() }
      );

      return response.data.accounts || [];
    } catch (error) {
      console.error('Failed to get accounts:', error.message);
      return [];
    }
  }

  /**
   * Get post status
   */
  async getPostStatus(postId) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/posts/${postId}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get post status:', error.message);
      return null;
    }
  }

  /**
   * Delete a scheduled post
   */
  async deletePost(postId) {
    try {
      await axios.delete(
        `${this.apiUrl}/posts/${postId}`,
        { headers: this.getHeaders() }
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to delete post:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Fallback: Direct posting if Post-Bridge not configured
class DirectPostingFallback {
  /**
   * Post directly to Twitter using their API
   * Note: Requires Twitter API credentials (expensive now)
   */
  async postToTwitter(content) {
    console.log('[DirectPosting] Twitter API not configured');
    return { success: false, error: 'Twitter API not configured' };
  }

  /**
   * Post directly to LinkedIn
   * Note: Requires LinkedIn API approval
   */
  async postToLinkedIn(content) {
    console.log('[DirectPosting] LinkedIn API not configured');
    return { success: false, error: 'LinkedIn API not configured' };
  }
}

// Export configured service
const postBridgeService = new PostBridgeService();
const directFallback = new DirectPostingFallback();

module.exports = {
  postBridgeService,
  directFallback,

  /**
   * Main posting function - tries Post-Bridge first, falls back to direct
   */
  async publishPost(post) {
    if (config.postBridgeApiKey) {
      return postBridgeService.createPost({
        content: post.content,
        platforms: [post.platform]
      });
    } else {
      console.log('[ShipPost] Post-Bridge not configured, post saved for manual publishing');
      return {
        success: false,
        error: 'Post-Bridge not configured',
        savedForManual: true,
        content: post.content
      };
    }
  }
};
