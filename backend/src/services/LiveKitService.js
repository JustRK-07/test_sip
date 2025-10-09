const { SipClient } = require('livekit-server-sdk');
const {SIPTransport} = require("@livekit/protocol");

/**
 * Service class for LiveKit operations
 * Centralizes LiveKit SIP client initialization and common operations
 */
class LiveKitService {
  constructor() {
    this._sipClient = null;
  }

  /**
   * Get initialized LiveKit SIP client
   * @returns {SipClient} LiveKit SIP client instance
   * @throws {Error} If LiveKit credentials are not configured
   */
  getSipClient() {
    if (!this._sipClient) {
      const livekitUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_SERVER_URL;
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      
      if (!apiKey || !apiSecret || !livekitUrl) {
        throw new Error('LiveKit credentials are required in environment variables');
      }

      this._sipClient = new SipClient(livekitUrl, apiKey, apiSecret);
    }
    
    return this._sipClient;
  }

  /**
   * Check if LiveKit is properly configured
   * @returns {boolean} True if credentials are available
   */
  isConfigured() {
    const livekitUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_SERVER_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    
    return !!(apiKey && apiSecret && livekitUrl);
  }

  /**
   * Create SIP inbound trunk
   * @param {string} name Trunk name
   * @param {Array<string>} numbers Phone numbers array
   * @param {Object} options Trunk options
   * @param {boolean} [options.krispEnabled=true] Enable Krisp noise suppression
   * @param {string} [options.metadata] Trunk metadata
   * @returns {Promise<Object>} Created inbound trunk information
   */
  async createSipInboundTrunk(name, numbers, options = {}) {
    const sipClient = this.getSipClient();
    
    const trunkOptions = {
      krispEnabled: options.krispEnabled ?? true,
      ...(options.metadata && { metadata: options.metadata })
    };

    return await sipClient.createSipInboundTrunk(name, numbers, trunkOptions);
  }

  /**
   * Create SIP outbound trunk
   * @param {string} name Trunk name
   * @param {string} address SIP address (required for outbound trunks)
   * @param {Array<string>} numbers Phone numbers array
   * @param {Object} options Trunk options
   * @param {boolean} [options.krispEnabled=true] Enable Krisp noise suppression
   * @param {string} [options.transport='udp'] Transport protocol
   * @param {string} [options.metadata] Trunk metadata
   * @returns {Promise<Object>} Created outbound trunk information
   */
  async createSipOutboundTrunk(name, address, numbers, options = {}) {
    const sipClient = this.getSipClient();
    
    const trunkOptions = {
      krispEnabled: options.krispEnabled ?? true,
      transport: options.transport || SIPTransport.SIP_TRANSPORT_AUTO,
      ...(options.metadata && { metadata: options.metadata })
    };

    return await sipClient.createSipOutboundTrunk(name, address, numbers, trunkOptions);
  }

  /**
   * Update SIP inbound trunk
   * @param {string} sipTrunkId LiveKit trunk ID
   * @param {Object} trunkData Trunk data to update
   * @param {string} trunkData.name Trunk name
   * @param {Array<string>} trunkData.numbers Phone numbers array
   * @param {boolean} [trunkData.krispEnabled] Enable Krisp noise suppression
   * @returns {Promise<Object>} Updated inbound trunk information
   */
  async updateSipInboundTrunk(sipTrunkId, trunkData) {
    const sipClient = this.getSipClient();
    return await sipClient.updateSipInboundTrunk(sipTrunkId, trunkData);
  }

  /**
   * Update SIP outbound trunk
   * @param {string} sipTrunkId LiveKit trunk ID
   * @param {Object} trunkData Trunk data to update
   * @param {string} trunkData.name Trunk name
   * @param {Array<string>} trunkData.numbers Phone numbers array
   * @param {boolean} [trunkData.krispEnabled] Enable Krisp noise suppression
   * @param {string} [trunkData.address] SIP address
   * @param {string} [trunkData.transport] Transport protocol
   * @returns {Promise<Object>} Updated outbound trunk information
   */
  async updateSipOutboundTrunk(sipTrunkId, trunkData) {
    const sipClient = this.getSipClient();
    return await sipClient.updateSipOutboundTrunk(sipTrunkId, trunkData);
  }

