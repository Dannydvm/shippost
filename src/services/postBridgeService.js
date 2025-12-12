/**
 * Post-Bridge Service
 *
 * Integration with Post-Bridge API for multi-platform posting
 * https://www.post-bridge.com/
 *
 * API Docs: https://api.post-bridge.com/
 */
const axios = require('axios');
const config = require('../config');

const API_BASE = 'https://api.post-bridge.com/v1';

// Account IDs from Post-Bridge (Danny's accounts)
const ACCOUNT_IDS = {
  twitter: 38571,      // @dannyveigatx
  instagram: 38572,    // @iamdannyveiga
  facebook: 38573,     // Danny Veiga (Page)
  linkedin: 38574,     // Danny Veiga (Personal)
  linkedin_company: 38575  // Danny Veiga Marketing
};

class PostBridgeService {
  constructor() {
    this.apiKey = config.postBridgeApiKey;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get all connected social accounts
   */
  async getAccounts() {
    try {
      const response = await axios.get(`${API_BASE}/social-accounts`, {
        headers: this.getHeaders()
      });
      return response.data.data || [];
    } catch (error) {
      console.error('[PostBridge] Failed to get accounts:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Create a post
   *
   * @param {Object} options
   * @param {string} options.caption - The post content
   * @param {string[]} options.platforms - ['twitter', 'linkedin', etc]
   * @param {Date} options.scheduledAt - Optional: schedule for later
   * @param {string[]} options.mediaIds - Optional: media to attach
   */
  async createPost(options) {
    const { caption, platforms, scheduledAt, mediaIds } = options;

    // Map platforms to account IDs
    const socialAccounts = platforms
      .map(p => ACCOUNT_IDS[p])
      .filter(Boolean);

    if (socialAccounts.length === 0) {
      return { success: false, error: 'No valid platforms specified' };
    }

    const payload = {
      caption,
      social_accounts: socialAccounts,
      ...(scheduledAt && { scheduled_at: scheduledAt.toISOString() }),
      ...(mediaIds && { media: mediaIds })
    };

    try {
      const response = await axios.post(`${API_BASE}/posts`, payload, {
        headers: this.getHeaders()
      });

      console.log('[PostBridge] Post created:', response.data);

      return {
        success: true,
        postId: response.data.id,
        status: response.data.status,
        data: response.data
      };
    } catch (error) {
      console.error('[PostBridge] Create post error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get post status
   */
  async getPost(postId) {
    try {
      const response = await axios.get(`${API_BASE}/posts/${postId}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('[PostBridge] Get post error:', error.message);
      return null;
    }
  }

  /**
   * Get post results (what actually got published)
   */
  async getPostResults(postId) {
    try {
      const response = await axios.get(`${API_BASE}/post-results?post_id=${postId}`, {
        headers: this.getHeaders()
      });
      return response.data.data || [];
    } catch (error) {
      console.error('[PostBridge] Get results error:', error.message);
      return [];
    }
  }

  /**
   * Delete a post
   */
  async deletePost(postId) {
    try {
      await axios.delete(`${API_BASE}/posts/${postId}`, {
        headers: this.getHeaders()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload media and get ID for attaching to posts
   */
  async uploadMedia(fileBuffer, filename, mimeType) {
    try {
      // Step 1: Get signed upload URL
      const urlResponse = await axios.post(`${API_BASE}/media/create-upload-url`, {
        filename,
        content_type: mimeType
      }, { headers: this.getHeaders() });

      const { upload_url, media_id } = urlResponse.data;

      // Step 2: Upload to signed URL
      await axios.put(upload_url, fileBuffer, {
        headers: { 'Content-Type': mimeType }
      });

      return { success: true, mediaId: media_id };
    } catch (error) {
      console.error('[PostBridge] Upload error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

const postBridgeService = new PostBridgeService();

module.exports = {
  postBridgeService,
  ACCOUNT_IDS,

  /**
   * Main publish function used by ShipPost
   */
  async publishPost(post) {
    if (!config.postBridgeApiKey) {
      console.log('[ShipPost] Post-Bridge not configured');
      return { success: false, error: 'Post-Bridge not configured' };
    }

    // Map platform names
    const platformMap = {
      'twitter': 'twitter',
      'x': 'twitter',
      'linkedin': 'linkedin',
      'instagram': 'instagram',
      'facebook': 'facebook',
      'fb': 'facebook'
    };

    const platform = platformMap[post.platform?.toLowerCase()] || post.platform;

    return postBridgeService.createPost({
      caption: post.content,
      platforms: [platform]
    });
  }
};
