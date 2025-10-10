# API Migration Guide: Consistent Tenant-Scoped Routes

## Overview

This document describes the API restructuring to achieve consistent tenant-scoped route patterns across all resources, following the phone number API design pattern.

## Migration Date
**Date**: 2025-10-10

## Changes Summary

### Pattern Change
**Before**: Header-based tenant identification (`X-Tenant-ID` header)
**After**: URL path-based tenant identification (`/:tenantId/...`)

### Authentication
**Before**: No authentication required (public access)
**After**: JWT authentication required (`authenticateToken` + `requireTenantAccess` middleware)

---

## API Endpoint Changes

### Campaign APIs

#### Before (Old Pattern)
```
GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
PUT    /api/v1/campaigns/:id
DELETE /api/v1/campaigns/:id
POST   /api/v1/campaigns/:id/start
POST   /api/v1/campaigns/:id/stop
POST   /api/v1/campaigns/:id/pause
POST   /api/v1/campaigns/:id/resume
GET    /api/v1/campaigns/:id/stats
GET    /api/v1/campaigns/:campaignId/agents
POST   /api/v1/campaigns/:campaignId/agents
DELETE /api/v1/campaigns/:campaignId/agents/:agentId
```

#### After (New Pattern)
```
GET    /api/v1/tenants/:tenantId/campaigns
POST   /api/v1/tenants/:tenantId/campaigns
GET    /api/v1/tenants/:tenantId/campaigns/:id
PUT    /api/v1/tenants/:tenantId/campaigns/:id
DELETE /api/v1/tenants/:tenantId/campaigns/:id
POST   /api/v1/tenants/:tenantId/campaigns/:id/start
POST   /api/v1/tenants/:tenantId/campaigns/:id/stop
POST   /api/v1/tenants/:tenantId/campaigns/:id/pause
POST   /api/v1/tenants/:tenantId/campaigns/:id/resume
GET    /api/v1/tenants/:tenantId/campaigns/:id/stats
GET    /api/v1/tenants/:tenantId/campaigns/:campaignId/agents
POST   /api/v1/tenants/:tenantId/campaigns/:campaignId/agents
DELETE /api/v1/tenants/:tenantId/campaigns/:campaignId/agents/:agentId
```

### Campaign Leads APIs

#### Before (Old Pattern)
```
POST   /api/v1/campaigns/:campaignId/leads
POST   /api/v1/campaigns/:campaignId/leads/bulk
POST   /api/v1/campaigns/:campaignId/leads/upload
GET    /api/v1/campaigns/:campaignId/leads
GET    /api/v1/campaigns/:campaignId/leads/:leadId
PUT    /api/v1/campaigns/:campaignId/leads/:leadId
DELETE /api/v1/campaigns/:campaignId/leads/:leadId
DELETE /api/v1/campaigns/:campaignId/leads
```

#### After (New Pattern)
```
POST   /api/v1/tenants/:tenantId/campaigns/:campaignId/leads
POST   /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/bulk
POST   /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/upload
GET    /api/v1/tenants/:tenantId/campaigns/:campaignId/leads
GET    /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/:leadId
PUT    /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/:leadId
DELETE /api/v1/tenants/:tenantId/campaigns/:campaignId/leads/:leadId
DELETE /api/v1/tenants/:tenantId/campaigns/:campaignId/leads
```

### Global Leads APIs

#### Before (Old Pattern)
```
GET    /api/v1/leads
GET    /api/v1/leads/search
GET    /api/v1/leads/stats
GET    /api/v1/leads/export
POST   /api/v1/leads/import
POST   /api/v1/leads/bulk/assign
POST   /api/v1/leads/bulk/status
GET    /api/v1/leads/:leadId
PUT    /api/v1/leads/:leadId
DELETE /api/v1/leads/:leadId
```

#### After (New Pattern)
```
GET    /api/v1/tenants/:tenantId/leads
GET    /api/v1/tenants/:tenantId/leads/search
GET    /api/v1/tenants/:tenantId/leads/stats
GET    /api/v1/tenants/:tenantId/leads/export
POST   /api/v1/tenants/:tenantId/leads/import
POST   /api/v1/tenants/:tenantId/leads/bulk/assign
POST   /api/v1/tenants/:tenantId/leads/bulk/status
GET    /api/v1/tenants/:tenantId/leads/:leadId
PUT    /api/v1/tenants/:tenantId/leads/:leadId
DELETE /api/v1/tenants/:tenantId/leads/:leadId
```

### Phone Number APIs (Already Following This Pattern)
```
GET    /api/v1/tenants/:tenantId/phone-numbers/available
GET    /api/v1/tenants/:tenantId/phone-numbers
POST   /api/v1/tenants/:tenantId/phone-numbers
GET    /api/v1/tenants/:tenantId/phone-numbers/:id
PUT    /api/v1/tenants/:tenantId/phone-numbers/:id
DELETE /api/v1/tenants/:tenantId/phone-numbers/:id
```

---

## Request Changes

### Before (Header-Based)
```bash
# Old way - using X-Tenant-ID header
curl -X GET http://localhost:3000/api/v1/campaigns \
  -H "X-Tenant-ID: 7c8693c6-976e-4324-9123-2c1d811605f9"
```

