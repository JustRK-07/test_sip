const DatabaseService = require('./DatabaseService');
const TwilioService = require('./TwilioService');
const LiveKitService = require('./LiveKitService');
const ResponseService = require('./ResponseService');

/**
 * Service class for common route operations
 * Centralizes repetitive patterns found across route files
 */
class RouteHelperService {
  
  /**
   * Validate and get tenant by ID
   * @param {string} tenantId Tenant ID to validate
   * @param {Object} res Express response object
   * @returns {Promise<Object|null>} Tenant object or null if validation fails (response already sent)
   */
  async validateTenant(tenantId, res) {
    try {
      const tenant = await DatabaseService.findTenantById(tenantId);
      
      if (!tenant) {
        ResponseService.notFound(res, 'Tenant', tenantId);
        return null;
      }
      
      return tenant;
    } catch (error) {
      ResponseService.internalError(res, error, 'Failed to validate tenant');
      return null;
    }
  }

  /**
   * Check service configuration and send error if not configured
   * @param {string} serviceName Service name (e.g., 'Twilio', 'LiveKit')
   * @param {Function} configCheckFn Function to check service configuration
   * @param {Object} res Express response object
   * @returns {boolean} True if configured, false if not (response already sent)
   */
  checkServiceConfiguration(serviceName, configCheckFn, res) {
    if (!configCheckFn()) {
      ResponseService.serviceUnavailable(res, serviceName, 'not configured');
      return false;
    }
    return true;
  }

  /**
   * Check Twilio configuration
   * @param {Object} res Express response object
   * @returns {boolean} True if configured, false if not (response already sent)
   */
  checkTwilioConfig(res) {
    return this.checkServiceConfiguration('Twilio', () => TwilioService.isConfigured(), res);
  }

  /**
   * Check LiveKit configuration
   * @param {Object} res Express response object
   * @returns {boolean} True if configured, false if not (response already sent)
   */
  checkLiveKitConfig(res) {
    return this.checkServiceConfiguration('LiveKit', () => LiveKitService.isConfigured(), res);
  }

  /**
   * Validate resource exists and belongs to tenant
   * @param {string} model Model name
   * @param {string} resourceId Resource ID
   * @param {string} tenantId Tenant ID
   * @param {string} resourceName Human-readable resource name
   * @param {Object} res Express response object
   * @param {Object} [include] Relations to include
   * @returns {Promise<Object|null>} Resource object or null if validation fails (response already sent)
   */
  async validateTenantResource(model, resourceId, tenantId, resourceName, res, include = null) {
    try {
      const resource = await DatabaseService.findRecordById(model, resourceId, include);
      
      if (!resource) {
        ResponseService.notFound(res, resourceName, resourceId);
        return null;
      }
      
      if (resource.tenantId !== tenantId) {
        ResponseService.forbidden(res, `Access denied: ${resourceName} does not belong to this tenant`);
        return null;
      }
      
      return resource;
    } catch (error) {
      ResponseService.internalError(res, error, `Failed to validate ${resourceName.toLowerCase()}`);
      return null;
    }
  }

  /**
   * Validate unique constraint for resource
   * @param {string} model Model name
   * @param {Object} where Where clause for uniqueness check
   * @param {string} [excludeId] ID to exclude from check (for updates)
   * @param {string} conflictMessage Conflict error message
   * @param {Object} res Express response object
   * @returns {Promise<boolean>} True if unique, false if conflict (response already sent)
   */
  async validateUnique(model, where, excludeId, conflictMessage, res) {
    try {
      const existing = await DatabaseService.findExistingRecord(model, where, excludeId);
      
      if (existing) {
        ResponseService.conflict(res, conflictMessage);
        return false;
      }
      
      return true;
    } catch (error) {
      ResponseService.internalError(res, error, 'Failed to check uniqueness constraint');
      return false;
    }
  }

  /**
   * Validate array of IDs belong to tenant
   * @param {string} model Model name
   * @param {Array<string>} ids Array of IDs to validate
   * @param {string} tenantId Tenant ID
   * @param {string} resourceName Human-readable resource name (plural)
   * @param {Object} res Express response object
   * @param {Object} [additionalWhere] Additional where conditions
   * @returns {Promise<Array|null>} Array of valid resources or null if validation fails (response already sent)
   */
  async validateTenantResourceIds(model, ids, tenantId, resourceName, res, additionalWhere = {}) {
    try {
      const where = {
        id: { in: ids },
        tenantId,
        ...additionalWhere
      };
      
      const resources = await DatabaseService.getClient()[model].findMany({ where });
      
      if (resources.length !== ids.length) {
        const foundIds = resources.map(r => r.id);
        const missingIds = ids.filter(id => !foundIds.includes(id));
        
        return ResponseService.error(res, 
          `Some ${resourceName} are invalid or do not belong to this tenant`,
          `INVALID_${resourceName.toUpperCase().replace(/\s+/g, '_')}`,
          400,
          {
            invalidIds: missingIds,
            validIds: foundIds
          }
        );
      }
      
      return resources;
    } catch (error) {
      ResponseService.internalError(res, error, `Failed to validate ${resourceName}`);
      return null;
    }
  }

