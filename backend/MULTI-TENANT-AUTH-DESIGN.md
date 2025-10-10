# Multi-Tenant Authentication & Authorization Design

## Overview

This document outlines the recommended design for implementing a flexible multi-tenant authentication system that supports:
- **Regular Users**: Access to specific tenant(s) only
- **Admin Users**: Access to all tenants
- **Multi-Account Users**: Users with access to multiple tenants with different roles

---

## Recommended JWT Token Structure

### JWT Payload Design

```json
{
  "sub": "user-uuid-12345",
  "email": "user@example.com",
  "name": "John Doe",
  "accounts": [
    {
      "id": "00000000-0000-0000-0000-00000000b40d",
      "role": "super_admin",
      "permissions": ["*"]
    },
    {
      "id": "clx1234567890abcdef",
      "role": "campaign_manager",
      "permissions": ["campaigns:*", "leads:*", "agents:read"]
    },
    {
      "id": "clx9876543210fedcba",
      "role": "viewer",
      "permissions": ["campaigns:read", "leads:read"]
    }
  ],
  "primary_account": "clx1234567890abcdef",
  "is_super_admin": false,
  "iat": 1728561234,
  "exp": 1728647634,
  "iss": "campaign-calling-system",
  "aud": "campaign-calling-api"
}
```

### Super Admin Example

```json
{
  "sub": "admin-uuid-99999",
  "email": "admin@example.com",
  "name": "System Administrator",
  "accounts": [
    {
      "id": "00000000-0000-0000-0000-00000000b40d",
      "role": "super_admin",
      "permissions": ["*"]
    }
  ],
  "primary_account": "00000000-0000-0000-0000-00000000b40d",
  "is_super_admin": true,
  "iat": 1728561234,
  "exp": 1728647634
}
```

### Regular User Example

```json
{
  "sub": "user-uuid-54321",
  "email": "manager@testcorp.com",
  "name": "Campaign Manager",
  "accounts": [
    {
      "id": "clx1234567890abcdef",
      "role": "campaign_manager",
      "permissions": ["campaigns:*", "leads:*"]
    }
  ],
  "primary_account": "clx1234567890abcdef",
  "is_super_admin": false,
  "iat": 1728561234,
  "exp": 1728647634
}
```

---

## Database Schema Updates

### User Table
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  passwordHash  String
  isSuperAdmin  Boolean   @default(false)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  userAccounts  UserAccount[]

  @@map("users")
}
```

### UserAccount Table (Join Table)
```prisma
model UserAccount {
  id          String    @id @default(cuid())
  userId      String
  tenantId    String
  role        String    // 'super_admin', 'admin', 'campaign_manager', 'viewer'
  permissions Json?     // Custom permissions per tenant
  isPrimary   Boolean   @default(false)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([userId, tenantId])
  @@map("user_accounts")
}
```

### Update Tenant Table
```prisma
model Tenant {
  id              String        @id @default(cuid())
  name            String
  domain          String        @unique
  // ... existing fields

  // Relations
  userAccounts    UserAccount[]

  @@map("tenants")
}
```

---

## Updated Middleware Implementation

### 1. Enhanced Authentication Middleware

**File:** `src/middleware/auth.js`

```javascript
/**
 * Enhanced JWT Authentication Middleware
 * Supports multi-account users and super admins
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Access token required',
        code: 'MISSING_TOKEN'
      }
    });
  }

  const certificate = process.env.JWT_PUBLIC_KEY;

  if (!certificate) {
    console.error('JWT_PUBLIC_KEY not configured');
    return res.status(500).json({
      error: {
        message: 'JWT configuration error',
        code: 'CONFIG_ERROR'
      }
    });
  }

  try {
    const publicKey = extractPublicKeyFromCertificate(certificate);
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256']
    });

    // Enhanced user object with multi-account support
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      accounts: decoded.accounts || [], // Array of {id, role, permissions}
      primaryAccount: decoded.primary_account,
      isSuperAdmin: decoded.is_super_admin || false,
      ...decoded
    };

    next();
  } catch (error) {
    // ... error handling
  }
};
```

### 2. Enhanced Tenant Access Middleware

**File:** `src/utils/routeUtils.js`

```javascript
/**
 * Enhanced Tenant Access Validation
 * Supports:
 * - Super admins (access all tenants)
 * - Multi-account users (access specific tenants)
 * - Single-tenant users
 */
