/**
 * Tenant Helper Utilities
 * Provides helper functions for tenant-scoped queries
 */

/**
 * Build where clause with tenant filtering
 * @param {Object} baseWhere - Base where conditions
 * @param {string|null} tenantId - Tenant ID from request
 * @returns {Object} - Where clause with tenant filter
 */
function addTenantFilter(baseWhere = {}, tenantId) {
  if (tenantId) {
    return {
      ...baseWhere,
      tenantId,
    };
  }
  return baseWhere;
}

/**
 * Ensure resource belongs to tenant (security check)
 * @param {Object} resource - Resource object from database
 * @param {string|null} tenantId - Expected tenant ID
 * @param {string} resourceName - Name of resource for error message
 * @throws {Error} - If resource doesn't belong to tenant
 */
function ensureTenantOwnership(resource, tenantId, resourceName = 'Resource') {
  if (!resource) {
    const error = new Error(`${resourceName} not found`);
    error.statusCode = 404;
    throw error;
  }

  // If tenant is required and resource has different tenant
  if (tenantId && resource.tenantId !== tenantId) {
    const error = new Error(`${resourceName} not found`);
    error.statusCode = 404; // Return 404 (not 403) to avoid leaking existence
    throw error;
  }
}

/**
 * Get data with automatic tenant assignment
 * Adds tenantId to data if provided
 * @param {Object} data - Data object
 * @param {string|null} tenantId - Tenant ID
 * @returns {Object} - Data with tenantId
 */
function addTenantToData(data, tenantId) {
  if (tenantId) {
    return {
      ...data,
      tenantId,
    };
  }
  return data;
}

module.exports = {
  addTenantFilter,
  ensureTenantOwnership,
  addTenantToData,
};