  /**
   * Delete SIP trunk
   * @param {string} sipTrunkId LiveKit trunk ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteSipTrunk(sipTrunkId) {
    const sipClient = this.getSipClient();
    return await sipClient.deleteSipTrunk(sipTrunkId);
  }

  /**
   * Update trunk numbers with retry mechanism
   * @param {Object} campaign Campaign object
   * @param {Array<string>} numbers Phone numbers array
   * @param {Object} livekitTrunk LiveKit trunk record from database
   * @returns {Promise<Object|null>} Update result or null if failed
   */
  async updateTrunkWithNumbers(campaign, numbers, livekitTrunk) {
    if (!livekitTrunk || !livekitTrunk.livekitTrunkId) {
      console.warn(`No LiveKit trunk found for campaign ${campaign.name}`);
      return null;
    }

    const trunkOptions = {
      krispEnabled: true,
    };

    let updatedTrunk = null;
    
    try {
      if (campaign.campaignType === 'INBOUND') {
        console.log(`Updating LiveKit inbound trunk ${livekitTrunk.livekitTrunkId} with numbers:`, numbers);
        
        try {
          const trunkData = {
            name: livekitTrunk.name,
            numbers,
            krispEnabled: trunkOptions.krispEnabled
          };
          
          updatedTrunk = await this.updateSipInboundTrunk(
            livekitTrunk.livekitTrunkId,
            trunkData
          );
          console.log(`Successfully updated existing inbound trunk ${livekitTrunk.livekitTrunkId}`);
        } catch (updateError) {
          console.warn(`Failed to update existing inbound trunk, creating new one:`, updateError.message);
          // Fallback to creating a new trunk
          updatedTrunk = await this.createSipInboundTrunk(
            livekitTrunk.name,
            numbers,
            trunkOptions,
          );
          console.log(`Created new inbound trunk as fallback`);
        }
      } else if (campaign.campaignType === 'OUTBOUND') {
        console.log(`Updating LiveKit outbound trunk ${livekitTrunk.livekitTrunkId} with numbers:`, numbers);
        
        try {
          const address = `${livekitTrunk.platformTrunkId}.pstn.twilio.com`;
          
          const trunkData = {
            name: livekitTrunk.name,
            numbers,
            krispEnabled: trunkOptions.krispEnabled,
            address: address,
            transport: SIPTransport.SIP_TRANSPORT_AUTO
          };
          
          updatedTrunk = await this.updateSipOutboundTrunk(
            livekitTrunk.livekitTrunkId,
            trunkData
          );
          console.log(`Successfully updated existing outbound trunk ${livekitTrunk.livekitTrunkId}`);
        } catch (updateError) {
          console.warn(`Failed to update existing outbound trunk, creating new one:`, updateError.message);
          // Fallback to creating a new trunk
          const address = `${livekitTrunk.platformTrunkId}.pstn.twilio.com`;
          const outboundOptions = {
            krispEnabled: trunkOptions.krispEnabled,
            transport: SIPTransport.SIP_TRANSPORT_AUTO
          };
          
          updatedTrunk = await this.createSipOutboundTrunk(
            livekitTrunk.name,
            address,
            numbers,
            outboundOptions,
          );
          console.log(`Created new outbound trunk as fallback`);
        }
      }

      return updatedTrunk;
    } catch (error) {
      console.error('Error updating LiveKit trunk numbers:', error);
      throw error;
    }
  }

