// Middleware to check if JWT acct matches tenantId
const requireTenantAccess = (req, res, next) => {

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