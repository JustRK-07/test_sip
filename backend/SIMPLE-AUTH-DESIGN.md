# Simple Authentication Design - 2 User Types

This document explains a simplified authentication approach with just **2 user types**: Regular User and Admin.

---

## Overview

The system uses JWT tokens with **2 user types**:
1. **Admin User** - Can access all tenants and create new tenants
2. **Regular User** - Can only access their specific tenant

---

## How Tenant Creation Works

### Tenant ID Generation

When you create a tenant via `POST /api/v1/tenants`, the tenant ID is handled as follows:

**Option 1: Auto-Generated ID (Recommended)**
```json
{
  "name": "Test Corp",
  "domain": "testcorp.com",
  "contactEmail": "admin@testcorp.com"
}
```
- The system **automatically generates** a unique tenant ID using `generateTenantId()` function
- Format: `cl{timestamp}{random}` (e.g., `cllzm4vwp7a8b9c`)
- Similar to CUID format for uniqueness

**Option 2: Custom Tenant ID (Optional)**
```json
{
  "tenantId": "my-custom-tenant-123",
  "name": "Test Corp",
  "domain": "testcorp.com",
  "contactEmail": "admin@testcorp.com"
}
```
- You can provide your own `tenantId` in the request body
- The system will use your custom ID if provided
- System checks if the ID already exists and returns error if duplicate

**Required Fields for Tenant Creation:**
- `name` (string, required) - Tenant name
- `domain` (string, required, unique) - Tenant domain
- `contactEmail` (string, optional) - Contact email
- `contactPhone` (string, optional) - Contact phone
- `address` (string, optional) - Physical address
- `maxUsers` (integer, optional) - Maximum users allowed
- `description` (string, optional) - Tenant description
- `isActive` (boolean, optional, default: true) - Whether tenant is active
- `tenantId` (string, optional) - Custom tenant ID (auto-generated if not provided)

**Who Can Create Tenants:**
- Only **Admin users** with `acct: "00000000-0000-0000-0000-00000000b40d"`
- Regular users cannot create tenants

---

## JWT Token Structure

### Option 1: Simple JWT (Currently Implemented)

#### Admin User Token
```json
{
  "sub": "00000000-0000-0000-0000-00000000b40d",
  "acct": "00000000-0000-0000-0000-00000000b40d",
  "email": "admin@system.com",
  "name": "System Administrator",
  "roles": ["admin"],
  "iat": 1728561234,
  "exp": 1728647634
}
```

**Admin Capabilities:**
- ✅ Can access **ALL tenants** (any `tenantId` in URL)
- ✅ Can create new tenants (`POST /api/v1/tenants`)
- ✅ Can list all tenants (`GET /api/v1/tenants`)
- ✅ Can manage all campaigns, leads, agents, phone numbers across all tenants

**How It Works:**
- `acct` field is the special system admin ID: `00000000-0000-0000-0000-00000000b40d`
- This ID is checked by `requireAccount` middleware in tenant routes
- Routes like `POST /api/v1/tenants` require this specific account ID

#### Regular User Token
```json
{
  "sub": "user-uuid-12345",
  "acct": "cllzm4vwp7a8b9c",
  "email": "user@testcorp.com",
  "name": "John Doe",
  "roles": ["user"],
  "iat": 1728561234,
  "exp": 1728647634
}
```

**Regular User Capabilities:**
- ✅ Can access **ONLY** their tenant (where `acct` matches `tenantId`)
- ✅ Can manage campaigns, leads, agents for their tenant
- ❌ **CANNOT** create new tenants
- ❌ **CANNOT** access other tenants' data

**How It Works:**
- `acct` field contains the user's tenant ID (e.g., `cllzm4vwp7a8b9c`)
- `requireTenantAccess` middleware validates that `acct` matches `:tenantId` in URL
- Example: User with `acct: "cllzm4vwp7a8b9c"` can access:
  - ✅ `GET /api/v1/tenants/cllzm4vwp7a8b9c/campaigns`
  - ❌ `GET /api/v1/tenants/different-tenant-id/campaigns` (403 Forbidden)

---

## Current Implementation

### Authentication Middleware Chain