const requireTenantAccess = (req, res, next) => {
  const tenantId = req.params.tenantId;
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      error: {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }
    });
  }

  // Super admin has access to all tenants
  if (user.isSuperAdmin) {
    req.currentAccount = {
      id: tenantId,
      role: 'super_admin',
      permissions: ['*']
    };
    return next();
  }

  // Check if user has access to this tenant
  const accountAccess = user.accounts.find(acc => acc.id === tenantId);

  if (!accountAccess) {
    return res.status(403).json({
      error: {
        message: 'Access denied: You do not have access to this tenant',
        code: 'TENANT_ACCESS_DENIED',
        requestedTenant: tenantId,
        availableAccounts: user.accounts.map(acc => ({
          id: acc.id,
          role: acc.role
        }))
      }
    });
  }

  // User has access - attach account info to request
  req.currentAccount = accountAccess;
  next();
};

/**
 * Permission Check Middleware
 * Validates user has specific permission for current tenant
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    const account = req.currentAccount;

    if (!account) {
      return res.status(403).json({
        error: {
          message: 'Account context not found',
          code: 'NO_ACCOUNT_CONTEXT'
        }
      });
    }

    // Super admin or wildcard permission
    if (account.permissions.includes('*')) {
      return next();
    }

    // Check specific permission
    const hasPermission = account.permissions.some(perm => {
      // Exact match
      if (perm === permission) return true;

      // Wildcard match (e.g., "campaigns:*" matches "campaigns:read")
      if (perm.endsWith(':*')) {
        const prefix = perm.replace(':*', '');
        return permission.startsWith(prefix + ':');
      }

      return false;
    });

    if (!hasPermission) {
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: permission,
          available: account.permissions
        }
      });
    }

    next();
  };
};

module.exports = {
  requireTenantAccess,
  requirePermission
};
```

---

## Route Implementation Examples

### Example 1: Campaign Routes with Permissions

**File:** `src/routes/campaignRoutes.js`

```javascript
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireTenantAccess, requirePermission } = require('../utils/routeUtils');
const campaignController = require('../controllers/campaignController');

const router = express.Router();

// All routes require authentication and tenant access
router.use(authenticateToken);

// List campaigns - requires read permission
router.get('/:tenantId/campaigns',
  requireTenantAccess,
  requirePermission('campaigns:read'),
  campaignController.getAllCampaigns
);

// Create campaign - requires write permission
router.post('/:tenantId/campaigns',
  requireTenantAccess,
  requirePermission('campaigns:write'),
  campaignController.createCampaign
);

// Start campaign - requires manage permission
router.post('/:tenantId/campaigns/:id/start',
  requireTenantAccess,
  requirePermission('campaigns:manage'),
  campaignController.startCampaign
);

// Delete campaign - requires delete permission
router.delete('/:tenantId/campaigns/:id',
  requireTenantAccess,
  requirePermission('campaigns:delete'),
  campaignController.deleteCampaign
);

module.exports = router;
```

### Example 2: Tenant Management (Admin Only)

**File:** `src/routes/tenantRoutes.js`

```javascript
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const tenantController = require('../controllers/tenantController');

const router = express.Router();

// Middleware to check super admin
const requireSuperAdmin = (req, res, next) => {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({
      error: {
        message: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED'
      }
    });
  }
  next();
};

// List all tenants - super admin only
router.get('/',
  authenticateToken,
  requireSuperAdmin,
  tenantController.getAllTenants
);

// Create tenant - super admin only
router.post('/',
  authenticateToken,
  requireSuperAdmin,
  tenantController.createTenant
);

// Get single tenant - accessible if user has access to that tenant
router.get('/:tenantId',
  authenticateToken,
  requireTenantAccess,
  tenantController.getTenant
);

module.exports = router;
```

---

## Controller Updates

### Enhanced Controller Example

**File:** `src/controllers/campaignController.js`

```javascript
exports.getAllCampaigns = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const user = req.user;
    const currentAccount = req.currentAccount;

    // Log access for audit
    logger.info('User accessing campaigns', {
      userId: user.id,
      email: user.email,
      tenantId,
      role: currentAccount.role
    });

    // Super admin can see all campaigns, others see filtered
    const where = user.isSuperAdmin
      ? { tenantId }
      : { tenantId, isActive: true }; // Regular users only see active

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      success: true,
      data: campaigns,
      meta: {
        tenantId,
        userRole: currentAccount.role,
        isSuperAdmin: user.isSuperAdmin
      }
    });
  } catch (error) {
    logger.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns'
    });
  }
};
```

---

## Login Endpoint Implementation

### Authentication Service

**File:** `src/services/AuthService.js`

```javascript
const { getPrismaClient } = require('../config/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = getPrismaClient();

class AuthService {
  /**
   * Login user and generate JWT with multi-account support
   */
  async login(email, password) {
    // Find user with accounts
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userAccounts: {
          where: { isActive: true },
          include: {
            tenant: {
              select: { id: true, name: true, domain: true }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    // Build accounts array for JWT
    const accounts = user.userAccounts.map(ua => ({
      id: ua.tenantId,
      name: ua.tenant.name,
      role: ua.role,
      permissions: ua.permissions || this.getDefaultPermissions(ua.role)
    }));

    // Find primary account
    const primaryAccount = user.userAccounts.find(ua => ua.isPrimary);
    const primaryAccountId = primaryAccount?.tenantId || accounts[0]?.id;

    // Generate JWT
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      accounts: accounts,
      primary_account: primaryAccountId,
      is_super_admin: user.isSuperAdmin,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
      iss: 'campaign-calling-system',
      aud: 'campaign-calling-api'
    };

    const privateKey = process.env.JWT_PRIVATE_KEY;
    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
        accounts: accounts,
        primaryAccount: primaryAccountId
      }
    };
  }

  /**
   * Get default permissions based on role
   */
  getDefaultPermissions(role) {
    const permissionMap = {
      'super_admin': ['*'],
      'admin': [
        'campaigns:*',
        'leads:*',
        'agents:*',
        'phone-numbers:*',
        'users:read',
        'users:write'
      ],
      'campaign_manager': [
        'campaigns:read',
        'campaigns:write',
        'campaigns:manage',
        'leads:*',
        'agents:read'
      ],
      'viewer': [
        'campaigns:read',
        'leads:read',
        'agents:read'
      ]
    };

    return permissionMap[role] || ['campaigns:read'];
  }
}

