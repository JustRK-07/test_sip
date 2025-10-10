/**
 * Test Phone Number Purchase Script
 * Tests the complete flow of searching and purchasing a phone number
 */

const { PrismaClient } = require('@prisma/client');
const TwilioService = require('./src/services/TwilioService');
const { formatPhoneNumber } = require('./src/utils/phoneValidation');

const prisma = new PrismaClient();

// IDs from setup script
const TENANT_ID = 'cmgjdc3p20000sb7zdadxqk93';
const PLATFORM_TRUNK_ID = 'cmgjdc3pe0002sb7zq83oejd6';
const TWILIO_TRUNK_SID = 'TKb7dce640389bbae93497be426666a548';

async function testPhonePurchase() {
  try {
    console.log('🔍 Step 1: Searching for available phone numbers...\n');

    // Search for available numbers
    const availableNumbers = await TwilioService.searchAvailableNumbers({
      country: 'US',
      type: 'LOCAL',
      areaCode: '415',
      limit: 5
    });

    if (availableNumbers.length === 0) {
      console.log('❌ No available numbers found in area code 415');
      console.log('Try different area code or type');
      return;
    }

    console.log(`✅ Found ${availableNumbers.length} available numbers:\n`);
    availableNumbers.forEach((num, index) => {
      console.log(`${index + 1}. ${num.phoneNumber} - ${num.friendlyName}`);
    });

    // Select first available number
    const selectedNumber = availableNumbers[0];
    console.log(`\n📱 Selected: ${selectedNumber.phoneNumber}\n`);

    console.log('💰 Step 2: Purchasing phone number from Twilio...');
    console.log('⚠️  WARNING: This will actually purchase the number and charge your Twilio account!\n');

    // Uncomment the lines below to actually purchase
    console.log('🛑 Purchase is currently disabled for safety.');
    console.log('To enable purchase, uncomment the purchase code in test-phone-purchase.js\n');

    /*
    // UNCOMMENT TO ACTUALLY PURCHASE:

    const purchasedNumber = await TwilioService.purchasePhoneNumber({
      phoneNumber: selectedNumber.phoneNumber,
      friendlyName: `Test Number - ${selectedNumber.phoneNumber}`,
      trunkSid: TWILIO_TRUNK_SID
    });

    console.log('✅ Number purchased from Twilio!');
    console.log('   Phone Number:', purchasedNumber.phoneNumber);
    console.log('   Twilio SID:', purchasedNumber.sid);
    console.log('   Trunk SID:', TWILIO_TRUNK_SID);

    console.log('\n💾 Step 3: Saving to database...');

    const phoneNumber = await prisma.phoneNumber.create({
      data: {
        number: formatPhoneNumber(purchasedNumber.phoneNumber),
        friendlyName: purchasedNumber.friendlyName,
        type: 'LOCAL',
        provider: 'TWILIO',
        providerSid: purchasedNumber.sid,
        isActive: true,
        tenantId: TENANT_ID,
        platformTrunkId: PLATFORM_TRUNK_ID,
        purchasedAt: new Date(),
        metadata: JSON.stringify({
          twilioData: {
            sid: purchasedNumber.sid,
            trunkSid: TWILIO_TRUNK_SID,
            purchaseDate: new Date().toISOString()
          }
        })
      },
      include: {
        tenant: {
          select: { id: true, name: true }
        },
        platformTrunk: {
          select: { id: true, name: true, twilioTrunkSid: true }
        }
      }
    });

    console.log('✅ Saved to database!');
    console.log('\n📋 Phone Number Record:');
    console.log('═══════════════════════════════════════');
    console.log('ID:', phoneNumber.id);
    console.log('Number:', phoneNumber.number);
    console.log('Type:', phoneNumber.type);
    console.log('Provider SID:', phoneNumber.providerSid);
    console.log('Tenant:', phoneNumber.tenant.name);
    console.log('Platform Trunk:', phoneNumber.platformTrunk.name);
    console.log('Twilio Trunk SID:', phoneNumber.platformTrunk.twilioTrunkSid);
    console.log('═══════════════════════════════════════');

    console.log('\n✅ COMPLETE! Phone number is now ready to use for calls!');
    console.log('\n📞 Next steps:');
    console.log('1. When someone calls', phoneNumber.number);
    console.log('2. Twilio routes to trunk', TWILIO_TRUNK_SID);
    console.log('3. Trunk routes to LiveKit');
    console.log('4. Your AI agent answers!');
    */

    console.log('\n📝 To actually purchase, edit test-phone-purchase.js and uncomment the purchase code.');
    console.log('💡 Selected number would be:', selectedNumber.phoneNumber);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('Twilio Error Code:', error.code);
    }
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPhonePurchase();
