const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validatePhoneNumber, formatPhoneNumber } = require('../utils/phoneValidation');
const { requireTenantAccess } = require("../utils/routeUtils");
const TwilioService = require('../services/TwilioService');
const LiveKitService = require('../services/LiveKitService');
const ValidationService = require('../services/ValidationService');
const DatabaseService = require('../services/DatabaseService');
const ResponseService = require('../services/ResponseService');
const RouteHelperService = require('../services/RouteHelperService');

const router = express.Router();
const prisma = DatabaseService.getClient();


/**
 * @swagger
 * /api/tenants/{tenantId}/phone-numbers/available:
 *   get:
 *     summary: List available phone numbers for purchase from Twilio
 *     tags: [Phone Numbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID (must match JWT acct field)
 *       - in: query
 *         name: areaCode
 *         schema:
 *           type: string
 *         description: Area code to search for (e.g., 555)
 *       - in: query
 *         name: contains
 *         schema:
 *           type: string
 *         description: Digits that the number should contain
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [LOCAL, MOBILE, TOLL_FREE]
 *           default: LOCAL
 *         description: Type of phone number to search for
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *           default: US
 *         description: Country code (ISO 3166-1 alpha-2)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: List of available phone numbers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AvailablePhoneNumber'
 *                 count:
 *                   type: integer
 *                   description: Number of available numbers returned
 *                 searchCriteria:
 *                   type: object
 *                   description: Search parameters used
 */
router.get('/:tenantId/phone-numbers/available', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { 
      areaCode, 
      contains, 
      type = 'LOCAL', 
      country = 'US', 
      limit = 20 
    } = req.query;

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        error: {
          message: 'Tenant not found',
          code: 'TENANT_NOT_FOUND'
        }
      });
    }

    // Check Twilio configuration
    if (!TwilioService.isConfigured()) {
      return res.status(500).json({
        error: {
          message: 'Twilio service not configured',
          code: 'TWILIO_CONFIG_ERROR'
        }
      });
    }

    let availableNumbers = [];

    try {
      // Search for available numbers using TwilioService
      availableNumbers = await TwilioService.searchAvailableNumbers({
        country,
        type,
        areaCode,
        contains,
        limit: parseInt(limit)
      });

      // Transform Twilio response to our format
      const formattedNumbers = availableNumbers.map(number => ({
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        locality: number.locality,
        region: number.region,
        postalCode: number.postalCode,
        country: number.isoCountry,
        capabilities: {
          voice: number.capabilities?.voice || false,
          sms: number.capabilities?.sms || false,
          mms: number.capabilities?.mms || false
        },
        type: type,
        provider: 'TWILIO',
        estimatedCost: {
          setup: 'Varies by number',
          monthly: 'Varies by number type'
        }
      }));

      res.json({
        data: formattedNumbers,
        count: formattedNumbers.length,
        searchCriteria: {
          type,
          country,
          areaCode: areaCode || null,
          contains: contains || null,
          limit: parseInt(limit)
        }
      });

    } catch (twilioError) {
      console.error('Twilio API error:', twilioError);
      res.status(500).json({
        error: {
          message: 'Failed to fetch available phone numbers from Twilio',
          code: 'TWILIO_API_ERROR',
          details: twilioError.message
        }
      });
    }

  } catch (error) {
    console.error('Error fetching available phone numbers:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch available phone numbers',
        code: 'FETCH_AVAILABLE_NUMBERS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/tenants/{tenantId}/phone-numbers:
 *   get:
 *     summary: List phone numbers for a tenant
 *     tags: [Phone Numbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID (must match JWT acct field)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [LOCAL, MOBILE, TOLL_FREE]
 *         description: Filter by phone number type
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of phone numbers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PhoneNumber'
 */
router.get('/:tenantId/phone-numbers', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { type, isActive } = req.query;

    // Verify tenant exists
    const tenant = await RouteHelperService.validateTenant(tenantId, res);
    if (!tenant) return;

    const where = { tenantId };
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const phoneNumbers = await prisma.phoneNumber.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' }
      ],
      include: {
        tenant: {
          select: { id: true, name: true, domain: true }
        }
      }
    });

    ResponseService.success(res, phoneNumbers);
  } catch (error) {
    ResponseService.internalError(res, error, 'Failed to fetch phone numbers');
  }
});

