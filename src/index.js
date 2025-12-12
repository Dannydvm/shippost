/**
 * ShipPost - Build in Public on Autopilot
 *
 * Automatically generates social media posts from your git commits
 */
const express = require('express');
const config = require('./config');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/webhooks', require('./routes/webhooks'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/fbgroups', require('./routes/fbgroups'));
app.use('/api/announce', require('./routes/announce'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ShipPost',
    version: '1.0.0'
  });
});

// Landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ShipPost - Build in Public on Autopilot</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .container {
          text-align: center;
          padding: 40px;
          max-width: 600px;
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        .tagline { font-size: 1.25rem; opacity: 0.9; margin-bottom: 2rem; }
        .features {
          text-align: left;
          background: rgba(255,255,255,0.1);
          padding: 20px 30px;
          border-radius: 12px;
          margin-bottom: 2rem;
        }
        .features li {
          margin: 10px 0;
          list-style: none;
        }
        .features li::before {
          content: "✓ ";
          color: #4ade80;
        }
        code {
          background: rgba(0,0,0,0.3);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        .api-link {
          color: #fbbf24;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 ShipPost</h1>
        <p class="tagline">Build in Public on Autopilot</p>
        <ul class="features">
          <li>Auto-generates posts from git commits</li>
          <li>Multi-platform: Twitter, LinkedIn, Threads</li>
          <li>AI picks the most interesting updates</li>
          <li>Slack preview before posting</li>
          <li>Multiple brand voices</li>
        </ul>
        <p>
          <a href="/api/projects" class="api-link">API →</a> |
          <code>POST /webhooks/github</code>
        </p>
      </div>
    </body>
    </html>
  `);
});

// Start server (only when not in Vercel serverless)
if (!process.env.VERCEL) {
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`
  ┌─────────────────────────────────────────────┐
  │                                             │
  │   🚀 ShipPost is running!                   │
  │                                             │
  │   Local:  http://localhost:${PORT}             │
  │                                             │
  │   Webhooks:                                 │
  │   • POST /webhooks/github                   │
  │   • POST /webhooks/generate                 │
  │                                             │
  │   Announcements:                            │
  │   • POST /api/announce/feature              │
  │   • POST /api/announce/quick                │
  │   • GET  /api/announce/projects             │
  │                                             │
  │   Projects:                                 │
  │   • GET  /api/projects                      │
  │   • POST /api/projects                      │
  │                                             │
  │   FB Groups (hybrid):                       │
  │   • GET  /api/fbgroups                      │
  │   • POST /api/fbgroups/queue                │
  │                                             │
  └─────────────────────────────────────────────┘
    `);
  });
}

module.exports = app;
