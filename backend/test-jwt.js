/**
 * Test JWT Token
 * Decodes and tests the provided JWT token
 */

const jwt = require('jsonwebtoken');

const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NjNmZDE0My05ZmVjLTRiYWEtYTU0NS1hZjViNzkxYmJiM2UiLCJ1SGFzaCI6IjU5ZTY0MjNkNTMyY2I1ODVkODBiOTM5NDgxZGM4MWIyNzQ1OTA5MjQ5YThhZWZmNzIxNTU0MTJlZTgwNTc5MTgiLCJwQWNjdCI6IjdjODY5M2M2LTk3NmUtNDMyNC05MTIzLTJjMWQ4MTE2MDVmOSIsImFjY3QiOiI3Yzg2OTNjNi05NzZlLTQzMjQtOTEyMy0yYzFkODExNjA1ZjkiLCJwcml2cyI6Wzg2ODY3OTYzMyw1MzY4MTQwNDgsMjA5NzIxNV0sInVzZXJuYW1lIjoicWF0ZWFtQHl0ZWwuY29tIiwic2NvcGUiOiJST0xFX0FDQ0VTU19UT0tFTiIsImlzcyI6Imh0dHBzOi8veXRlbC5jb20iLCJpYXQiOjE3NjAwMDk2MzcsImV4cCI6MTc2MDAxNjgzN30.rV3RyuhzdteMsRJ68_C1fuDxXVqjEpsaBhAPkesm2HWHjtDNy2_BPh8ZYfGKdrcbAcSXQWlzgU4-Oi_dZmSa8xv5aOoJhukSRgX3meFNlC1Rn78VXklMZ7dB3e2QpDksrgZZb6jC1ustKfO6Zs4Eu8Dw8MzTJD2UgT_d-uhOZzjOZj0WrOI6dOA4kgvxZcGWaX6Rj5LdLWBGD0eEb783RzTAZc2oKtdFRX6x5ka5B5Otc4RdsjnThFMVIgKt6RM9e_kTyf9kvkkq2_v2HLRGscrBtb490pcGOetFlL4oVJZvP1XjmbZwBkdqxqhFqU0LIXs6QfRKt_k5cyV_JekHHw";

console.log('🔍 Decoding JWT Token...\n');

// Decode without verification to see contents
const decoded = jwt.decode(token, { complete: true });

if (!decoded) {
  console.log('❌ Invalid JWT token format');
  process.exit(1);
}

console.log('📋 Token Header:');
console.log(JSON.stringify(decoded.header, null, 2));

console.log('\n📋 Token Payload:');
console.log(JSON.stringify(decoded.payload, null, 2));

console.log('\n⏰ Token Timing:');
const now = Math.floor(Date.now() / 1000);
const iat = decoded.payload.iat;
const exp = decoded.payload.exp;

console.log('Issued At:', new Date(iat * 1000).toISOString());
console.log('Expires At:', new Date(exp * 1000).toISOString());
console.log('Current Time:', new Date(now * 1000).toISOString());
console.log('Is Expired?', now > exp ? '❌ YES' : '✅ NO');
console.log('Time Until Expiry:', Math.floor((exp - now) / 60), 'minutes');

console.log('\n📝 Token Claims:');
console.log('Subject (sub):', decoded.payload.sub);
console.log('Account (acct):', decoded.payload.acct);
console.log('Username:', decoded.payload.username);
console.log('Issuer:', decoded.payload.iss);
console.log('Scope:', decoded.payload.scope);

console.log('\n🔐 Authentication Requirements:');
console.log('Algorithm:', decoded.header.alg);
console.log('⚠️  This token uses RS256 (RSA) signature');
console.log('⚠️  Your API requires JWT_PUBLIC_KEY in .env to verify');

console.log('\n💡 To use this token:');
console.log('1. Set JWT_PUBLIC_KEY in .env with the public key from token issuer');
console.log('2. Or disable authentication temporarily for testing');
console.log('\n🧪 Testing API call with this token...');
