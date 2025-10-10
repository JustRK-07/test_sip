/**
 * LiveKit Executor Service
 * Makes outbound calls using LiveKit Server SDK (Node.js native)
 *
 * Architecture: Uses LiveKit Dispatch Rules for automatic agent assignment
 * - Dispatch rules are configured in LiveKit Dashboard (Agent settings)
 * - When room is created, agent automatically joins based on room name pattern
 * - No explicit dispatch API calls needed (simpler, faster, more scalable)
 *
 * Setup Required in LiveKit Dashboard:
 * 1. Create Agent (e.g., "telephony-agent")
 * 2. Set Dispatch Rule: Room pattern "outbound-*" → Auto-join enabled
 * 3. Configure agent behavior and prompts
 */

const { AccessToken, SipClient, RoomServiceClient, AgentDispatchClient } = require('livekit-server-sdk');
const logger = require('../utils/logger');
const { formatPhoneNumber } = require('../utils/phoneValidation');

class LiveKitExecutor {
  constructor() {
    // LiveKit credentials from environment
    this.livekitUrl = process.env.LIVEKIT_URL;
    this.apiKey = process.env.LIVEKIT_API_KEY;
    this.apiSecret = process.env.LIVEKIT_API_SECRET;

    // Validate credentials
    if (!this.livekitUrl || !this.apiKey || !this.apiSecret) {
      logger.error('LiveKit credentials missing in environment variables');
      throw new Error(
        'LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set'
      );
    }

    // Initialize clients
    this.sipClient = new SipClient(this.livekitUrl, this.apiKey, this.apiSecret);
    this.roomService = new RoomServiceClient(this.livekitUrl, this.apiKey, this.apiSecret);
    this.agentDispatch = new AgentDispatchClient(this.livekitUrl, this.apiKey, this.apiSecret);

    logger.info('LiveKitExecutor initialized', {
      livekitUrl: this.livekitUrl,
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
    });
  }

