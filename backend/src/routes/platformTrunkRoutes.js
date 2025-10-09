const express = require('express');
const { authenticateToken, requireRole, requireAccount } = require('../middleware/auth');
const { randomBytes } = require('crypto');
const TwilioService = require('../services/TwilioService');
const ValidationService = require('../services/ValidationService');
const DatabaseService = require('../services/DatabaseService');
const PaginationService = require('../services/PaginationService');
const ResponseService = require('../services/ResponseService');
const RouteHelperService = require('../services/RouteHelperService');

const router = express.Router();
const prisma = DatabaseService.getClient();

// ID generation helper (similar to cuid format)
const generatePlatformTrunkId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(6).toString('base64url');
  return `pt${timestamp}${randomPart}`;
};

/**
 * @swagger
 * /api/platform-trunks:
 *   get:
 *     summary: List all platform trunks
 *     description: Retrieve a paginated list of platform trunks with optional filtering and sorting capabilities
 *     tags: [Platform Trunks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Search term to filter platform trunks by name or description
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by platform trunk active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt]
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
 *         description: Successfully retrieved platform trunks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PlatformTrunk'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Build paginated query using PaginationService
    const queryOptions = PaginationService.buildPaginatedQuery({
      query: req.query,
      searchFields: ['name', 'description'],
      defaultSortBy: 'createdAt',
      defaultSortOrder: 'desc'
    });

    // Execute paginated query using DatabaseService
    const { data: platformTrunks, totalCount } = await DatabaseService.executePaginatedQuery('platformTrunk', {
      ...queryOptions,
      select: {
        id: true,
        name: true,
        description: true,
        twilioRegion: true,
        isActive: true,
        maxChannels: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            livekitTrunks: true
          }
        }
      }
    });

    // Format response using PaginationService
    const response = PaginationService.formatPaginatedResponse(platformTrunks, {
      ...queryOptions.paginationParams,
      totalCount
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching platform trunks:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

/**
 * @swagger
 * /api/platform-trunks/{id}:
 *   get:
 *     summary: Get platform trunk by ID
 *     description: Retrieve a specific platform trunk by its ID
 *     tags: [Platform Trunks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform trunk ID
 *     responses:
 *       200:
 *         description: Successfully retrieved platform trunk
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlatformTrunk'
 *       404:
 *         description: Platform trunk not found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const platformTrunk = await prisma.platformTrunk.findUnique({
      where: { id },
      include: {
        livekitTrunks: {
          select: {
            id: true,
            name: true,
            status: true,
            tenantId: true,
            tenant: {
              select: {
                name: true,
                domain: true
              }
            }
          }
        },
        _count: {
          select: {
            livekitTrunks: true
          }
        }
      }
    });

    if (!platformTrunk) {
      return res.status(404).json({ 
        error: 'Platform trunk not found',
        message: `Platform trunk with ID ${id} does not exist`
      });
    }

    res.json(platformTrunk);
  } catch (error) {
    console.error('Error fetching platform trunk:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

/**
 * @swagger
 * /api/platform-trunks:
 *   post:
 *     summary: Create a new platform trunk
 *     description: Create a new platform trunk with the provided data
 *     tags: [Platform Trunks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Platform trunk name
 *                 default: "Platform Twilio Trunk"
 *               description:
 *                 type: string
 *                 description: Platform trunk description
 *               twilioRegion:
 *                 type: string
 *                 description: Twilio region
 *                 enum: [us1, us2, au1, dublin, tokyo, singapore, sydney, ireland]
 *                 default: "us1"
 *               maxChannels:
 *                 type: integer
 *                 description: Maximum concurrent channels
 *                 default: 100
 *     responses:
 *       201:
 *         description: Platform trunk created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlatformTrunk'
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Platform trunk with this Twilio Account SID already exists
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, requireAccount('00000000-0000-0000-0000-00000000b40d'), async (req, res) => {
  try {
    const validationErrors = ValidationService.validatePlatformTrunkData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const {
      name = 'Platform Twilio Trunk',
      description,
      twilioRegion = 'us1',
      maxChannels = 100
    } = req.body;


    const platformTrunk = await prisma.platformTrunk.create({
      data: {
        id: generatePlatformTrunkId(),
        name: name.trim(),
        description: description?.trim(),
        twilioRegion,
        maxChannels
      }
    });

    // Create Twilio Elastic SIP Trunk
    let twilioTrunk = null;
    try {
      if (!TwilioService.isConfigured()) {
        throw new Error('Twilio credentials not configured');
      }

      console.log(`${platformTrunk.id}.pstn.twilio.com`)
      
      // Create an Elastic SIP Trunk using TwilioService
      twilioTrunk = await TwilioService.createElasticSipTrunk({
        friendlyName: name.trim(),
        domainName: `${platformTrunk.id}.pstn.twilio.com`, // Use platform trunk ID as domain
        cnamLookupEnabled: true,
        recordingEnabled: false,
        secure: true,
        transferMode: 'enable-all'
      });

      console.log(`Twilio Elastic SIP Trunk created: ${twilioTrunk.sid}`);

      // Create origination URL using TwilioService
      const originationUrl = await TwilioService.createOriginationUrl(twilioTrunk, {
        friendlyName: "LiveKit Cloud",
        sipUrl: process.env.LIVEKIT_SIP_URL,
        enabled: true,
        weight: 10,
        priority: 10
      });

      console.log(`Origination URL created: ${originationUrl.sid}`);

      // Update the platform trunk with the Twilio trunk SID
      await prisma.platformTrunk.update({
        where: { id: platformTrunk.id },
        data: { twilioTrunkSid: twilioTrunk.sid }
      });
      
      console.log(`Platform trunk ${platformTrunk.id} updated with Twilio trunk SID: ${twilioTrunk.sid}`);
    } catch (twilioError) {
      console.error('Error creating Twilio Elastic SIP Trunk:', twilioError);
      // Note: We don't fail the entire operation if Twilio trunk creation fails
      // The platform trunk is still created in the database
    }

    // Include Twilio trunk information in response
    const response = {
      ...platformTrunk,
      twilioTrunk: twilioTrunk ? {
        sid: twilioTrunk.sid,
        friendlyName: twilioTrunk.friendlyName,
        domainName: twilioTrunk.domainName,
        status: twilioTrunk.status,
        dateCreated: twilioTrunk.dateCreated
      } : null
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating platform trunk:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

/**
 * @swagger
 * /api/platform-trunks/{id}:
 *   put:
 *     summary: Update platform trunk
 *     description: Update an existing platform trunk with the provided data
 *     tags: [Platform Trunks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform trunk ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Platform trunk name
 *               description:
 *                 type: string
 *                 description: Platform trunk description
 *               twilioAuthToken:
 *                 type: string
 *                 description: Twilio Auth Token
 *               twilioRegion:
 *                 type: string
 *                 description: Twilio region
 *                 enum: [us1, us2, au1, dublin, tokyo, singapore, sydney, ireland]
 *               maxChannels:
 *                 type: integer
 *                 description: Maximum concurrent channels
 *               isActive:
 *                 type: boolean
 *                 description: Whether the platform trunk is active
 *     responses:
 *       200:
 *         description: Platform trunk updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlatformTrunk'
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Platform trunk not found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, requireAccount('00000000-0000-0000-0000-00000000b40d'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if platform trunk exists
    const existingPlatformTrunk = await prisma.platformTrunk.findUnique({
      where: { id }
    });

    if (!existingPlatformTrunk) {
      return res.status(404).json({
        error: 'Platform trunk not found',
        message: `Platform trunk with ID ${id} does not exist`
      });
    }

    const validationErrors = validatePlatformTrunkData({ ...existingPlatformTrunk, ...req.body });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name.trim();
    if (req.body.description !== undefined) updateData.description = req.body.description?.trim();
    if (req.body.twilioAuthToken !== undefined) updateData.twilioAuthToken = req.body.twilioAuthToken.trim();
    if (req.body.twilioRegion !== undefined) updateData.twilioRegion = req.body.twilioRegion;
    if (req.body.maxChannels !== undefined) updateData.maxChannels = req.body.maxChannels;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    const platformTrunk = await prisma.platformTrunk.update({
      where: { id },
      data: updateData
    });

    res.json(platformTrunk);
  } catch (error) {
    console.error('Error updating platform trunk:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

/**
 * @swagger
 * /api/platform-trunks/{id}:
 *   delete:
 *     summary: Delete platform trunk
 *     description: Delete a platform trunk by ID (only if no LiveKit trunks are associated)
 *     tags: [Platform Trunks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform trunk ID
 *     responses:
 *       200:
 *         description: Platform trunk deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Platform trunk deleted successfully
 *       400:
 *         description: Cannot delete platform trunk with associated LiveKit trunks
 *       404:
 *         description: Platform trunk not found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, requireAccount('00000000-0000-0000-0000-00000000b40d'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if platform trunk exists
    const existingPlatformTrunk = await prisma.platformTrunk.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            livekitTrunks: true
          }
        }
      }
    });

    if (!existingPlatformTrunk) {
      return res.status(404).json({
        error: 'Platform trunk not found',
        message: `Platform trunk with ID ${id} does not exist`
      });
    }

    // Check if there are associated LiveKit trunks
    if (existingPlatformTrunk._count.livekitTrunks > 0) {
      return res.status(400).json({
        error: 'Cannot delete platform trunk',
        message: 'Platform trunk has associated LiveKit trunks. Delete them first.'
      });
    }

    await prisma.platformTrunk.delete({
      where: { id }
    });

    res.json({ message: 'Platform trunk deleted successfully' });
  } catch (error) {
    console.error('Error deleting platform trunk:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
});

module.exports = router;