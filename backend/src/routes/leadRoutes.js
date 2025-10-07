/**
 * Lead Routes (nested under campaigns)
 */

const express = require('express');
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

// Lead management (all nested under /campaigns/:campaignId)
router.post('/:campaignId/leads', addLead);
router.post('/:campaignId/leads/bulk', addLeadsBulk);
router.post('/:campaignId/leads/upload', uploadLeadsCSV);
router.get('/:campaignId/leads', getLeads);
router.get('/:campaignId/leads/:leadId', getLead);
router.put('/:campaignId/leads/:leadId', updateLead);
router.delete('/:campaignId/leads/:leadId', deleteLead);
router.delete('/:campaignId/leads', deleteAllLeads);

module.exports = router;