module.exports = new AuthService();
```

### Login Controller

**File:** `src/controllers/authController.js`

```javascript
const AuthService = require('../services/AuthService');
const logger = require('../utils/logger');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    const result = await AuthService.login(email, password);

    logger.info('User logged in successfully', {
      userId: result.user.id,
      email: result.user.email,
      accountCount: result.user.accounts.length
    });

    res.json({
      success: true,
      data: {
        token: result.token,
        user: result.user
      }
    });
  } catch (error) {
    logger.error('Login error:', error);

    res.status(401).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
};

exports.me = async (req, res) => {
  try {
    const user = req.user; // From authenticateToken middleware

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
        accounts: user.accounts,
        primaryAccount: user.primaryAccount
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info'
    });
  }
};
```

---

## API Response Examples

### Login Response - Super Admin
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "admin-uuid-99999",
      "email": "admin@example.com",
      "name": "System Administrator",
      "isSuperAdmin": true,
      "accounts": [
        {
          "id": "00000000-0000-0000-0000-00000000b40d",
          "name": "System",
          "role": "super_admin",
          "permissions": ["*"]
        }
      ],
      "primaryAccount": "00000000-0000-0000-0000-00000000b40d"
    }
  }
}
```

### Login Response - Multi-Account User
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-uuid-12345",
      "email": "manager@example.com",
      "name": "Campaign Manager",
      "isSuperAdmin": false,
      "accounts": [
        {
          "id": "clx1234567890abcdef",
          "name": "Test Corp",
          "role": "campaign_manager",
          "permissions": ["campaigns:*", "leads:*", "agents:read"]
        },
        {
          "id": "clx9876543210fedcba",
          "name": "Another Corp",
          "role": "viewer",
          "permissions": ["campaigns:read", "leads:read"]
        }
      ],
      "primaryAccount": "clx1234567890abcdef"
    }
  }
}
```

---

## Frontend Integration Examples

### Account Switcher Component

```javascript
// React example
function AccountSwitcher({ user, onSwitchAccount }) {
  return (
    <div className="account-switcher">
      <h3>Switch Account</h3>
      {user.accounts.map(account => (
        <button
          key={account.id}
          onClick={() => onSwitchAccount(account.id)}
          className={account.id === user.primaryAccount ? 'active' : ''}
        >
          <span>{account.name}</span>
          <span className="role">{account.role}</span>
        </button>
      ))}
    </div>
  );
}
```

### API Client with Account Context

```javascript
class ApiClient {
  constructor(token) {
    this.token = token;
    this.baseURL = 'http://localhost:3001/api/v1';
  }

