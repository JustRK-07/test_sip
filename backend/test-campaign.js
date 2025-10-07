#!/usr/bin/env node
/**
 * Campaign Prototype Test Script
 * Tests the campaign calling logic with real calls
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const CampaignQueue = require('./src/services/CampaignQueue');
const logger = require('./src/utils/logger');

// ASCII Art Banner
console.log('\n' + '═'.repeat(70));
console.log(`
  ╔═╗┌─┐┌┬┐┌─┐┌─┐┬┌─┐┌┐┌  ╔═╗┌─┐┬  ┬  ┬┌┐┌┌─┐  ╔═╗┬─┐┌─┐┌┬┐┌─┐┌┬┐┬ ┬┌─┐┌─┐
  ║  ├─┤│││├─┘├─┤││ ┬│││  ║  ├─┤│  │  │││││ ┬  ╠═╝├┬┘│ │ │ │ │ │ └┬┘├─┘├┤
  ╚═╝┴ ┴┴ ┴┴  ┴ ┴┴└─┘┘└┘  ╚═╝┴ ┴┴─┘┴─┘┴┘└┘└─┘  ╩  ┴└─└─┘ ┴ └─┘ ┴  ┴ ┴  └─┘
`);
console.log('═'.repeat(70));
console.log('\n💡 Testing Campaign Queue with Node.js + Python Integration\n');

async function main() {
  try {
    // ========================================
    // 1. LOAD LEADS FROM JSON FILE
    // ========================================
    const leadsFilePath = path.join(__dirname, 'test-leads.json');

    logger.info('📂 Loading leads from file...', { file: leadsFilePath });

    if (!fs.existsSync(leadsFilePath)) {
      logger.error('❌ Leads file not found!', { file: leadsFilePath });
      logger.info('💡 Create a test-leads.json file with sample phone numbers');
      process.exit(1);
    }

    const leadsData = JSON.parse(fs.readFileSync(leadsFilePath, 'utf8'));

    if (!Array.isArray(leadsData) || leadsData.length === 0) {
      logger.error('❌ No leads found in file!');
      process.exit(1);
    }

    logger.info(`✅ Loaded ${leadsData.length} leads from file`);

    // ========================================
    // 2. CREATE CAMPAIGN QUEUE
    // ========================================
    const campaign = new CampaignQueue({
      campaignName: 'Real Test Campaign - 3 Concurrent Calls',
      maxConcurrent: 3, // Max 3 concurrent calls (all at once!)
      retryFailed: false, // Don't retry in prototype
      retryAttempts: 1,
      callDelay: 2000, // 2 seconds between initiating calls
    });

    // ========================================
    // 3. SETUP EVENT LISTENERS
    // ========================================
    campaign.on('campaign_started', (data) => {
      console.log('\n' + '━'.repeat(70));
      console.log(`🚀 Campaign Started: ${data.campaignName}`);
      console.log(`📊 Total Leads: ${data.totalLeads}`);
      console.log('━'.repeat(70) + '\n');
    });

    campaign.on('call_started', ({ lead }) => {
      console.log(
        `\n📞 [CALLING] ${lead.name} - ${lead.phoneNumber} (Attempt ${lead.attempts})`
      );
    });

    campaign.on('call_completed', ({ lead, result }) => {
      console.log(`✅ [SUCCESS] ${lead.name} - ${lead.phoneNumber}`);
      console.log(`   ├─ Room: ${result.roomName}`);
      console.log(`   ├─ Dispatch: ${result.dispatchId}`);
      console.log(`   └─ Duration: ${result.duration}ms`);
    });

    campaign.on('call_failed', ({ lead, error }) => {
      console.log(`❌ [FAILED] ${lead.name} - ${lead.phoneNumber}`);
      console.log(`   └─ Error: ${error.error || error.message}`);
    });

    campaign.on('campaign_completed', ({ campaignName, stats, duration }) => {
      console.log('\n' + '═'.repeat(70));
      console.log(`🎉 Campaign Completed: ${campaignName}`);
      console.log('═'.repeat(70));
      console.log(`📊 FINAL RESULTS:`);
      console.log(`   ├─ Total Leads:     ${stats.total}`);
      console.log(`   ├─ ✅ Completed:    ${stats.completed} (${Math.round((stats.completed / stats.total) * 100)}%)`);
      console.log(`   ├─ ❌ Failed:       ${stats.failed} (${Math.round((stats.failed / stats.total) * 100)}%)`);
      console.log(`   └─ ⏱️  Duration:     ${duration.formatted}`);
      console.log('═'.repeat(70) + '\n');
    });

    // ========================================
    // 4. ADD LEADS TO CAMPAIGN
    // ========================================
    campaign.addLeads(leadsData);

    // ========================================
    // 5. SHOW PREVIEW
    // ========================================
    console.log('\n' + '─'.repeat(70));
    console.log('📋 CAMPAIGN PREVIEW:');
    console.log('─'.repeat(70));
    console.log(`Campaign Name:    ${campaign.campaignName}`);
    console.log(`Max Concurrent:   ${campaign.maxConcurrent} calls`);
    console.log(`Total Leads:      ${campaign.stats.total}`);
    console.log(`Call Delay:       ${campaign.callDelay}ms`);
    console.log('─'.repeat(70));
    console.log('\n📞 Leads to call:');
    leadsData.forEach((lead, index) => {
      console.log(`   ${index + 1}. ${lead.name} - ${lead.phoneNumber}`);
    });
    console.log('─'.repeat(70) + '\n');

    // ========================================
    // 6. ASK FOR CONFIRMATION
    // ========================================
    console.log('⚠️  WARNING: This will make REAL phone calls!');
    console.log('💡 Make sure voice_agent.py is running in another terminal\n');

    // Auto-start in 5 seconds (or comment this out and uncomment readline below)
    console.log('⏳ Starting campaign in 5 seconds... (Press Ctrl+C to cancel)\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // OR: Uncomment this for manual confirmation
    /*
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      readline.question('👉 Start campaign? (yes/no): ', resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('\n❌ Campaign cancelled\n');
      process.exit(0);
    }
    */

    // ========================================
    // 7. START CAMPAIGN
    // ========================================
    await campaign.start();

    // ========================================
    // 8. SHOW DETAILED RESULTS
    // ========================================
    console.log('\n' + '═'.repeat(70));
    console.log('📊 DETAILED RESULTS:');
    console.log('═'.repeat(70) + '\n');

    if (campaign.completedLeads.length > 0) {
      console.log('✅ SUCCESSFUL CALLS:');
      campaign.completedLeads.forEach((lead, index) => {
        console.log(`   ${index + 1}. ${lead.name} (${lead.phoneNumber})`);
        console.log(`      Room: ${lead.result.roomName}`);
        console.log(`      Duration: ${lead.result.duration}ms`);
        console.log('');
      });
    }

    if (campaign.failedLeads.length > 0) {
      console.log('❌ FAILED CALLS:');
      campaign.failedLeads.forEach((lead, index) => {
        console.log(`   ${index + 1}. ${lead.name} (${lead.phoneNumber})`);
        console.log(`      Error: ${lead.error.error || lead.error.message}`);
        console.log('');
      });
    }

    console.log('═'.repeat(70));
    console.log('🎉 Test Complete!\n');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Campaign failed:', error);
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Campaign interrupted by user\n');
  process.exit(0);
});

// Run main function
main();
