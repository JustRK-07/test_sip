/**
 * Generate test JWT tokens for different user types
 *
 * Usage:
 *   node generate-test-jwt.js admin              - Generate admin token
 *   node generate-test-jwt.js user <tenantId>    - Generate regular user token
 *   node generate-test-jwt.js                    - Generate admin token (default)
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// User type configurations
const USER_TYPES = {
    admin: {
        sub: '00000000-0000-0000-0000-00000000b40d',
        acct: '00000000-0000-0000-0000-00000000b40d', // System admin account
        email: 'admin@system.com',
        name: 'System Administrator',
        roles: ['admin'],
        permissions: ['*']
    },
    user: (tenantId) => ({
        sub: 'user-' + crypto.randomBytes(8).toString('hex'),
        acct: tenantId, // User's tenant ID
        email: `user@${tenantId}.com`,
        name: 'Regular User',
        roles: ['user'],
        permissions: ['campaigns:read', 'campaigns:write', 'leads:read', 'leads:write']
    })
};

function generateTestJWT(userType = 'admin', tenantId = null) {
    const privateKey = process.env.JWT_PRIVATE_KEY;

    if (!privateKey) {
        console.error('Error: JWT_PRIVATE_KEY not found in environment');
        console.error('Please add JWT_PRIVATE_KEY to your .env file');
        process.exit(1);
    }

    // Build payload based on user type
    let basePayload;
    if (userType === 'admin') {
        basePayload = USER_TYPES.admin;
        console.log('\n🔐 Generating ADMIN token...\n');
    } else if (userType === 'user') {
        if (!tenantId) {
            console.error('Error: tenantId is required for regular user tokens');
            console.error('Usage: node generate-test-jwt.js user <tenantId>');
            console.error('Example: node generate-test-jwt.js user cllzm4vwp7a8b9c');
            process.exit(1);
        }
        basePayload = USER_TYPES.user(tenantId);
        console.log(`\n👤 Generating REGULAR USER token for tenant: ${tenantId}\n`);
    } else {
        console.error(`Error: Unknown user type "${userType}"`);
        console.error('Valid types: admin, user');
        process.exit(1);
    }

    const payload = {
        ...basePayload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hour expiry
        iss: 'campaign-calling-system',
        aud: 'campaign-calling-api'
    };

    try {
        let token;
        let algorithm;

        // Check if it's an RSA private key
        if (privateKey.includes('BEGIN RSA PRIVATE KEY') || privateKey.includes('BEGIN PRIVATE KEY')) {
            token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
            algorithm = 'RS256';
        } else {
            // Use HMAC with secret
            token = jwt.sign(payload, privateKey, { algorithm: 'HS256' });
            algorithm = 'HS256';
        }

        console.log(`Algorithm: ${algorithm}`);
        console.log('\n--- JWT TOKEN ---');
        console.log(token);

        console.log('\n--- DECODED PAYLOAD ---');
        console.log(JSON.stringify(payload, null, 2));

        console.log('\n--- USAGE ---');
        console.log('Set as environment variable:');
        console.log(`export TEST_JWT="${token}"`);

        console.log('\nOr use in curl:');
        if (userType === 'admin') {
            console.log(`curl -X POST http://localhost:3001/api/v1/tenants \\`);
            console.log(`  -H "Authorization: Bearer ${token}" \\`);
            console.log(`  -H "Content-Type: application/json" \\`);
            console.log(`  -d '{"name":"Test Corp","domain":"testcorp.com"}'`);
        } else {
            console.log(`curl -X GET http://localhost:3001/api/v1/tenants/${tenantId}/campaigns \\`);
            console.log(`  -H "Authorization: Bearer ${token}"`);
        }

        console.log('\n--- CAPABILITIES ---');
        if (userType === 'admin') {
            console.log('✅ Can create tenants');
            console.log('✅ Can access ALL tenants');
            console.log('✅ Can manage all resources across all tenants');
        } else {
            console.log(`✅ Can access tenant: ${tenantId}`);
            console.log('✅ Can manage campaigns, leads, phone numbers for this tenant');
            console.log('❌ Cannot create new tenants');
            console.log('❌ Cannot access other tenants');
        }

        console.log('\n--- TOKEN EXPIRY ---');
        const expiryDate = new Date(payload.exp * 1000);
        console.log(`Expires: ${expiryDate.toLocaleString()}`);
        console.log(`Valid for: 24 hours`);

        console.log('\n');
        return token;
    } catch (error) {
        console.error('Error generating JWT:', error.message);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const userType = args[0] || 'admin';
const tenantId = args[1] || null;

// Show help
if (args.includes('--help') || args.includes('-h')) {
    console.log('\nJWT Token Generator');
    console.log('===================\n');
    console.log('Usage:');
    console.log('  node generate-test-jwt.js admin              - Generate admin token');
    console.log('  node generate-test-jwt.js user <tenantId>    - Generate regular user token');
    console.log('  node generate-test-jwt.js                    - Generate admin token (default)\n');
    console.log('Examples:');
    console.log('  node generate-test-jwt.js admin');
    console.log('  node generate-test-jwt.js user cllzm4vwp7a8b9c');
    console.log('  node generate-test-jwt.js user my-custom-tenant-123\n');
    process.exit(0);
}

generateTestJWT(userType, tenantId);
