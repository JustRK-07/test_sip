/**
 * Campaign Controller
 * Handles all campaign-related API endpoints
 */

const { getPrismaClient } = require('../config/prisma');
const CampaignQueue = require('../services/CampaignQueue');
const logger = require('../utils/logger');
const { addTenantFilter, addTenantToData } = require('../utils/tenantHelper');

const prisma = getPrismaClient();

// Store active campaign instances
const activeCampaigns = new Map();

/**
 * @route   POST /api/v1/tenants/:tenantId/campaigns
 * @desc    Create a new campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.createCampaign = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const {
      name,
      description,
      maxConcurrent = 3,
      retryFailed = false,
      retryAttempts = 1,
      callDelay = 2000,
      scheduledAt,
      status = 'draft',
      agentName,
      sipTrunkId,
      callerIdNumber,
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name is required',
      });
    }

    // Create campaign in database
    const campaign = await prisma.campaign.create({
      data: addTenantToData(
        {
          name,
          description,
          maxConcurrent,
          retryFailed,
          retryAttempts,
          callDelay,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          status,
          agentName,
          sipTrunkId,
          callerIdNumber,
        },
        tenantId
      ),
    });

    logger.info(`Campaign created: ${campaign.id} - ${campaign.name}`);

    res.status(201).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/tenants/:tenantId/campaigns
 * @desc    Get all campaigns
 * @access  Protected (JWT required, tenant access validated)
 */
