/**
 * Test Setup Script
 * Creates a test tenant and platform trunk for phone number purchase testing
 */

const { PrismaClient } = require('@prisma/client');
const TwilioService = require('./src/services/TwilioService');

const prisma = new PrismaClient();

async function setup() {
  try {
    console.log('🚀 Starting test setup...\n');

    // Step 1: Create or get test tenant
    console.log('Step 1: Creating test tenant...');
    let tenant = await prisma.tenant.findFirst({
      where: { name: 'Test Tenant' }
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'Test Tenant',
          domain: 'test.example.com',
          isActive: true,
          metadata: JSON.stringify({ test: true })
        }
      });
      console.log('✅ Tenant created:', tenant.id);
    } else {
      console.log('✅ Tenant already exists:', tenant.id);
    }

    // Step 2: Create platform trunk (WITHOUT actually creating in Twilio)
    console.log('\nStep 2: Creating platform trunk...');
    let platformTrunk = await prisma.platformTrunk.findFirst({
      where: { name: 'Test Platform Trunk' }
    });

    if (!platformTrunk) {
      // Use your existing Twilio trunk SID from .env.local
      platformTrunk = await prisma.platformTrunk.create({
        data: {
          name: 'Test Platform Trunk',
          description: 'Platform trunk for testing phone number purchase',
          twilioTrunkSid: 'TKb7dce640389bbae93497be426666a548', // From your .env.local
          twilioRegion: 'us1',
          tenantId: tenant.id,
          maxChannels: 100,
          isActive: true,
          metadata: JSON.stringify({ test: true })
        }
      });
      console.log('✅ Platform trunk created:', platformTrunk.id);
    } else {
      console.log('✅ Platform trunk already exists:', platformTrunk.id);
    }

    console.log('\n📋 Test Setup Complete!');
    console.log('═══════════════════════════════════════');
    console.log('Tenant ID:', tenant.id);
    console.log('Tenant Name:', tenant.name);
    console.log('Platform Trunk ID:', platformTrunk.id);
    console.log('Twilio Trunk SID:', platformTrunk.twilioTrunkSid);
    console.log('═══════════════════════════════════════\n');

    console.log('✅ Ready to test phone number purchase!');
    console.log('\nTest command:');
    console.log(`curl -X POST http://localhost:3000/api/v1/tenants/${tenant.id}/phone-numbers \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"number": "+1XXXXXXXXXX", "type": "LOCAL", "label": "Test Number"}\'');

  } catch (error) {
    console.error('❌ Error during setup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setup();