  /**
   * Make an outbound call using LiveKit SIP API with explicit agent dispatch
   *
   * Flow:
   * 1. Dispatch agent to room (explicit dispatch for availability-based routing)
   * 2. Create SIP participant (initiates call via Twilio trunk)
   * 3. Conversation happens between agent and caller
   *
   * Call Path:
   * Room → SIP Trunk → Twilio Termination → PSTN → Lead's Phone
   *
   * @param {string} phoneNumber - Phone number in E.164 format (e.g., "+14155550123")
   * @param {string} sipTrunkId - SIP trunk ID for routing (e.g., "ST_xxxxx")
   * @param {string} roomName - Unique room name (e.g., "outbound-campaign-123-lead-001")
   * @param {string} agentName - AI agent name to dispatch
   * @param {string} callerIdNumber - Optional caller ID number
   * @returns {Promise<object>} Call result with participant details
   */
  async makeCall(phoneNumber, sipTrunkId, roomName, agentName = 'telephony-agent', callerIdNumber = null) {
    const startTime = Date.now();

    logger.info(`📞 Initiating call to ${phoneNumber}`, {
      roomName,
      sipTrunkId,
      agentName,
      callerIdNumber,
    });

    try {
      // Validate inputs
      if (!phoneNumber) {
        throw new Error('Phone number is required');
      }

      if (!sipTrunkId) {
        throw new Error('SIP trunk ID is required');
      }

      if (!roomName) {
        throw new Error('Room name is required');
      }

      if (!agentName) {
        throw new Error('Agent name is required');
      }

      // Format phone number to E.164 format (+country code + number)
      // Detect country code based on number length and format
      let formattedPhoneNumber = phoneNumber;

      if (!phoneNumber.startsWith('+')) {
        // Auto-detect country: Indian numbers start with 91
        if (phoneNumber.startsWith('91') && phoneNumber.length >= 12) {
          // Indian number: 918766552802 -> +918766552802
          formattedPhoneNumber = `+${phoneNumber}`;
          logger.debug(`Formatted Indian number: ${phoneNumber} -> ${formattedPhoneNumber}`);
        } else if (phoneNumber.length === 10) {
          // US number without country code: 7048134431 -> +17048134431
          formattedPhoneNumber = formatPhoneNumber(phoneNumber, 'US');
          logger.debug(`Formatted US number: ${phoneNumber} -> ${formattedPhoneNumber}`);
        } else {
          // Try to format with Indian country code as default
          formattedPhoneNumber = formatPhoneNumber(phoneNumber, 'IN');
          logger.debug(`Formatted with IN country code: ${phoneNumber} -> ${formattedPhoneNumber}`);
        }
      }

      phoneNumber = formattedPhoneNumber;

      // Step 1: Dispatch agent to room (explicit dispatch for availability-based routing)
      logger.debug(`Dispatching agent ${agentName} to room ${roomName}`);

      const dispatchInfo = await this.agentDispatch.createDispatch(
        roomName,
        agentName,
        {
          metadata: JSON.stringify({
            phoneNumber,
            callInitiatedAt: new Date().toISOString(),
          }),
        }
      );

      logger.debug(`Agent dispatched successfully`, {
        dispatchId: dispatchInfo.id,
        agentName,
        roomName,
      });

      // Step 2: Create SIP participant (initiates outbound call)
      const sipOptions = {
        participantIdentity: `caller-${phoneNumber.replace(/\+/g, '')}`,
        participantName: phoneNumber,
        participantMetadata: JSON.stringify({
          phoneNumber,
          agentName,
          dispatchId: dispatchInfo.id,
          callInitiatedAt: new Date().toISOString(),
        }),
      };

      // Add caller ID if provided
      if (callerIdNumber) {
        sipOptions.hidePhoneNumber = false;
        // Note: Check LiveKit SDK docs for exact caller ID parameter
      }

      const sipParticipantInfo = await this.sipClient.createSipParticipant(
        sipTrunkId,
        phoneNumber,
        roomName,
        sipOptions
      );

      const duration = Date.now() - startTime;

      logger.info(`✅ Call initiated successfully to ${phoneNumber}`, {
        roomName,
        agentName,
        dispatchId: dispatchInfo.id,
        participantId: sipParticipantInfo.participantId,
        participantIdentity: sipParticipantInfo.participantIdentity,
        sipCallId: sipParticipantInfo.sipCallId,
        duration,
      });

      // Return call result
      return {
        success: true,
        phoneNumber,
        roomName,
        agentName,
        dispatchId: dispatchInfo.id,
        participantId: sipParticipantInfo.participantId,
        participantIdentity: sipParticipantInfo.participantIdentity,
        sipCallId: sipParticipantInfo.sipCallId,
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(`❌ Call failed to ${phoneNumber}`, {
        error: error.message,
        duration,
        roomName,
        sipTrunkId,
        agentName,
      });

      // Throw error with details
      throw {
        success: false,
        phoneNumber,
        roomName,
        agentName,
        error: error.message,
        duration,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create SIP participant with additional options
   * (Alternative method with more control)
   *
   * @param {object} options - SIP participant options
   * @returns {Promise<object>} Call result
   */
  async createSipParticipant(options) {
    const {
      phoneNumber,
      sipTrunkId,
      roomName,
      participantIdentity,
      participantName,
      participantMetadata,
      hidePhoneNumber = false,
    } = options;

    return this.makeCall(phoneNumber, sipTrunkId, roomName, participantMetadata?.agentName);
  }

  /**
   * Validate LiveKit environment
   * @returns {Promise<boolean>}
   */
  async validateEnvironment() {
    try {
      logger.info('Validating LiveKit environment...');

      // Check credentials
      if (!this.livekitUrl) {
        logger.error('LIVEKIT_URL is not set');
        return false;
      }

      if (!this.apiKey) {
        logger.error('LIVEKIT_API_KEY is not set');
        return false;
      }

      if (!this.apiSecret) {
        logger.error('LIVEKIT_API_SECRET is not set');
        return false;
      }

      // Test SIP client initialization
      if (!this.sipClient) {
        logger.error('SIP client failed to initialize');
        return false;
      }

      logger.info('✓ LiveKit environment validated');
      return true;
    } catch (error) {
      logger.error('LiveKit environment validation failed:', error);
      return false;
    }
  }

  /**
   * Generate unique room name for outbound call
   * Format: outbound-{campaignId}-{timestamp}-{random}
   *
   * Note: "outbound-*" pattern should match your dispatch rules in LiveKit Dashboard
   *
   * @param {string} campaignId - Campaign ID
   * @returns {string} Room name
   */
  generateRoomName(campaignId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `outbound-${campaignId}-${timestamp}-${random}`;
  }

  /**
   * Create access token for room (if needed for debugging/monitoring)
   *
   * @param {string} roomName - Room name
   * @param {string} participantName - Participant name
   * @returns {string} Access token
   */
  createAccessToken(roomName, participantName) {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantName,
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    return token.toJwt();
  }
}

module.exports = LiveKitExecutor;
