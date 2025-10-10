/**
 * Independent Lead Controller
 * Handles global lead management (not scoped to campaigns)
 * For "Leads" tab in UI
 */

const { getPrismaClient } = require('../config/prisma');
const logger = require('../utils/logger');
const { addTenantFilter, addTenantToData } = require('../utils/tenantHelper');

const prisma = getPrismaClient();

/**
 * @route   GET /api/v1/tenants/:tenantId/leads
 * @desc    Get all leads across all campaigns
 * @access  Protected (JWT required, tenant access validated)
 * @query   ?page=1&limit=50&status=pending&campaignId=xxx&search=phone
 */
exports.getAllLeads = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const {
      page = 1,
      limit = 50,
      status,
      campaignId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};
    if (status) where.status = status;
    if (campaignId) where.campaignId = campaignId;
    if (search) {
      where.OR = [
        { phoneNumber: { contains: search } },
        { name: { contains: search } },
      ];
    }
    Object.assign(where, addTenantFilter(where, tenantId));

    // Fetch leads with campaign info
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          callLogs: {
            select: {
              id: true,
              status: true,
              duration: true,
              createdAt: true,
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching all leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/tenants/:tenantId/leads/search
 * @desc    Search leads by phone number or name
 * @access  Protected (JWT required, tenant access validated)
 * @query   ?q=search_term
 */
exports.searchLeads = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const leads = await prisma.lead.findMany({
      where: {
        ...addTenantFilter({}, tenantId),
        OR: [
          { phoneNumber: { contains: q } },
          { name: { contains: q } },
        ],
      },
      take: parseInt(limit),
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: leads,
      count: leads.length,
    });
  } catch (error) {
    logger.error('Error searching leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search leads',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/tenants/:tenantId/leads/stats
 * @desc    Get lead statistics across all campaigns
 * @access  Protected (JWT required, tenant access validated)
 */
exports.getLeadStats = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { campaignId } = req.query;

    const where = campaignId ? { campaignId } : {};
    Object.assign(where, addTenantFilter(where, tenantId));

    const [total, pending, calling, completed, failed, unassigned] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: 'pending' } }),
      prisma.lead.count({ where: { ...where, status: 'calling' } }),
      prisma.lead.count({ where: { ...where, status: 'completed' } }),
      prisma.lead.count({ where: { ...where, status: 'failed' } }),
      prisma.lead.count({ where: { campaignId: null } }),
    ]);

    // Get campaign breakdown
    const campaignBreakdown = await prisma.campaign.findMany({
      where: addTenantFilter({}, tenantId),
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        total,
        byStatus: {
          pending,
          calling,
          completed,
          failed,
        },
        unassigned,
        byCampaign: campaignBreakdown.map(c => ({
          campaignId: c.id,
          campaignName: c.name,
          count: c._count.leads,
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching lead stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead statistics',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/tenants/:tenantId/leads/:leadId
 * @desc    Get a single lead by ID (with full details)
 * @access  Protected (JWT required, tenant access validated)
 */
exports.getLeadById = async (req, res) => {
  try {
    const { tenantId, leadId } = req.params;

    const lead = await prisma.lead.findFirst({
      where: addTenantFilter({ id: leadId }, tenantId),
      include: {
        campaign: true,
        callLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    logger.error('Error fetching lead by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead',
      details: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/tenants/:tenantId/leads/:leadId
 * @desc    Update a lead (can move between campaigns, change status, etc.)
 * @access  Protected (JWT required, tenant access validated)
 */
exports.updateLeadById = async (req, res) => {
  try {
    const { tenantId, leadId } = req.params;
    const { phoneNumber, name, priority, campaignId, status, metadata } = req.body;

    const lead = await prisma.lead.findFirst({
      where: addTenantFilter({ id: leadId }, tenantId),
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    // Don't allow moving leads if campaign is active
    if (campaignId && campaignId !== lead.campaignId) {
      const newCampaign = await prisma.campaign.findFirst({
        where: addTenantFilter({ id: campaignId }, tenantId),
      });

      if (!newCampaign) {
        return res.status(404).json({
          success: false,
          error: 'Target campaign not found',
        });
      }

      if (newCampaign.status === 'active') {
        return res.status(400).json({
          success: false,
          error: 'Cannot move lead to active campaign',
        });
      }
    }

    const updateData = {};
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (name !== undefined) updateData.name = name;
    if (priority !== undefined) updateData.priority = priority;
    if (campaignId !== undefined) updateData.campaignId = campaignId;
    if (status !== undefined) updateData.status = status;
    if (metadata !== undefined) updateData.metadata = metadata;

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info(`Lead updated: ${leadId}`, updateData);

    res.json({
      success: true,
      data: updatedLead,
    });
  } catch (error) {
    logger.error('Error updating lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update lead',
      details: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/tenants/:tenantId/leads/:leadId
 * @desc    Delete a lead (from any campaign)
 * @access  Protected (JWT required, tenant access validated)
 */
exports.deleteLeadById = async (req, res) => {
  try {
    const { tenantId, leadId } = req.params;

    const lead = await prisma.lead.findFirst({
      where: addTenantFilter({ id: leadId }, tenantId),
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    // Don't allow deleting if call is in progress
    if (lead.status === 'calling') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete lead while call is in progress',
      });
    }

    await prisma.lead.delete({
      where: { id: leadId },
    });

    logger.info(`Lead deleted: ${leadId}`);

    res.json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete lead',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/tenants/:tenantId/leads/import
 * @desc    Import leads (optionally assign to campaign)
 * @access  Protected (JWT required, tenant access validated)
 * @body    { leads: [...], campaignId: "optional" }
 */
exports.importLeads = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { leads, campaignId } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Leads array is required and must not be empty',
      });
    }

    // Validate campaign if provided
    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: addTenantFilter({ id: campaignId }, tenantId),
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found',
        });
      }
    }

    // Create leads
    const validLeads = leads.map((lead) =>
      addTenantToData(
        {
          phoneNumber: lead.phoneNumber,
          name: lead.name || lead.phoneNumber,
          priority: lead.priority || 1,
          campaignId: campaignId || null,
          status: 'pending',
          metadata: lead.metadata ? JSON.stringify(lead.metadata) : null,
        },
        tenantId
      )
    );

    let createdCount = 0;
    for (const lead of validLeads) {
      try {
        await prisma.lead.create({ data: lead });
        createdCount++;
      } catch (error) {
        // Skip duplicates
        if (!error.code || error.code !== 'P2002') {
          throw error;
        }
      }
    }

    logger.info(`${createdCount} leads imported${campaignId ? ` to campaign ${campaignId}` : ''}`);

    res.status(201).json({
      success: true,
      data: {
        imported: createdCount,
        total: leads.length,
        campaignId: campaignId || null,
      },
    });
  } catch (error) {
    logger.error('Error importing leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import leads',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/tenants/:tenantId/leads/bulk/assign
 * @desc    Bulk assign leads to a campaign
 * @access  Protected (JWT required, tenant access validated)
 * @body    { leadIds: [...], campaignId: "xxx" }
 */
exports.bulkAssignCampaign = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { leadIds, campaignId } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'leadIds array is required',
      });
    }

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'campaignId is required',
      });
    }

    // Check campaign exists
    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id: campaignId }, tenantId),
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    // Update leads
    const result = await prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        status: { not: 'calling' }, // Don't move leads in active calls
        ...addTenantFilter({}, tenantId),
      },
      data: {
        campaignId,
      },
    });

    logger.info(`${result.count} leads assigned to campaign ${campaignId}`);

    res.json({
      success: true,
      data: {
        updated: result.count,
        requested: leadIds.length,
        campaignId,
      },
    });
  } catch (error) {
    logger.error('Error bulk assigning leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign leads to campaign',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/tenants/:tenantId/leads/bulk/status
 * @desc    Bulk update lead status
 * @access  Protected (JWT required, tenant access validated)
 * @body    { leadIds: [...], status: "pending" }
 */
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { leadIds, status } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'leadIds array is required',
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required',
      });
    }

    const result = await prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        ...addTenantFilter({}, tenantId),
      },
      data: {
        status,
      },
    });

    logger.info(`${result.count} leads updated to status: ${status}`);

    res.json({
      success: true,
      data: {
        updated: result.count,
        requested: leadIds.length,
        status,
      },
    });
  } catch (error) {
    logger.error('Error bulk updating status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update lead status',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/tenants/:tenantId/leads/export
 * @desc    Export leads as CSV
 * @access  Protected (JWT required, tenant access validated)
 * @query   ?campaignId=xxx&status=pending
 */
exports.exportLeads = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { campaignId, status } = req.query;

    const where = {};
    if (campaignId) where.campaignId = campaignId;
    if (status) where.status = status;
    Object.assign(where, addTenantFilter(where, tenantId));

    const leads = await prisma.lead.findMany({
      where,
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Convert to CSV
    const csvHeader = 'Phone Number,Name,Campaign,Status,Priority,Created At\n';
    const csvRows = leads.map(lead =>
      `${lead.phoneNumber},${lead.name || ''},${lead.campaign?.name || 'Unassigned'},${lead.status},${lead.priority},${lead.createdAt}`
    ).join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads-export-${Date.now()}.csv"`);
    res.send(csv);

    logger.info(`Exported ${leads.length} leads as CSV`);
  } catch (error) {
    logger.error('Error exporting leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export leads',
      details: error.message,
    });
  }
};

module.exports = exports;
