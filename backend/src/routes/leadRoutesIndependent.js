/**
 * Independent Lead Routes (global lead management)
 * Pattern: /api/v1/tenants/:tenantId/leads
 * For "Leads" tab - manages leads across all campaigns
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireTenantAccess } = require('../utils/routeUtils');
const {
  getAllLeads,
  getLeadById,
  updateLeadById,
  deleteLeadById,
  searchLeads,
  getLeadStats,
  importLeads,
  bulkAssignCampaign,
  bulkUpdateStatus,
  exportLeads,
} = require('../controllers/leadControllerIndependent');

const router = express.Router();

// Global lead management (not campaign-scoped) - All require auth and tenant access
router.get('/:tenantId/leads', authenticateToken, requireTenantAccess, getAllLeads);
router.get('/:tenantId/leads/search', authenticateToken, requireTenantAccess, searchLeads);
router.get('/:tenantId/leads/stats', authenticateToken, requireTenantAccess, getLeadStats);
router.get('/:tenantId/leads/export', authenticateToken, requireTenantAccess, exportLeads);
router.post('/:tenantId/leads/import', authenticateToken, requireTenantAccess, importLeads);
router.post('/:tenantId/leads/bulk/assign', authenticateToken, requireTenantAccess, bulkAssignCampaign);
router.post('/:tenantId/leads/bulk/status', authenticateToken, requireTenantAccess, bulkUpdateStatus);
router.get('/:tenantId/leads/:leadId', authenticateToken, requireTenantAccess, getLeadById);
router.put('/:tenantId/leads/:leadId', authenticateToken, requireTenantAccess, updateLeadById);
router.delete('/:tenantId/leads/:leadId', authenticateToken, requireTenantAccess, deleteLeadById);

module.exports = router;
