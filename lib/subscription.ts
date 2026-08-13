import type { Profile, SubscriptionPlan } from '../types'

// ─── Plan limits — source of truth: `subscription_plans` table (DB) ────────
// Limits are read from the `subscription_plans` table via
// `useSubscriptionPlans()` and passed down to the getters below.
//
// The static values in DEFAULT_LIMITS are an EMERGENCY FALLBACK only, used
// while the plans query is loading or fails (e.g. no connectivity). They
// intentionally drift from the DB — do not treat them as the source of truth.
const DEFAULT_LIMITS = {
  premium: { maxImages: 20, maxFeatured: 10 },
  estandar: { maxImages: 10, maxFeatured: 1 },
} as const

const DEFAULT_FREE_LIMITS = { maxImages: 3, maxFeatured: 0 }

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
  // Paid plan wins over trial — mirrors the server-side guard (misma lógica
  // que la web src/lib/subscription.ts): el server aplica el plan pagado,
  // así que la UI debe mostrar lo mismo. Trial solo si no hay plan pago.
  if (hasPaidPlan(profile)) {
    return (profile.subscription_type as PlanSlug) || 'none'
  }
  if (isInTrial(profile)) return 'premium'
  return 'none'
}

// ─── Limit getters (DB-first) ───────────────────────────────────────────────

/**
 * Resolves the limits for a plan slug against the active plans read from the
 * `subscription_plans` table (via `useSubscriptionPlans`).
 *
 * Slug matching es case-insensitive y con trim (normalización defensiva):
 * los slugs de la tabla `subscription_plans` son `estandar` y `premium`.
 *
 * FAIL-LOUD: si el slug es de un plan pago/no-free y ningún plan activo lo
 * matchea, un usuario pagador degradaría a límites free en silencio. En ese
 * caso se loguea un warning claro (slug buscado + slugs disponibles) y se
 * devuelven los límites del plan pagado más alto de la lista como fallback
 * conservador — NUNCA free.
 *
 * Falls back to the emergency static limits when:
 * - `plans` is undefined/null (query loading or failed)
 * - the slug is not found and there are no active plans to fall back to
 */
export function getLimitsForPlan(
  planSlug: string | null | undefined,
  plans: SubscriptionPlan[] | null | undefined,
): { maxImages: number; maxFeatured: number } {
  const target = planSlug?.trim().toLowerCase()

  if (target && plans && plans.length > 0) {
    const plan = plans.find((p) => p.slug.trim().toLowerCase() === target)
    if (plan) return { maxImages: plan.max_images, maxFeatured: plan.max_featured }

    // Fail-loud: slug pago sin match en la lista de planes activos
    if (target !== 'none' && target !== 'free') {
      console.warn(
        `[subscription] Plan slug "${planSlug}" no matchea ningún plan activo de subscription_plans. ` +
          `Slugs disponibles: ${plans.map((p) => `"${p.slug}"`).join(', ')}. ` +
          'Usando límites del plan pagado más alto como fallback conservador (nunca free).'
      )
      const highest = plans.reduce<SubscriptionPlan | null>((best, p) =>
        best === null || p.max_images > best.max_images ? p : best, null)
      if (highest) return { maxImages: highest.max_images, maxFeatured: highest.max_featured }
    }
  }

  // Emergency fallback (DB unreachable or plan missing) — see header comment.
  if (target && target !== 'none') {
    const fallback = DEFAULT_LIMITS[target as keyof typeof DEFAULT_LIMITS]
    if (fallback) return fallback
  }
  return DEFAULT_FREE_LIMITS
}

/**
 * Max images per listing based on effective plan and the plans from the DB.
 * Pass `plans` from `useSubscriptionPlans()`; when omitted (callers outside
 * the React tree or before the query resolves) the emergency fallback applies.
 */
export function getMaxImages(
  profile: Profile | null | undefined,
  plans?: SubscriptionPlan[] | null,
): number {
  return getLimitsForPlan(getEffectivePlan(profile), plans).maxImages
}

/**
 * Max featured listings per billing period, from the DB plans.
 * Same fallback semantics as `getMaxImages`.
 */
export function getMaxFeatured(
  profile: Profile | null | undefined,
  plans?: SubscriptionPlan[] | null,
): number {
  return getLimitsForPlan(getEffectivePlan(profile), plans).maxFeatured
}

export function getTrialDaysLeft(profile: Profile | null | undefined): number | null {
  if (!isInTrial(profile) || !profile?.trial_ends_at) return null
  return Math.max(0, Math.ceil(
    (new Date(profile.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ))
}
