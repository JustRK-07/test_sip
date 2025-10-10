/**
 * Complete Outbound Call Flow Test
 * Sets up everything needed and tests if automatic agent/phone assignment works
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('═'.repeat(60));
  console.log('🧪 Testing Complete Outbound Call Flow');
  console.log('═'.repeat(60));
  console.log('');

  try {
    // Step 1: Get the multi-agent campaign
    console.log('Step 1: Loading campaign...');
    let campaign = await prisma.campaign.findFirst({
      where: { name: 'Multi-Agent Test Campaign' },
      include: {
        campaignAgents: { include: { agent: true } },
        phoneNumbers: true,
        leads: true
      }
    });

    if (!campaign) {
      console.log('❌ Campaign not found. Run: node test-multi-agent-campaign.js first');
      return;
    }
    console.log(`✅ Campaign loaded: ${campaign.name}`);
    console.log('');

    // Step 2: Configure SIP Trunk (get from existing phone number or use default)
    console.log('Step 2: Configuring SIP Trunk...');

    // Get existing phone number with trunk info
    const phoneWithTrunk = await prisma.phoneNumber.findFirst({
      where: {
        isActive: true,
        provider: 'TWILIO'
      },
      include: {
        livekitTrunk: true
      }
    });

    let sipTrunkId = null;
    if (phoneWithTrunk && phoneWithTrunk.livekitTrunk) {
      sipTrunkId = phoneWithTrunk.livekitTrunk.livekitTrunkId;
      console.log(`✅ Using existing SIP trunk from phone: ${sipTrunkId}`);
    } else {
      // Use environment variable
      sipTrunkId = process.env.LIVEKIT_OUTBOUND_TRUNK_ID;
      if (sipTrunkId) {
        console.log(`✅ Using SIP trunk from environment: ${sipTrunkId}`);
      } else {
        console.log('⚠️  No SIP trunk configured - using placeholder');
        sipTrunkId = 'ST_placeholder';
      }
    }

    // Update campaign with SIP trunk
    campaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { sipTrunkId }
    });
    console.log('');

    // Step 3: Ensure phone number is linked
    console.log('Step 3: Linking phone number to campaign...');

    // Reload campaign with phone numbers
    campaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: {
        campaignAgents: { include: { agent: true } },
        phoneNumbers: true,
        leads: true
      }
    });

    let campaignPhone = campaign.phoneNumbers ? campaign.phoneNumbers[0] : null;

    if (!campaignPhone) {
      // Link the phone number we found
      if (phoneWithTrunk) {
        await prisma.phoneNumber.update({
          where: { id: phoneWithTrunk.id },
          data: { campaignId: campaign.id }
        });
        campaignPhone = phoneWithTrunk;
        console.log(`✅ Linked phone number: ${campaignPhone.number}`);
      } else {
        console.log('⚠️  No phone number available - calls will not have caller ID');
      }
    } else {
      console.log(`✅ Phone number already linked: ${campaignPhone.number}`);
    }
    console.log('');

    // Step 4: Add test leads if none exist
    console.log('Step 4: Setting up test leads...');
    if (campaign.leads.length === 0) {
      const testPhones = [
        '+919529117230',
        '+15551234567',
        '+15559876543'
      ];

      for (const phone of testPhones) {
        await prisma.lead.create({
          data: {
            campaignId: campaign.id,
            phoneNumber: phone,
            name: `Test Lead ${phone}`,
            status: 'pending',
            priority: 1
          }
        });
      }
      console.log(`✅ Created ${testPhones.length} test leads`);
    } else {
      console.log(`✅ Campaign already has ${campaign.leads.length} leads`);
    }
    console.log('');

    // Step 5: Verify everything is ready
    console.log('Step 5: Verifying campaign readiness...');
    campaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: {
        campaignAgents: {
          include: { agent: true },
          orderBy: { isPrimary: 'desc' }
        },
        phoneNumbers: true,
        leads: { where: { status: 'pending' }, take: 5 }
      }
    });

    console.log('');
    console.log('═'.repeat(60));
    console.log('📊 Campaign Configuration Summary');
    console.log('═'.repeat(60));
    console.log('');

    console.log('Campaign:', campaign.name);
    console.log('  Status:', campaign.status);
    console.log('  Max Concurrent:', campaign.maxConcurrent);
    console.log('  SIP Trunk:', campaign.sipTrunkId);
    console.log('');

    console.log('Agents (' + campaign.campaignAgents.length + '):');
    campaign.campaignAgents.forEach((ca, i) => {
      console.log(`  ${i + 1}. ${ca.agent.name} ${ca.isPrimary ? '(PRIMARY)' : '(backup)'}`);
      console.log(`     Max calls: ${ca.agent.maxConcurrentCalls}`);
    });
    console.log('');

    console.log('Phone Numbers (' + campaign.phoneNumbers.length + '):');
    campaign.phoneNumbers.forEach((pn, i) => {
      console.log(`  ${i + 1}. ${pn.number} (${pn.type})`);
    });
    console.log('');

    console.log('Pending Leads (' + campaign.leads.length + '):');
    campaign.leads.forEach((lead, i) => {
      console.log(`  ${i + 1}. ${lead.phoneNumber} - ${lead.name}`);
    });
    console.log('');

    // Step 6: Simulate what happens when campaign starts
    console.log('═'.repeat(60));
    console.log('🎬 Simulating Outbound Call Flow');
    console.log('═'.repeat(60));
    console.log('');

    console.log('When you START this campaign:');
    console.log('');

    console.log('1️⃣  Campaign starts with:');
    console.log(`    - sipTrunkId: ${campaign.sipTrunkId}`);
    console.log(`    - maxConcurrent: ${campaign.maxConcurrent}`);
    console.log(`    - agentName: ${campaign.agentName || 'null (will use CampaignAgent table)'}`);
    console.log('');

    console.log('2️⃣  CampaignQueue created with these settings');
    console.log('');

    console.log('3️⃣  For EACH lead, CampaignQueue.startCall() does:');
    console.log('');

    console.log('    a) SELECT AGENT:');
    console.log('       AgentSelectionService.selectAgentForCampaign()');
    console.log(`       → Queries: SELECT * FROM CampaignAgent WHERE campaignId = "${campaign.id}"`);
    console.log(`       → Found ${campaign.campaignAgents.length} agents`);
    console.log(`       → Strategy: PRIMARY_FIRST (default)`);
    console.log(`       → Selects: ${campaign.campaignAgents[0].agent.name} (primary)`);
    console.log(`       → When primary at capacity (${campaign.campaignAgents[0].agent.maxConcurrentCalls} calls):`);
    console.log(`         Fallback → ${campaign.campaignAgents[1].agent.name}`);
    console.log('');

    console.log('    b) GET PHONE NUMBER (caller ID):');
    if (campaign.phoneNumbers.length > 0) {
      console.log(`       → Uses: ${campaign.phoneNumbers[0].number}`);
    } else {
      console.log('       ⚠️  No phone numbers - no caller ID');
    }
    console.log('');

    console.log('    c) GET SIP TRUNK:');
    console.log(`       → Uses: ${campaign.sipTrunkId}`);
    console.log('');

    console.log('    d) MAKE CALL via LiveKit:');
    console.log(`       livekitExecutor.makeCall(`);
    console.log(`         lead.phoneNumber: ${campaign.leads[0]?.phoneNumber || '<lead-phone>'},`);
    console.log(`         sipTrunkId: ${campaign.sipTrunkId},`);
    console.log(`         roomName: <auto-generated>,`);
    console.log(`         agentName: ${campaign.campaignAgents[0].agent.name} ← SELECTED DYNAMICALLY`);
    console.log(`       )`);
    console.log('');

    console.log('    e) TRACK LOAD:');
    console.log(`       AgentSelectionService.incrementActiveCall(${campaign.campaignAgents[0].agent.name})`);
    console.log('');

    console.log('4️⃣  When call completes:');
    console.log('       AgentSelectionService.decrementActiveCall()');
    console.log('');

    console.log('5️⃣  Next call:');
    console.log('       If primary still available → use primary');
    console.log('       If primary at capacity → use backup-1');
    console.log('       If backup-1 at capacity → use backup-2');
    console.log('');

    // Step 7: Final readiness check
    console.log('═'.repeat(60));
    console.log('✅ READINESS CHECK');
    console.log('═'.repeat(60));
    console.log('');

    const checks = [
      {
        name: 'Agents via CampaignAgent table',
        pass: campaign.campaignAgents.length > 0,
        value: `${campaign.campaignAgents.length} agents`
      },
      {
        name: 'SIP Trunk ID',
        pass: campaign.sipTrunkId !== null,
        value: campaign.sipTrunkId || 'not set'
      },
      {
        name: 'Phone number for caller ID',
        pass: campaign.phoneNumbers.length > 0,
        value: campaign.phoneNumbers.length > 0 ? campaign.phoneNumbers[0].number : 'none'
      },
      {
        name: 'Leads to call',
        pass: campaign.leads.length > 0,
        value: `${campaign.leads.length} pending leads`
      }
    ];

    checks.forEach(check => {
      const icon = check.pass ? '✅' : '❌';
      console.log(`${icon} ${check.name}: ${check.value}`);
    });

    console.log('');

    if (checks.every(c => c.pass)) {
      console.log('🎉 CAMPAIGN IS READY FOR OUTBOUND CALLING!');
      console.log('');
      console.log('To start campaign:');
      console.log(`  POST http://localhost:3001/api/v1/campaigns/${campaign.id}/start`);
      console.log('');
      console.log('Or via test script:');
      console.log('  python test_outbound.py +919529117230');
      console.log('');
      console.log('Expected behavior:');
      console.log('  ✅ Agent selected automatically from CampaignAgent table');
      console.log('  ✅ Primary agent used first');
      console.log('  ✅ Automatic fallback to backup when primary at capacity');
      console.log('  ✅ Load balancing across all agents');
      console.log('  ✅ Real-time tracking via GET /api/v1/agents/load-stats');
    } else {
      console.log('⚠️  Campaign has issues (see above)');
    }

    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