exports.getAllCampaigns = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const where = {};
    if (status) {
      where.status = status;
    }
    Object.assign(where, addTenantFilter(where, tenantId));

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              leads: true,
              campaignAgents: true,
            },
          },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    res.json({
      success: true,
      data: campaigns,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/tenants/:tenantId/campaigns/:id
 * @desc    Get campaign by ID
 * @access  Protected (JWT required, tenant access validated)
 */
exports.getCampaignById = async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id }, tenantId),
      include: {
        leads: true,
        campaignAgents: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    logger.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign',
      details: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/tenants/:tenantId/campaigns/:id
 * @desc    Update campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.updateCampaign = async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const {
      name,
      description,
      maxConcurrent,
      retryFailed,
      retryAttempts,
      callDelay,
      scheduledAt,
      agentName,
      sipTrunkId,
      callerIdNumber,
    } = req.body;

    // Check if campaign exists
    const existingCampaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id }, tenantId),
    });

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    // Don't allow updating if campaign is active
    if (existingCampaign.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update active campaign',
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (maxConcurrent !== undefined) updateData.maxConcurrent = maxConcurrent;
    if (retryFailed !== undefined) updateData.retryFailed = retryFailed;
    if (retryAttempts !== undefined) updateData.retryAttempts = retryAttempts;
    if (callDelay !== undefined) updateData.callDelay = callDelay;
    if (scheduledAt !== undefined) {
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    }
    if (agentName !== undefined) updateData.agentName = agentName;
    if (sipTrunkId !== undefined) updateData.sipTrunkId = sipTrunkId;
    if (callerIdNumber !== undefined) updateData.callerIdNumber = callerIdNumber;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Campaign updated: ${campaign.id}`);

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    logger.error('Error updating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
      details: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/tenants/:tenantId/campaigns/:id
 * @desc    Delete campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.deleteCampaign = async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id }, tenantId),
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    // Don't allow deleting active campaigns
    if (campaign.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete active campaign. Stop it first.',
      });
    }

    await prisma.campaign.delete({
      where: { id },
    });

    logger.info(`Campaign deleted: ${id}`);

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/tenants/:tenantId/campaigns/:id/start
 * @desc    Start a campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.startCampaign = async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    // Get campaign with leads
    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id }, tenantId),
      include: {
        leads: {
          where: {
            status: 'pending',
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    if (campaign.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Campaign is already active',
      });
    }

    if (campaign.leads.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No pending leads in campaign',
      });
    }

    // Validate SIP configuration
    if (!campaign.sipTrunkId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign must have sipTrunkId configured to start calling',
      });
    }

    // Update campaign status to active
    await prisma.campaign.update({
      where: { id },
      data: {
        status: 'active',
        startedAt: new Date(),
      },
    });

    // Create campaign queue instance
    const campaignQueue = new CampaignQueue({
      campaignId: campaign.id,
      campaignName: campaign.name,
      maxConcurrent: campaign.maxConcurrent,
      retryFailed: campaign.retryFailed,
      retryAttempts: campaign.retryAttempts,
      callDelay: campaign.callDelay,
      agentName: campaign.agentName,
      sipTrunkId: campaign.sipTrunkId,
      callerIdNumber: campaign.callerIdNumber,
    });

    // Setup event listeners to update database
    campaignQueue.on('call_started', async ({ lead }) => {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'calling' },
      });
    });

    campaignQueue.on('call_completed', async ({ lead, result }) => {
      await Promise.all([
        prisma.lead.update({
          where: { id: lead.id },
          data: { status: 'completed' },
        }),
        prisma.callLog.create({
          data: {
            campaignId: id,
            leadId: lead.id,
            phoneNumber: lead.phoneNumber,
            status: 'completed',
            roomName: result.roomName,
            dispatchId: result.dispatchId, // Agent dispatch ID
            callSid: result.sipCallId, // LiveKit SIP call ID
            duration: result.duration,
            metadata: result,
          },
        }),
      ]);
    });

    campaignQueue.on('call_failed', async ({ lead, error }) => {
      await Promise.all([
        prisma.lead.update({
          where: { id: lead.id },
          data: { status: 'failed' },
        }),
        prisma.callLog.create({
          data: {
            campaignId: id,
            leadId: lead.id,
            phoneNumber: lead.phoneNumber,
            status: 'failed',
            error: error.error || error.message,
            metadata: error,
          },
        }),
      ]);
    });

    campaignQueue.on('campaign_completed', async ({ stats }) => {
      await prisma.campaign.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          totalCalls: stats.total,
          successfulCalls: stats.completed,
          failedCalls: stats.failed,
        },
      });

      // Remove from active campaigns
      activeCampaigns.delete(id);

      logger.info(`Campaign completed: ${id} - ${campaign.name}`);
    });

    // Store campaign instance
    activeCampaigns.set(id, campaignQueue);

    // Add leads and start
    const leadsData = campaign.leads.map((lead) => ({
      id: lead.id,
      phoneNumber: lead.phoneNumber,
      name: lead.name,
      priority: lead.priority,
      metadata: lead.metadata,
    }));

    campaignQueue.addLeads(leadsData);

    // Start campaign asynchronously
    campaignQueue.start().catch((error) => {
      logger.error(`Campaign ${id} failed:`, error);
    });

    logger.info(`Campaign started: ${id} - ${campaign.name}`);

    res.json({
      success: true,
      message: 'Campaign started successfully',
      data: {
        campaignId: id,
        totalLeads: campaign.leads.length,
        maxConcurrent: campaign.maxConcurrent,
      },
    });
  } catch (error) {
    logger.error('Error starting campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start campaign',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/tenants/:tenantId/campaigns/:id/stop
 * @desc    Stop a campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.stopCampaign = async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    // Verify campaign belongs to tenant before stopping
    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id }, tenantId),
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    const campaignQueue = activeCampaigns.get(id);

    if (!campaignQueue) {
      return res.status(400).json({
        success: false,
        error: 'Campaign is not active',
      });
    }

    campaignQueue.stop();
    activeCampaigns.delete(id);

    await prisma.campaign.update({
      where: { id },
      data: {
        status: 'stopped',
        completedAt: new Date(),
      },
    });

    logger.info(`Campaign stopped: ${id}`);

    res.json({
      success: true,
      message: 'Campaign stopped successfully',
    });
  } catch (error) {
    logger.error('Error stopping campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop campaign',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/tenants/:tenantId/campaigns/:id/pause
 * @desc    Pause a campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.pauseCampaign = async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    // Verify campaign belongs to tenant before pausing
    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id }, tenantId),
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    const campaignQueue = activeCampaigns.get(id);

    if (!campaignQueue) {
      return res.status(400).json({
        success: false,
        error: 'Campaign is not active',
      });
    }

    campaignQueue.pause();

    await prisma.campaign.update({
      where: { id },
      data: { status: 'paused' },
    });

    logger.info(`Campaign paused: ${id}`);

    res.json({
      success: true,
      message: 'Campaign paused successfully',
    });
  } catch (error) {
    logger.error('Error pausing campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause campaign',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/tenants/:tenantId/campaigns/:id/resume
 * @desc    Resume a paused campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.resumeCampaign = async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    // Verify campaign belongs to tenant before resuming
    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id }, tenantId),
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    const campaignQueue = activeCampaigns.get(id);

    if (!campaignQueue) {
      return res.status(400).json({
        success: false,
        error: 'Campaign is not active',
      });
    }

    campaignQueue.resume();

    await prisma.campaign.update({
      where: { id },
      data: { status: 'active' },
    });

    logger.info(`Campaign resumed: ${id}`);

    res.json({
      success: true,
      message: 'Campaign resumed successfully',
    });
  } catch (error) {
    logger.error('Error resuming campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume campaign',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/tenants/:tenantId/campaigns/:id/stats
 * @desc    Get campaign statistics
 * @access  Protected (JWT required, tenant access validated)
 */
exports.getCampaignStats = async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id }, tenantId),
      include: {
        leads: true,
        callLogs: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    const stats = {
      totalLeads: campaign.leads.length,
      pending: campaign.leads.filter((l) => l.status === 'pending').length,
      calling: campaign.leads.filter((l) => l.status === 'calling').length,
      completed: campaign.leads.filter((l) => l.status === 'completed').length,
      failed: campaign.leads.filter((l) => l.status === 'failed').length,
      totalCalls: campaign.callLogs.length,
      successfulCalls: campaign.callLogs.filter((c) => c.status === 'completed').length,
      failedCalls: campaign.callLogs.filter((c) => c.status === 'failed').length,
      averageDuration:
        campaign.callLogs.length > 0
          ? Math.round(
              campaign.callLogs.reduce((sum, c) => sum + (c.duration || 0), 0) /
                campaign.callLogs.length
            )
          : 0,
    };

    // Add real-time stats if campaign is active
    const campaignQueue = activeCampaigns.get(id);
    if (campaignQueue) {
      stats.realtime = campaignQueue.getStats();
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching campaign stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign stats',
      details: error.message,
    });
  }
};

module.exports = exports;