  /**
   * Handle async operations with try-catch and error response
   * @param {Function} operation Async operation to execute
   * @param {Object} res Express response object
   * @param {string} [errorMessage='Operation failed'] Error message for failures
   * @returns {Promise<*>} Operation result or null if error occurred (response already sent)
   */
  async handleAsync(operation, res, errorMessage = 'Operation failed') {
    try {
      return await operation();
    } catch (error) {
      ResponseService.internalError(res, error, errorMessage);
      return null;
    }
  }

  /**
   * Execute paginated query with standard error handling
   * @param {string} model Model name
   * @param {Object} queryOptions Query options from PaginationService
   * @param {Object} res Express response object
   * @param {Object} [metadata] Additional metadata for response
   * @returns {Promise<boolean>} True if successful (response sent), false if error (response already sent)
   */
  async executePaginatedQuery(model, queryOptions, res, metadata = {}) {
    try {
      const { data, totalCount } = await DatabaseService.executePaginatedQuery(model, queryOptions);
      
      const paginationInfo = {
        currentPage: queryOptions.paginationParams.page,
        totalPages: Math.ceil(totalCount / queryOptions.paginationParams.limit),
        totalCount,
        hasNextPage: queryOptions.paginationParams.page < Math.ceil(totalCount / queryOptions.paginationParams.limit),
        hasPreviousPage: queryOptions.paginationParams.page > 1
      };
      
      ResponseService.paginated(res, data, paginationInfo, metadata);
      return true;
    } catch (error) {
      ResponseService.internalError(res, error, 'Failed to fetch records');
      return false;
    }
  }

  /**
   * Validate request body against schema
   * @param {Object} data Request body data
   * @param {Function} validationFn Validation function from ValidationService
   * @param {Object} res Express response object
   * @returns {boolean} True if valid, false if invalid (response already sent)
   */
  validateRequestBody(data, validationFn, res) {
    const validationErrors = validationFn(data);
    
    if (validationErrors.length > 0) {
      ResponseService.validationError(res, validationErrors);
      return false;
    }
    
    return true;
  }

  /**
   * Extract and validate pagination parameters
   * @param {Object} query Request query parameters
   * @param {number} [defaultLimit=10] Default limit
   * @param {number} [maxLimit=100] Maximum allowed limit
   * @returns {Object} Validated pagination parameters
   */
  extractPaginationParams(query, defaultLimit = 10, maxLimit = 100) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || defaultLimit));
    const skip = (page - 1) * limit;
    
    return { page, limit, skip };
  }

  /**
   * Build search where clause
   * @param {string} searchTerm Search term
   * @param {Array<string>} searchFields Fields to search in
   * @param {Object} [baseWhere={}] Base where conditions
   * @returns {Object} Where clause with search conditions
   */
  buildSearchWhere(searchTerm, searchFields, baseWhere = {}) {
    const where = { ...baseWhere };
    
    if (searchTerm && searchFields.length > 0) {
      where.OR = searchFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' }
      }));
    }
    
    return where;
  }

  /**
   * Handle service operation with error handling
   * @param {Function} serviceOperation Service operation function
   * @param {Object} res Express response object
   * @param {string} serviceName Service name for error messages
   * @param {string} operation Operation description
   * @returns {Promise<*>} Operation result or null if error occurred (response already sent)
   */
  async handleServiceOperation(serviceOperation, res, serviceName, operation) {
    try {
      return await serviceOperation();
    } catch (serviceError) {
      console.error(`${serviceName} ${operation} error:`, serviceError);
      
      // Handle specific service errors if needed
      if (serviceName === 'Twilio' && typeof TwilioService.handleTwilioError === 'function') {
        const errorInfo = TwilioService.handleTwilioError(serviceError);
        return ResponseService.error(res, errorInfo.message, errorInfo.code, 400, errorInfo.details);
      }
      
      return ResponseService.error(res, 
        `Failed to ${operation} with ${serviceName}`, 
        `${serviceName.toUpperCase()}_${operation.toUpperCase().replace(/\s+/g, '_')}_ERROR`,
        500,
        serviceError.message
      );
    }
  }
}

// Export singleton instance
module.exports = new RouteHelperService();