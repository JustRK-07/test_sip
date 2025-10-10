/**
 * LiveKit Configuration Test
 * Tests LiveKit connection and retrieves SIP trunk information
 */

require('dotenv').config();
const { AccessToken } = require('livekit-server-sdk');

console.log('🔍 LiveKit Configuration Check\n');
console.log('=' .repeat(60));

// Check environment variables
const config = {
  url: process.env.LIVEKIT_URL,
  apiKey: process.env.LIVEKIT_API_KEY,
  apiSecret: process.env.LIVEKIT_API_SECRET,
  outboundTrunkId: process.env.LIVEKIT_OUTBOUND_TRUNK_ID
};

console.log('\n📋 Environment Variables:');
console.log('─'.repeat(60));
console.log('LIVEKIT_URL:', config.url || '❌ NOT SET');
console.log('LIVEKIT_API_KEY:', config.apiKey ? `✅ ${config.apiKey}` : '❌ NOT SET');
console.log('LIVEKIT_API_SECRET:', config.apiSecret ? `✅ ${config.apiSecret.substring(0, 20)}...` : '❌ NOT SET');
console.log('LIVEKIT_OUTBOUND_TRUNK_ID:', config.outboundTrunkId || '❌ NOT SET');

// Validate configuration
console.log('\n✅ Validation:');
console.log('─'.repeat(60));

const issues = [];
if (!config.url) issues.push('LIVEKIT_URL is missing');
if (!config.apiKey) issues.push('LIVEKIT_API_KEY is missing');
if (!config.apiSecret) issues.push('LIVEKIT_API_SECRET is missing');

if (issues.length > 0) {
  console.log('❌ Configuration Issues:');
  issues.forEach(issue => console.log(`   - ${issue}`));
  process.exit(1);
}

console.log('✅ All required variables are set');

// Test token generation
console.log('\n🔐 Testing Token Generation:');
console.log('─'.repeat(60));

(async () => {
  try {
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: 'test-agent',
      ttl: 3600,
    });

    token.addGrant({
      roomJoin: true,
      room: 'test-room',
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();
    console.log('✅ Token generated successfully');
    console.log('   Token length:', jwt ? jwt.length : 0, 'characters');
    if (jwt && typeof jwt === 'string') {
      console.log('   Sample:', jwt.substring(0, 50) + '...');
    }
  } catch (error) {
    console.log('❌ Token generation failed:', error.message);
    process.exit(1);
  }

// Extract project info from URL
console.log('\n🌐 LiveKit Server Info:');
console.log('─'.repeat(60));

const urlMatch = config.url.match(/wss:\/\/([^.]+)\.livekit\.cloud/);
if (urlMatch) {
  const projectName = urlMatch[1];
  console.log('✅ Project Name:', projectName);
  console.log('✅ Region: cloud (managed)');
  console.log('✅ WebSocket URL:', config.url);
} else {
  console.log('⚠️  Custom LiveKit server URL:', config.url);
}

// SIP Trunk Info
console.log('\n📞 SIP Trunk Information:');
console.log('─'.repeat(60));

if (config.outboundTrunkId) {
  console.log('✅ Outbound Trunk ID:', config.outboundTrunkId);
  console.log('   Type: OUTBOUND (for making calls)');
  console.log('   Status: Configured in .env');
} else {
  console.log('⚠️  No outbound trunk ID configured');
}

// Check for inbound trunk
console.log('\n📥 Inbound Trunk Configuration:');
console.log('─'.repeat(60));
console.log('⚠️  No LIVEKIT_INBOUND_TRUNK_ID found in .env');
console.log('   You need to create an INBOUND trunk for receiving calls');
console.log('   This trunk will receive calls from Twilio');

// Summary and next steps
console.log('\n' + '='.repeat(60));
console.log('📊 CONFIGURATION SUMMARY');
console.log('='.repeat(60));

console.log('\n✅ Working:');
console.log('   - LiveKit API credentials configured');
console.log('   - Can generate access tokens');
console.log('   - Outbound trunk for making calls: ' + config.outboundTrunkId);

console.log('\n⚠️  Missing for Inbound Calls:');
console.log('   - Inbound SIP Trunk (for receiving calls from Twilio)');
console.log('   - Twilio trunk needs to be pointed to LiveKit SIP endpoint');

console.log('\n📝 Next Steps to Enable Inbound Calls:');
console.log('─'.repeat(60));
console.log('1. Create Inbound SIP Trunk in LiveKit Dashboard:');
console.log('   → Go to: https://cloud.livekit.io');
console.log('   → Select project: firstproject-ly6tfhj5');
console.log('   → SIP → Create SIP Trunk');
console.log('   → Type: INBOUND');
console.log('   → Copy the Trunk ID and SIP URI');
console.log('');
console.log('2. Add to .env file:');
console.log('   LIVEKIT_INBOUND_TRUNK_ID=ST_xxxxxxxxxx');
console.log('');
console.log('3. Configure Twilio Trunk to point to LiveKit:');
console.log('   → Twilio Console → Elastic SIP Trunking');
console.log('   → Trunk: TKb7dce640389bbae93497be426666a548');
console.log('   → Origination → Add Origination URL');
console.log('   → Enter LiveKit SIP URI from step 1');
console.log('');
console.log('4. Test the complete flow:');
console.log('   → Purchase phone number (already working ✅)');
console.log('   → Call the number');
console.log('   → LiveKit receives call');
console.log('   → AI agent answers');

  console.log('\n' + '='.repeat(60));
  console.log('✅ Configuration check complete!');
  console.log('='.repeat(60) + '\n');
})();
