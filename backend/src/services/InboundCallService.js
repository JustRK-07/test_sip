/**
 * Inbound Call Service
 * Handles incoming SIP calls from LiveKit
 */

const { getPrismaClient } = require('../config/prisma');
const { AccessToken } = require('livekit-server-sdk');
const logger = require('../utils/logger');
const AgentSelectionService = require('./AgentSelectionService');

const prisma = getPrismaClient();

class InboundCallService {
  /**
   * Handle inbound SIP call from LiveKit
   * @param {Object} sipData - SIP call data from LiveKit webhook
   * @returns {Object} Response with agent dispatch info
   */
  async handleInboundCall(sipData) {
    const {
      call_id,
      trunk_id,
      trunk_phone_number,
      from_number,
      to_number,
      room_name,
    } = sipData;

    logger.info('📞 Inbound call received', {
      callId: call_id,
      trunkId: trunk_id,
      from: from_number,
      to: to_number,
      room: room_name,
    });

    try {
      // Step 1: Look up phone number in database
      const phoneNumber = await this.lookupPhoneNumber(to_number);

      if (!phoneNumber) {
        logger.warn(`Phone number not found in database: ${to_number}`);
        return {
          error: 'Phone number not found',
          decline: false, // Still accept call
          agent_name: 'telephony-agent', // Use default agent
        };
      }

      logger.info('✅ Phone number found', {
        number: phoneNumber.number,
        tenant: phoneNumber.tenant?.name,
        campaign: phoneNumber.campaign?.name,
      });

      // Step 2: Determine which agent to use
      const agentName = await this.getAgentForCall(phoneNumber);

      // Step 3: Log the call in database
      await this.logInboundCall({
        callId: call_id,
        phoneNumber: phoneNumber,
        fromNumber: from_number,
        toNumber: to_number,
        roomName: room_name,
        trunkId: trunk_id,
      });

      // Step 4: Return response to LiveKit
      return {
        agent_name: agentName,
        metadata: JSON.stringify({
          call_type: 'inbound',
          phone_number_id: phoneNumber.id,
          tenant_id: phoneNumber.tenantId,
          campaign_id: phoneNumber.campaignId,
          from_number: from_number,
          to_number: to_number,
        }),
        attributes: {
          inbound: 'true',
          phone_number: to_number,
          caller: from_number,
        },
      };
    } catch (error) {
      logger.error('❌ Error handling inbound call:', error);

      // Still allow the call to proceed with default agent
      return {
        error: error.message,
        decline: false,
        agent_name: 'telephony-agent',
      };
    }
  }

  /**
   * Look up phone number in database
   * @param {string} phoneNumber - E.164 formatted phone number
   * @returns {Object|null} Phone number record with associations
   */
  async lookupPhoneNumber(phoneNumber) {
    // Normalize phone number to E.164 format
    const normalizedNumber = this.normalizePhoneNumber(phoneNumber);

    const record = await prisma.phoneNumber.findUnique({
      where: { number: normalizedNumber },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
        campaign: {
          select: { id: true, name: true, agentName: true },
        },
      },
    });

