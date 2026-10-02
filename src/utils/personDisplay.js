import { getCache } from '../services/cacheService'

/**
 * Resolves the friendly display name for a person/beneficiary
 */
export function getPersonDisplayName(person, beneficiariesList = null) {
  if (!person) return 'Family Member'
  const cached = getCache('beneficiaries')
  const list = beneficiariesList || (Array.isArray(cached) ? cached : cached?.data) || (typeof window !== 'undefined' ? (getCache('beneficiaries')?.data || []) : []) || []
  if (Array.isArray(list) && list.length > 0) {
    const normPersonPhone = person.phone ? person.phone.replace(/\D/g, '').slice(-10) : ''
    const match = list.find(b => {
      if (b.registered_user_id && person.id && b.registered_user_id === person.id) return true
      if (b.id && (b.id === person.id || b.id === person.beneficiary_id || b.id === person.user_id)) return true
      if (b.user_id && (b.user_id === person.id || b.user_id === person.beneficiary_id || b.user_id === person.user_id)) return true
      if (b.phone && normPersonPhone) {
        const normBPhone = b.phone.replace(/\D/g, '').slice(-10)
        if (normBPhone && normBPhone === normPersonPhone) return true
      }
      return false
    })
    if (match) {
      if (match.nickname) return match.nickname
      if (match.name) return match.name
      if (match.full_name) return match.full_name
      if (match.relationship) return `${match.relationship} (${person.name || person.full_name || 'Member'})`
    }
  }
  return person.custom_name || person.nickname || person.name || person.full_name || person.targetName || person.phone || 'Family Member'
}
