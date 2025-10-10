/**
 * Agent Controller
 * Handles AI agent management and campaign assignments
 */

const { getPrismaClient } = require('../config/prisma');
const logger = require('../utils/logger');
const AgentSelectionService = require('../services/AgentSelectionService');

const prisma = getPrismaClient();

/**
 * @route   POST /api/v1/agents
 * @desc    Create a new agent
 * @access  Public
 */
exports.createAgent = async (req, res) => {
  try {
    const { name, description, voiceId, personality, systemPrompt, metadata = {} } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Agent name is required',
      });
    }

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        name,
        description,
        voiceId,
        personality,
        systemPrompt,
        metadata,
        isActive: true,
      },
    });

    logger.info(`Agent created: ${agent.id} - ${agent.name}`);

    res.status(201).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    logger.error('Error creating agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create agent',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/agents
 * @desc    Get all agents
 * @access  Public
 */
exports.getAllAgents = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              campaignAgents: true,
            },
          },
        },
      }),
      prisma.agent.count({ where }),
    ]);

    res.json({
      success: true,
      data: agents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agents',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/agents/:id
 * @desc    Get agent by ID
 * @access  Public
 */
exports.getAgentById = async (req, res) => {
  try {
    const { id } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        campaignAgents: {
          include: {
            campaign: true,
          },
        },
      },
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    logger.error('Error fetching agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent',
      details: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/agents/:id
 * @desc    Update agent
 * @access  Public
 */
exports.updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, voiceId, personality, systemPrompt, isActive, metadata } = req.body;

    const existingAgent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (voiceId !== undefined) updateData.voiceId = voiceId;
    if (personality !== undefined) updateData.personality = personality;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (metadata !== undefined) updateData.metadata = metadata;

    const agent = await prisma.agent.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Agent updated: ${agent.id}`);

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    logger.error('Error updating agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent',
      details: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/agents/:id
 * @desc    Delete agent
 * @access  Public
 */
exports.deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        campaignAgents: {
          where: {
            campaign: {
              status: 'active',
            },
          },
        },
      },
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    // Don't allow deleting if agent is assigned to active campaigns
    if (agent.campaignAgents.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete agent assigned to active campaigns',
      });
    }

    await prisma.agent.delete({
      where: { id },
    });

    logger.info(`Agent deleted: ${id}`);

    res.json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete agent',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/campaigns/:campaignId/agents
 * @desc    Assign agent to campaign
 * @access  Public
 */
exports.assignAgentToCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { agentId, isPrimary = false } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required',
      });
    }

    // Check if campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    // Check if agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    // Check if already assigned
    const existing = await prisma.campaignAgent.findUnique({
      where: {
        campaignId_agentId: {
          campaignId,
          agentId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Agent already assigned to this campaign',
      });
    }

    // Create assignment
    const assignment = await prisma.campaignAgent.create({
      data: {
        campaignId,
        agentId,
        isPrimary,
      },
      include: {
        agent: true,
      },
    });

    logger.info(`Agent ${agentId} assigned to campaign ${campaignId}`);

    res.status(201).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    logger.error('Error assigning agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign agent',
      details: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/campaigns/:campaignId/agents/:agentId
 * @desc    Remove agent from campaign
 * @access  Public
 */
exports.removeAgentFromCampaign = async (req, res) => {
  try {
    const { campaignId, agentId } = req.params;

    const assignment = await prisma.campaignAgent.findUnique({
      where: {
        campaignId_agentId: {
          campaignId,
          agentId,
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Agent assignment not found',
      });
    }

    await prisma.campaignAgent.delete({
      where: {
        campaignId_agentId: {
          campaignId,
          agentId,
        },
      },
    });

    logger.info(`Agent ${agentId} removed from campaign ${campaignId}`);

    res.json({
      success: true,
      message: 'Agent removed from campaign successfully',
    });
  } catch (error) {
    logger.error('Error removing agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove agent',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/campaigns/:campaignId/agents
 * @desc    Get all agents assigned to campaign with availability
 * @access  Public
 */
exports.getCampaignAgents = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const assignments = await prisma.campaignAgent.findMany({
      where: { campaignId },
      include: {
        agent: true,
      },
      orderBy: {
        isPrimary: 'desc',
      },
    });

    // Add availability info
    const agentsWithAvailability = assignments.map(assignment => {
      const activeCalls = AgentSelectionService.activeCallsPerAgent.get(assignment.agent.id) || 0;
      return {
        ...assignment,
        agent: {
          ...assignment.agent,
          activeCalls,
          available: activeCalls < assignment.agent.maxConcurrentCalls,
          loadPercentage: Math.round((activeCalls / assignment.agent.maxConcurrentCalls) * 100)
        }
      };
    });

    res.json({
      success: true,
      data: agentsWithAvailability,
    });
  } catch (error) {
    logger.error('Error fetching campaign agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign agents',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/agents/load-stats
 * @desc    Get agent load statistics
 * @access  Public
 */
exports.getAgentLoadStats = async (req, res) => {
  try {
    const loadStats = AgentSelectionService.getAgentLoadStats();

    // Get all agents with their current load
    const agents = await prisma.agent.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        maxConcurrentCalls: true
      }
    });

    const agentsWithLoad = agents.map(agent => ({
      ...agent,
      activeCalls: loadStats[agent.id] || 0,
      available: (loadStats[agent.id] || 0) < agent.maxConcurrentCalls,
      loadPercentage: Math.round(((loadStats[agent.id] || 0) / agent.maxConcurrentCalls) * 100)
    }));

    res.json({
      success: true,
      data: agentsWithLoad,
      summary: {
        totalAgents: agents.length,
        activeAgents: agentsWithLoad.filter(a => a.activeCalls > 0).length,
        availableAgents: agentsWithLoad.filter(a => a.available).length,
        totalActiveCalls: Object.values(loadStats).reduce((sum, calls) => sum + calls, 0)
      }
    });
  } catch (error) {
    logger.error('Error fetching agent load stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent load stats',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/campaigns/:campaignId/agents/available
 * @desc    Get available agents for campaign
 * @access  Public
 */
exports.getCampaignAvailableAgents = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const availableAgents = await AgentSelectionService.getAvailableAgents(campaignId);

    res.json({
      success: true,
      data: availableAgents,
      summary: {
        total: availableAgents.length,
        available: availableAgents.filter(a => a.available).length,
        primary: availableAgents.filter(a => a.isPrimary).length
      }
    });
  } catch (error) {
    logger.error('Error fetching available agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available agents',
      details: error.message,
    });
  }
};

module.exports = exports;
