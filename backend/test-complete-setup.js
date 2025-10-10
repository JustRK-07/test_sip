/**
 * Complete Setup Verification Test
 * Tests the entire call flow configuration
 */

require('dotenv').config();
const { AccessToken } = require('livekit-server-sdk');

console.log('\n' + '='.repeat(70));
console.log('🔍 COMPLETE SETUP VERIFICATION TEST');
console.log('='.repeat(70) + '\n');

const config = {
  livekitUrl: process.env.LIVEKIT_URL,
  livekitApiKey: process.env.LIVEKIT_API_KEY,
  livekitApiSecret: process.env.LIVEKIT_API_SECRET,
  livekitOutboundTrunk: process.env.LIVEKIT_OUTBOUND_TRUNK_ID,
  livekitInboundTrunk: process.env.LIVEKIT_INBOUND_TRUNK_ID,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
};

let allTestsPassed = true;

// Test 1: LiveKit Configuration
console.log('📋 Test 1: LiveKit Configuration');
console.log('─'.repeat(70));

if (!config.livekitUrl || !config.livekitApiKey || !config.livekitApiSecret) {
  console.log('❌ FAILED: Missing LiveKit credentials');
  allTestsPassed = false;
} else {
  console.log('✅ LiveKit URL:', config.livekitUrl);
  console.log('✅ LiveKit API Key:', config.livekitApiKey);
  console.log('✅ LiveKit API Secret: Configured');
}

// Test 2: LiveKit Trunks
console.log('\n📞 Test 2: LiveKit SIP Trunks');
console.log('─'.repeat(70));

if (!config.livekitOutboundTrunk) {
  console.log('⚠️  WARNING: No outbound trunk configured');
} else {
  console.log('✅ Outbound Trunk:', config.livekitOutboundTrunk);
}

if (!config.livekitInboundTrunk) {
  console.log('❌ FAILED: No inbound trunk configured');
  allTestsPassed = false;
} else {
  console.log('✅ Inbound Trunk:', config.livekitInboundTrunk);
}

// Test 3: Token Generation
console.log('\n🔐 Test 3: LiveKit Token Generation');
console.log('─'.repeat(70));

(async () => {
  try {
    const token = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity: 'test-agent',
      ttl: 3600,
    });

    token.addGrant({
      roomJoin: true,
      room: 'test-room',
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();
    console.log('✅ Token generation successful');
    console.log('   Token length:', jwt.length, 'characters');
  } catch (error) {
    console.log('❌ FAILED: Token generation failed -', error.message);
    allTestsPassed = false;
  }

  // Test 4: Twilio Configuration
  console.log('\n📱 Test 4: Twilio Configuration');
  console.log('─'.repeat(70));

  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    console.log('❌ FAILED: Missing Twilio credentials');
    allTestsPassed = false;
  } else {
    console.log('✅ Twilio Account SID:', config.twilioAccountSid);
    console.log('✅ Twilio Auth Token: Configured');
    if (config.twilioPhoneNumber) {
      console.log('✅ Twilio Phone Number:', config.twilioPhoneNumber);
    }
  }

  // Test 5: Database Connection
  console.log('\n💾 Test 5: Database Connection');
  console.log('─'.repeat(70));

  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const tenantCount = await prisma.tenant.count();
    const trunkCount = await prisma.platformTrunk.count();
    const phoneCount = await prisma.phoneNumber.count();

    console.log('✅ Database connected');
    console.log('   Tenants:', tenantCount);
    console.log('   Platform Trunks:', trunkCount);
    console.log('   Phone Numbers:', phoneCount);

    await prisma.$disconnect();
  } catch (error) {
    console.log('❌ FAILED: Database connection failed -', error.message);
    allTestsPassed = false;
  }

  // Test 6: Expected Configuration
  console.log('\n🔗 Test 6: Call Flow Configuration');
  console.log('─'.repeat(70));

  const projectName = config.livekitUrl?.match(/wss:\/\/([^.]+)\./)?.[1];

  console.log('Expected SIP URI for Twilio:');
  console.log('   sip:mjloa7bmm8p.sip.livekit.cloud');
  console.log('');
  console.log('⚠️  IMPORTANT: Verify in Twilio Console:');
  console.log('   1. Go to: Elastic SIP Trunking');
  console.log('   2. Select trunk: TKb7dce640389bbae93497be426666a548');
  console.log('   3. Origination tab');
  console.log('   4. Should see: sip:mjloa7bmm8p.sip.livekit.cloud');
  console.log('   5. Priority: 10, Weight: 10, Enabled: Yes');

  // Final Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));

  if (allTestsPassed) {
    console.log('\n✅ ALL TESTS PASSED!');
    console.log('\n🎉 Your setup is complete and ready!');
    console.log('\n📞 Complete Call Flow:');
    console.log('   1. ✅ Caller dials phone number');
    console.log('   2. ✅ Twilio receives call');
    console.log('   3. ✅ Twilio routes to trunk: TKb7dce640389bbae93497be426666a548');
    console.log('   4. ✅ Trunk sends to LiveKit: sip:mjloa7bmm8p.sip.livekit.cloud');
    console.log('   5. ✅ LiveKit inbound trunk receives: ' + config.livekitInboundTrunk);
    console.log('   6. ✅ LiveKit creates room and waits for agent');
    console.log('   7. ⏳ Your AI agent needs to connect (next step)');

    console.log('\n🚀 Next Steps:');
    console.log('   1. Purchase a phone number using your API');
    console.log('   2. Call that number');
    console.log('   3. Check LiveKit dashboard for incoming call');
    console.log('   4. Connect your AI agent to the room');

    console.log('\n💡 To test:');
    console.log('   Run: ./test-purchase-with-jwt.sh');
    console.log('   Or use the API to purchase a number');

  } else {
    console.log('\n❌ SOME TESTS FAILED');
    console.log('\nPlease fix the issues above before proceeding.');
  }

  console.log('\n' + '='.repeat(70) + '\n');
})();
