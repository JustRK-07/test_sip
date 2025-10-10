/**
 * Test Campaign Call with Phone Number
 * Links a phone number to a campaign and makes a test call
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

console.log('\n' + '='.repeat(70));
console.log('📱 TEST CAMPAIGN CALL WITH PHONE NUMBER');
console.log('='.repeat(70) + '\n');

(async () => {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    if (args.length < 1) {
      console.log('❌ Usage: node test-campaign-with-phone.js <phone_number_to_call>');
      console.log('   Example: node test-campaign-with-phone.js +919529117230');
      process.exit(1);
    }

    const phoneToCall = args[0];

    // Step 1: Get the imported phone number
    console.log('📊 Step 1: Finding Imported Phone Number');
    console.log('─'.repeat(70));

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { isActive: true },
      include: { tenant: true }
    });

    if (!phoneNumber) {
      console.log('❌ No phone number found. Run test-import-twilio-numbers.js first');
      process.exit(1);
    }

    console.log(`✅ Found phone: ${phoneNumber.number}`);
    console.log(`   Type: ${phoneNumber.type}`);
    console.log(`   Provider: ${phoneNumber.provider}`);
    console.log(`   Tenant: ${phoneNumber.tenant?.name}\n`);

    // Step 2: Get or create a test campaign
    console.log('📊 Step 2: Finding/Creating Test Campaign');
    console.log('─'.repeat(70));

    let campaign = await prisma.campaign.findFirst({
      where: {
        name: 'Phone Number Test Campaign',
      },
      include: {
        phoneNumbers: true,
        leads: true
      }
    });

    if (!campaign) {
      console.log('Creating new test campaign...');
      campaign = await prisma.campaign.create({
        data: {
          name: 'Phone Number Test Campaign',
          description: 'Testing campaign with linked phone number',
          status: 'draft',
          agentName: 'telephony-agent',
          sipTrunkId: process.env.LIVEKIT_OUTBOUND_TRUNK_ID,
          maxConcurrent: 1,
          retryFailed: false,
        },
        include: {
          phoneNumbers: true,
          leads: true
        }
      });
      console.log(`✅ Created campaign: ${campaign.name} (${campaign.id})`);
    } else {
      console.log(`✅ Found existing campaign: ${campaign.name} (${campaign.id})`);
    }

    console.log(`   Status: ${campaign.status}`);
    console.log(`   SIP Trunk: ${campaign.sipTrunkId}`);
    console.log(`   Linked Phone Numbers: ${campaign.phoneNumbers.length}`);
    console.log(`   Leads: ${campaign.leads.length}\n`);

    // Step 3: Link phone number to campaign
    console.log('📊 Step 3: Linking Phone Number to Campaign');
    console.log('─'.repeat(70));

    if (phoneNumber.campaignId === campaign.id) {
      console.log(`✅ Phone number already linked to campaign\n`);
    } else {
      await prisma.phoneNumber.update({
        where: { id: phoneNumber.id },
        data: { campaignId: campaign.id }
      });
      console.log(`✅ Linked ${phoneNumber.number} to campaign\n`);
    }

    // Step 4: Create/Update lead with phone to call
    console.log('📊 Step 4: Creating Test Lead');
    console.log('─'.repeat(70));

    let lead = await prisma.lead.findFirst({
      where: {
        campaignId: campaign.id,
        phoneNumber: phoneToCall
      }
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          campaignId: campaign.id,
          phoneNumber: phoneToCall,
          name: 'Test Lead',
          status: 'pending',
          priority: 1
        }
      });
      console.log(`✅ Created lead: ${phoneToCall}`);
    } else {
      // Reset status to pending if it was called before
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'pending', attempts: 0 }
      });
      console.log(`✅ Found and reset lead: ${phoneToCall}`);
    }
    console.log(`   Lead ID: ${lead.id}\n`);

    // Step 5: Display call configuration
    console.log('📊 Step 5: Call Configuration');
    console.log('─'.repeat(70));
    console.log('✅ Everything is configured!\n');
    console.log('Call Details:');
    console.log(`  From Number (Caller ID): ${phoneNumber.number}`);
    console.log(`  To Number (Lead): ${phoneToCall}`);
    console.log(`  Campaign: ${campaign.name}`);
    console.log(`  Agent: ${campaign.agentName}`);
    console.log(`  SIP Trunk: ${campaign.sipTrunkId}`);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ SETUP COMPLETE');
    console.log('='.repeat(70));
    console.log('\n📱 Phone number imported from Twilio: +18588796658');
    console.log('🔗 Linked to campaign: Phone Number Test Campaign');
    console.log('📞 Ready to call: ' + phoneToCall);
    console.log('\n📝 Next Steps:');
    console.log('   1. Start the campaign via API:');
    console.log(`      POST http://localhost:3000/api/v1/campaigns/${campaign.id}/start`);
    console.log('');
    console.log('   2. Or test the outbound call directly:');
    console.log(`      python test_outbound.py ${phoneToCall}`);
    console.log('');
    console.log('   3. The campaign will use phone number as caller ID');
    console.log(`      (The person receiving the call will see: ${phoneNumber.number})`);

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
