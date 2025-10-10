/**
 * Lead Routes (nested under campaigns)
 * Pattern: /api/v1/tenants/:tenantId/campaigns/:campaignId/leads
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireTenantAccess } = require('../utils/routeUtils');
const {
  addLead,
  addLeadsBulk,
  uploadLeadsCSV,
  getLeads,
  getLead,
  updateLead,
  deleteLead,
  deleteAllLeads,
} = require('../controllers/leadController');

const router = express.Router();

// Lead management (all nested under /tenants/:tenantId/campaigns/:campaignId)
router.post('/:tenantId/campaigns/:campaignId/leads', authenticateToken, requireTenantAccess, addLead);
router.post('/:tenantId/campaigns/:campaignId/leads/bulk', authenticateToken, requireTenantAccess, addLeadsBulk);
router.post('/:tenantId/campaigns/:campaignId/leads/upload', authenticateToken, requireTenantAccess, uploadLeadsCSV);
router.get('/:tenantId/campaigns/:campaignId/leads', authenticateToken, requireTenantAccess, getLeads);
router.get('/:tenantId/campaigns/:campaignId/leads/:leadId', authenticateToken, requireTenantAccess, getLead);
router.put('/:tenantId/campaigns/:campaignId/leads/:leadId', authenticateToken, requireTenantAccess, updateLead);
router.delete('/:tenantId/campaigns/:campaignId/leads/:leadId', authenticateToken, requireTenantAccess, deleteLead);
router.delete('/:tenantId/campaigns/:campaignId/leads', authenticateToken, requireTenantAccess, deleteAllLeads);

module.exports = router;
