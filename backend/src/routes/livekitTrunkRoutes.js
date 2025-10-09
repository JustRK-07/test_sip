const express = require('express');
const { authenticateToken, requireRole, requireAccount } = require('../middleware/auth');
const { randomBytes } = require('crypto');
const { AccessToken, SipClient } = require('livekit-server-sdk');
const {requireTenantAccess} = require("../utils/routeUtils");
const ValidationService = require('../services/ValidationService');
const DatabaseService = require('../services/DatabaseService');
const PaginationService = require('../services/PaginationService');
const ResponseService = require('../services/ResponseService');
const RouteHelperService = require('../services/RouteHelperService');

const router = express.Router();
const prisma = DatabaseService.getClient();

// ID generation helper (similar to cuid format)
const generateLiveKitTrunkId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(6).toString('base64url');
  return `lk${timestamp}${randomPart}`;
};

// Initialize LiveKit SIP client
const getSipClient = () => {
  const livekitUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_SERVER_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error('LiveKit credentials are required in environment variables');
  }

  const sipClient = new SipClient(livekitUrl, apiKey, apiSecret);
  
  return sipClient;
};

// Validation helpers
const validateLiveKitTrunkData = (data) => {
  const errors = [];
  
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  }
  
  if (!data.tenantId || typeof data.tenantId !== 'string' || data.tenantId.trim().length === 0) {
    errors.push('Tenant ID is required and must be a non-empty string');
  }
  
  if (data.livekitRegion && !['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1'].includes(data.livekitRegion)) {
    errors.push('LiveKit Region must be a valid region code');
  }
  
  if (data.trunkType && !['INBOUND', 'OUTBOUND'].includes(data.trunkType)) {
    errors.push('Trunk type must be either INBOUND or OUTBOUND');
  }
  
  if (data.status && !['ACTIVE', 'INACTIVE', 'PROVISIONING', 'ERROR', 'MAINTENANCE'].includes(data.status)) {
    errors.push('Status must be one of: ACTIVE, INACTIVE, PROVISIONING, ERROR, MAINTENANCE');
  }
  
  if (data.maxConcurrentCalls && (!Number.isInteger(data.maxConcurrentCalls) || data.maxConcurrentCalls < 1)) {
    errors.push('Max concurrent calls must be a positive integer');
  }
  
  if (data.codecPreferences && !Array.isArray(data.codecPreferences)) {
    errors.push('Codec preferences must be an array');
  }
  
  return errors;
};

