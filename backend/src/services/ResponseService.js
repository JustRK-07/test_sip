/**
 * Service class for standardized API responses
 * Centralizes response formatting patterns used across route files
 */
class ResponseService {
  
  /**
   * Send standardized success response
   * @param {Object} res Express response object
   * @param {*} data Response data
   * @param {string} [message] Success message
   * @param {number} [statusCode=200] HTTP status code
   * @param {Object} [metadata] Additional metadata
   */
  success(res, data, message = null, statusCode = 200, metadata = {}) {
    const response = { data };
    
    if (message) {
      response.message = message;
    }
    
    if (Object.keys(metadata).length > 0) {
      Object.assign(response, metadata);
    }
    
    return res.status(statusCode).json(response);
  }

  /**
   * Send standardized error response
   * @param {Object} res Express response object
   * @param {string} message Error message
   * @param {string} [code] Error code
   * @param {number} [statusCode=500] HTTP status code
   * @param {*} [details] Additional error details
   */
  error(res, message, code = null, statusCode = 500, details = null) {
    const errorResponse = {
      error: {
        message
      }
    };
    
    if (code) {
      errorResponse.error.code = code;
    }
    
    if (details !== null) {
      errorResponse.error.details = details;
    }
    
    return res.status(statusCode).json(errorResponse);
  }

  /**
   * Send validation error response
   * @param {Object} res Express response object
   * @param {Array<string>} validationErrors Array of validation error messages
   * @param {string} [message='Validation failed'] Error message
   */
  validationError(res, validationErrors, message = 'Validation failed') {
    return this.error(res, message, 'VALIDATION_ERROR', 400, validationErrors);
  }

  /**
   * Send not found error response
   * @param {Object} res Express response object
   * @param {string} resource Resource name (e.g., 'Campaign', 'Phone number')
   * @param {string} [identifier] Resource identifier
   */
  notFound(res, resource, identifier = null) {
    const message = identifier 
      ? `${resource} with ID ${identifier} not found`
      : `${resource} not found`;
    
    return this.error(res, message, `${resource.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`, 404);
  }

  /**
   * Send conflict error response
   * @param {Object} res Express response object
   * @param {string} message Conflict message
   * @param {string} [code] Error code
   */
  conflict(res, message, code = 'CONFLICT') {
    return this.error(res, message, code, 409);
  }

  /**
   * Send unauthorized error response
   * @param {Object} res Express response object
   * @param {string} [message='Unauthorized'] Error message
   */
  unauthorized(res, message = 'Unauthorized') {
    return this.error(res, message, 'UNAUTHORIZED', 401);
  }

  /**
   * Send forbidden error response
   * @param {Object} res Express response object
   * @param {string} [message='Access denied'] Error message
   * @param {string} [code='ACCESS_DENIED'] Error code
   */
  forbidden(res, message = 'Access denied', code = 'ACCESS_DENIED') {
    return this.error(res, message, code, 403);
  }

  /**
   * Send service unavailable error response
   * @param {Object} res Express response object
   * @param {string} service Service name
   * @param {string} [reason] Reason for unavailability
   */
  serviceUnavailable(res, service, reason = null) {
    const message = reason 
      ? `${service} service unavailable: ${reason}`
      : `${service} service unavailable`;
    
    return this.error(res, message, `${service.toUpperCase()}_SERVICE_ERROR`, 503);
  }

  /**
   * Send paginated response
   * @param {Object} res Express response object
   * @param {Array} data Data array
   * @param {Object} paginationInfo Pagination information
   * @param {Object} [metadata] Additional metadata
   */
  paginated(res, data, paginationInfo, metadata = {}) {
    const response = {
      data,
      pagination: paginationInfo
    };
    
    if (Object.keys(metadata).length > 0) {
      Object.assign(response, metadata);
    }
    
    return res.json(response);
  }

  /**
   * Send created resource response
   * @param {Object} res Express response object
   * @param {*} data Created resource data
   * @param {string} [message] Success message
   * @param {Object} [metadata] Additional metadata
   */
  created(res, data, message = null, metadata = {}) {
    return this.success(res, data, message, 201, metadata);
  }

  /**
   * Send no content response
   * @param {Object} res Express response object
   */
  noContent(res) {
    return res.status(204).send();
  }

  /**
   * Handle async route wrapper to catch errors
   * @param {Function} fn Async route handler function
   * @returns {Function} Wrapped route handler
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Send internal server error with development details
   * @param {Object} res Express response object
   * @param {Error} error Error object
   * @param {string} [message='Internal server error'] Error message
   */
  internalError(res, error, message = 'Internal server error') {
    console.error('Internal server error:', error);
    
    const errorResponse = {
      error: {
        message
      }
    };
    
    // Include stack trace in development mode
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error.details = error.message;
      errorResponse.error.stack = error.stack;
    }
    
    return res.status(500).json(errorResponse);
  }

  /**
   * Send custom response with flexible structure
   * @param {Object} res Express response object
   * @param {number} statusCode HTTP status code
   * @param {Object} responseBody Response body object
   */
  custom(res, statusCode, responseBody) {
    return res.status(statusCode).json(responseBody);
  }
}

// Export singleton instance
module.exports = new ResponseService();