### After (URL Path-Based + JWT Auth)
```bash
# New way - tenant in URL path + Bearer token
curl -X GET http://localhost:3000/api/v1/tenants/7c8693c6-976e-4324-9123-2c1d811605f9/campaigns \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Note**: The JWT token's `acct` field must match the `tenantId` in the URL path. The `requireTenantAccess` middleware validates this.

---

## Breaking Changes

### 1. URL Structure
- **Change**: All campaign and lead routes now include `/tenants/:tenantId` prefix
- **Impact**: All client code making API calls must update URLs
- **Migration**: Update all API endpoint URLs in frontend/client code

### 2. Authentication Required
- **Change**: All routes now require JWT authentication
- **Impact**: Unauthenticated requests will receive 401 Unauthorized
- **Migration**: Ensure all requests include valid JWT token in `Authorization: Bearer <token>` header

### 3. Tenant Access Validation
- **Change**: JWT token's `acct` field must match URL `tenantId`
- **Impact**: Users can only access resources for their own tenant
- **Migration**: Ensure JWT tokens are issued with correct `acct` claim

### 4. Controller Parameter Source
- **Change**: Controllers extract `tenantId` from `req.params` instead of `req.tenantId`
- **Impact**: Internal code change (no impact on API consumers)
- **Files Modified**:
  - `src/controllers/campaignController.js`
  - `src/controllers/leadController.js`
  - `src/controllers/leadControllerIndependent.js`

### 5. Middleware Changes
- **Change**: Added `authenticateToken` and `requireTenantAccess` to all routes
- **Impact**: Better security, proper tenant isolation
- **Files Modified**:
  - `src/routes/campaignRoutes.js`
  - `src/routes/leadRoutes.js`
  - `src/routes/leadRoutesIndependent.js`

---

## Files Modified

### Route Files
1. **src/routes/index.js** - Updated route mounting
2. **src/routes/campaignRoutes.js** - Added `/:tenantId/campaigns` pattern
3. **src/routes/leadRoutes.js** - Added `/:tenantId/campaigns/:campaignId/leads` pattern
4. **src/routes/leadRoutesIndependent.js** - Added `/:tenantId/leads` pattern

### Controller Files
1. **src/controllers/campaignController.js** - Extract `tenantId` from `req.params`
2. **src/controllers/leadController.js** - Extract `tenantId` from `req.params`
3. **src/controllers/leadControllerIndependent.js** - Extract `tenantId` from `req.params`

---

## Migration Checklist

### Backend (Completed)
- [x] Update campaign routes to include `/:tenantId` prefix
- [x] Update lead routes to include `/:tenantId` prefix
- [x] Add authentication middleware to all routes
- [x] Update campaign controller to extract tenantId from params
- [x] Update lead controllers to extract tenantId from params
- [x] Update route mounting in index.js
- [x] Test all endpoints for proper tenant isolation

### Frontend/Client (To Do)
- [ ] Update all API endpoint URLs to include `/tenants/:tenantId`
- [ ] Ensure JWT token is included in all requests
- [ ] Update API client/SDK to use new endpoint structure
- [ ] Test authentication and authorization flows
- [ ] Update error handling for 401/403 responses

### Testing
- [ ] Verify all campaign CRUD operations work with new pattern
- [ ] Verify all lead CRUD operations work with new pattern
- [ ] Test tenant isolation (users cannot access other tenants' data)
- [ ] Test authentication flows
- [ ] Test error handling for invalid tenant IDs
- [ ] Load testing with new auth middleware

---

## Example Migration

### Creating a Campaign

#### Before
```javascript
const response = await fetch('http://localhost:3000/api/v1/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': 'tenant-123'
  },
  body: JSON.stringify({
    name: 'Q4 Sales Campaign',
    description: 'End of year sales push'
  })
});
```

#### After
```javascript
const response = await fetch('http://localhost:3000/api/v1/tenants/tenant-123/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  body: JSON.stringify({
    name: 'Q4 Sales Campaign',
    description: 'End of year sales push'
  })
});
```

### Uploading Leads to Campaign

#### Before
```javascript
const formData = new FormData();
formData.append('file', csvFile);

const response = await fetch(`http://localhost:3000/api/v1/campaigns/${campaignId}/leads/upload`, {
  method: 'POST',
  headers: {
    'X-Tenant-ID': 'tenant-123'
  },
  body: formData
});
```

#### After
```javascript
const formData = new FormData();
formData.append('file', csvFile);

const response = await fetch(`http://localhost:3000/api/v1/tenants/tenant-123/campaigns/${campaignId}/leads/upload`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  body: formData
});
```

---

## Security Improvements

### Before
- Tenant identification via header (could be spoofed)
- No authentication required
- Minimal tenant isolation enforcement

### After
- Tenant identification in URL path (RESTful, clear)
- JWT authentication required (secure)
- Double validation: JWT `acct` must match URL `tenantId`
- Middleware enforces tenant access control
- Audit trail via JWT claims

---

## Benefits

### 1. **Consistency**
- All resources follow the same `/tenants/:tenantId/resource` pattern
- Easier to understand and maintain
- Matches industry best practices for multi-tenant APIs

### 2. **Security**
- JWT authentication prevents unauthorized access
- Tenant access validation prevents cross-tenant data leakage
- RESTful URLs make permissions clearer

### 3. **Clarity**
- URL clearly shows tenant scope
- No hidden tenant context in headers
- Better API discoverability

### 4. **Scalability**
- Easier to implement rate limiting per tenant
- Better caching strategies (CDN can cache by URL)
- Simpler load balancing and routing

---

## Rollback Plan

If issues arise, rollback involves:

1. Revert route files to use old patterns (remove `/:tenantId` prefix)
2. Revert controller files to use `req.tenantId`
3. Remove `authenticateToken` and `requireTenantAccess` middleware
4. Re-add `extractTenant` middleware for header-based identification

**Git Commit**: Current changes are committed as single unit for easy rollback

---

## Support

For questions or issues with the migration:
1. Check this documentation first
2. Review the code changes in the modified files
3. Test using the provided examples
4. Contact the development team for assistance

---

**Last Updated**: 2025-10-10
**Version**: 1.0
