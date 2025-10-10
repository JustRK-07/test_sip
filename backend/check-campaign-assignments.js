/**
 * Check Campaign Assignments
 * Verifies that agents and phone numbers are properly assigned to campaigns
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('═'.repeat(60));
  console.log('🔍 Checking Campaign Assignments');
  console.log('═'.repeat(60));
  console.log('');

  try {
    // Get the multi-agent test campaign
    const campaign = await prisma.campaign.findFirst({
      where: { name: 'Multi-Agent Test Campaign' },
      include: {
        campaignAgents: {
          include: {
            agent: true
          },
          orderBy: {
            isPrimary: 'desc'
          }
        },
        phoneNumbers: true,
        leads: {
          take: 5
        }
      }
    });

    if (!campaign) {
      console.log('❌ Campaign "Multi-Agent Test Campaign" not found');
      console.log('   Run: node test-multi-agent-campaign.js first');
      return;
    }

    console.log('📋 Campaign Details:');
    console.log(`   Name: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Max Concurrent: ${campaign.maxConcurrent}`);
    console.log(`   SIP Trunk ID: ${campaign.sipTrunkId || 'not set'}`);
    console.log(`   Agent Name (legacy): ${campaign.agentName || 'null'}`);
    console.log('');

    console.log('🤖 Assigned Agents: ' + campaign.campaignAgents.length);
    if (campaign.campaignAgents.length === 0) {
      console.log('   ❌ No agents assigned!');
    } else {
      campaign.campaignAgents.forEach((ca, i) => {
        console.log(`   ${i + 1}. ${ca.agent.name}`);
        console.log(`      - Agent ID: ${ca.agent.id}`);
        console.log(`      - Primary: ${ca.isPrimary ? '✅ YES' : 'No'}`);
        console.log(`      - Max Concurrent Calls: ${ca.agent.maxConcurrentCalls}`);
        console.log(`      - Active: ${ca.agent.isActive ? '✅' : '❌'}`);
      });
    }
    console.log('');

    console.log('📞 Assigned Phone Numbers: ' + campaign.phoneNumbers.length);
    if (campaign.phoneNumbers.length === 0) {
      console.log('   ⚠️  No phone numbers assigned');
      console.log('   Note: Phone numbers can be assigned via phoneNumber.campaignId');
    } else {
      campaign.phoneNumbers.forEach((pn, i) => {
        console.log(`   ${i + 1}. ${pn.number}`);
        console.log(`      - Type: ${pn.type}`);
        console.log(`      - Provider: ${pn.provider}`);
        console.log(`      - Active: ${pn.isActive ? '✅' : '❌'}`);
        console.log(`      - LiveKit Trunk: ${pn.livekitTrunkId || 'not set'}`);
      });
    }
    console.log('');

    console.log('👥 Campaign Leads: ' + campaign.leads.length);
    if (campaign.leads.length === 0) {
      console.log('   ⚠️  No leads - campaign cannot start without leads');
    } else {
      campaign.leads.forEach((lead, i) => {
        console.log(`   ${i + 1}. ${lead.phoneNumber}`);
        console.log(`      - Name: ${lead.name || 'N/A'}`);
        console.log(`      - Status: ${lead.status}`);
        console.log(`      - Priority: ${lead.priority}`);
      });
    }
    console.log('');

    // Check what's needed for outbound calling
    console.log('═'.repeat(60));
    console.log('📊 Outbound Call Readiness:');
    console.log('═'.repeat(60));
    console.log('');

    const checks = [];

    // Check 1: Agents assigned
    if (campaign.campaignAgents.length > 0) {
      console.log('✅ Agents assigned:', campaign.campaignAgents.length);
      checks.push(true);
    } else {
      console.log('❌ No agents assigned - calls will fail!');
      console.log('   Fix: Run node test-multi-agent-campaign.js');
      checks.push(false);
    }

    // Check 2: SIP Trunk configured
    if (campaign.sipTrunkId) {
      console.log('✅ SIP Trunk ID configured:', campaign.sipTrunkId);
      checks.push(true);
    } else {
      console.log('⚠️  SIP Trunk ID not set in campaign');
      console.log('   Campaign will need to get trunk from phone number or default');

      // Check if phone numbers have trunk
      if (campaign.phoneNumbers.length > 0 && campaign.phoneNumbers[0].livekitTrunkId) {
        console.log('   ✅ Phone numbers have LiveKit trunk:', campaign.phoneNumbers[0].livekitTrunkId);
        checks.push(true);
      } else {
        console.log('   ❌ No trunk configuration found!');
        checks.push(false);
      }
    }

    // Check 3: Phone numbers for caller ID
    if (campaign.phoneNumbers.length > 0) {
      console.log('✅ Phone numbers available for caller ID:', campaign.phoneNumbers.length);
      checks.push(true);
    } else {
      console.log('⚠️  No phone numbers assigned');
      console.log('   Calls may work but will not have proper caller ID');
      checks.push(false);
    }

    // Check 4: Leads to call
    if (campaign.leads.length > 0) {
      console.log('✅ Leads available to call:', campaign.leads.length);
      checks.push(true);
    } else {
      console.log('❌ No leads - campaign cannot start!');
      console.log('   Fix: Add leads to campaign via API or test script');
      checks.push(false);
    }

    console.log('');
    console.log('═'.repeat(60));

    const allReady = checks.every(c => c);
    if (allReady) {
      console.log('✅ Campaign is READY for outbound calling!');
      console.log('');
      console.log('How outbound calls will work:');
      console.log('  1. Campaign starts');
      console.log('  2. For each lead:');
      console.log('     a. AgentSelectionService picks an agent from assigned agents');
      console.log('     b. Phone number from campaign.phoneNumbers used as caller ID');
      console.log('     c. SIP trunk from campaign.sipTrunkId or phoneNumber.livekitTrunkId');
      console.log('     d. Agent dispatched to call via LiveKit');
      console.log('  3. Agent rotation/load balancing happens automatically');
    } else {
      console.log('⚠️  Campaign NOT READY - issues found above');
      console.log('');
      console.log('Required for outbound calling:');
      console.log('  ✅ = Ready, ❌ = Missing, ⚠️ = Warning');
      console.log('');
      console.log('  ' + (campaign.campaignAgents.length > 0 ? '✅' : '❌') + ' Agents assigned via CampaignAgent table');
      console.log('  ' + (campaign.sipTrunkId ? '✅' : '⚠️') + ' SIP Trunk ID configured');
      console.log('  ' + (campaign.phoneNumbers.length > 0 ? '✅' : '⚠️') + ' Phone numbers for caller ID');
      console.log('  ' + (campaign.leads.length > 0 ? '✅' : '❌') + ' Leads to call');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