  /**
   * Update campaign trunk with phone numbers (comprehensive version)
   * Fetches campaign phone numbers, finds LiveKit trunk, updates it, and updates database status
   * @param {Object} campaign Campaign object with id, name, campaignType
   * @param {string} tenantId Tenant ID
   * @param {Object} prismaClient Prisma client instance
   * @returns {Promise<Object|null>} Update result with campaign name, trunk ID, and numbers count
   */
  async updateCampaignTrunk(campaign, tenantId, prismaClient) {
    if (!campaign) return null;

    const campaignPhoneNumbers = await prismaClient.phoneNumber.findMany({
      where: {
        campaignId: campaign.id,
        isActive: true
      },
      select: {
        number: true
      }
    });

    const numbers = campaignPhoneNumbers.map(pn => pn.number);
    
    const livekitTrunk = await prismaClient.liveKitTrunk.findFirst({
      where: {
        tenantId,
        campaignId: campaign.id,
        trunkType: campaign.campaignType,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (livekitTrunk && livekitTrunk.livekitTrunkId) {
      const trunkOptions = {
        krispEnabled: true,
      };

      let updatedTrunk = null;
      
      if (campaign.campaignType === 'INBOUND') {
        try {
          if (livekitTrunk.livekitTrunkId) {
            // Try to update existing trunk first
            const trunkData = {
              name: livekitTrunk.name,
              numbers,
              krispEnabled: trunkOptions.krispEnabled
            };
            
            updatedTrunk = await this.updateSipInboundTrunk(
              livekitTrunk.livekitTrunkId,
              trunkData
            );
            console.log(`Successfully updated existing inbound trunk ${livekitTrunk.livekitTrunkId}`);
          } else {
            throw new Error('No existing trunk ID found');
          }
        } catch (updateError) {
          console.warn(`Failed to update existing inbound trunk, creating new one:`, updateError.message);
          // Fallback to creating a new trunk
          updatedTrunk = await this.createSipInboundTrunk(
            livekitTrunk.name,
            numbers,
            trunkOptions,
          );
          console.log(`Created new inbound trunk as fallback`);
        }
      } else if (campaign.campaignType === 'OUTBOUND') {
        try {
          if (livekitTrunk.livekitTrunkId) {
            // Try to update existing trunk first
            const address = `${livekitTrunk.platformTrunkId}.pstn.twilio.com`;
          
            const trunkData = {
              name: livekitTrunk.name,
              numbers,
              krispEnabled: trunkOptions.krispEnabled,
              address: address,
              transport: SIPTransport.SIP_TRANSPORT_AUTO
            };
            
            updatedTrunk = await this.updateSipOutboundTrunk(
              livekitTrunk.livekitTrunkId,
              trunkData
            );
            console.log(`Successfully updated existing outbound trunk ${livekitTrunk.livekitTrunkId}`);
          } else {
            throw new Error('No existing trunk ID found');
          }
        } catch (updateError) {
          console.warn(`Failed to update existing outbound trunk, creating new one:`, updateError.message);
          // Fallback to creating a new trunk
          const address = `${livekitTrunk.platformTrunkId}.pstn.twilio.com`;
          const outboundOptions = {
            krispEnabled: trunkOptions.krispEnabled,
            transport: SIPTransport.SIP_TRANSPORT_AUTO
          };
          
          updatedTrunk = await this.createSipOutboundTrunk(
            livekitTrunk.name,
            address,
            numbers,
            outboundOptions,
          );
          console.log(`Created new outbound trunk as fallback`);
        }
      }

      if (updatedTrunk) {
        await prismaClient.liveKitTrunk.update({
          where: { id: livekitTrunk.id },
          data: {
            livekitTrunkId: updatedTrunk.sipTrunkId,
            status: 'ACTIVE',
            updatedAt: new Date()
          }
        });

        return {
          campaignName: campaign.name,
          trunkId: updatedTrunk.sipTrunkId,
          numbersCount: numbers.length,
          status: 'success'
        };
      }
    }
    
    return null;
  }

  /**
   * Create trunk for campaign
   * @param {Object} campaign Campaign object
   * @param {string} platformTrunkId Platform trunk ID
   * @returns {Promise<Object|null>} Created trunk information or null if failed
   */
  async createTrunkForCampaign(campaign, platformTrunkId) {
    try {
      const trunkName = `${campaign.name} - ${campaign.campaignType} Trunk`;
      
      // Initialize with empty numbers array - will be populated when phone numbers are added to campaign
      const numbers = [];
      
      let livekitTrunkId = null;
      let provisioningStatus = 'PROVISIONING';
      
      if (campaign.campaignType === 'INBOUND') {
        console.log(`Creating LiveKit inbound trunk for campaign: ${campaign.name}`);
        
        const trunkOptions = {
          krispEnabled: true,
        };
        
        const inboundTrunk = await this.createSipInboundTrunk(
          trunkName,
          numbers,
          trunkOptions,
        );
        livekitTrunkId = inboundTrunk.sipTrunkId;
        provisioningStatus = 'ACTIVE';
        
        console.log(`Successfully provisioned LiveKit inbound trunk: ${livekitTrunkId}`);
      } else if (campaign.campaignType === 'OUTBOUND') {
        console.log(`Creating LiveKit outbound trunk for campaign: ${campaign.name}`);
        
        const address = `${platformTrunkId}.pstn.twilio.com`;
        const trunkOptions = {
          krispEnabled: true,
          transport: SIPTransport.SIP_TRANSPORT_AUTO
        };
        
        const outboundTrunk = await this.createSipOutboundTrunk(
          trunkName,
          address,
          numbers,
          trunkOptions,
        );
        livekitTrunkId = outboundTrunk.sipTrunkId;
        provisioningStatus = 'ACTIVE';
        
        console.log(`Successfully provisioned LiveKit outbound trunk: ${livekitTrunkId}`);
      }

      return {
        livekitTrunkId,
        status: provisioningStatus,
        name: trunkName
      };
    } catch (livekitError) {
      console.error('Error creating LiveKit trunk for campaign:', livekitError);
      return {
        livekitTrunkId: null,
        status: 'ERROR',
        error: livekitError.message
      };
    }
  }

  /**
   * Create SIP dispatch rule
   * @param {Object} ruleConfig Rule configuration
   * @param {string} ruleConfig.name Rule name
   * @param {string} ruleConfig.agentName Agent name for the rule
   * @param {string} ruleConfig.type Rule type ('direct' or 'individual')
   * @param {string} [ruleConfig.roomName] Room name for direct rules
   * @param {string} [ruleConfig.roomPrefix] Room prefix for individual rules
   * @param {string} [ruleConfig.pin] PIN for room access
   * @param {Array<string>} [ruleConfig.trunkIds] Array of trunk IDs to associate with
   * @param {Object} [ruleConfig.metadata] Additional metadata
   * @returns {Promise<Object>} Created dispatch rule information
   */
  async createSipDispatchRule(ruleConfig) {
    const sipClient = this.getSipClient();
    
    const { name, agentName, type, roomName, roomPrefix, pin, trunkIds = [], metadata = {} } = ruleConfig;
    
    // Build rule object based on type
    let rule = {};
    if (type === 'direct') {
      rule = {
        type: 'direct',
        roomName: roomName || `${name.replace(/\s+/g, '-').toLowerCase()}-room`,
        pin: pin || ''
      };
    } else if (type === 'individual') {
      rule = {
        type: 'individual',
        roomPrefix: roomPrefix || `${name.replace(/\s+/g, '-').toLowerCase()}`,
        pin: pin || ''
      };
    } else {
      throw new Error(`Unsupported dispatch rule type: ${type}`);
    }
    
    // Create dispatch rule options
    const options = {
      name: agentName, // Use agentName as the dispatch rule name in LiveKit
      trunkIds,
      metadata: JSON.stringify({ ...metadata, agentName, originalName: name }),
      hidePhoneNumber: false
    };
    
    return await sipClient.createSipDispatchRule(rule, options);
  }

  /**
   * Update SIP dispatch rule
   * @param {string} dispatchRuleId LiveKit dispatch rule ID
   * @param {Object} ruleConfig Updated rule configuration
   * @returns {Promise<Object>} Updated dispatch rule information
   */
  async updateSipDispatchRule(dispatchRuleId, ruleConfig) {
    const sipClient = this.getSipClient();
    
    const { name, agentName, type, roomName, roomPrefix, pin, trunkIds = [], metadata = {} } = ruleConfig;
    
    // Build rule object based on type
    let rule = {};
    if (type === 'direct') {
      rule = {
        type: 'direct',
        roomName: roomName || `${name.replace(/\s+/g, '-').toLowerCase()}-room`,
        pin: pin || ''
      };
    } else if (type === 'individual') {
      rule = {
        type: 'individual',
        roomPrefix: roomPrefix || `${name.replace(/\s+/g, '-').toLowerCase()}`,
        pin: pin || ''
      };
    }
    
    // Create dispatch rule options
    const options = {
      name: agentName,
      trunkIds,
      metadata: JSON.stringify({ ...metadata, agentName, originalName: name }),
      hidePhoneNumber: false
    };
    
    return await sipClient.updateSipDispatchRule(dispatchRuleId, { rule, ...options });
  }

  /**
   * Update specific fields of SIP dispatch rule
   * @param {string} dispatchRuleId LiveKit dispatch rule ID
   * @param {Object} fields Fields to update
   * @returns {Promise<Object>} Updated dispatch rule information
   */
  async updateSipDispatchRuleFields(dispatchRuleId, fields) {
    const sipClient = this.getSipClient();
    return await sipClient.updateSipDispatchRuleFields(dispatchRuleId, fields);
  }

  /**
   * Delete SIP dispatch rule
   * @param {string} dispatchRuleId LiveKit dispatch rule ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteSipDispatchRule(dispatchRuleId) {
    const sipClient = this.getSipClient();
    return await sipClient.deleteSipDispatchRule(dispatchRuleId);
  }

  /**
   * List SIP dispatch rules
   * @param {Object} [filters] Optional filters
   * @returns {Promise<Array>} Array of dispatch rules
   */
  async listSipDispatchRules(filters = {}) {
    const sipClient = this.getSipClient();
    return await sipClient.listSipDispatchRule(filters);
  }

  /**
   * Create dispatch rule for campaign
   * @param {Object} campaign Campaign object
   * @param {string} agentName Agent name for the dispatch rule
   * @param {string} livekitTrunkId LiveKit trunk ID to associate with
   * @returns {Promise<Object|null>} Created dispatch rule information or null if failed
   */
  async createDispatchRuleForCampaign(campaign, agentName, livekitTrunkId) {
    try {
      console.log(`Creating dispatch rule for campaign: ${campaign.name} with agent: ${agentName}`);
      
      const ruleConfig = {
        name: `${campaign.name} Dispatch Rule`,
        agentName: agentName.trim(),
        type: 'direct', // Default to direct dispatch
        roomName: `${campaign.name.replace(/\s+/g, '-').toLowerCase()}-${campaign.campaignType.toLowerCase()}`,
        trunkIds: livekitTrunkId ? [livekitTrunkId] : [],
        metadata: {
          campaignId: campaign.id,
          campaignType: campaign.campaignType,
          tenantId: campaign.tenantId
        }
      };
      
      const dispatchRule = await this.createSipDispatchRule(ruleConfig);
      
      console.log(`Successfully created dispatch rule: ${dispatchRule.sipDispatchRuleId}`);
      
      return {
        livekitDispatchRuleId: dispatchRule.sipDispatchRuleId,
        name: ruleConfig.name,
        agentName: ruleConfig.agentName,
        ruleType: ruleConfig.type.toUpperCase(),
        roomName: ruleConfig.roomName,
        status: 'ACTIVE'
      };
    } catch (dispatchRuleError) {
      console.error('Error creating dispatch rule for campaign:', dispatchRuleError);
      return {
        livekitDispatchRuleId: null,
        status: 'ERROR',
        error: dispatchRuleError.message
      };
    }
  }
}

// Export singleton instance
module.exports = new LiveKitService();