/**
 * Campaign Routes
 * Pattern: /api/v1/tenants/:tenantId/campaigns
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireTenantAccess } = require('../utils/routeUtils');
const {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  stopCampaign,
  pauseCampaign,
  resumeCampaign,
  getCampaignStats,
} = require('../controllers/campaignController');

const {
  assignAgentToCampaign,
  removeAgentFromCampaign,
  getCampaignAgents,
  getCampaignAvailableAgents,
} = require('../controllers/agentController');

const router = express.Router();

// Campaign CRUD - All routes require authentication and tenant access
router.post('/:tenantId/campaigns', authenticateToken, requireTenantAccess, createCampaign);
router.get('/:tenantId/campaigns', authenticateToken, requireTenantAccess, getAllCampaigns);
router.get('/:tenantId/campaigns/:id', authenticateToken, requireTenantAccess, getCampaignById);
router.put('/:tenantId/campaigns/:id', authenticateToken, requireTenantAccess, updateCampaign);
router.delete('/:tenantId/campaigns/:id', authenticateToken, requireTenantAccess, deleteCampaign);

// Campaign control
router.post('/:tenantId/campaigns/:id/start', authenticateToken, requireTenantAccess, startCampaign);
router.post('/:tenantId/campaigns/:id/stop', authenticateToken, requireTenantAccess, stopCampaign);
router.post('/:tenantId/campaigns/:id/pause', authenticateToken, requireTenantAccess, pauseCampaign);
router.post('/:tenantId/campaigns/:id/resume', authenticateToken, requireTenantAccess, resumeCampaign);

// Campaign stats
router.get('/:tenantId/campaigns/:id/stats', authenticateToken, requireTenantAccess, getCampaignStats);

// Campaign agents (multi-agent support)
router.get('/:tenantId/campaigns/:campaignId/agents', authenticateToken, requireTenantAccess, getCampaignAgents);
router.get('/:tenantId/campaigns/:campaignId/agents/available', authenticateToken, requireTenantAccess, getCampaignAvailableAgents);
router.post('/:tenantId/campaigns/:campaignId/agents', authenticateToken, requireTenantAccess, assignAgentToCampaign);
router.delete('/:tenantId/campaigns/:campaignId/agents/:agentId', authenticateToken, requireTenantAccess, removeAgentFromCampaign);

module.exports = router;
