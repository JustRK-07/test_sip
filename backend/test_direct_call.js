/**
 * Direct Call Test - Bypass Campaign System
 * Tests LiveKit + Twilio integration directly
 */

const { SipClient, AgentDispatchClient } = require('livekit-server-sdk');

// Configuration from .env
const LIVEKIT_URL = 'wss://firstproject-ly6tfhj5.livekit.cloud';
const LIVEKIT_API_KEY = 'APIEwGrcGpqLgai';
const LIVEKIT_API_SECRET = 'MvwhuwO9nFEyVmjSDNae5HXOO1JUxZ78efubMnpEfBdD';
const SIP_TRUNK_ID = 'ST_dWczR9uHwe7u';

// Test call details
const PHONE_NUMBER = '+919529117230'; // Your test number
const AGENT_NAME = 'telephony-agent'; // Changed from 'agent-backup-2' to match the running worker
const ROOM_NAME = `test-direct-call-${Date.now()}`;

async function makeDirectCall() {
  console.log('========================================');
  console.log('DIRECT CALL TEST');
  console.log('========================================');
  console.log('');
  console.log('Configuration:');
  console.log(`  Phone Number: ${PHONE_NUMBER}`);
  console.log(`  SIP Trunk: ${SIP_TRUNK_ID}`);
  console.log(`  Room: ${ROOM_NAME}`);
  console.log(`  Agent: ${AGENT_NAME}`);
  console.log('');

  try {
    // Initialize LiveKit clients
    const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const agentDispatch = new AgentDispatchClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    console.log('Step 1: Dispatching agent to room...');
    const dispatchInfo = await agentDispatch.createDispatch(
      ROOM_NAME,
      AGENT_NAME,
      {
        metadata: JSON.stringify({
          phoneNumber: PHONE_NUMBER,
          testCall: true,
          timestamp: new Date().toISOString(),
        }),
      }
    );

    console.log(`✓ Agent dispatched successfully`);
    console.log(`  Dispatch ID: ${dispatchInfo.id}`);
    console.log('');

    console.log('Step 2: Creating SIP participant (initiating call)...');
    const startTime = Date.now();

    const sipParticipantInfo = await sipClient.createSipParticipant(
      SIP_TRUNK_ID,
      PHONE_NUMBER,
      ROOM_NAME,
      {
        participantIdentity: `test-caller-${Date.now()}`,
        participantName: PHONE_NUMBER,
        participantMetadata: JSON.stringify({
          phoneNumber: PHONE_NUMBER,
          agentName: AGENT_NAME,
          dispatchId: dispatchInfo.id,
          testCall: true,
        }),
      }
    );

    const duration = Date.now() - startTime;

    console.log(`✓ Call initiated successfully!`);
    console.log('');
    console.log('Call Details:');
    console.log(`  Participant ID: ${sipParticipantInfo.participantId}`);
    console.log(`  SIP Call ID: ${sipParticipantInfo.sipCallId}`);
    console.log(`  Duration: ${duration}ms`);
    console.log('');
    console.log('========================================');
    console.log('RESULT');
    console.log('========================================');
    console.log('');
    console.log(`✅ Call successfully initiated to ${PHONE_NUMBER}`);
    console.log('');
    console.log('Expected behavior:');
    console.log('  - If LiveKit trunk is configured with Twilio:');
    console.log('    → Your phone should ring within 5-10 seconds');
    console.log('    → You will hear the AI agent when you answer');
    console.log('');
    console.log('  - If trunk is NOT configured:');
    console.log('    → Call will connect to LiveKit but not reach phone');
    console.log('    → Duration will be very short (< 5 seconds)');
    console.log('');
    console.log('Actual Duration:', duration + 'ms');

    if (duration < 5000) {
      console.log('');
      console.log('⚠️  WARNING: Very short duration!');
      console.log('This suggests the trunk is not properly configured.');
      console.log('Please configure LiveKit trunk with Twilio credentials.');
    } else {
      console.log('');
      console.log('✓ Duration looks good - call likely went through!');
      console.log('Check if your phone rang.');
    }

    console.log('');
    console.log('To monitor the call:');
    console.log(`  Room Name: ${ROOM_NAME}`);
    console.log(`  LiveKit Dashboard: https://cloud.livekit.io/projects`);
    console.log('');

    return {
      success: true,
      sipCallId: sipParticipantInfo.sipCallId,
      participantId: sipParticipantInfo.participantId,
      duration,
    };

  } catch (error) {
    console.error('');
    console.error('❌ CALL FAILED');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('');

    if (error.message.includes('trunk')) {
      console.error('Possible causes:');
      console.error('  1. SIP trunk does not exist');
      console.error('  2. SIP trunk is not configured');
      console.error('  3. Invalid trunk ID');
      console.error('');
      console.error('Solution:');
      console.error('  - Check LiveKit Dashboard for trunk:', SIP_TRUNK_ID);
      console.error('  - Verify trunk is configured with Twilio');
    } else if (error.message.includes('agent')) {
      console.error('Possible causes:');
      console.error('  1. Agent does not exist');
      console.error('  2. Agent name is incorrect');
      console.error('');
      console.error('Solution:');
      console.error('  - Check agent name:', AGENT_NAME);
      console.error('  - Verify agent exists in LiveKit Dashboard');
    }

    console.error('');
    throw error;
  }
}

// Run the test
makeDirectCall()
  .then((result) => {
    console.log('Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error.message);
    process.exit(1);
  });