/**
 * @swagger
 * /api/livekit-trunks:
 *   get:
 *     summary: List LiveKit trunks
 *     description: Retrieve a paginated list of LiveKit trunks with optional filtering and sorting capabilities
 *     tags: [LiveKit Trunks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         description: Filter by tenant ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter LiveKit trunks by name or description
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, PROVISIONING, ERROR, MAINTENANCE]
 *         description: Filter by trunk status
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by trunk active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, status, createdAt, updatedAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successfully retrieved LiveKit trunks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LiveKitTrunk'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Build where clause for additional filters
    const baseWhere = {};
    if (req.query.tenantId) {
      baseWhere.tenantId = req.query.tenantId;
    }
    if (req.query.status) {
      baseWhere.status = req.query.status;
    }

    // Build paginated query using PaginationService
    const queryOptions = PaginationService.buildPaginatedQuery({
      query: req.query,
      where: baseWhere,
      searchFields: ['name', 'description'],
      defaultSortBy: 'createdAt',
      defaultSortOrder: 'desc'
    });

    // Add include for relations
    queryOptions.include = {
      tenant: {
        select: {
          id: true,
          name: true,
          domain: true
        }
      },
      platformTrunk: {
        select: {
          id: true,
          name: true
        }
      }
    };

    // Execute paginated query using RouteHelperService
    await RouteHelperService.executePaginatedQuery('liveKitTrunk', queryOptions, res);
  } catch (error) {
    ResponseService.internalError(res, error, 'Failed to fetch LiveKit trunks');
  }
});

/**
 * @swagger
 * /api/livekit-trunks/{id}:
 *   get:
 *     summary: Get LiveKit trunk by ID
 *     description: Retrieve a specific LiveKit trunk by its ID
 *     tags: [LiveKit Trunks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: LiveKit trunk ID
 *     responses:
 *       200:
 *         description: Successfully retrieved LiveKit trunk
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LiveKitTrunk'
 *       404:
 *         description: LiveKit trunk not found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const livekitTrunk = await prisma.liveKitTrunk.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true
          }
        },
        platformTrunk: {
          select: {
            id: true,
            name: true,
            twilioRegion: true
          }
        },
      }
    });

    if (!livekitTrunk) {
      return res.status(404).json({ 
        error: 'LiveKit trunk not found',
        message: `LiveKit trunk with ID ${id} does not exist`
      });
    }

    res.json(livekitTrunk);
  } catch (error) {
    console.error('Error fetching LiveKit trunk:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

/**
 * @swagger
 * /api/livekit-trunks:
 *   post:
 *     summary: Create a new LiveKit trunk
 *     description: Create a new LiveKit trunk with the provided data
 *     tags: [LiveKit Trunks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - tenantId
 *             properties:
 *               name:
 *                 type: string
 *                 description: LiveKit trunk name
 *               description:
 *                 type: string
 *                 description: LiveKit trunk description
 *               livekitRegion:
 *                 type: string
 *                 description: LiveKit region
 *                 enum: [us-east-1, us-west-2, eu-west-1, ap-southeast-1, ap-northeast-1]
 *                 default: "us-east-1"
 *               tenantId:
 *                 type: string
 *                 description: Tenant ID
 *               maxConcurrentCalls:
 *                 type: integer
 *                 description: Maximum concurrent calls
 *                 default: 10
 *               codecPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Preferred audio codecs
 *                 default: ["PCMU", "PCMA", "G722"]
 *     responses:
 *       201:
 *         description: LiveKit trunk created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LiveKitTrunk'
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: LiveKit trunk with this name already exists for the tenant
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const validationErrors = validateLiveKitTrunkData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const {
      name,
      description,
      livekitRegion = 'us-east-1',
      trunkType = 'INBOUND',
      tenantId,
      maxConcurrentCalls = 10,
      codecPreferences = ['PCMU', 'PCMA', 'G722']
    } = req.body;

    // Get LiveKit credentials from environment variables
    const livekitUrl = process.env.LIVEKIT_SERVER_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return res.status(500).json({
        error: 'LiveKit configuration missing',
        message: 'LiveKit credentials are not configured in environment variables'
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(400).json({
        error: 'Invalid tenant',
        message: `Tenant with ID ${tenantId} does not exist`
      });
    }

    // Find the default active platform trunk
    const platformTrunk = await prisma.platformTrunk.findFirst({
      where: {
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!platformTrunk) {
      return res.status(400).json({
        error: 'No platform trunk available',
        message: 'No active platform trunk found. Please create an active platform trunk first.'
      });
    }

    const platformTrunkId = platformTrunk.id;

    // Check if LiveKit trunk with this name already exists for the tenant
    const existingLiveKitTrunk = await prisma.liveKitTrunk.findFirst({
      where: { 
        tenantId: tenantId.trim(),
        name: name.trim()
      }
    });

    if (existingLiveKitTrunk) {
      return res.status(409).json({
        error: 'LiveKit trunk already exists',
        message: `A LiveKit trunk with name "${name}" already exists for this tenant`
      });
    }

    // Provision LiveKit SIP Trunk
    let livekitTrunkId = null;
    let provisioningStatus = 'PROVISIONING';
    
    try {
      const sipClient = getSipClient();
      
      if (trunkType === 'INBOUND') {
        console.log(`Provisioning LiveKit inbound SIP trunk: ${name}`);
        
        // An array of one or more provider phone numbers associated with the trunk.
        const numbers = ['+15555555555']; // Phone numbers will be associated later
        
        const trunkName = name.trim();
        
        // Trunk options
        const trunkOptions = {
          krispEnabled: true,
        };
        
        const inboundTrunk = await sipClient.createSipInboundTrunk(
          trunkName,
          numbers,
          trunkOptions,
        );
        livekitTrunkId = inboundTrunk.sipTrunkId;
        provisioningStatus = 'ACTIVE';
        
        console.log(`Successfully provisioned LiveKit inbound trunk: ${livekitTrunkId}`);
      } else if (trunkType === 'OUTBOUND') {
        console.log(`Provisioning LiveKit outbound SIP trunk: ${name}`);
        
        // Note: createSipOutboundTrunk method signature may be different
        // Using similar pattern as inbound for now
        const numbers = ['+15555555555']; // Phone numbers will be associated later
        const trunkName = name.trim();
        
        const trunkOptions = {
          krispEnabled: true,
          address: `${platformTrunkId}.pstn.twilio.com`,
          transport: 'udp'
        };
        
        const outboundTrunk = await sipClient.createSipOutboundTrunk(
          trunkName,
          numbers,
          trunkOptions,
        );
        livekitTrunkId = outboundTrunk.sipTrunkId;
        provisioningStatus = 'ACTIVE';
        
        console.log(`Successfully provisioned LiveKit outbound trunk: ${livekitTrunkId}`);
      }
    } catch (livekitError) {
      console.error('LiveKit trunk provisioning error:', livekitError);
      provisioningStatus = 'ERROR';
      // Continue with database creation even if LiveKit provisioning fails
      // The trunk can be reprovisioned later
    }

    const livekitTrunk = await prisma.liveKitTrunk.create({
      data: {
        id: generateLiveKitTrunkId(),
        name: name.trim(),
        description: description?.trim(),
        livekitRegion,
        trunkType,
        livekitTrunkId,
        status: provisioningStatus,
        tenantId: tenantId.trim(),
        platformTrunkId: platformTrunkId.trim(),
        maxConcurrentCalls,
        codecPreferences
      },
      include: {
        tenant: {
          select: {
            name: true,
            domain: true
          }
        },
        platformTrunk: {
          select: {
            name: true
          }
        }
      }
    });

    res.status(201).json(livekitTrunk);
  } catch (error) {
    console.error('Error creating LiveKit trunk:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

/**
 * @swagger
 * /api/livekit-trunks/{id}:
 *   put:
 *     summary: Update LiveKit trunk
 *     description: Update an existing LiveKit trunk with the provided data
 *     tags: [LiveKit Trunks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: LiveKit trunk ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: LiveKit trunk name
 *               description:
 *                 type: string
 *                 description: LiveKit trunk description
 *               livekitRegion:
 *                 type: string
 *                 description: LiveKit region
 *                 enum: [us-east-1, us-west-2, eu-west-1, ap-southeast-1, ap-northeast-1]
 *               status:
 *                 type: string
 *                 description: LiveKit trunk status
 *                 enum: [ACTIVE, INACTIVE, PROVISIONING, ERROR, MAINTENANCE]
 *               maxConcurrentCalls:
 *                 type: integer
 *                 description: Maximum concurrent calls
 *               codecPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Preferred audio codecs
 *               isActive:
 *                 type: boolean
 *                 description: Whether the LiveKit trunk is active
 *     responses:
 *       200:
 *         description: LiveKit trunk updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LiveKitTrunk'
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: LiveKit trunk not found
 *       409:
 *         description: LiveKit trunk with this name already exists for the tenant
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if LiveKit trunk exists
    const existingLiveKitTrunk = await prisma.liveKitTrunk.findUnique({
      where: { id }
    });

    if (!existingLiveKitTrunk) {
      return res.status(404).json({
        error: 'LiveKit trunk not found',
        message: `LiveKit trunk with ID ${id} does not exist`
      });
    }

    const validationErrors = validateLiveKitTrunkData({ ...existingLiveKitTrunk, ...req.body });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Check for name uniqueness if name is being updated
    if (req.body.name && req.body.name.trim() !== existingLiveKitTrunk.name) {
      const conflictingTrunk = await prisma.liveKitTrunk.findFirst({
        where: {
          tenantId: existingLiveKitTrunk.tenantId,
          name: req.body.name.trim(),
          id: { not: id }
        }
      });

      if (conflictingTrunk) {
        return res.status(409).json({
          error: 'LiveKit trunk name already exists',
          message: `A LiveKit trunk with name "${req.body.name}" already exists for this tenant`
        });
      }
    }

    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name.trim();
    if (req.body.description !== undefined) updateData.description = req.body.description?.trim();
    if (req.body.livekitRegion !== undefined) updateData.livekitRegion = req.body.livekitRegion;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.maxConcurrentCalls !== undefined) updateData.maxConcurrentCalls = req.body.maxConcurrentCalls;
    if (req.body.codecPreferences !== undefined) updateData.codecPreferences = req.body.codecPreferences;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    const livekitTrunk = await prisma.liveKitTrunk.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            name: true,
            domain: true
          }
        },
        platformTrunk: {
          select: {
            name: true,
            twilioAccountSid: true
          }
        }
      }
    });

    res.json(livekitTrunk);
  } catch (error) {
    console.error('Error updating LiveKit trunk:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

/**
 * @swagger
 * /api/livekit-trunks/{id}:
 *   delete:
 *     summary: Delete LiveKit trunk
 *     description: Delete a LiveKit trunk by ID
 *     tags: [LiveKit Trunks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: LiveKit trunk ID
 *     responses:
 *       200:
 *         description: LiveKit trunk deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: LiveKit trunk deleted successfully
 *       404:
 *         description: LiveKit trunk not found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if LiveKit trunk exists
    const existingLiveKitTrunk = await prisma.liveKitTrunk.findUnique({
      where: { id }
    });

    if (!existingLiveKitTrunk) {
      return res.status(404).json({
        error: 'LiveKit trunk not found',
        message: `LiveKit trunk with ID ${id} does not exist`
      });
    }

    // Delete SIP trunk from LiveKit cloud if it exists
    let livekitDeletionResult = null;
    if (existingLiveKitTrunk.livekitTrunkId) {
      try {
        console.log(`Deleting SIP trunk from LiveKit cloud: ${existingLiveKitTrunk.livekitTrunkId}`);
        const sipClient = getSipClient();
        
        livekitDeletionResult = await sipClient.deleteSipTrunk(existingLiveKitTrunk.livekitTrunkId);
        console.log(`Successfully deleted SIP trunk from LiveKit cloud: ${existingLiveKitTrunk.livekitTrunkId}`);
      } catch (livekitError) {
        console.error('Error deleting SIP trunk from LiveKit cloud:', livekitError);
        // Continue with database deletion even if LiveKit deletion fails
        // This prevents orphaned database records if the trunk was already deleted in LiveKit
        livekitDeletionResult = { error: livekitError.message };
      }
    } else {
      console.log('No LiveKit trunk ID found, skipping LiveKit cloud deletion');
    }

    // Delete from local database
    await prisma.liveKitTrunk.delete({
      where: { id }
    });

    const response = {
      message: 'LiveKit trunk deleted successfully',
      livekitCloudDeletion: livekitDeletionResult ? {
        status: livekitDeletionResult.error ? 'failed' : 'success',
        ...(livekitDeletionResult.error && { error: livekitDeletionResult.error })
      } : 'skipped'
    };

    res.json(response);
  } catch (error) {
    console.error('Error deleting LiveKit trunk:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

module.exports = router;