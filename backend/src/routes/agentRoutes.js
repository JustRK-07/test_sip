/**
 * Agent Routes
 */

const express = require('express');
const {
  createAgent,
  getAllAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
  assignAgentToCampaign,
  removeAgentFromCampaign,
  getCampaignAgents,
} = require('../controllers/agentController');

const router = express.Router();

// Agent CRUD
router.post('/', createAgent);
router.get('/', getAllAgents);
router.get('/:id', getAgentById);
router.put('/:id', updateAgent);
router.delete('/:id', deleteAgent);

module.exports = router;
