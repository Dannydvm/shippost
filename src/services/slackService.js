/**
 * Slack Service
 *
 * Sends post previews to Slack for approval
 */
const axios = require('axios');
const config = require('../config');

const SLACK_API = 'https://slack.com/api';

/**
 * Send a post preview to Slack with approval buttons
 */
async function sendPostPreview(post, channelId = null) {
  const channel = channelId || config.slackChannel;

  const platformEmoji = {
    twitter: ':bird:',
    linkedin: ':briefcase:',
    threads: ':thread:',
    instagram: ':camera:'
  };

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${platformEmoji[post.platform] || ':mega:'} New ${post.platform} post ready`,
        emoji: true
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Brand:* ${post.brand} | *Generated:* ${new Date(post.generatedAt).toLocaleString()}`
        }
      ]
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `\`\`\`${post.content}\`\`\``
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Theme:* ${post.analysis?.mainTheme || 'N/A'} | *Char count:* ${post.content.length}`
        }
      ]
    },
    {
      type: 'divider'
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':white_check_mark: Approve & Post',
            emoji: true
          },
          style: 'primary',
          action_id: 'approve_post',
          value: JSON.stringify({ postId: post.id, platform: post.platform })
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':pencil2: Edit First',
            emoji: true
          },
          action_id: 'edit_post',
          value: JSON.stringify({ postId: post.id })
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':clock3: Schedule',
            emoji: true
          },
          action_id: 'schedule_post',
          value: JSON.stringify({ postId: post.id })
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':x: Skip',
            emoji: true
          },
          style: 'danger',
          action_id: 'skip_post',
          value: JSON.stringify({ postId: post.id })
        }
      ]
    }
  ];

  const response = await axios.post(`${SLACK_API}/chat.postMessage`, {
    channel,
    text: `New ${post.platform} post ready for ${post.brand}`,
    blocks
  }, {
    headers: {
      'Authorization': `Bearer ${config.slackBotToken}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

/**
 * Send multiple post previews (one message with all platforms)
 */
async function sendBatchPreview(posts, channelId = null) {
  const channel = channelId || config.slackChannel;

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':rocket: Daily posts ready for review',
        emoji: true
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*${posts.length} posts* generated from today's commits`
        }
      ]
    },
    {
      type: 'divider'
    }
  ];

  // Add each post as a section
  for (const post of posts) {
    const platformEmoji = {
      twitter: ':bird:',
      linkedin: ':briefcase:',
      threads: ':thread:'
    };

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${platformEmoji[post.platform] || ':mega:'} *${post.platform.toUpperCase()}* (${post.brand})\n\`\`\`${post.content}\`\`\``
      }
    });

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve', emoji: true },
          style: 'primary',
          action_id: `approve_${post.id}`,
          value: JSON.stringify({ postId: post.id, platform: post.platform })
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Edit', emoji: true },
          action_id: `edit_${post.id}`,
          value: JSON.stringify({ postId: post.id })
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Skip', emoji: true },
          style: 'danger',
          action_id: `skip_${post.id}`,
          value: JSON.stringify({ postId: post.id })
        }
      ]
    });

    blocks.push({ type: 'divider' });
  }

  // Add approve all button
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: ':zap: Approve All & Post Now',
          emoji: true
        },
        style: 'primary',
        action_id: 'approve_all',
        value: JSON.stringify({ postIds: posts.map(p => p.id) })
      }
    ]
  });

  const response = await axios.post(`${SLACK_API}/chat.postMessage`, {
    channel,
    text: `${posts.length} posts ready for review`,
    blocks
  }, {
    headers: {
      'Authorization': `Bearer ${config.slackBotToken}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

/**
 * Update message after action (approved/skipped/etc)
 */
async function updateMessage(channel, ts, status, post) {
  const statusEmoji = {
    approved: ':white_check_mark:',
    posted: ':rocket:',
    skipped: ':fast_forward:',
    error: ':x:'
  };

  await axios.post(`${SLACK_API}/chat.update`, {
    channel,
    ts,
    text: `Post ${status}: ${post.content.substring(0, 50)}...`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusEmoji[status] || ':grey_question:'} *${status.toUpperCase()}*\n\`\`\`${post.content}\`\`\``
        }
      }
    ]
  }, {
    headers: {
      'Authorization': `Bearer ${config.slackBotToken}`,
      'Content-Type': 'application/json'
    }
  });
}

module.exports = {
  sendPostPreview,
  sendBatchPreview,
  updateMessage
};
