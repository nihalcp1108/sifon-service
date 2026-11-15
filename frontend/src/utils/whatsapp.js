import { validateAndFormatCustomerPhone, cleanDuplicateCountryCode } from './phoneValidator';

export { validateAndFormatCustomerPhone, cleanDuplicateCountryCode };

export const SUPPORTED_COUNTRY_CODES = [
  { code: '+91', country: 'IN', label: '+91 (India)' },
  { code: '+1', country: 'US', label: '+1 (US / Canada)' },
  { code: '+44', country: 'GB', label: '+44 (UK)' },
  { code: '+971', country: 'AE', label: '+971 (UAE)' },
  { code: '+65', country: 'SG', label: '+65 (Singapore)' },
  { code: '+61', country: 'AU', label: '+61 (Australia)' },
];

/**
 * Normalizes an international phone number to digits only for WhatsApp wa.me links.
 */
export function formatInternationalDigits(phone = '', defaultCountryCode = '+91') {
  if (!phone) return '';
  const result = validateAndFormatCustomerPhone(phone, defaultCountryCode);
  if (result.isValid && result.internationalDigits) {
    return result.internationalDigits;
  }
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.replace(/^00+/, '');
  if (digits.startsWith('0') && digits.length > 10) digits = digits.replace(/^0+/, '');
  if (digits.length === 10 && defaultCountryCode) {
    digits = `${String(defaultCountryCode).replace(/\D/g, '')}${digits}`;
  }
  return digits;
}

/**
 * Validates international digits for WhatsApp.
 */
export function isValidInternationalDigits(digits = '', defaultCountryCode = '+91') {
  if (!digits) return false;
  const result = validateAndFormatCustomerPhone(digits, defaultCountryCode);
  return result.isValid;
}

/**
 * Resolves template placeholders with complaint data, providing graceful fallbacks
 * for missing optional fields without ever producing "undefined".
 */
export function renderComplaintMessage(template = '', complaint = {}, companyName = 'sifon-service') {
  const defaultTemplate =
    template ||
    'Hello {{customer_name}}, your complaint #{{complaint_id}} for {{brand_name}} {{product_name}} has been registered with {{company_name}}. Current status: {{status}}.';

  const values = {
    customer_name: complaint.customerName || 'Customer',
    complaint_id: complaint.complaintNumber || 'N/A',
    brand_name: complaint.brand?.name || complaint.brandNameSnapshot || 'Not assigned',
    category_name: complaint.category?.name || complaint.categoryNameSnapshot || 'Not assigned',
    product_name: complaint.productName || 'N/A',
    servicer_name: complaint.assignedServicer?.name || complaint.servicerNameSnapshot || 'Unassigned',
    status: complaint.status || 'Registered',
    registered_date: complaint.complaintDate ? new Date(complaint.complaintDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
    company_name: companyName || 'sifon-service',
  };

  let rendered = defaultTemplate;
  for (const [key, val] of Object.entries(values)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, val !== undefined && val !== null && val !== '' ? String(val) : 'N/A');
  }

  // Replace any unmatched or unknown {{placeholder}} with 'N/A' to strictly avoid 'undefined'
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, 'N/A');

  return rendered;
}

/**
 * Builds the official wa.me link:
 * https://wa.me/{internationalDigitsOnly}?text={encodedMessage}
 *
 * Returns distinct error reasons:
 * - 'DISABLED': Click-to-chat disabled in settings
 * - 'INVALID_PHONE': Customer phone number could not be validated
 */
export function getWhatsAppClickToChatUrl(
  phone,
  template = '',
  complaint = {},
  companyName = 'sifon-service',
  selectorCode = '+91',
  isClickToChatEnabled = true
) {
  if (isClickToChatEnabled === false) {
    return {
      url: '',
      digits: '',
      formattedPhone: '',
      message: '',
      encoded: '',
      isValid: false,
      reason: 'DISABLED',
      error: 'Enable WhatsApp click-to-chat in Account Settings.',
    };
  }

  const phoneValidation = validateAndFormatCustomerPhone(phone, selectorCode);
  if (!phoneValidation.isValid) {
    return {
      url: '',
      digits: '',
      formattedPhone: '',
      message: '',
      encoded: '',
      isValid: false,
      reason: 'INVALID_PHONE',
      error: phoneValidation.error || 'Enter a valid customer WhatsApp number with country code.',
    };
  }

  const message = renderComplaintMessage(template, complaint, companyName);
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${phoneValidation.internationalDigits}?text=${encoded}`;

  return {
    url,
    digits: phoneValidation.internationalDigits,
    formattedPhone: phoneValidation.formatted,
    message,
    encoded,
    isValid: true,
    reason: null,
    error: null,
  };
}
