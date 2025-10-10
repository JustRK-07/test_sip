/**
 * API Routes
 * Main router that combines all route modules
 */

const express = require('express');
const campaignRoutes = require('./campaignRoutes');
const leadRoutes = require('./leadRoutes');
const leadRoutesIndependent = require('./leadRoutesIndependent'); // NEW: Independent leads API
const agentRoutes = require('./agentRoutes');

// NEW: Tenant and Trunk management routes
const tenantRoutes = require('./tenantRoutes');
const platformTrunkRoutes = require('./platformTrunkRoutes');
const livekitTrunkRoutes = require('./livekitTrunkRoutes');
const phoneNumberRoutes = require('./phoneNumbers');

// NEW: Webhook routes for inbound calls
const webhookRoutes = require('./webhookRoutes');

// NEW: Authentication routes
const authRoutes = require('./authRoutes');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Campaign Calling API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount tenant-scoped routes (new consistent pattern)
router.use('/tenants', campaignRoutes);     // Campaigns: /tenants/:tenantId/campaigns
router.use('/tenants', leadRoutes);         // Campaign leads: /tenants/:tenantId/campaigns/:campaignId/leads
router.use('/tenants', leadRoutesIndependent); // All leads: /tenants/:tenantId/leads
router.use('/tenants', phoneNumberRoutes);  // Phone numbers: /tenants/:tenantId/phone-numbers

// Mount tenant management routes
router.use('/tenants', tenantRoutes);       // Tenant CRUD: /tenants

// Mount global routes (not tenant-scoped)
router.use('/agents', agentRoutes);         // Agents: /agents
router.use('/platform-trunks', platformTrunkRoutes); // Platform trunks: /platform-trunks
router.use('/livekit-trunks', livekitTrunkRoutes);   // LiveKit trunks: /livekit-trunks

// Mount authentication routes (public)
router.use('/auth', authRoutes);            // Auth: /auth

// Mount webhook routes (no auth required for webhooks)
router.use('/webhooks', webhookRoutes);

module.exports = router;
