// Middleware to check if JWT acct matches tenantId
// Admin users (with system admin account ID) can access any tenant
const requireTenantAccess = (req, res, next) => {
    const SYSTEM_ADMIN_ACCOUNT_ID = '00000000-0000-0000-0000-00000000b40d';

    if (req?.params?.tenantId && req?.body?.tenantId) {
        return res.status(403).json({
            error: {
                message: 'Access denied: Account ID cannot be specified in both URL and body',
                code: 'TENANT_ACCESS_DENIED',
                required: req.params.tenantId,
                current: req.body.tenantId
            }
        });
    }

    let tenantId = req?.params?.tenantId ?? req?.body?.tenantId ?? req?.user?.acct;
    const userAccountId = req.user?.acct;

    if (!userAccountId) {
        return res.status(403).json({
            error: {
                message: 'Account information missing from token',
                code: 'MISSING_ACCOUNT_INFO'
            }
        });
    }

    // Allow system admins to access any tenant
    if (userAccountId === SYSTEM_ADMIN_ACCOUNT_ID) {
        return next();
    }

    // Regular users must match the tenant ID
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

// At the end of routeUtils.js
module.exports = {
    requireTenantAccess
};