```javascript
// Admin-only route (tenant management)
router.post('/tenants',
  authenticateToken,                                          // Verify JWT
  requireAccount('00000000-0000-0000-0000-00000000b40d'),   // Admin only
  createTenantHandler
);

// Tenant-scoped route (campaigns, leads, etc.)
router.get('/tenants/:tenantId/campaigns',
  authenticateToken,      // Verify JWT
  requireTenantAccess,    // Verify acct matches tenantId
  getCampaignsHandler
);
```

### How Tenant Access Validation Works

From `src/utils/routeUtils.js`:

```javascript
const requireTenantAccess = (req, res, next) => {
    let tenantId = req?.params?.tenantId ?? req?.body?.tenantId ?? req?.user?.acct;
    const userAccountId = req.user?.acct; // From JWT token

    if (userAccountId !== tenantId) {
        return res.status(403).json({
            error: {
                message: 'Access denied: Account ID does not match tenant ID',
                code: 'TENANT_ACCESS_DENIED',
                required: tenantId,
                current: userAccountId
            }
        });
    }
    next();
};
```

**Validation Logic:**
1. Extract `tenantId` from URL params (e.g., `/tenants/:tenantId/campaigns`)
2. Extract `userAccountId` from JWT token's `acct` field
3. Compare: `userAccountId === tenantId`
4. If match → Allow access
5. If mismatch → Return 403 Forbidden

---

## API Access Matrix

| Endpoint | Admin Token | Regular User Token | Notes |
|----------|-------------|-------------------|-------|
| `POST /api/v1/tenants` | ✅ Yes | ❌ No | Create new tenant |
| `GET /api/v1/tenants` | ✅ Yes | ❌ No | List all tenants |
| `GET /api/v1/tenants/:tenantId` | ✅ Yes | ❌ No | Get specific tenant |
| `GET /api/v1/tenants/:tenantId/campaigns` | ✅ Yes (any tenant) | ✅ Yes (own tenant only) | List campaigns |
| `POST /api/v1/tenants/:tenantId/campaigns` | ✅ Yes (any tenant) | ✅ Yes (own tenant only) | Create campaign |
| `GET /api/v1/tenants/:tenantId/leads` | ✅ Yes (any tenant) | ✅ Yes (own tenant only) | List leads |
| `POST /api/v1/tenants/:tenantId/phone-numbers` | ✅ Yes (any tenant) | ✅ Yes (own tenant only) | Purchase number |
| `GET /api/v1/agents` | ✅ Yes | ✅ Yes | List agents (global resource) |

---

## Example API Calls

### Admin User Examples

**1. Create a new tenant**
```bash
curl -X POST http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Corp",
    "domain": "testcorp.com",
    "contactEmail": "admin@testcorp.com"
  }'

# Response:
{
  "data": {
    "id": "cllzm4vwp7a8b9c",  // Auto-generated tenant ID
    "name": "Test Corp",
    "domain": "testcorp.com",
    "isActive": true,
    "createdAt": "2025-10-10T10:00:00.000Z"
  },
  "message": "Tenant created successfully"
}
```

**2. Create tenant with custom ID**
```bash
curl -X POST http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "my-custom-tenant-123",
    "name": "Test Corp",
    "domain": "testcorp.com"
  }'

# Response:
{
  "data": {
    "id": "my-custom-tenant-123",  // Your custom ID
    "name": "Test Corp",
    "domain": "testcorp.com",
    "isActive": true
  }
}
```

**3. Access any tenant's campaigns**
```bash
# Admin can access tenant "cllzm4vwp7a8b9c"
curl -X GET http://localhost:3001/api/v1/tenants/cllzm4vwp7a8b9c/campaigns \
  -H "Authorization: Bearer <admin-jwt-token>"

# Admin can also access tenant "xyz123456789"
curl -X GET http://localhost:3001/api/v1/tenants/xyz123456789/campaigns \
  -H "Authorization: Bearer <admin-jwt-token>"

# Both work! Admin has access to ALL tenants
```

### Regular User Examples

**User with `acct: "cllzm4vwp7a8b9c"`**

**1. Access own tenant's campaigns ✅**
```bash
curl -X GET http://localhost:3001/api/v1/tenants/cllzm4vwp7a8b9c/campaigns \
  -H "Authorization: Bearer <regular-user-jwt-token>"

# Works! acct matches tenantId
```

