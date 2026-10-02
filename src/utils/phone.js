/**
 * Comprehensive Phone, Email and Name validation & normalization utility
 */

export const isValidFullName = (name = '') => {
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 100) return false
  // Must contain at least one letter (a-z, A-Z, unicode letters)
  return /[\p{L}]/u.test(trimmed)
}

export const isValidEmail = (email = '') => {
  if (typeof email !== 'string') return false
  const trimmed = email.trim()
  if (!trimmed || trimmed.length > 254) return false
  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
  return emailRegex.test(trimmed)
}

export const normalizePhoneNumber = (value = '') => {
  if (typeof value !== 'string') return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  const digitsOnly = trimmed.replace(/\D/g, '')
  if (!digitsOnly) return ''

  // Already has international 234 prefix
  if (digitsOnly.startsWith('234') && digitsOnly.length >= 12) {
    return `+${digitsOnly}`
  }

  // Nigerian national format (e.g. 08012345678)
  if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
    return `+234${digitsOnly.slice(1)}`
  }

  // 10 digits without leading zero (e.g. 8012345678, 7012345678, 9012345678)
  if (digitsOnly.length === 10 && ['7', '8', '9', '1', '2'].includes(digitsOnly.charAt(0))) {
    return `+234${digitsOnly}`
  }

  // If user provided a '+' with international code (10-15 digits)
  if (trimmed.startsWith('+') && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return `+${digitsOnly}`
  }

  // Fallback for other standard length digit inputs
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return `+234${digitsOnly.slice(1)}`
  }

  if (digitsOnly.length === 10) {
    return `+234${digitsOnly}`
  }

  if (digitsOnly.length === 13 && digitsOnly.startsWith('234')) {
    return `+${digitsOnly}`
  }

  return `+${digitsOnly}`
}

export const validatePhoneNumber = (value = '') => {
  if (typeof value !== 'string' || !value.trim()) {
    return { valid: false, error: 'Phone number is required' }
  }

  const trimmed = value.trim()
  const digitsOnly = trimmed.replace(/\D/g, '')

  if (!digitsOnly || digitsOnly.length < 10) {
    return { valid: false, error: 'Please enter a valid phone number (at least 10 digits)' }
  }

  if (digitsOnly.length > 15) {
    return { valid: false, error: 'Phone number is too long (maximum 15 digits)' }
  }

  // Nigerian numbers validation
  if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
    const prefix = digitsOnly.slice(0, 3)
    // Valid Nigerian mobile prefixes (070, 071, 080, 081, 090, 091, etc.)
    return { valid: true, normalized: `+234${digitsOnly.slice(1)}` }
  }

  if (digitsOnly.startsWith('234') && digitsOnly.length === 13) {
    return { valid: true, normalized: `+${digitsOnly}` }
  }

  if (digitsOnly.length === 10 && ['7', '8', '9'].includes(digitsOnly.charAt(0))) {
    return { valid: true, normalized: `+234${digitsOnly}` }
  }

  // International format starting with '+' or valid length
  if (trimmed.startsWith('+') && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return { valid: true, normalized: `+${digitsOnly}` }
  }

  if (digitsOnly.length >= 10 && digitsOnly.length <= 14) {
    return { valid: true, normalized: normalizePhoneNumber(trimmed) }
  }

  return { valid: false, error: 'Invalid phone number format (e.g. 08012345678)' }
}

export const isValidPhoneNumber = (value = '') => {
  return validatePhoneNumber(value).valid
}

export const getPhoneDigits = (value = '') => {
  const norm = normalizePhoneNumber(value)
  return norm ? norm.replace(/\D/g, '') : ''
}

export const formatPhoneDisplay = (value = '') => {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return value
}
