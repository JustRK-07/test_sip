const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const PNF = require('google-libphonenumber').PhoneNumberFormat;

/**
 * Validate a phone number
 * @param {string} phoneNumber - The phone number to validate
 * @param {string} countryCode - Default country code (default: 'US')
 * @returns {boolean} - Whether the phone number is valid
 */
const validatePhoneNumber = (phoneNumber, countryCode = 'US') => {
  try {
    const number = phoneUtil.parseAndKeepRawInput(phoneNumber, countryCode);
    return phoneUtil.isValidNumber(number);
  } catch (error) {
    return false;
  }
};

/**
 * Format a phone number to E.164 format
 * @param {string} phoneNumber - The phone number to format
 * @param {string} countryCode - Default country code (default: 'US')
 * @returns {string} - Formatted phone number in E.164 format (e.g., "+17048134431")
 */
const formatPhoneNumber = (phoneNumber, countryCode = 'US') => {
  try {
    const number = phoneUtil.parseAndKeepRawInput(phoneNumber, countryCode);
    if (phoneUtil.isValidNumber(number)) {
      return phoneUtil.format(number, PNF.E164);
    }
    return phoneNumber; // Return original if formatting fails
  } catch (error) {
    return phoneNumber;
  }
};

/**
 * Get phone number type (mobile, fixed line, etc.)
 * @param {string} phoneNumber - The phone number to check
 * @param {string} countryCode - Default country code (default: 'US')
 * @returns {string} - Phone number type
 */
const getPhoneNumberType = (phoneNumber, countryCode = 'US') => {
  try {
    const number = phoneUtil.parseAndKeepRawInput(phoneNumber, countryCode);
    const type = phoneUtil.getNumberType(number);
    
    const typeMap = {
      0: 'FIXED_LINE',
      1: 'MOBILE',
      2: 'FIXED_LINE_OR_MOBILE',
      3: 'TOLL_FREE',
      4: 'PREMIUM_RATE',
      5: 'SHARED_COST',
      6: 'VOIP',
      7: 'PERSONAL_NUMBER',
      8: 'PAGER',
      9: 'UAN',
      10: 'VOICEMAIL',
      11: 'UNKNOWN'
    };
    
    return typeMap[type] || 'UNKNOWN';
  } catch (error) {
    return 'UNKNOWN';
  }
};

module.exports = {
  validatePhoneNumber,
  formatPhoneNumber,
  getPhoneNumberType
};