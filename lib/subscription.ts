import type { Profile } from '../types'

// ─── Plan limits (matching subscription_plans table) ────────────────────────
const PLAN_LIMITS = {
  premium: { maxImages: 20, maxFeatured: 10 },
  estandar: { maxImages: 10, maxFeatured: 1 },
} as const

const DEFAULT_LIMITS = { maxImages: 3, maxFeatured: 0 }

// ─── Core checks ───────────────────────────────────────────────────────────

/**
 * Returns true if the user has active benefits (trial OR paid plan).
 */
export function hasActiveBenefits(profile: Profile | null | undefined): boolean {
  if (!profile) return false

  if (
    profile.subscription_status === 'trial' &&
    profile.trial_ends_at &&
    new Date(profile.trial_ends_at) > new Date()
  ) return true

  if (
    profile.subscription_type &&
    profile.subscription_type !== '' &&
    profile.subscription_type !== 'none' &&
    (!profile.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date())
  ) return true

  return false
}

export function hasPaidPlan(profile: Profile | null | undefined): boolean {
  if (!profile) return false
  return (
    profile.subscription_type != null &&
    profile.subscription_type !== '' &&
    profile.subscription_type !== 'none' &&
    (!profile.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date())
  )
}

export function isInTrial(profile: Profile | null | undefined): boolean {
  if (!profile) return false
  return (
    profile.subscription_status === 'trial' &&
    profile.trial_ends_at != null &&
    new Date(profile.trial_ends_at) > new Date()
  )
}

// ─── Effective plan resolution ──────────────────────────────────────────────

type PlanSlug = 'premium' | 'estandar' | 'none'

export function getEffectivePlan(profile: Profile | null | undefined): PlanSlug {
  if (!profile) return 'none'
  if (isInTrial(profile)) return 'premium'
  if (hasPaidPlan(profile)) {
    return (profile.subscription_type as PlanSlug) || 'none'
  }
  return 'none'
}

// ─── Limit getters ──────────────────────────────────────────────────────────

export function getMaxImages(profile: Profile | null | undefined): number {
  const plan = getEffectivePlan(profile)
  return PLAN_LIMITS[plan]?.maxImages ?? DEFAULT_LIMITS.maxImages
}

export function getMaxFeatured(profile: Profile | null | undefined): number {
  const plan = getEffectivePlan(profile)
  return PLAN_LIMITS[plan]?.maxFeatured ?? DEFAULT_LIMITS.maxFeatured
}

export function getTrialDaysLeft(profile: Profile | null | undefined): number | null {
  if (!isInTrial(profile) || !profile?.trial_ends_at) return null
  return Math.max(0, Math.ceil(
    (new Date(profile.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ))
}
