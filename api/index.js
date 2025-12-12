/**
 * ShipPost - Vercel Serverless Entry Point
 */

// Simple handler to test
module.exports = async (req, res) => {
  try {
    // Import Express app lazily
    const app = require('../src/index');

    // Let Express handle the request
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
