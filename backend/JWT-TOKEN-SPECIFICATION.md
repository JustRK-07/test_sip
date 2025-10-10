# JWT Token Specification for Campaign Calling System

This document explains the JWT token structure required for authentication in this project.

---

## Overview

The system uses **RS256 (RSA Signature with SHA-256)** for JWT token verification. Tokens must be signed with the private key corresponding to the public certificate configured in the environment.

---

## Token Structure

### Header
```json
{
  "alg": "RS256",
  "typ": "JWT"
}
```

### Payload (Claims)

Here's what a valid JWT payload should contain for this project:

```json
{
  "sub": "00000000-0000-0000-0000-00000000b40d",
  "acct": "00000000-0000-0000-0000-00000000b40d",
  "email": "admin@example.com",
  "name": "Admin User",
  "roles": ["admin"],
  "permissions": ["*"],
  "iat": 1728561234,
  "exp": 1728647634,
  "iss": "campaign-calling-system",
  "aud": "campaign-calling-api"
}
```

### Signature
```
RSASHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  privateKey
)
```

---

## Required Claims

### 1. `sub` (Subject) - **REQUIRED**
- **Type:** String
- **Description:** Unique user identifier
- **Example:** `"00000000-0000-0000-0000-00000000b40d"`
- **Used For:** User identification

### 2. `acct` (Account ID) - **REQUIRED** ⚠️ CRITICAL
- **Type:** String
- **Description:** Account/Tenant ID that the user belongs to
- **Example:** `"00000000-0000-0000-0000-00000000b40d"` (system admin)
- **Used For:**
  - Tenant access validation
  - Must match `:tenantId` in URL for tenant-scoped operations
  - Required by `requireTenantAccess` middleware

**Important:** For system-level operations (like creating tenants), use:
```json
"acct": "00000000-0000-0000-0000-00000000b40d"
```

For tenant-specific operations, `acct` must match the tenant ID:
```json
"acct": "clx1234567890abcdef"  // Specific tenant ID
```

### 3. `iat` (Issued At) - **REQUIRED**
- **Type:** Numeric (Unix timestamp)
- **Description:** Token creation time
- **Example:** `1728561234`

### 4. `exp` (Expiration Time) - **REQUIRED**
- **Type:** Numeric (Unix timestamp)
- **Description:** Token expiration time
- **Example:** `1728647634` (24 hours from `iat`)
- **Recommendation:** Use 1-24 hours for security

---

## Optional But Recommended Claims

### 5. `email` (Email)
- **Type:** String
- **Description:** User's email address
- **Example:** `"admin@example.com"`
- **Used For:** User identification, audit logs

### 6. `name` (Name)
- **Type:** String
- **Description:** User's full name
- **Example:** `"Admin User"`
- **Used For:** Display purposes, logs

### 7. `roles` (Roles)
- **Type:** Array of strings
- **Description:** User roles for RBAC
- **Example:** `["admin", "tenant-manager"]`
- **Used For:** `requireRole` middleware
- **Available Roles:**
  - `"admin"` - System administrator
  - `"tenant-manager"` - Can manage tenants
  - `"campaign-manager"` - Can manage campaigns
  - `"user"` - Basic user

### 8. `permissions` (Permissions)
- **Type:** Array of strings
- **Description:** Granular permissions
- **Example:** `["*"]` or `["campaigns:read", "campaigns:write"]`
- **Used For:** Fine-grained access control

### 9. `iss` (Issuer)
- **Type:** String
- **Description:** Who issued the token
- **Example:** `"campaign-calling-system"`
- **Used For:** Token validation

### 10. `aud` (Audience)
- **Type:** String
- **Description:** Intended recipient
- **Example:** `"campaign-calling-api"`
- **Used For:** Token validation

---

## Complete Example Tokens

### Example 1: System Admin Token
**Use Case:** Creating tenants, managing platform-wide resources