/**
 * @swagger
 * /api/tenants/{tenantId}/phone-numbers/{id}:
 *   get:
 *     summary: Get a specific phone number
 *     tags: [Phone Numbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID (must match JWT acct field)
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Phone number ID
 *     responses:
 *       200:
 *         description: Phone number details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/PhoneNumber'
 */
router.get('/:tenantId/phone-numbers/:id', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { 
        id,
        tenantId 
      },
      include: {
        tenant: {
          select: { id: true, name: true, domain: true }
        }
      }
    });

    if (!phoneNumber) {
      return res.status(404).json({
        error: {
          message: 'Phone number not found',
          code: 'PHONE_NUMBER_NOT_FOUND'
        }
      });
    }

    res.json({ data: phoneNumber });
  } catch (error) {
    console.error('Error fetching phone number:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch phone number',
        code: 'FETCH_PHONE_NUMBER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/tenants/{tenantId}/phone-numbers:
 *   post:
 *     summary: Purchase and add a new phone number to a tenant
 *     description: Purchases a phone number from Twilio and adds it to the specified tenant. The number must be available for purchase.
 *     tags: [Phone Numbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID (must match JWT acct field)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PhoneNumberInput'
 *           example:
 *             number: "+15551234567"
 *             type: "LOCAL"
 *             label: "Main Office Line"
 *             provider: "TWILIO"
 *     responses:
 *       201:
 *         description: Phone number purchased and created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/PhoneNumber'
 *                 message:
 *                   type: string
 *                   example: "Phone number purchased and created successfully"
 *                 twilio:
 *                   type: object
 *                   properties:
 *                     sid:
 *                       type: string
 *                       description: Twilio SID for the purchased number
 *                       example: "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
 *                     status:
 *                       type: string
 *                       description: Current status of the number in Twilio
 *                       example: "in-use"
 *                     dateCreated:
 *                       type: string
 *                       format: date-time
 *                       description: When the number was purchased from Twilio
 *       400:
 *         description: Purchase failed or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Phone number is no longer available for purchase"
 *                     code:
 *                       type: string
 *                       enum: [VALIDATION_ERROR, TWILIO_PURCHASE_ERROR, NUMBER_NOT_AVAILABLE, INVALID_PHONE_NUMBER, TWILIO_AUTH_ERROR]
 *                       example: "NUMBER_NOT_AVAILABLE"
 *                     details:
 *                       type: string
 *                       description: Additional error details from Twilio
 *                     twilioCode:
 *                       type: integer
 *                       description: Specific Twilio error code
 *                       example: 21452
 *       500:
 *         description: Twilio service not configured or internal error
 */
router.post('/:tenantId/phone-numbers', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        error: {
          message: 'Tenant not found',
          code: 'TENANT_NOT_FOUND'
        }
      });
    }

    const validationErrors = ValidationService.validatePhoneNumberData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        }
      });
    }

    const {
      number,
      type = 'LOCAL',
      label,
      extension,
      provider = 'TWILIO',
      isActive = true,
      campaignId
    } = req.body;

    // Format phone number
    const formattedNumber = formatPhoneNumber(number);
    
    // Check Twilio configuration
    if (!TwilioService.isConfigured()) {
      return res.status(500).json({
        error: {
          message: 'Twilio service not configured',
          code: 'TWILIO_CONFIG_ERROR'
        }
      });
    }

    // Validate campaign if provided
    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          tenantId,
          isActive: true
        }
      });

      if (!campaign) {
        return res.status(400).json({
          error: {
            message: 'Invalid campaign ID or campaign not found for this tenant',
            code: 'INVALID_CAMPAIGN'
          }
        });
      }
    }

    // Find the active platform trunk before purchasing to get the trunkSid
    let platformTrunkId = null;
    let twilioTrunkSid = null;
    try {
      const activePlatformTrunk = await prisma.platformTrunk.findFirst({
        where: {
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          name: true,
          twilioTrunkSid: true
        }
      });

      if (activePlatformTrunk) {
        platformTrunkId = activePlatformTrunk.id;
        twilioTrunkSid = activePlatformTrunk.twilioTrunkSid;
        console.log(`Found platform trunk: ${activePlatformTrunk.name} (${platformTrunkId}) with Twilio trunk SID: ${twilioTrunkSid}`);
      } else {
        console.warn('No active platform trunk found - phone number will not be associated with a trunk');
      }
    } catch (error) {
      console.error('Error finding platform trunk:', error);
      // Continue without association - don't fail the entire operation
    }


    let purchasedNumber;
    try {
      // Purchase the phone number using TwilioService
      console.log(`Attempting to purchase phone number: ${formattedNumber}${twilioTrunkSid ? ` with trunk SID: ${twilioTrunkSid}` : ''}`);
      
      purchasedNumber = await TwilioService.purchasePhoneNumber({
        phoneNumber: formattedNumber,
        friendlyName: label || `${tenant.name} - ${formattedNumber}`,
        trunkSid: twilioTrunkSid
      });

      console.log(`Successfully purchased phone number: ${purchasedNumber.phoneNumber} with SID: ${purchasedNumber.sid}`);
      
    } catch (twilioError) {
      console.error('Twilio purchase error:', twilioError);
      
      const errorInfo = TwilioService.handleTwilioError(twilioError);
      
      return res.status(400).json({
        error: errorInfo
      });
    }

    // Create database record with Twilio SID, platform trunk, and campaign associations
    const phoneNumber = await prisma.phoneNumber.create({
      data: {
        number: formattedNumber,
        type,
        label: label?.trim(),
        extension: extension?.trim(),
        provider,
        isActive,
        tenantId,
        platformTrunkId, // Associate with platform trunk if found
        campaignId, // Associate with campaign if provided
        // Store Twilio SID for future reference (we'd need to add this field to schema)
        // twilioSid: purchasedNumber.sid
      },
      include: {
        tenant: {
          select: { id: true, name: true, domain: true }
        },
        platformTrunk: {
          select: { id: true, name: true, description: true }
        },
        campaign: {
          select: { id: true, name: true, description: true, campaignType: true }
        }
      }
    });

    // If phone number is associated with a campaign, update the LiveKit trunk
    let livekitTrunkUpdate = null;
    if (phoneNumber.campaign) {
      try {
        console.log(`Phone number ${formattedNumber} added to campaign ${phoneNumber.campaign.name}, updating LiveKit trunk...`);
        
        // Get all phone numbers for the campaign
        const campaignPhoneNumbers = await DatabaseService.findPhoneNumbersByCampaign(phoneNumber.campaign.id);
        const numbers = campaignPhoneNumbers.map(pn => pn.number);
        
        // Find the LiveKit trunk for this campaign
        const livekitTrunk = await DatabaseService.findLiveKitTrunkByCampaign(
          tenantId,
          phoneNumber.campaign.id,
          phoneNumber.campaign.campaignType
        );

        if (livekitTrunk && livekitTrunk.livekitTrunkId) {
          const updatedTrunk = await LiveKitService.updateTrunkWithNumbers(
            phoneNumber.campaign,
            numbers,
            livekitTrunk
          );

          if (updatedTrunk) {
            await DatabaseService.updateLiveKitTrunkStatus(
              livekitTrunk.id,
              updatedTrunk.sipTrunkId,
              'ACTIVE'
            );

            livekitTrunkUpdate = {
              status: 'success',
              trunkId: updatedTrunk.sipTrunkId,
              numbersCount: numbers.length
            };

            console.log(`Successfully updated LiveKit trunk ${livekitTrunk.id} with ${numbers.length} numbers`);
          }
        }
      } catch (livekitError) {
        console.error('Error updating LiveKit trunk after phone number creation:', livekitError);
        livekitTrunkUpdate = {
          status: 'error',
          error: livekitError.message
        };
      }
    }

    res.status(201).json({
      data: phoneNumber,
      message: 'Phone number purchased and created successfully' + (livekitTrunkUpdate?.status === 'success' ? ' and LiveKit trunk updated' : ''),
      twilio: {
        sid: purchasedNumber.sid,
        status: purchasedNumber.status,
        dateCreated: purchasedNumber.dateCreated
      },
      livekitTrunkUpdate
    });
  } catch (error) {
    console.error('Error creating phone number:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create phone number',
        code: 'CREATE_PHONE_NUMBER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/tenants/{tenantId}/phone-numbers/{id}:
 *   put:
 *     summary: Update a phone number
 *     tags: [Phone Numbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID (must match JWT acct field)
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Phone number ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PhoneNumberInput'
 *     responses:
 *       200:
 *         description: Phone number updated successfully
 */
router.put('/:tenantId/phone-numbers/:id', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    // Check if phone number exists
    const existingPhone = await prisma.phoneNumber.findFirst({
      where: { 
        id,
        tenantId 
      }
    });

    if (!existingPhone) {
      return res.status(404).json({
        error: {
          message: 'Phone number not found',
          code: 'PHONE_NUMBER_NOT_FOUND'
        }
      });
    }

    const validationErrors = ValidationService.validatePhoneNumberData({ ...existingPhone, ...req.body });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        }
      });
    }

    const {
      number,
      type,
      label,
      extension,
      provider,
      isActive,
      campaignId
    } = req.body;

    // Validate campaign if provided
    if (campaignId !== undefined && campaignId !== null) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          tenantId,
          isActive: true
        }
      });

      if (!campaign) {
        return res.status(400).json({
          error: {
            message: 'Invalid campaign ID or campaign not found for this tenant',
            code: 'INVALID_CAMPAIGN'
          }
        });
      }
    }

    const updateData = {};
    if (number !== undefined) updateData.number = formatPhoneNumber(number);
    if (type !== undefined) updateData.type = type;
    if (label !== undefined) updateData.label = label?.trim();
    if (extension !== undefined) updateData.extension = extension?.trim();
    if (provider !== undefined) updateData.provider = provider;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (campaignId !== undefined) updateData.campaignId = campaignId;

    // Get the current phone number to check for campaign changes
    const currentPhoneNumber = await prisma.phoneNumber.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { id: true, name: true, campaignType: true }
        }
      }
    });

    const phoneNumber = await prisma.phoneNumber.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: { id: true, name: true, domain: true }
        },
        campaign: {
          select: { id: true, name: true, description: true, campaignType: true }
        }
      }
    });

    // Check if campaign association changed and update LiveKit trunks accordingly
    let livekitTrunkUpdates = [];
    
    try {

      // Update old campaign trunk (if phone number was removed from a campaign)
      if (currentPhoneNumber.campaign && (!phoneNumber.campaign || currentPhoneNumber.campaign.id !== phoneNumber.campaign.id)) {
        console.log(`Phone number ${phoneNumber.number} removed from campaign ${currentPhoneNumber.campaign.name}, updating trunk...`);
        const oldCampaignUpdate = await LiveKitService.updateCampaignTrunk(currentPhoneNumber.campaign, tenantId, prisma);
        if (oldCampaignUpdate) {
          livekitTrunkUpdates.push({ type: 'removed_from', ...oldCampaignUpdate });
        }
      }

      // Update new campaign trunk (if phone number was added to a campaign)
      if (phoneNumber.campaign && (!currentPhoneNumber.campaign || currentPhoneNumber.campaign.id !== phoneNumber.campaign.id)) {
        console.log(`Phone number ${phoneNumber.number} added to campaign ${phoneNumber.campaign.name}, updating trunk...`);
        const newCampaignUpdate = await LiveKitService.updateCampaignTrunk(phoneNumber.campaign, tenantId, prisma);
        if (newCampaignUpdate) {
          livekitTrunkUpdates.push({ type: 'added_to', ...newCampaignUpdate });
        }
      }

    } catch (livekitError) {
      console.error('Error updating LiveKit trunk after phone number update:', livekitError);
      livekitTrunkUpdates.push({
        status: 'error',
        error: livekitError.message
      });
    }

    res.json({
      data: phoneNumber,
      message: 'Phone number updated successfully' + (livekitTrunkUpdates.length > 0 ? ' and LiveKit trunks updated' : ''),
      livekitTrunkUpdates: livekitTrunkUpdates.length > 0 ? livekitTrunkUpdates : null
    });
  } catch (error) {
    console.error('Error updating phone number:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update phone number',
        code: 'UPDATE_PHONE_NUMBER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/tenants/{tenantId}/phone-numbers/{id}:
 *   delete:
 *     summary: Delete a phone number
 *     tags: [Phone Numbers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID (must match JWT acct field)
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Phone number ID
 *       - in: query
 *         name: permanent
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to permanently delete (true) or deactivate (false)
 *     responses:
 *       200:
 *         description: Phone number deleted successfully
 */
router.delete('/:tenantId/phone-numbers/:id', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const { permanent = false } = req.query;

    const existingPhone = await prisma.phoneNumber.findFirst({
      where: { 
        id,
        tenantId 
      }
    });

    if (!existingPhone) {
      return res.status(404).json({
        error: {
          message: 'Phone number not found',
          code: 'PHONE_NUMBER_NOT_FOUND'
        }
      });
    }

    // Release the phone number from Twilio before local deletion
    let twilioReleaseResult = null;
    if (existingPhone.provider === 'TWILIO') {
      try {
        console.log(`Releasing phone number ${existingPhone.number} from Twilio...`);
        
        if (!TwilioService.isConfigured()) {
          console.warn('Twilio not configured - skipping Twilio release');
          twilioReleaseResult = { 
            status: 'skipped', 
            reason: 'Twilio not configured' 
          };
        } else {
          twilioReleaseResult = await TwilioService.releasePhoneNumber(existingPhone.number);
          console.log(`Successfully released phone number ${existingPhone.number} from Twilio`);
        }
      } catch (twilioError) {
        console.error(`Error releasing phone number ${existingPhone.number} from Twilio:`, twilioError);
        
        // Handle specific Twilio errors
        const errorInfo = TwilioService.handleTwilioError(twilioError);
        
        // If the number is not found in Twilio, we can continue with local deletion
        // as it may have already been released or never existed in Twilio
        if (errorInfo.code === 'NUMBER_NOT_FOUND') {
          console.warn(`Phone number ${existingPhone.number} not found in Twilio - continuing with local deletion`);
          twilioReleaseResult = { 
            status: 'not_found', 
            error: errorInfo.message 
          };
        } else {
          // For other Twilio errors, we might want to continue or fail based on business logic
          // For now, we'll log the error but continue with local deletion
          console.warn(`Twilio release failed for ${existingPhone.number}, continuing with local deletion:`, errorInfo.message);
          twilioReleaseResult = { 
            status: 'failed', 
            error: errorInfo.message,
            twilioCode: errorInfo.twilioCode 
          };
        }
      }
    } else {
      console.log(`Phone number ${existingPhone.number} is not a Twilio number - skipping Twilio release`);
      twilioReleaseResult = { 
        status: 'skipped', 
        reason: 'Not a Twilio number' 
      };
    }

    // Perform local database operation
    if (permanent === 'true') {
      await prisma.phoneNumber.delete({
        where: { id }
      });

      res.json({
        message: 'Phone number permanently deleted' + (twilioReleaseResult?.status === 'success' ? ' and released from Twilio' : ''),
        twilioRelease: twilioReleaseResult
      });
    } else {
      const phoneNumber = await prisma.phoneNumber.update({
        where: { id },
        data: { isActive: false },
        include: {
          tenant: {
            select: { id: true, name: true, domain: true }
          }
        }
      });

      res.json({
        data: phoneNumber,
        message: 'Phone number deactivated successfully' + (twilioReleaseResult?.status === 'success' ? ' and released from Twilio' : ''),
        twilioRelease: twilioReleaseResult
      });
    }
  } catch (error) {
    console.error('Error deleting phone number:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete phone number',
        code: 'DELETE_PHONE_NUMBER_ERROR'
      }
    });
  }
});

module.exports = router;