**2. Try to access different tenant ❌**
```bash
curl -X GET http://localhost:3001/api/v1/tenants/different-tenant-id/campaigns \
  -H "Authorization: Bearer <regular-user-jwt-token>"

# Response: 403 Forbidden
{
  "error": {
    "message": "Access denied: Account ID does not match tenant ID",
    "code": "TENANT_ACCESS_DENIED",
    "required": "different-tenant-id",
    "current": "cllzm4vwp7a8b9c"
  }
}
```

**3. Try to create tenant ❌**
```bash
curl -X POST http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer <regular-user-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Corp",
    "domain": "newcorp.com"
  }'

# Response: 403 Forbidden
# Only admin account (00000000-0000-0000-0000-00000000b40d) can create tenants
```

---

## How to Generate JWT Tokens

### Using the `generate-test-jwt.js` Script

**Generate Admin Token:**
```bash
# Set JWT_PRIVATE_KEY in .env file first
node generate-test-jwt.js

# Output:
Generated RS256 JWT token:
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

Decoded payload:
{
  "sub": "00000000-0000-0000-0000-00000000b40d",
  "acct": "00000000-0000-0000-0000-00000000b40d",
  "iat": 1728561234,
  "exp": 1728647634
}
```

**Generate Regular User Token (Manual):**

Edit `generate-test-jwt.js` to change the payload:

```javascript
// For regular user
const payload = {
    sub: 'user-uuid-12345',
    acct: 'cllzm4vwp7a8b9c',  // The tenant ID this user belongs to
    email: 'user@testcorp.com',
    name: 'John Doe',
    roles: ['user'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
};
```

Then run:
```bash
node generate-test-jwt.js
```

---

## Workflow: Creating Tenant and User

### Step 1: Admin Creates Tenant

```bash
# Admin token with acct: "00000000-0000-0000-0000-00000000b40d"
curl -X POST http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Corp",
    "domain": "testcorp.com",
    "contactEmail": "admin@testcorp.com"
  }'

# Response includes the tenant ID:
{
  "data": {
    "id": "cllzm4vwp7a8b9c",  // ← This is the tenant ID
    "name": "Test Corp",
    ...
  }
}
```

### Step 2: Generate Regular User Token for That Tenant

Create a JWT token with:
```json
{
  "sub": "user-uuid-12345",
  "acct": "cllzm4vwp7a8b9c",  // ← Use the tenant ID from step 1
  "email": "user@testcorp.com",
  "name": "John Doe",
  "roles": ["user"]
}
```

### Step 3: Regular User Can Now Access Their Tenant

```bash
# User can access their tenant's resources
curl -X GET http://localhost:3001/api/v1/tenants/cllzm4vwp7a8b9c/campaigns \
  -H "Authorization: Bearer <regular-user-jwt>"

# User can create campaigns in their tenant
curl -X POST http://localhost:3001/api/v1/tenants/cllzm4vwp7a8b9c/campaigns \
  -H "Authorization: Bearer <regular-user-jwt>" \
  -d '{
    "name": "My Campaign",
    "description": "Test campaign"
  }'
```

---

## Summary

### Admin User
- **JWT `acct` field:** `"00000000-0000-0000-0000-00000000b40d"`
- **Can access:** All tenants
- **Can create:** New tenants
- **Use case:** System administration, platform management

### Regular User
- **JWT `acct` field:** Their tenant ID (e.g., `"cllzm4vwp7a8b9c"`)
- **Can access:** Only their own tenant
- **Cannot create:** New tenants
- **Use case:** Tenant-specific operations

### Tenant ID
- **Auto-generated** by default using `generateTenantId()` function
- **Format:** `cl{timestamp}{random}` (e.g., `cllzm4vwp7a8b9c`)
- **Can be custom** if provided in `tenantId` field during tenant creation
- **Returned** in the response after tenant creation

### Key Validation Points
1. `authenticateToken` - Verifies JWT signature and expiration
2. `requireAccount(<id>)` - Checks if JWT `acct` matches specific ID (for admin routes)
3. `requireTenantAccess` - Checks if JWT `acct` matches URL `tenantId` (for tenant-scoped routes)

---

## Next Steps

If you want to implement a more sophisticated system with:
- Users belonging to multiple tenants
- Different roles per tenant (viewer, manager, admin)
- Permission-based access control (campaigns:read, campaigns:write, etc.)

Refer to `MULTI-TENANT-AUTH-DESIGN.md` for the advanced design.

For now, this simple 2-user-type approach should work well for basic multi-tenancy needs.