```json
{
  "sub": "00000000-0000-0000-0000-00000000b40d",
  "acct": "00000000-0000-0000-0000-00000000b40d",
  "email": "admin@system.com",
  "name": "System Administrator",
  "roles": ["admin"],
  "permissions": ["*"],
  "iat": 1728561234,
  "exp": 1728647634,
  "iss": "campaign-calling-system",
  "aud": "campaign-calling-api"
}
```

**Can Access:**
- ✅ `POST /api/v1/tenants` (create tenants)
- ✅ `GET /api/v1/tenants` (list all tenants)
- ✅ `GET /api/v1/agents` (list all agents)
- ✅ `GET /api/v1/platform-trunks` (platform trunks)

### Example 2: Tenant User Token
**Use Case:** Managing campaigns, leads, phone numbers for a specific tenant

```json
{
  "sub": "user-12345-67890-abcdef",
  "acct": "clx1234567890abcdef",
  "email": "manager@testcorp.com",
  "name": "Campaign Manager",
  "roles": ["campaign-manager"],
  "permissions": [
    "campaigns:read",
    "campaigns:write",
    "leads:read",
    "leads:write",
    "phone-numbers:read"
  ],
  "tenant_id": "clx1234567890abcdef",
  "tenantId": "clx1234567890abcdef",
  "iat": 1728561234,
  "exp": 1728647634,
  "iss": "campaign-calling-system",
  "aud": "campaign-calling-api"
}
```

**Can Access:**
- ✅ `POST /api/v1/tenants/clx1234567890abcdef/campaigns` (create campaigns)
- ✅ `GET /api/v1/tenants/clx1234567890abcdef/campaigns` (list campaigns)
- ✅ `POST /api/v1/tenants/clx1234567890abcdef/campaigns/:id/leads` (add leads)
- ✅ `GET /api/v1/tenants/clx1234567890abcdef/phone-numbers` (list phone numbers)
- ❌ `POST /api/v1/tenants` (cannot create tenants - wrong acct)
- ❌ `GET /api/v1/tenants/different-tenant-id/campaigns` (acct mismatch)

### Example 3: Read-Only User Token
**Use Case:** Viewing campaigns and statistics only

```json
{
  "sub": "user-readonly-98765",
  "acct": "clx1234567890abcdef",
  "email": "viewer@testcorp.com",
  "name": "Campaign Viewer",
  "roles": ["user"],
  "permissions": [
    "campaigns:read",
    "leads:read",
    "stats:read"
  ],
  "iat": 1728561234,
  "exp": 1728647634
}
```

---

## How Token Validation Works

### Step 1: Extract Token
```javascript
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                      This part is extracted and verified
```

### Step 2: Verify Signature
```javascript
// Backend extracts public key from certificate
const publicKey = extractPublicKeyFromCertificate(process.env.JWT_PUBLIC_KEY);

// Verify token was signed by corresponding private key
const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
```

### Step 3: Validate Claims
```javascript
// Check expiration
if (decoded.exp < Date.now() / 1000) {
  throw new Error('Token expired');
}

// Check required fields
if (!decoded.acct) {
  throw new Error('Missing account information');
}
```

### Step 4: Tenant Access Check (for tenant-scoped routes)
```javascript
// Extract tenantId from URL: /api/v1/tenants/:tenantId/...
const urlTenantId = req.params.tenantId;

// Extract acct from JWT
const tokenAcct = decoded.acct;

// Validate match
if (urlTenantId !== tokenAcct) {
  throw new Error('Access denied: Account ID does not match tenant ID');
}
```

---

## Creating JWT Tokens

### Method 1: Using jwt.io (Testing Only)
1. Go to https://jwt.io
2. Select algorithm: **RS256**
3. Enter payload (see examples above)
4. Enter your **private key** in the "Verify Signature" section
5. Copy the generated token

### Method 2: Using Node.js

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Read private key
const privateKey = fs.readFileSync('path/to/private-key.pem', 'utf8');

