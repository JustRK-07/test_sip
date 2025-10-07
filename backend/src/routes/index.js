/**
 * API Routes
 * Main router that combines all route modules
 */

const express = require('express');
const campaignRoutes = require('./campaignRoutes');
const leadRoutes = require('./leadRoutes');
const agentRoutes = require('./agentRoutes');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Campaign Calling API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/campaigns', campaignRoutes);
router.use('/campaigns', leadRoutes); // Lead routes are nested under campaigns
router.use('/agents', agentRoutes);

module.exports = router;
