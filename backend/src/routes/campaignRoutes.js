/**
 * Campaign Routes
 */

const express = require('express');
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

const router = express.Router();

// Campaign CRUD
router.post('/', createCampaign);
router.get('/', getAllCampaigns);
router.get('/:id', getCampaignById);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

// Campaign control
router.post('/:id/start', startCampaign);
router.post('/:id/stop', stopCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/resume', resumeCampaign);

// Campaign stats
router.get('/:id/stats', getCampaignStats);

module.exports = router;
