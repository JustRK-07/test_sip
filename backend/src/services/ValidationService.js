const { validatePhoneNumber } = require('../utils/phoneValidation');

/**
 * Service class for validation operations
 * Centralizes common validation patterns used across route files
 */
class ValidationService {
  
  /**
   * Validate phone number data
   * @param {Object} data Phone number data to validate
   * @returns {Array<string>} Array of validation error messages
   */
  validatePhoneNumberData(data) {
    const errors = [];
    
    if (!data.number || typeof data.number !== 'string' || data.number.trim().length === 0) {
      errors.push('Phone number is required and must be a non-empty string');
    }
    
    if (data.number && !validatePhoneNumber(data.number)) {
      errors.push('Phone number must be a valid phone number format');
    }
    
    if (data.type && !['LOCAL', 'MOBILE', 'TOLL_FREE'].includes(data.type)) {
      errors.push('Phone type must be one of: LOCAL, MOBILE, TOLL_FREE');
    }
    
    if (data.provider && !['TWILIO'].includes(data.provider)) {
      errors.push('Provider must be: TWILIO');
    }
    
    if (data.extension && (typeof data.extension !== 'string' || data.extension.length > 10)) {
      errors.push('Extension must be a string with maximum 10 characters');
    }
    
    return errors;
  }

  /**
   * Validate campaign data
   * @param {Object} data Campaign data to validate
   * @returns {Array<string>} Array of validation error messages
   */
  validateCampaignData(data) {
    const errors = [];
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }
    
    if (data.agentName && (typeof data.agentName !== 'string' || data.agentName.trim().length === 0)) {
      errors.push('Agent name must be a non-empty string when provided');
    }
    
    if (data.description && typeof data.description !== 'string') {
      errors.push('Description must be a string when provided');
    }
    
    if (data.campaignType && !['INBOUND', 'OUTBOUND'].includes(data.campaignType)) {
      errors.push('Campaign type must be either INBOUND or OUTBOUND');
    }
    
