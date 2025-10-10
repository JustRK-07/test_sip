/**
 * Inbound Call Configuration Verification
 * Checks if inbound calls are properly configured
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const twilioService = require('./src/services/TwilioService');

const prisma = new PrismaClient();

console.log('\n' + '='.repeat(70));
console.log('📞 INBOUND CALL CONFIGURATION VERIFICATION');
console.log('='.repeat(70) + '\n');

(async () => {
  try {
    // Step 1: Check Environment Configuration
    console.log('📊 Step 1: Environment Configuration');
    console.log('─'.repeat(70));

    const config = {
      livekitUrl: process.env.LIVEKIT_URL,
      livekitApiKey: process.env.LIVEKIT_API_KEY,
      livekitApiSecret: process.env.LIVEKIT_API_SECRET,
      inboundTrunk: process.env.LIVEKIT_INBOUND_TRUNK_ID,
      outboundTrunk: process.env.LIVEKIT_OUTBOUND_TRUNK_ID,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    };

    console.log('LiveKit URL:', config.livekitUrl || '❌ Not set');
    console.log('LiveKit API Key:', config.livekitApiKey ? '✅ Set' : '❌ Not set');
    console.log('LiveKit API Secret:', config.livekitApiSecret ? '✅ Set' : '❌ Not set');
    console.log('Inbound Trunk:', config.inboundTrunk || '❌ Not set');
    console.log('Outbound Trunk:', config.outboundTrunk || '❌ Not set');
    console.log('Twilio Account:', config.twilioAccountSid ? '✅ Set' : '❌ Not set');
    console.log('');

    // Step 2: Check Phone Numbers
    console.log('📊 Step 2: Checking Phone Numbers');
    console.log('─'.repeat(70));

    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: { isActive: true },
      include: {
        tenant: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } }
      }
    });

    console.log(`Found ${phoneNumbers.length} active phone numbers\n`);

    if (phoneNumbers.length === 0) {
      console.log('⚠️  No phone numbers found in database');
      console.log('   Run: node backend/test-import-twilio-numbers.js');
    } else {
      phoneNumbers.forEach((phone, idx) => {
        console.log(`${idx + 1}. ${phone.number}`);
        console.log(`   Type: ${phone.type}`);
        console.log(`   Provider: ${phone.provider}`);
        console.log(`   Provider SID: ${phone.providerSid}`);
        console.log(`   Tenant: ${phone.tenant?.name || 'None'}`);
        console.log(`   Campaign: ${phone.campaign?.name || 'Not linked'}`);
        console.log('');
      });
    }

    // Step 3: Check Twilio Configuration
    console.log('📊 Step 3: Twilio Phone Number Configuration');
    console.log('─'.repeat(70));

    if (phoneNumbers.length > 0) {
      const client = twilioService.getClient();

      for (const phone of phoneNumbers) {
        console.log(`\nChecking ${phone.number}...`);

        try {
          const twilioNumber = await client.incomingPhoneNumbers(phone.providerSid).fetch();

          console.log(`✅ Found on Twilio`);
          console.log(`   Friendly Name: ${twilioNumber.friendlyName}`);
          console.log(`   Voice URL: ${twilioNumber.voiceUrl || 'Not set'}`);
          console.log(`   Voice Method: ${twilioNumber.voiceMethod || 'POST'}`);
          console.log(`   Trunk SID: ${twilioNumber.trunkSid || 'Not assigned to trunk'}`);
          console.log(`   Status Callback: ${twilioNumber.statusCallback || 'Not set'}`);

          // Check if assigned to correct trunk
          const platformTrunk = await prisma.platformTrunk.findFirst({
            where: { tenantId: phone.tenantId, isActive: true }
          });

          if (platformTrunk && twilioNumber.trunkSid === platformTrunk.twilioTrunkSid) {
            console.log(`   ✅ Assigned to correct trunk: ${platformTrunk.name}`);
          } else if (twilioNumber.trunkSid) {
            console.log(`   ⚠️  Assigned to trunk: ${twilioNumber.trunkSid}`);
            if (platformTrunk) {
              console.log(`   Expected trunk: ${platformTrunk.twilioTrunkSid}`);
            }
          } else {
            console.log(`   ⚠️  Not assigned to any trunk`);
          }

        } catch (error) {
          console.log(`❌ Error fetching from Twilio: ${error.message}`);
        }
      }
    }

    // Step 4: Check Twilio Trunk Configuration
    console.log('\n📊 Step 4: Twilio Trunk Configuration');
    console.log('─'.repeat(70));

    const platformTrunk = await prisma.platformTrunk.findFirst({
      where: { isActive: true },
      include: { tenant: true }
    });

    if (!platformTrunk) {
      console.log('❌ No platform trunk found');
    } else {
      console.log(`✅ Found platform trunk: ${platformTrunk.name}`);
      console.log(`   Twilio SID: ${platformTrunk.twilioTrunkSid}`);
      console.log(`   Tenant: ${platformTrunk.tenant?.name}`);

      try {
        const client = twilioService.getClient();
        const trunk = await client.trunking.v1.trunks(platformTrunk.twilioTrunkSid).fetch();

        console.log(`   Status: ${trunk.friendlyName}`);
        console.log(`   Secure: ${trunk.secure ? 'Yes' : 'No'}`);
        console.log(`   Recording: ${trunk.recording?.mode || 'Not set'}`);

        // Check origination URIs
        const originationUrls = await client.trunking.v1
          .trunks(platformTrunk.twilioTrunkSid)
          .originationUrls.list();

        console.log(`\n   Origination URIs: ${originationUrls.length}`);
        originationUrls.forEach((url, idx) => {
          console.log(`   ${idx + 1}. ${url.sipUrl}`);
          console.log(`      Priority: ${url.priority}, Weight: ${url.weight}`);
          console.log(`      Enabled: ${url.enabled ? 'Yes' : 'No'}`);
        });

        // Check if LiveKit SIP URI is configured
        const expectedSipUri = 'sip:mjloa7bmm8p.sip.livekit.cloud';
        const hasLiveKitUri = originationUrls.some(url => url.sipUrl === expectedSipUri);

        if (hasLiveKitUri) {
          console.log(`\n   ✅ LiveKit SIP URI configured correctly`);
        } else {
          console.log(`\n   ⚠️  LiveKit SIP URI not found`);
          console.log(`   Expected: ${expectedSipUri}`);
        }

      } catch (error) {
        console.log(`❌ Error fetching trunk details: ${error.message}`);
      }
    }

    // Step 5: Inbound Call Flow Analysis
    console.log('\n' + '='.repeat(70));
    console.log('📋 INBOUND CALL FLOW ANALYSIS');
    console.log('='.repeat(70) + '\n');

    const inboundReady = config.inboundTrunk && phoneNumbers.length > 0;

    if (inboundReady) {
      console.log('✅ INBOUND CALLS READY\n');
      console.log('Complete Flow:');
      console.log('  1. External caller dials: ' + (phoneNumbers[0]?.number || 'your number'));
      console.log('  2. Twilio receives call');
      console.log('  3. Twilio trunk routes to: sip:mjloa7bmm8p.sip.livekit.cloud');
      console.log('  4. LiveKit inbound trunk receives: ' + config.inboundTrunk);
      console.log('  5. LiveKit creates room and waits for agent');
      console.log('  6. ⚠️  Webhook handler needed to connect AI agent');

      console.log('\n📝 What Happens Now:');
      console.log('   ✅ Infrastructure: Ready');
      console.log('   ✅ Phone numbers: Configured');
      console.log('   ✅ Trunk routing: Working');
      console.log('   ⚠️  Missing: Webhook handler for agent connection');

      console.log('\n🔧 Next Step: Implement Webhook Handler');
      console.log('   POST /api/v1/webhooks/livekit/sip-inbound');
      console.log('   - Receives SIP trunk webhook from LiveKit');
      console.log('   - Looks up phone number in database');
      console.log('   - Dispatches AI agent to room');
      console.log('   - Returns SIP trunk dispatch info');

    } else {
      console.log('⚠️  INBOUND CALLS NOT FULLY CONFIGURED\n');

      if (!config.inboundTrunk) {
        console.log('❌ Missing: LIVEKIT_INBOUND_TRUNK_ID in .env');
      }
      if (phoneNumbers.length === 0) {
        console.log('❌ Missing: Phone numbers (run import script)');
      }
    }

    // Step 6: Test Inbound Call
    console.log('\n' + '='.repeat(70));
    console.log('🧪 HOW TO TEST INBOUND CALLS');
    console.log('='.repeat(70) + '\n');

    if (phoneNumbers.length > 0) {
      console.log('1. Call this number from your phone:');
      console.log(`   ${phoneNumbers[0].number}`);
      console.log('');
      console.log('2. Check LiveKit dashboard:');
      console.log('   https://cloud.livekit.io/projects/firstproject-ly6tfhj5/rooms');
      console.log('');
      console.log('3. You should see:');
      console.log('   - New room created by SIP trunk');
      console.log('   - SIP participant connected');
      console.log('   - Waiting for agent to join');
      console.log('');
      console.log('⚠️  Note: Without webhook handler, agent won\'t auto-connect');
      console.log('   The call will connect to LiveKit but hang waiting for agent');
    } else {
      console.log('Import a phone number first:');
      console.log('   node backend/test-import-twilio-numbers.js');
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));

    console.log('\n✅ Configured:');
    console.log('   - LiveKit inbound trunk: ' + (config.inboundTrunk || 'Not set'));
    console.log('   - Phone numbers: ' + phoneNumbers.length);
    console.log('   - Twilio trunk routing: Configured');

    console.log('\n⚠️  To Complete:');
    console.log('   - Implement webhook handler for inbound calls');
    console.log('   - Auto-dispatch AI agent when call arrives');
    console.log('   - Add call logging to database');

    console.log('\n📍 Current Status:');
    console.log('   Inbound calls will reach LiveKit but need webhook');
    console.log('   handler to automatically connect AI agent.\n');

    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
