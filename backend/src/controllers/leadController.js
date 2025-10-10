/**
 * Lead Controller
 * Handles lead management (add, upload CSV, bulk operations)
 */

const { getPrismaClient } = require('../config/prisma');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { addTenantFilter, addTenantToData } = require('../utils/tenantHelper');

const prisma = getPrismaClient();

// Configure multer for CSV upload
const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * @route   POST /api/v1/tenants/:tenantId/campaigns/:campaignId/leads
 * @desc    Add a single lead to campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.addLead = async (req, res) => {
  try {
    const { tenantId, campaignId } = req.params;
    const { phoneNumber, name, priority = 1, metadata = {} } = req.body;

    // Validation
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Check if campaign exists
    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id: campaignId }, tenantId),
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    // Check if lead already exists in campaign
    const existingLead = await prisma.lead.findFirst({
      where: {
        campaignId,
        phoneNumber,
      },
    });

    if (existingLead) {
      return res.status(400).json({
        success: false,
        error: 'Lead with this phone number already exists in campaign',
      });
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: addTenantToData(
        {
          campaignId,
          phoneNumber,
          name: name || phoneNumber,
          priority,
          metadata: metadata ? JSON.stringify(metadata) : null,
          status: 'pending',
        },
        tenantId
      ),
    });

    logger.info(`Lead added to campaign ${campaignId}: ${phoneNumber}`);

    res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    logger.error('Error adding lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add lead',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/bulk
 * @desc    Add multiple leads to campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.addLeadsBulk = async (req, res) => {
  try {
    const { tenantId, campaignId } = req.params;
    const { leads } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Leads array is required and must not be empty',
      });
    }

    // Check if campaign exists
    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id: campaignId }, tenantId),
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    // Validate all leads
    const validLeads = [];
    const errors = [];

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];

      if (!lead.phoneNumber) {
        errors.push({
          index: i,
          error: 'Phone number is required',
          data: lead,
        });
        continue;
      }

      validLeads.push(
        addTenantToData(
          {
            campaignId,
            phoneNumber: lead.phoneNumber,
            name: lead.name || lead.phoneNumber,
            priority: lead.priority || 1,
            metadata: lead.metadata ? JSON.stringify(lead.metadata) : null,
            status: 'pending',
          },
          tenantId
        )
      );
    }

    // Create leads (Note: SQLite doesn't support skipDuplicates, so we'll handle duplicates manually)
    let createdCount = 0;
    for (const lead of validLeads) {
      try {
        await prisma.lead.create({ data: lead });
        createdCount++;
      } catch (error) {
        // Skip duplicates (unique constraint violations)
        if (!error.code || error.code !== 'P2002') {
          throw error;
        }
      }
    }

    const createdLeads = { count: createdCount };

    logger.info(`${createdLeads.count} leads added to campaign ${campaignId}`);

    res.status(201).json({
      success: true,
      data: {
        created: createdLeads.count,
        total: leads.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    logger.error('Error adding leads bulk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add leads',
      details: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/upload
 * @desc    Upload CSV file with leads
 * @access  Protected (JWT required, tenant access validated)
 */
exports.uploadLeadsCSV = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { tenantId, campaignId } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'CSV file is required',
        });
      }

      // Check if campaign exists
      const campaign = await prisma.campaign.findFirst({
        where: addTenantFilter({ id: campaignId }, tenantId),
      });

      if (!campaign) {
        // Delete uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          error: 'Campaign not found',
        });
      }

      const leads = [];
      const errors = [];

      // Parse CSV
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (row) => {
            // Expected CSV format: phoneNumber,name,priority,metadata
            const phoneNumber = row.phoneNumber || row.phone || row.number;

            if (!phoneNumber) {
              errors.push({
                row,
                error: 'Phone number is required',
              });
              return;
            }

            leads.push(
              addTenantToData(
                {
                  campaignId,
                  phoneNumber: phoneNumber.trim(),
                  name: row.name?.trim() || phoneNumber.trim(),
                  priority: parseInt(row.priority) || 1,
                  metadata: row.metadata || null,
                  status: 'pending',
                },
                tenantId
              )
            );
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Delete uploaded file
      fs.unlinkSync(req.file.path);

      if (leads.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid leads found in CSV',
          errors,
        });
      }

      // Create leads in database (handle duplicates manually for SQLite)
      let createdCount = 0;
      for (const lead of leads) {
        try {
          await prisma.lead.create({ data: lead });
          createdCount++;
        } catch (error) {
          // Skip duplicates (unique constraint violations)
          if (!error.code || error.code !== 'P2002') {
            throw error;
          }
        }
      }

      const result = { count: createdCount };

      logger.info(`${result.count} leads uploaded to campaign ${campaignId}`);

      res.status(201).json({
        success: true,
        data: {
          uploaded: result.count,
          total: leads.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch (error) {
      // Delete uploaded file if exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      logger.error('Error uploading CSV:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload CSV',
        details: error.message,
      });
    }
  },
];

/**
 * @route   GET /api/v1/tenants/:tenantId/campaigns/:campaignId/leads
 * @desc    Get all leads for a campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.getLeads = async (req, res) => {
  try {
    const { tenantId, campaignId } = req.params;
    const { status, page = 1, limit = 50 } = req.query;

    const skip = (page - 1) * limit;

    const where = {
      campaignId,
      ...addTenantFilter({}, tenantId),
    };
    if (status) {
      where.status = status;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
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
    logger.error('Error fetching leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads',
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/:leadId
 * @desc    Get a single lead
 * @access  Protected (JWT required, tenant access validated)
 */
exports.getLead = async (req, res) => {
  try {
    const { tenantId, campaignId, leadId } = req.params;

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaignId,
        ...addTenantFilter({}, tenantId),
      },
      include: {
        callLogs: true,
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
    logger.error('Error fetching lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead',
      details: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/:leadId
 * @desc    Update a lead
 * @access  Protected (JWT required, tenant access validated)
 */
exports.updateLead = async (req, res) => {
  try {
    const { tenantId, campaignId, leadId } = req.params;
    const { phoneNumber, name, priority, metadata } = req.body;

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaignId,
        ...addTenantFilter({}, tenantId),
      },
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    const updateData = {};
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (name !== undefined) updateData.name = name;
    if (priority !== undefined) updateData.priority = priority;
    if (metadata !== undefined) updateData.metadata = metadata;

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    logger.info(`Lead updated: ${leadId}`);

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
 * @route   DELETE /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/:leadId
 * @desc    Delete a lead
 * @access  Protected (JWT required, tenant access validated)
 */
exports.deleteLead = async (req, res) => {
  try {
    const { tenantId, campaignId, leadId } = req.params;

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaignId,
        ...addTenantFilter({}, tenantId),
      },
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
 * @route   DELETE /api/v1/tenants/:tenantId/campaigns/:campaignId/leads
 * @desc    Delete all leads from campaign
 * @access  Protected (JWT required, tenant access validated)
 */
exports.deleteAllLeads = async (req, res) => {
  try {
    const { tenantId, campaignId } = req.params;

    const campaign = await prisma.campaign.findFirst({
      where: addTenantFilter({ id: campaignId }, tenantId),
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
        error: 'Cannot delete leads while campaign is active',
      });
    }

    const result = await prisma.lead.deleteMany({
      where: addTenantFilter({ campaignId }, tenantId),
    });

    logger.info(`${result.count} leads deleted from campaign ${campaignId}`);

    res.json({
      success: true,
      message: `${result.count} leads deleted successfully`,
    });
  } catch (error) {
    logger.error('Error deleting leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete leads',
      details: error.message,
    });
  }
};

module.exports = exports;