    return errors;
  }

  /**
   * Validate platform trunk data
   * @param {Object} data Platform trunk data to validate
   * @returns {Array<string>} Array of validation error messages
   */
  validatePlatformTrunkData(data) {
    const errors = [];
    
    if (data.name && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
      errors.push('Name must be a non-empty string when provided');
    }
    
    if (data.twilioRegion && !['us1', 'us2', 'au1', 'dublin', 'tokyo', 'singapore', 'sydney', 'ireland'].includes(data.twilioRegion)) {
      errors.push('Twilio Region must be a valid region code');
    }
    
    if (data.maxChannels && (!Number.isInteger(data.maxChannels) || data.maxChannels < 1)) {
      errors.push('Max channels must be a positive integer');
    }
    
    return errors;
  }

  /**
   * Validate LiveKit trunk data
   * @param {Object} data LiveKit trunk data to validate
   * @returns {Array<string>} Array of validation error messages
   */
  validateLiveKitTrunkData(data) {
    const errors = [];
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }
    
    if (!data.tenantId || typeof data.tenantId !== 'string' || data.tenantId.trim().length === 0) {
      errors.push('Tenant ID is required and must be a non-empty string');
    }
    
    if (data.livekitRegion && !['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1'].includes(data.livekitRegion)) {
      errors.push('LiveKit Region must be a valid region code');
    }
    
    if (data.trunkType && !['INBOUND', 'OUTBOUND'].includes(data.trunkType)) {
      errors.push('Trunk type must be either INBOUND or OUTBOUND');
    }
    
    if (data.status && !['ACTIVE', 'INACTIVE', 'PROVISIONING', 'ERROR', 'MAINTENANCE'].includes(data.status)) {
      errors.push('Status must be one of: ACTIVE, INACTIVE, PROVISIONING, ERROR, MAINTENANCE');
    }
    
    if (data.maxConcurrentCalls && (!Number.isInteger(data.maxConcurrentCalls) || data.maxConcurrentCalls < 1)) {
      errors.push('Max concurrent calls must be a positive integer');
    }
    
    if (data.codecPreferences && !Array.isArray(data.codecPreferences)) {
      errors.push('Codec preferences must be an array');
    }
    
    return errors;
  }

  /**
   * Validate pagination parameters
   * @param {Object} query Query parameters
   * @param {number} [maxLimit=100] Maximum allowed limit
   * @returns {Object} Validated pagination parameters
   */
  validatePaginationParams(query, maxLimit = 100) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || 10));
    const skip = (page - 1) * limit;
    
    return {
      page,
      limit,
      skip
    };
  }

  /**
   * Validate search parameters
   * @param {Object} query Query parameters
   * @returns {Object} Validated search parameters
   */
  validateSearchParams(query) {
    const search = query.search;
    const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;
    const sortBy = query.sortBy;
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    
    return {
      search,
      isActive,
      sortBy,
      sortOrder
    };
  }

  /**
   * Validate tenant ID parameter
   * @param {string} tenantId Tenant ID to validate
   * @returns {Object} Validation result
   */
  validateTenantId(tenantId) {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      return {
        valid: false,
        error: 'Tenant ID is required and must be a non-empty string'
      };
    }
    
    return {
      valid: true,
      tenantId: tenantId.trim()
    };
  }

  /**
   * Validate required fields
   * @param {Object} data Data object to validate
   * @param {Array<string>} requiredFields Array of required field names
   * @returns {Array<string>} Array of validation error messages
   */
  validateRequiredFields(data, requiredFields) {
    const errors = [];
    
    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim().length === 0)) {
        errors.push(`${field} is required`);
      }
    }
    
    return errors;
  }

  /**
   * Validate string field with constraints
   * @param {*} value Value to validate
   * @param {string} fieldName Field name for error messages
   * @param {Object} [constraints] Validation constraints
   * @param {number} [constraints.minLength] Minimum length
   * @param {number} [constraints.maxLength] Maximum length
   * @param {boolean} [constraints.required=false] Whether field is required
   * @param {RegExp} [constraints.pattern] Pattern to match
   * @returns {Array<string>} Array of validation error messages
   */
  validateStringField(value, fieldName, constraints = {}) {
    const errors = [];
    const { minLength, maxLength, required = false, pattern } = constraints;
    
    if (required && (!value || typeof value !== 'string' || value.trim().length === 0)) {
      errors.push(`${fieldName} is required`);
      return errors;
    }
    
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        errors.push(`${fieldName} must be a string`);
        return errors;
      }
      
      const trimmedValue = value.trim();
      
      if (minLength && trimmedValue.length < minLength) {
        errors.push(`${fieldName} must be at least ${minLength} characters long`);
      }
      
      if (maxLength && trimmedValue.length > maxLength) {
        errors.push(`${fieldName} must be no more than ${maxLength} characters long`);
      }
      
      if (pattern && !pattern.test(trimmedValue)) {
        errors.push(`${fieldName} format is invalid`);
      }
    }
    
    return errors;
  }

  /**
   * Validate enum field
   * @param {*} value Value to validate
   * @param {string} fieldName Field name for error messages
   * @param {Array} allowedValues Array of allowed values
   * @param {boolean} [required=false] Whether field is required
   * @returns {Array<string>} Array of validation error messages
   */
  validateEnumField(value, fieldName, allowedValues, required = false) {
    const errors = [];
    
    if (required && (value === undefined || value === null || value === '')) {
      errors.push(`${fieldName} is required`);
      return errors;
    }
    
    if (value !== undefined && value !== null && value !== '' && !allowedValues.includes(value)) {
      errors.push(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }
    
    return errors;
  }

  /**
   * Validate integer field with constraints
   * @param {*} value Value to validate
   * @param {string} fieldName Field name for error messages
   * @param {Object} [constraints] Validation constraints
   * @param {number} [constraints.min] Minimum value
   * @param {number} [constraints.max] Maximum value
   * @param {boolean} [constraints.required=false] Whether field is required
   * @returns {Array<string>} Array of validation error messages
   */
  validateIntegerField(value, fieldName, constraints = {}) {
    const errors = [];
    const { min, max, required = false } = constraints;
    
    if (required && (value === undefined || value === null)) {
      errors.push(`${fieldName} is required`);
      return errors;
    }
    
    if (value !== undefined && value !== null) {
      if (!Number.isInteger(value)) {
        errors.push(`${fieldName} must be an integer`);
        return errors;
      }
      
      if (min !== undefined && value < min) {
        errors.push(`${fieldName} must be at least ${min}`);
      }
      
      if (max !== undefined && value > max) {
        errors.push(`${fieldName} must be no more than ${max}`);
      }
    }
    
    return errors;
  }
}

// Export singleton instance
module.exports = new ValidationService();