    return record;
  }

  /**
   * Determine which agent should handle the call
   * @param {Object} phoneNumber - Phone number record from database
   * @returns {string} Agent name to dispatch
   */
  async getAgentForCall(phoneNumber) {
    try {
      // Use AgentSelectionService for intelligent agent selection
      const agentName = await AgentSelectionService.selectAgentForInbound(phoneNumber);
      logger.info(`Selected inbound agent: ${agentName}`);
      return agentName;
    } catch (error) {
      logger.error('Error selecting agent for inbound call:', error);

      // Fallback to old logic if AgentSelectionService fails

      // Priority 1: Use campaign's agent if phone is linked to campaign
      if (phoneNumber.campaign?.agentName) {
        logger.info(`Using campaign agent (fallback): ${phoneNumber.campaign.agentName}`);
        return phoneNumber.campaign.agentName;
      }

      // Priority 2: Look up default agent for tenant
      if (phoneNumber.tenantId) {
        const defaultAgent = await prisma.agent.findFirst({
          where: {
            isActive: true,
            // Could add tenant filtering here if agents are tenant-scoped
          },
          orderBy: { createdAt: 'desc' },
        });

        if (defaultAgent) {
          logger.info(`Using tenant default agent (fallback): ${defaultAgent.name}`);
          return defaultAgent.name;
        }
      }

      // Priority 3: Use system default agent
      logger.info('Using system default agent (fallback): telephony-agent');
      return 'telephony-agent';
    }
  }

  /**
   * Log inbound call to database
   * @param {Object} callData - Call information
   */
  async logInboundCall(callData) {
    const {
      callId,
      phoneNumber,
      fromNumber,
      toNumber,
      roomName,
      trunkId,
    } = callData;

    try {
      // Create call log entry
      const metadata = {
        call_type: 'inbound',
        trunk_id: trunkId,
        phone_number_id: phoneNumber.id,
        tenant_id: phoneNumber.tenantId,
        campaign_id: phoneNumber.campaignId,
      };

      // If phone is linked to campaign, create CallLog
      if (phoneNumber.campaignId) {
        // Check if there's a lead for this caller
        let lead = await prisma.lead.findFirst({
          where: {
            campaignId: phoneNumber.campaignId,
            phoneNumber: fromNumber,
          },
        });

        // Create lead if doesn't exist
        if (!lead) {
          lead = await prisma.lead.create({
            data: {
              campaignId: phoneNumber.campaignId,
              phoneNumber: fromNumber,
              name: `Inbound Caller ${fromNumber}`,
              status: 'calling',
            },
          });
          logger.info(`Created new lead for inbound caller: ${fromNumber}`);
        }

        // Create call log
        const callLog = await prisma.callLog.create({
          data: {
            leadId: lead.id,
            campaignId: phoneNumber.campaignId,
            phoneNumber: fromNumber,
            callSid: callId,
            roomName: roomName,
            status: 'ringing',
            metadata: JSON.stringify(metadata),
          },
        });

        logger.info(`Call log created: ${callLog.id}`);
      } else {
        logger.info('Phone not linked to campaign, skipping detailed logging');
      }
    } catch (error) {
      logger.error('Error logging inbound call:', error);
      // Don't throw - logging shouldn't block the call
    }
  }

  /**
   * Normalize phone number to E.164 format
   * @param {string} phoneNumber - Phone number in any format
   * @returns {string} E.164 formatted phone number
   */
  normalizePhoneNumber(phoneNumber) {
    // Remove all non-digit characters except leading +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      // Assume US number if no country code
      normalized = '+1' + normalized;
    }

    return normalized;
  }

  /**
   * Update call status when call ends
   * @param {Object} eventData - Call event data from LiveKit
   */
  async handleCallEnded(eventData) {
    const { call_id, room_name, duration, disconnect_reason } = eventData;

    logger.info('📞 Call ended', {
      callId: call_id,
      room: room_name,
      duration: duration,
      reason: disconnect_reason,
    });

    try {
      // Find call log by callSid or roomName
      const callLog = await prisma.callLog.findFirst({
        where: {
          OR: [
            { callSid: call_id },
            { roomName: room_name },
          ],
        },
      });

      if (callLog) {
        // Update call log with final status
        await prisma.callLog.update({
          where: { id: callLog.id },
          data: {
            status: 'completed',
            duration: duration || null,
            metadata: JSON.stringify({
              ...JSON.parse(callLog.metadata || '{}'),
              disconnect_reason,
              ended_at: new Date().toISOString(),
            }),
          },
        });

        // Update lead status
        if (callLog.leadId) {
          await prisma.lead.update({
            where: { id: callLog.leadId },
            data: {
              status: 'completed',
              lastCallAt: new Date(),
            },
          });
        }

        logger.info(`Updated call log: ${callLog.id}`);
      }
    } catch (error) {
      logger.error('Error updating call status:', error);
    }
  }
}

// Export singleton instance
module.exports = new InboundCallService();
