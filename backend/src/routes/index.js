/**
 * API Routes
 * Main router that combines all route modules
 */

const express = require('express');
const campaignRoutes = require('./campaignRoutes');
const leadRoutes = require('./leadRoutes');
const agentRoutes = require('./agentRoutes');

// NEW: Tenant and Trunk management routes
const tenantRoutes = require('./tenantRoutes');
const platformTrunkRoutes = require('./platformTrunkRoutes');
const livekitTrunkRoutes = require('./livekitTrunkRoutes');
const phoneNumberRoutes = require('./phoneNumbers');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Campaign Calling API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount existing routes
router.use('/campaigns', campaignRoutes);
router.use('/campaigns', leadRoutes); // Lead routes are nested under campaigns
router.use('/agents', agentRoutes);

// Mount new routes (tenant and trunk management)
router.use('/tenants', tenantRoutes);
router.use('/tenants', phoneNumberRoutes); // Phone numbers are nested under tenants
router.use('/platform-trunks', platformTrunkRoutes);
router.use('/livekit-trunks', livekitTrunkRoutes);

module.exports = router;
