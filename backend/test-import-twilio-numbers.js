/**
 * Import Existing Twilio Phone Numbers
 * Fetches all phone numbers from Twilio and imports them to database
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const twilioService = require('./src/services/TwilioService');

const prisma = new PrismaClient();

console.log('\n' + '='.repeat(70));
console.log('📞 IMPORT EXISTING TWILIO PHONE NUMBERS');
console.log('='.repeat(70) + '\n');

(async () => {
  try {
    // Step 1: Get tenant
    console.log('📊 Step 1: Finding Tenant');
    console.log('─'.repeat(70));

    const tenant = await prisma.tenant.findFirst({
      where: { isActive: true }
    });

    if (!tenant) {
      console.log('❌ No active tenant found');
      process.exit(1);
    }

    console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})\n`);

    // Step 2: Get platform trunk
    console.log('📊 Step 2: Finding Platform Trunk');
    console.log('─'.repeat(70));

    const platformTrunk = await prisma.platformTrunk.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true
      }
    });

    if (!platformTrunk) {
      console.log('❌ No active platform trunk found');
      process.exit(1);
    }

    console.log(`✅ Found trunk: ${platformTrunk.name}`);
    console.log(`   Twilio SID: ${platformTrunk.twilioTrunkSid}\n`);

    // Step 3: Fetch phone numbers from Twilio
    console.log('📊 Step 3: Fetching Phone Numbers from Twilio');
    console.log('─'.repeat(70));

    const client = twilioService.getClient();
    const twilioNumbers = await client.incomingPhoneNumbers.list({ limit: 50 });

    console.log(`Found ${twilioNumbers.length} phone numbers on Twilio\n`);

    if (twilioNumbers.length === 0) {
      console.log('⚠️  No phone numbers found on Twilio account');
      process.exit(0);
    }

    // Display Twilio numbers
    twilioNumbers.forEach((number, idx) => {
      console.log(`${idx + 1}. ${number.phoneNumber}`);
      console.log(`   SID: ${number.sid}`);
      console.log(`   Friendly Name: ${number.friendlyName || 'None'}`);
      console.log(`   Trunk SID: ${number.trunkSid || 'Not assigned'}`);
      console.log('');
    });

    // Step 4: Import to database
    console.log('📊 Step 4: Importing to Database');
    console.log('─'.repeat(70));

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const twilioNumber of twilioNumbers) {
      try {
        // Check if already exists
        const existing = await prisma.phoneNumber.findUnique({
          where: { number: twilioNumber.phoneNumber }
        });

        if (existing) {
          console.log(`⏭️  Skipped: ${twilioNumber.phoneNumber} (already exists)`);
          skipped++;
          continue;
        }

        // Determine phone type from capabilities
        let phoneType = 'LOCAL';
        if (twilioNumber.phoneNumber.startsWith('+1800') ||
            twilioNumber.phoneNumber.startsWith('+1888') ||
            twilioNumber.phoneNumber.startsWith('+1877') ||
            twilioNumber.phoneNumber.startsWith('+1866') ||
            twilioNumber.phoneNumber.startsWith('+1855') ||
            twilioNumber.phoneNumber.startsWith('+1844') ||
            twilioNumber.phoneNumber.startsWith('+1833')) {
          phoneType = 'TOLL_FREE';
        }

        // Create phone number record
        const phoneNumber = await prisma.phoneNumber.create({
          data: {
            number: twilioNumber.phoneNumber,
            friendlyName: twilioNumber.friendlyName || twilioNumber.phoneNumber,
            type: phoneType,
            provider: 'TWILIO',
            providerSid: twilioNumber.sid,
            tenantId: tenant.id,
            // Only set livekitTrunkId if number is already assigned to our trunk
            livekitTrunkId: null,
            campaignId: null,
            isActive: true,
            purchasedAt: twilioNumber.dateCreated,
            metadata: JSON.stringify({
              capabilities: {
                voice: twilioNumber.capabilities?.voice,
                sms: twilioNumber.capabilities?.sms,
                mms: twilioNumber.capabilities?.mms
              },
              importedFrom: 'twilio',
              originalTrunkSid: twilioNumber.trunkSid
            })
          }
        });

        console.log(`✅ Imported: ${phoneNumber.number}`);
        imported++;

      } catch (error) {
        console.log(`❌ Error importing ${twilioNumber.phoneNumber}: ${error.message}`);
        errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total found on Twilio: ${twilioNumbers.length}`);
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️  Skipped (already exist): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);

    if (imported > 0) {
      console.log('\n✨ Success! Phone numbers imported to database');
      console.log('\n📝 Next steps:');
      console.log('   1. Link phone numbers to campaigns (optional)');
      console.log('   2. Use phone numbers as caller ID for outbound calls');
      console.log('   3. Receive inbound calls on these numbers');
    }

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
