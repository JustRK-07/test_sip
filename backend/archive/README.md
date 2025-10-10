# Archived Code

This directory contains code that has been deprecated or superseded by newer implementations.

## Middleware

### tenantMiddleware.js.archived
**Archived Date**: 2025-10-10
**Reason**: Superseded by URL-based tenant isolation pattern

**Previous Functionality:**
- Extracted `tenantId` from request headers (`X-Tenant-ID`)
- Supported JWT token claims and subdomain-based tenant detection
- Attached `req.tenantId` to request object

**Replacement:**
The entire multi-tenant architecture was migrated to a URL-based pattern:
- Old: `/api/v1/campaigns` + `X-Tenant-ID` header
- New: `/api/v1/tenants/:tenantId/campaigns` with JWT `acct` validation

**Migration:**
All controllers now extract `tenantId` from `req.params` instead of `req.tenantId`. Authentication is handled by:
1. `authenticateToken` - Validates JWT
2. `requireTenantAccess` - Ensures JWT `acct` field matches URL `tenantId`

**References:**
- See `API-MIGRATION-GUIDE.md` for full migration details
- See `src/utils/routeUtils.js` for `requireTenantAccess` implementation
