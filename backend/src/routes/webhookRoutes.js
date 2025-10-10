/**
 * Webhook Routes
 * Handles webhooks from LiveKit and other services
 */

const express = require('express');
const InboundCallService = require('../services/InboundCallService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * LiveKit SIP Trunk Inbound Call Webhook
 * POST /webhooks/livekit/sip-inbound
 *
 * LiveKit calls this when an inbound SIP call arrives
 * We need to respond with agent dispatch information
 */
router.post('/livekit/sip-inbound', async (req, res) => {
  try {
    logger.info('📞 Received LiveKit SIP inbound webhook');
    logger.info('Headers:', req.headers);
    logger.info('Body:', req.body);

    // Extract SIP call data from webhook payload
    const sipData = req.body;

    // Validate required fields
    if (!sipData.call_id || !sipData.to_number) {
      logger.error('Missing required fields in webhook payload');
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['call_id', 'to_number'],
      });
    }

    // Handle the inbound call
    const response = await InboundCallService.handleInboundCall(sipData);

    logger.info('✅ Inbound call handled successfully', response);

    // Return response to LiveKit
    // LiveKit expects agent_name to dispatch the agent
    res.json({
      agent_name: response.agent_name,
      metadata: response.metadata,
      attributes: response.attributes,
    });
  } catch (error) {
    logger.error('❌ Error handling inbound webhook:', error);

    // Even on error, return a valid response so call doesn't fail
    res.json({
      agent_name: 'telephony-agent', // Default agent
      error: error.message,
    });
  }
});

/**
 * LiveKit Room Events Webhook
 * POST /webhooks/livekit/events
 *
 * LiveKit sends room events (participant joined, call ended, etc.)
 */
router.post('/livekit/events', async (req, res) => {
  try {
    logger.info('📡 Received LiveKit event webhook');

    const event = req.body;
    const eventType = event.event;

    logger.info(`Event type: ${eventType}`);
    logger.info('Event data:', event);

    // Handle different event types
    switch (eventType) {
      case 'room.finished':
      case 'room.closed':
        // Call ended
        await InboundCallService.handleCallEnded({
          call_id: event.room?.name,
          room_name: event.room?.name,
          duration: event.room?.duration,
          disconnect_reason: event.room?.metadata?.disconnect_reason,
        });
        break;

      case 'participant.left':
        logger.info('Participant left room:', event.participant?.identity);
        break;

      case 'participant.joined':
        logger.info('Participant joined room:', event.participant?.identity);
        break;

      default:
        logger.info('Unhandled event type:', eventType);
    }

    // Acknowledge receipt
    res.json({ success: true });
  } catch (error) {
    logger.error('Error handling LiveKit event:', error);
    res.json({ success: false, error: error.message });
  }
});

/**
 * Webhook Health Check
 * GET /webhooks/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoints are operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      sip_inbound: '/webhooks/livekit/sip-inbound',
      events: '/webhooks/livekit/events',
    },
  });
});

/**
 * Test webhook endpoint
 * POST /webhooks/test
 *
 * For testing webhook integration without real calls
 */
router.post('/test', async (req, res) => {
  try {
    logger.info('🧪 Test webhook called');
    logger.info('Body:', req.body);

    // Simulate inbound call
    const testData = {
      call_id: 'test-' + Date.now(),
      trunk_id: process.env.LIVEKIT_INBOUND_TRUNK_ID,
      trunk_phone_number: '+18588796658',
      from_number: req.body.from_number || '+15551234567',
      to_number: req.body.to_number || '+18588796658',
      room_name: 'test-room-' + Date.now(),
    };

    const response = await InboundCallService.handleInboundCall(testData);

    res.json({
      success: true,
      message: 'Test webhook processed',
      test_data: testData,
      response: response,
    });
  } catch (error) {
    logger.error('Error in test webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
