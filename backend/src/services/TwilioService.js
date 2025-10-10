/**
 * Twilio Service
 * Centralizes Twilio client initialization and common operations
 * Copied from gobi-main project with minor adaptations
 */

const logger = require('../utils/logger');

class TwilioService {
  constructor() {
    this._client = null;
  }

  /**
   * Get initialized Twilio client
   * @returns {import('twilio').Twilio} Twilio client instance
   * @throws {Error} If Twilio credentials are not configured
   */
  getClient() {
    if (!this._client) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials are required in environment variables');
      }

      const twilio = require('twilio');
      this._client = twilio(accountSid, authToken);
    }

    return this._client;
  }

  /**
   * Check if Twilio is properly configured
   * @returns {boolean} True if credentials are available
   */
  isConfigured() {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  }

  /**
   * Create an Elastic SIP Trunk
   * @param {Object} options Trunk configuration options
   * @param {string} options.friendlyName Friendly name for the trunk
   * @param {string} options.domainName Domain name for the trunk
   * @param {boolean} [options.cnamLookupEnabled=true] Enable CNAM lookup
   * @param {boolean} [options.recordingEnabled=false] Enable recording
   * @param {boolean} [options.secure=true] Use secure connection
   * @param {string} [options.transferMode='enable-all'] Transfer mode
   * @returns {Promise<Object>} Created trunk information
   */
  async createElasticSipTrunk(options) {
    const client = this.getClient();

    const {
      friendlyName,
      domainName,
      cnamLookupEnabled = true,
      recordingEnabled = false,
      secure = true,
      transferMode = 'enable-all',
    } = options;

    logger.info(`Creating Twilio Elastic SIP Trunk: ${friendlyName}`, {
      domainName,
    });

    const trunk = await client.trunking.v1.trunks.create({
      friendlyName,
      domainName,
      cnamLookupEnabled,
      recordingEnabled,
      secure,
      transferMode,
    });

    logger.info(`Twilio trunk created successfully`, {
      sid: trunk.sid,
      domainName: trunk.domainName,
    });

    return trunk;
  }

  /**
   * Create origination URL for a trunk
   * @param {Object} trunk Twilio trunk instance
   * @param {Object} options Origination URL options
   * @param {string} options.friendlyName Friendly name for the URL
   * @param {string} options.sipUrl SIP URL
   * @param {boolean} [options.enabled=true] Enable the URL
   * @param {number} [options.weight=10] Weight for load balancing
   * @param {number} [options.priority=10] Priority for routing
   * @returns {Promise<Object>} Created origination URL information
   */
  async createOriginationUrl(trunk, options) {
    const {
      friendlyName,
      sipUrl,
      enabled = true,
      weight = 10,
      priority = 10,
    } = options;

    logger.info(`Creating origination URL for trunk: ${trunk.sid}`, {
      sipUrl,
    });

    const originationUrl = await trunk.originationUrls().create({
      friendlyName,
      enabled,
      sipUrl,
      weight,
      priority,
    });

    logger.info(`Origination URL created successfully`, {
      sid: originationUrl.sid,
      sipUrl: originationUrl.sipUrl,
    });

    return originationUrl;
  }

  /**
   * Delete a SIP trunk
   * @param {string} trunkSid Trunk SID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteTrunk(trunkSid) {
    const client = this.getClient();

    logger.info(`Deleting Twilio trunk: ${trunkSid}`);

    await client.trunking.v1.trunks(trunkSid).remove();

    logger.info(`Twilio trunk deleted successfully: ${trunkSid}`);

    return true;
  }

  /**
   * Purchase a phone number from Twilio
   * @param {Object} options Purchase options
   * @param {string} options.phoneNumber Phone number to purchase (E.164 format)
   * @param {string} options.friendlyName Friendly name for the phone number
   * @param {string} [options.trunkSid] Optional trunk SID to associate with
   * @returns {Promise<Object>} Purchased phone number information
   */
  async purchasePhoneNumber(options) {
    const client = this.getClient();

    const purchaseParams = {
      phoneNumber: options.phoneNumber,
      friendlyName: options.friendlyName,
    };

    // Include trunkSid if provided to automatically associate with the Twilio trunk
    if (options.trunkSid) {
      purchaseParams.trunkSid = options.trunkSid;
    }

    logger.info(`Purchasing phone number: ${options.phoneNumber}`, {
      friendlyName: options.friendlyName,
      trunkSid: options.trunkSid || 'none',
    });

    const result = await client.incomingPhoneNumbers.create(purchaseParams);

    logger.info(`Phone number purchased successfully`, {
      phoneNumber: result.phoneNumber,
      sid: result.sid,
    });

    return result;
  }

  /**
   * Search for available phone numbers
   * @param {Object} searchParams Search parameters
   * @param {string} [searchParams.country='US'] Country code
   * @param {string} searchParams.type Number type (LOCAL, MOBILE, TOLL_FREE)
   * @param {string} [searchParams.areaCode] Area code to search for
   * @param {string} [searchParams.contains] Digits that the number should contain
   * @param {number} [searchParams.limit=20] Maximum number of results
   * @returns {Promise<Array>} Available phone numbers
   */
  async searchAvailableNumbers(searchParams) {
    const client = this.getClient();

    const {
      country = 'US',
      type,
      areaCode,
      contains,
      limit = 20
    } = searchParams;

    const searchOptions = {
      limit: Math.min(50, Math.max(1, limit)),
      ...(areaCode && { areaCode }),
      ...(contains && { contains })
    };

    let availableNumbers = [];

    if (type === 'TOLL_FREE') {
      availableNumbers = await client.availablePhoneNumbers(country)
        .tollFree
        .list(searchOptions);
    } else if (type === 'MOBILE') {
      availableNumbers = await client.availablePhoneNumbers(country)
        .mobile
        .list(searchOptions);
    } else {
      // LOCAL or default
      availableNumbers = await client.availablePhoneNumbers(country)
        .local
        .list(searchOptions);
    }

    logger.info(`Found ${availableNumbers.length} available phone numbers`, {
      country,
      type,
      areaCode,
    });

    return availableNumbers;
  }

  /**
   * Release a phone number from Twilio
   * @param {string} phoneNumberSid Phone number SID to release
   * @returns {Promise<boolean>} True if released successfully
   */
  async releasePhoneNumber(phoneNumberSid) {
    const client = this.getClient();

    logger.info(`Releasing phone number: ${phoneNumberSid}`);

    await client.incomingPhoneNumbers(phoneNumberSid).remove();

    logger.info(`Phone number released successfully: ${phoneNumberSid}`);

    return true;
  }

  /**
   * Handle Twilio errors and provide user-friendly error codes
   * @param {Error} error Twilio error
   * @returns {Object} Formatted error information
   */
  handleTwilioError(error) {
    let errorMessage = 'Failed to perform Twilio operation';
    let errorCode = 'TWILIO_ERROR';

    if (error.code === 21452) {
      errorMessage = 'Phone number is no longer available for purchase';
      errorCode = 'NUMBER_NOT_AVAILABLE';
    } else if (error.code === 21421) {
      errorMessage = 'Invalid phone number format';
      errorCode = 'INVALID_PHONE_NUMBER';
    } else if (error.code === 20003) {
      errorMessage = 'Authentication failed - check Twilio credentials';
      errorCode = 'TWILIO_AUTH_ERROR';
    } else if (error.code === 20404) {
      errorMessage = 'Phone number not found in Twilio account';
      errorCode = 'NUMBER_NOT_FOUND';
    }

    return {
      message: errorMessage,
      code: errorCode,
      details: error.message,
      twilioCode: error.code,
    };
  }
}

// Export singleton instance
module.exports = new TwilioService();
