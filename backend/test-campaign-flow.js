/**
 * Campaign Call Flow Verification
 * Tests that campaigns work with the new phone number/trunk architecture
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('\n' + '='.repeat(70));
console.log('🎯 CAMPAIGN CALL FLOW VERIFICATION');
console.log('='.repeat(70) + '\n');

(async () => {
  try {
    // Step 1: Check existing campaigns
    console.log('📊 Step 1: Checking Existing Campaigns');
    console.log('─'.repeat(70));

    const campaigns = await prisma.campaign.findMany({
      include: {
        phoneNumbers: true,
        leads: {
          take: 3,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`Found ${campaigns.length} campaigns\n`);

    if (campaigns.length > 0) {
      campaigns.forEach((campaign, idx) => {
        console.log(`${idx + 1}. ${campaign.name}`);
        console.log(`   Status: ${campaign.status}`);
        console.log(`   SIP Trunk: ${campaign.sipTrunkId || 'Not set'}`);
        console.log(`   Agent: ${campaign.agentName || 'Not set'}`);
        console.log(`   Phone Numbers: ${campaign.phoneNumbers.length}`);
        console.log(`   Leads: ${campaign.leads.length}`);
        console.log(`   Calls: ${campaign.totalCalls} (${campaign.successfulCalls} success, ${campaign.failedCalls} failed)`);
        console.log('');
      });
    }

    // Step 2: Check phone numbers
    console.log('\n📞 Step 2: Checking Phone Number Configuration');
    console.log('─'.repeat(70));

    const phoneNumbers = await prisma.phoneNumber.findMany({
      include: {
        tenant: {
          select: { id: true, name: true }
        },
        livekitTrunk: {
          select: { id: true, name: true, livekitTrunkId: true }
        },
        campaign: {
          select: { id: true, name: true, status: true }
        }
      }
    });

    console.log(`Found ${phoneNumbers.length} phone numbers\n`);

    if (phoneNumbers.length > 0) {
      phoneNumbers.forEach((phone, idx) => {
        console.log(`${idx + 1}. ${phone.number}`);
        console.log(`   Provider: ${phone.provider}`);
        console.log(`   Type: ${phone.type}`);
        console.log(`   Active: ${phone.isActive}`);
        console.log(`   Tenant: ${phone.tenant?.name || 'None'}`);
        console.log(`   Campaign: ${phone.campaign?.name || 'None'}`);
        console.log(`   LiveKit Trunk: ${phone.livekitTrunk?.name || 'None'}`);
        console.log('');
      });
    }

    // Step 3: Check LiveKit Trunks
    console.log('\n🔗 Step 3: Checking LiveKit Trunk Configuration');
    console.log('─'.repeat(70));

    const livekitTrunks = await prisma.liveKitTrunk.findMany({
      include: {
        tenant: {
          select: { id: true, name: true }
        },
        phoneNumbers: true
      }
    });

    console.log(`Found ${livekitTrunks.length} LiveKit trunks\n`);

    if (livekitTrunks.length > 0) {
      livekitTrunks.forEach((trunk, idx) => {
        console.log(`${idx + 1}. ${trunk.name}`);
        console.log(`   Trunk ID: ${trunk.livekitTrunkId}`);
        console.log(`   SIP URI: ${trunk.sipUri || 'Not set'}`);
        console.log(`   Type: ${trunk.type}`);
        console.log(`   Tenant: ${trunk.tenant?.name || 'None'}`);
        console.log(`   Phone Numbers: ${trunk.phoneNumbers.length}`);
        console.log('');
      });
    }

    // Step 4: Check Environment Configuration
    console.log('\n⚙️  Step 4: Environment Configuration');
    console.log('─'.repeat(70));

    const config = {
      livekitUrl: process.env.LIVEKIT_URL,
      livekitApiKey: process.env.LIVEKIT_API_KEY,
      outboundTrunk: process.env.LIVEKIT_OUTBOUND_TRUNK_ID,
      inboundTrunk: process.env.LIVEKIT_INBOUND_TRUNK_ID,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID
    };

    console.log('LiveKit URL:', config.livekitUrl || '❌ Not set');
    console.log('LiveKit API Key:', config.livekitApiKey ? '✅ Set' : '❌ Not set');
    console.log('Outbound Trunk:', config.outboundTrunk || '❌ Not set');
    console.log('Inbound Trunk:', config.inboundTrunk || '❌ Not set');
    console.log('Twilio Account:', config.twilioAccountSid ? '✅ Set' : '❌ Not set');

    // Step 5: Analyze Call Flow Readiness
    console.log('\n' + '='.repeat(70));
    console.log('📋 CALL FLOW ANALYSIS');
    console.log('='.repeat(70) + '\n');

    // Check if outbound calls can work
    const outboundReady = config.outboundTrunk && campaigns.some(c => c.sipTrunkId);
    console.log('🔊 Outbound Calls (Campaign → External Numbers):');
    if (outboundReady) {
      console.log('   ✅ READY');
      console.log('   - Outbound trunk configured:', config.outboundTrunk);
      console.log('   - Campaigns using trunk:', campaigns.filter(c => c.sipTrunkId).length);
      console.log('   - Flow: Campaign → LiveKit Outbound → Twilio → External Number');
    } else {
      console.log('   ⚠️  NOT FULLY CONFIGURED');
      if (!config.outboundTrunk) console.log('   - Missing: LIVEKIT_OUTBOUND_TRUNK_ID in .env');
      if (!campaigns.some(c => c.sipTrunkId)) console.log('   - No campaigns configured with SIP trunk');
    }

    // Check if inbound calls can work
    const inboundReady = config.inboundTrunk && phoneNumbers.length > 0;
    console.log('\n📞 Inbound Calls (External Numbers → System):');
    if (inboundReady) {
      console.log('   ✅ READY');
      console.log('   - Inbound trunk configured:', config.inboundTrunk);
      console.log('   - Phone numbers available:', phoneNumbers.length);
      console.log('   - Flow: External → Twilio → LiveKit Inbound → AI Agent');
    } else {
      console.log('   ⚠️  NOT FULLY CONFIGURED');
      if (!config.inboundTrunk) console.log('   - Missing: LIVEKIT_INBOUND_TRUNK_ID in .env');
      if (phoneNumbers.length === 0) console.log('   - No phone numbers purchased');
    }

    // Check phone number <-> campaign integration
    const phoneCampaignIntegration = phoneNumbers.some(p => p.campaignId);
    console.log('\n🔗 Phone Number ↔ Campaign Integration:');
    if (phoneCampaignIntegration) {
      const linkedNumbers = phoneNumbers.filter(p => p.campaignId);
      console.log('   ✅ CONFIGURED');
      console.log(`   - ${linkedNumbers.length} phone numbers linked to campaigns`);
      linkedNumbers.forEach(phone => {
        console.log(`   - ${phone.number} → ${phone.campaign?.name}`);
      });
    } else {
      console.log('   ⚠️  NO INTEGRATION YET');
      console.log('   - Phone numbers not linked to campaigns');
      console.log('   - Campaigns can still make outbound calls to leads');
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ SUMMARY');
    console.log('='.repeat(70) + '\n');

    const allReady = outboundReady && inboundReady;

    if (allReady) {
      console.log('🎉 FULL CALL FLOW READY!\n');
      console.log('You can now:');
      console.log('  1. ✅ Make outbound calls from campaigns to leads');
      console.log('  2. ✅ Receive inbound calls on purchased numbers');
      console.log('  3. ✅ Link phone numbers to campaigns for caller ID');
    } else {
      console.log('⚠️  PARTIAL SETUP\n');

      if (outboundReady) {
        console.log('✅ Outbound calls working:');
        console.log('   - Can make calls from campaigns to leads');
      }

      if (!inboundReady) {
        console.log('\n❌ Inbound calls need configuration:');
        if (!config.inboundTrunk) console.log('   1. Add LIVEKIT_INBOUND_TRUNK_ID to .env');
        if (phoneNumbers.length === 0) console.log('   2. Purchase phone numbers via API');
      }
    }

    // Current Campaign Flow
    console.log('\n📊 Current Campaign Flow:');
    console.log('─'.repeat(70));
    console.log('1. Create campaign via API');
    console.log('2. Add leads to campaign');
    console.log('3. Start campaign');
    console.log('4. Campaign uses LiveKit Outbound Trunk:', config.outboundTrunk || 'Not set');
    console.log('5. LiveKit calls leads via Twilio');
    console.log('6. AI agent connects and handles conversation');
    console.log('');
    console.log('Recent Campaign Results:');
    const recentCampaigns = campaigns.slice(0, 3);
    recentCampaigns.forEach(c => {
      console.log(`  - ${c.name}: ${c.totalCalls} calls (${c.successfulCalls} success)`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('📝 RECOMMENDATIONS');
    console.log('='.repeat(70) + '\n');

    if (!phoneCampaignIntegration && phoneNumbers.length > 0) {
      console.log('💡 Link phone numbers to campaigns for better caller ID:');
      console.log('   PUT /api/v1/tenants/:tenantId/phone-numbers/:id');
      console.log('   { "campaignId": "campaign-id-here" }');
      console.log('');
    }

    if (phoneNumbers.length === 0) {
      console.log('💡 Purchase phone numbers for inbound calls:');
      console.log('   POST /api/v1/tenants/:tenantId/phone-numbers');
      console.log('   { "number": "+14155551234", "type": "LOCAL" }');
      console.log('');
    }

    if (campaigns.length === 0) {
      console.log('💡 Create a campaign to test outbound calls:');
      console.log('   POST /api/v1/campaigns');
      console.log('   { "name": "Test Campaign", "sipTrunkId": "' + config.outboundTrunk + '" }');
      console.log('');
    }

    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
