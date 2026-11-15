import { parsePhoneNumberFromString } from 'libphonenumber-js';

const CALLING_CODE_TO_REGION = {
  '91': 'IN',
  '1': 'US',
  '44': 'GB',
  '971': 'AE',
  '65': 'SG',
  '61': 'AU',
};

/**
 * Removes duplicate country code prefixes.
 * e.g., If calling code is '91' and phone is '91919876543210' or '+91 919876543210',
 * it strips the redundant '91' prefix.
 */
export function cleanDuplicateCountryCode(rawPhone = '', selectorCode = '91') {
  if (!rawPhone) return '';
  let str = String(rawPhone).trim();
  const callingCodeDigits = String(selectorCode || '91').replace(/\D/g, '');
  const digitsOnly = str.replace(/\D/g, '');

  if (callingCodeDigits && digitsOnly.startsWith(callingCodeDigits + callingCodeDigits)) {
    const stripped = digitsOnly.slice(callingCodeDigits.length);
    return `+${stripped}`;
  }

  return str;
}

/**
 * Validates and formats customer phone number for international WhatsApp Click-to-Chat.
 */
export function validateAndFormatCustomerPhone(rawPhone = '', selectorCode = '+91') {
  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return {
      isValid: false,
      internationalDigits: '',
      e164: '',
      country: null,
      formatted: '',
      error: 'Enter a valid customer WhatsApp number with country code.',
      code: 'REQUIRED',
    };
  }

  // Reject alphabetical characters or invalid phone symbols
  if (/[a-zA-Z]/.test(rawPhone) || /[^\d+\s\-().]/.test(rawPhone)) {
    return {
      isValid: false,
      internationalDigits: '',
      e164: '',
      country: null,
      formatted: '',
      error: 'Enter a valid customer WhatsApp number with country code.',
      code: 'INVALID_PHONE',
    };
  }

  const trimmed = rawPhone.trim();
  if (trimmed.indexOf('+', 1) > 0 || (trimmed.match(/\+/g) || []).length > 1) {
    return {
      isValid: false,
      internationalDigits: '',
      e164: '',
      country: null,
      formatted: '',
      error: 'Enter a valid customer WhatsApp number with country code.',
      code: 'INVALID_PHONE',
    };
  }

  const callingCodeDigits = String(selectorCode || '91').replace(/\D/g, '');
  const defaultRegion = CALLING_CODE_TO_REGION[callingCodeDigits] || 'IN';

  // 1. Clean any duplicated country code
  let cleanInput = cleanDuplicateCountryCode(rawPhone, callingCodeDigits);

  // 2. Normalize domestic trunk prefix 0 (e.g. 09876543210 in India -> 9876543210)
  const digitsOnly = cleanInput.replace(/\D/g, '');
  if (cleanInput.startsWith('0') && !cleanInput.startsWith('00') && digitsOnly.length === 11 && defaultRegion === 'IN') {
    cleanInput = digitsOnly.slice(1);
  }

  // 3. Attempt parsing with libphonenumber-js
  let phoneNumber = parsePhoneNumberFromString(cleanInput, defaultRegion);

  // If not parsed and does not start with '+', try prefixing with '+' or calling code
  if (!phoneNumber) {
    if (cleanInput.startsWith('+')) {
      phoneNumber = parsePhoneNumberFromString(cleanInput);
    } else if (cleanInput.startsWith('00')) {
      phoneNumber = parsePhoneNumberFromString('+' + cleanInput.replace(/^00+/, ''));
    } else {
      phoneNumber = parsePhoneNumberFromString(`+${callingCodeDigits}${cleanInput}`, defaultRegion);
    }
  }

  // 4. Fallback for 10-digit Indian numbers (starting with 6, 7, 8, 9)
  if ((!phoneNumber || !phoneNumber.isValid()) && defaultRegion === 'IN') {
    const rawDigits = cleanInput.replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(rawDigits)) {
      phoneNumber = parsePhoneNumberFromString(`+91${rawDigits}`, 'IN');
    }
  }

  // 5. Final validation check
  if (phoneNumber && phoneNumber.isValid()) {
    const internationalDigitsOnly = phoneNumber.number.replace('+', '');
    return {
      isValid: true,
      internationalDigits: internationalDigitsOnly,
      e164: phoneNumber.number,
      country: phoneNumber.country || defaultRegion,
      formatted: phoneNumber.formatInternational(),
      error: null,
      code: null,
    };
  }

  return {
    isValid: false,
    internationalDigits: '',
    e164: '',
    country: null,
    formatted: '',
    error: 'Enter a valid customer WhatsApp number with country code.',
    code: 'INVALID_PHONE',
  };
}