  // Get campaigns for specific account
  async getCampaigns(accountId) {
    const response = await fetch(
      `${this.baseURL}/tenants/${accountId}/campaigns`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }

  // Super admin: Get all tenants
  async getAllTenants() {
    const response = await fetch(`${this.baseURL}/tenants`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }
}
```

---

## Migration Steps

### Step 1: Database Migration

```bash
# Add new tables
npx prisma migrate dev --name add_multi_tenant_auth
```

### Step 2: Seed Super Admin

```javascript
// prisma/seed.js
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Super Administrator',
      passwordHash,
      isSuperAdmin: true,
      userAccounts: {
        create: {
          tenantId: '00000000-0000-0000-0000-00000000b40d',
          role: 'super_admin',
          permissions: ['*'],
          isPrimary: true
        }
      }
    }
  });

  console.log('Super admin created:', superAdmin);
}

main();
```

### Step 3: Update Middleware Files

1. Update `src/middleware/auth.js`
2. Update `src/utils/routeUtils.js`
3. Create `src/services/AuthService.js`
4. Create `src/controllers/authController.js`

### Step 4: Update Route Files

Add permission checks to all protected routes

### Step 5: Test

```bash
# Login as super admin
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Use token to access resources
export TOKEN="<token-from-login>"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/tenants
```

---

## Security Best Practices

1. ✅ **Password Hashing**: Use bcrypt with salt rounds >= 10
2. ✅ **Token Expiration**: Set reasonable expiration (1-24 hours)
3. ✅ **Refresh Tokens**: Implement refresh token mechanism
4. ✅ **Audit Logging**: Log all access attempts
5. ✅ **Rate Limiting**: Limit login attempts
6. ✅ **HTTPS Only**: Never send tokens over HTTP
7. ✅ **Token Rotation**: Rotate tokens on sensitive operations
8. ✅ **Permission Validation**: Always validate permissions server-side

---

## Summary

This design provides:

✅ **Flexibility**: Users can have access to multiple tenants
✅ **Granular Control**: Role and permission-based access
✅ **Super Admin**: Special users with access to all tenants
✅ **Scalability**: Easy to add new roles and permissions
✅ **Security**: Proper validation at every level
✅ **Audit Trail**: Clear logging of who accessed what
✅ **User Experience**: Users can switch between accounts easily

The system supports your exact requirements:
- Regular users see only their tenant(s)
- Super admins see all tenants
- Multi-account users can switch between tenants
- Granular permissions per tenant per user