// Create payload
const payload = {
  sub: '00000000-0000-0000-0000-00000000b40d',
  acct: '00000000-0000-0000-0000-00000000b40d',
  email: 'admin@system.com',
  name: 'System Administrator',
  roles: ['admin'],
  permissions: ['*'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
};

// Sign token
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

console.log('JWT Token:', token);
```

### Method 3: Using OpenSSL + jwt.io

```bash
# Generate key pair (if you don't have one)
openssl genrsa -out private-key.pem 2048
openssl rsa -in private-key.pem -pubout -out public-key.pem

# Use private key to sign JWT at jwt.io
```

---

## Testing Your Token

### Quick Test with curl

```bash
# Set your token
export JWT_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

# Test authentication
curl -X GET http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer $JWT_TOKEN"

# Should return 200 if token is valid, 401 if invalid
```

### Decode Token (Without Verification)

```bash
# Install jwt-cli
npm install -g jwt-cli

# Decode token to see payload
jwt decode $JWT_TOKEN
```

**Online Decoder:** https://jwt.io (paste token to decode and inspect)

---

## Common Errors & Solutions

### Error: "Malformed token"
**Cause:** Token doesn't match RS256 format
**Solution:** Ensure token is signed with RS256 algorithm using correct private key

### Error: "Access denied: Account ID does not match tenant ID"
**Cause:** JWT `acct` field doesn't match `:tenantId` in URL
**Solution:**
- For system admin: Use `acct: "00000000-0000-0000-0000-00000000b40d"`
- For tenant user: Ensure `acct` matches the tenant ID in the URL

### Error: "Account information missing from token"
**Cause:** JWT doesn't have `acct` field
**Solution:** Add `acct` field to JWT payload

### Error: "Token expired"
**Cause:** Current time is past `exp` timestamp
**Solution:** Generate new token with fresh `exp` timestamp

### Error: "Invalid token"
**Cause:** Token signature doesn't match public key
**Solution:** Ensure token is signed with private key corresponding to public certificate in `.env`

---

## Security Best Practices

1. ✅ **Never expose private key** - Keep private key secure, never commit to git
2. ✅ **Use short expiration times** - 1-24 hours recommended
3. ✅ **Rotate keys regularly** - Update key pairs periodically
4. ✅ **Use HTTPS in production** - Never send tokens over HTTP
5. ✅ **Validate all claims** - Check `iat`, `exp`, `iss`, `aud`
6. ✅ **Store tokens securely** - Use httpOnly cookies or secure storage
7. ✅ **Implement token refresh** - Allow users to refresh expired tokens

---

## Public Certificate Information

**Current Certificate:** Ytel Inc. RSA Certificate
**Location:** `.env` file (`JWT_PUBLIC_KEY`)
**Algorithm:** RS256
**Issuer:** Ytel Inc.
**Subject:** Ryan Tran
**Valid:** 2018-09-25 to 2018-12-24

**Note:** You need the corresponding **private key** to sign tokens that can be verified by this public certificate.

---

## Quick Reference

| Field | Required | Type | Example | Purpose |
|-------|----------|------|---------|---------|
| `sub` | ✅ Yes | String | `"user-123"` | User ID |
| `acct` | ✅ Yes | String | `"tenant-456"` | Account/Tenant ID |
| `iat` | ✅ Yes | Number | `1728561234` | Issued at |
| `exp` | ✅ Yes | Number | `1728647634` | Expiration |
| `email` | ⚠️ Recommended | String | `"user@example.com"` | User email |
| `name` | ⚠️ Recommended | String | `"John Doe"` | User name |
| `roles` | ⚠️ Recommended | Array | `["admin"]` | User roles |
| `permissions` | Optional | Array | `["*"]` | Permissions |
| `iss` | Optional | String | `"api"` | Issuer |
| `aud` | Optional | String | `"api"` | Audience |

---

## Need Help?

If you need to generate test tokens for this project:

1. Obtain the private key corresponding to the public certificate
2. Use the Node.js script in `generate-test-jwt.js`
3. Or contact your system administrator for a valid token

**For testing purposes**, you can request a test token from the authentication service or use the examples provided in this document with the correct private key.
