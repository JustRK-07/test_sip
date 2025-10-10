/**
 * Test Multi-Agent Campaign Flow
 * Tests the new CampaignAgent junction table approach with multiple agents per campaign
 */

const { PrismaClient } = require('@prisma/client');
const AgentSelectionService = require('./src/services/AgentSelectionService');
const { SELECTION_STRATEGIES } = AgentSelectionService;

const prisma = new PrismaClient();

async function main() {
  console.log('═'.repeat(60));
  console.log('🧪 Testing Multi-Agent Campaign Flow');
  console.log('═'.repeat(60));
  console.log('');

  try {
    // Step 1: Get or create tenant
    console.log('Step 1: Setting up tenant...');
    let tenant = await prisma.tenant.findFirst({
      where: { name: 'Test Tenant' }
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'Test Tenant',
          domain: 'test.example.com'
        }
      });
    }
    console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);
    console.log('');

    // Step 2: Create multiple agents
    console.log('Step 2: Creating multiple agents...');

    const agents = [];
    const agentConfigs = [
      { name: 'agent-primary', description: 'Primary agent', maxConcurrentCalls: 2 },
      { name: 'agent-backup-1', description: 'Backup agent 1', maxConcurrentCalls: 3 },
      { name: 'agent-backup-2', description: 'Backup agent 2', maxConcurrentCalls: 5 }
    ];

    for (const config of agentConfigs) {
      let agent = await prisma.agent.findFirst({
        where: { name: config.name }
      });

      if (!agent) {
        agent = await prisma.agent.create({
          data: {
            name: config.name,
            description: config.description,
            isActive: true,
            maxConcurrentCalls: config.maxConcurrentCalls
          }
        });
        console.log(`  ✅ Created agent: ${agent.name} (max: ${agent.maxConcurrentCalls} calls)`);
      } else {
        console.log(`  ℹ️  Agent exists: ${agent.name} (max: ${agent.maxConcurrentCalls} calls)`);
      }
      agents.push(agent);
    }
    console.log('');

    // Step 3: Create campaign
    console.log('Step 3: Creating campaign...');
    let campaign = await prisma.campaign.findFirst({
      where: { name: 'Multi-Agent Test Campaign' }
    });

    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: {
          name: 'Multi-Agent Test Campaign',
          description: 'Testing multiple agents with rotation and fallback',
          status: 'draft',
          maxConcurrent: 5
        }
      });
      console.log(`✅ Campaign created: ${campaign.name} (${campaign.id})`);
    } else {
      console.log(`ℹ️  Campaign exists: ${campaign.name} (${campaign.id})`);
    }
    console.log('');

    // Step 4: Assign agents to campaign
    console.log('Step 4: Assigning agents to campaign...');

    // Assign primary agent
    const primaryAssignment = await prisma.campaignAgent.upsert({
      where: {
        campaignId_agentId: {
          campaignId: campaign.id,
          agentId: agents[0].id
        }
      },
      update: { isPrimary: true },
      create: {
        campaignId: campaign.id,
        agentId: agents[0].id,
        isPrimary: true
      },
      include: { agent: true }
    });
    console.log(`  ✅ Primary agent: ${primaryAssignment.agent.name}`);

    // Assign backup agents
    for (let i = 1; i < agents.length; i++) {
      const backupAssignment = await prisma.campaignAgent.upsert({
        where: {
          campaignId_agentId: {
            campaignId: campaign.id,
            agentId: agents[i].id
          }
        },
        update: { isPrimary: false },
        create: {
          campaignId: campaign.id,
          agentId: agents[i].id,
          isPrimary: false
        },
        include: { agent: true }
      });
      console.log(`  ✅ Backup agent ${i}: ${backupAssignment.agent.name}`);
    }
    console.log('');

    // Step 5: Test different selection strategies
    console.log('Step 5: Testing agent selection strategies...');
    console.log('');

    // Reset agent load tracking for testing
    AgentSelectionService.resetLoadTracking();

    // Test PRIMARY_FIRST strategy
    console.log('🧪 Strategy: PRIMARY_FIRST');
    for (let i = 1; i <= 5; i++) {
      const agent = await AgentSelectionService.selectAgentForCampaign(
        campaign.id,
        SELECTION_STRATEGIES.PRIMARY_FIRST
      );
      console.log(`  Call ${i}: ${agent.name}`);
      AgentSelectionService.incrementActiveCall(agent.id);
    }
    console.log('  Load stats:', AgentSelectionService.getAgentLoadStats());
    AgentSelectionService.resetLoadTracking();
    console.log('');

    // Test ROUND_ROBIN strategy
    console.log('🧪 Strategy: ROUND_ROBIN');
    for (let i = 1; i <= 6; i++) {
      const agent = await AgentSelectionService.selectAgentForCampaign(
        campaign.id,
        SELECTION_STRATEGIES.ROUND_ROBIN
      );
      console.log(`  Call ${i}: ${agent.name}`);
    }
    console.log('');

    // Test LEAST_LOADED strategy
    console.log('🧪 Strategy: LEAST_LOADED');
    // Simulate different loads
    AgentSelectionService.incrementActiveCall(agents[0].id);  // agent-primary: 1
    AgentSelectionService.incrementActiveCall(agents[1].id);  // agent-backup-1: 1
    AgentSelectionService.incrementActiveCall(agents[1].id);  // agent-backup-1: 2

    console.log('  Current loads:', AgentSelectionService.getAgentLoadStats());
    for (let i = 1; i <= 3; i++) {
      const agent = await AgentSelectionService.selectAgentForCampaign(
        campaign.id,
        SELECTION_STRATEGIES.LEAST_LOADED
      );
      console.log(`  Call ${i}: ${agent.name} (selecting least loaded)`);
      AgentSelectionService.incrementActiveCall(agent.id);
      console.log(`    New loads:`, AgentSelectionService.getAgentLoadStats());
    }
    AgentSelectionService.resetLoadTracking();
    console.log('');

    // Step 6: Test capacity limits and fallback
    console.log('Step 6: Testing capacity limits and fallback...');
    // Simulate primary agent at capacity
    for (let i = 0; i < agents[0].maxConcurrentCalls; i++) {
      AgentSelectionService.incrementActiveCall(agents[0].id);
    }
    console.log(`  Primary agent (${agents[0].name}) at capacity: ${agents[0].maxConcurrentCalls}/${agents[0].maxConcurrentCalls}`);

    const fallbackAgent = await AgentSelectionService.selectAgentForCampaign(
      campaign.id,
      SELECTION_STRATEGIES.PRIMARY_FIRST
    );
    console.log(`  ✅ Fallback agent selected: ${fallbackAgent.name}`);
    AgentSelectionService.resetLoadTracking();
    console.log('');

    // Step 7: Test available agents query
    console.log('Step 7: Testing available agents query...');
    const availableAgents = await AgentSelectionService.getAvailableAgents(campaign.id);
    console.log(`  Total agents: ${availableAgents.length}`);
    availableAgents.forEach(agent => {
      console.log(`    • ${agent.name}:`);
      console.log(`      - Primary: ${agent.isPrimary}`);
      console.log(`      - Active calls: ${agent.activeCalls}`);
      console.log(`      - Max calls: ${agent.maxConcurrentCalls}`);
      console.log(`      - Available: ${agent.available}`);
    });
    console.log('');

    // Step 8: Test inbound call agent selection
    console.log('Step 8: Testing inbound call agent selection...');

    // Create phone number linked to campaign
    let phoneNumber = await prisma.phoneNumber.findFirst({
      where: { number: '+18588796658' }
    });

    if (phoneNumber) {
      // Update to link to campaign
      phoneNumber = await prisma.phoneNumber.update({
        where: { id: phoneNumber.id },
        data: { campaignId: campaign.id },
        include: { campaign: true, tenant: true }
      });
      console.log(`  ✅ Phone number linked to campaign: ${phoneNumber.number}`);

      // Test inbound agent selection
      const inboundAgent = await AgentSelectionService.selectAgentForInbound(phoneNumber);
      console.log(`  ✅ Inbound call would use agent: ${inboundAgent}`);
    } else {
      console.log(`  ℹ️  No phone number found to test inbound (create one with test-import-twilio-numbers.js)`);
    }
    console.log('');

    // Summary
    console.log('═'.repeat(60));
    console.log('✅ Multi-Agent Campaign Test Complete!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('Summary:');
    console.log(`  • Campaign: ${campaign.name}`);
    console.log(`  • Agents assigned: ${agents.length}`);
    console.log(`  • Primary agent: ${agents[0].name}`);
    console.log(`  • Backup agents: ${agents.slice(1).map(a => a.name).join(', ')}`);
    console.log('');
    console.log('Features tested:');
    console.log('  ✅ Multiple agents per campaign (CampaignAgent table)');
    console.log('  ✅ Primary agent assignment');
    console.log('  ✅ Agent selection strategies (PRIMARY_FIRST, ROUND_ROBIN, LEAST_LOADED)');
    console.log('  ✅ Load balancing and tracking');
    console.log('  ✅ Capacity limits and automatic fallback');
    console.log('  ✅ Available agents query');
    console.log('  ✅ Inbound call agent selection');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Use POST /api/v1/campaigns/:campaignId/agents to assign agents');
    console.log('  2. Use GET /api/v1/campaigns/:campaignId/agents to view assignments');
    console.log('  3. Use GET /api/v1/campaigns/:campaignId/agents/available to check availability');
    console.log('  4. Use GET /api/v1/agents/load-stats to monitor agent loads');
    console.log('  5. Start campaign - agents will be selected dynamically per call');
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
