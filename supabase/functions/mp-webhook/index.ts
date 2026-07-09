import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // --- 1. Optional X-Signature validation ---
    const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')
    if (webhookSecret) {
      const signature = req.headers.get('X-Signature')
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing X-Signature header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      // TODO: Implement full HMAC-SHA256 validation once MP_WEBHOOK_SECRET is available.
      // MercadoPago signs with: ts=<timestamp>,v1=<hmac> where hmac = HMAC-SHA256(data.id + ts + secret)
      // For now, presence of the header is accepted in dev.
      console.log('Webhook signature header present — skipping full HMAC validation (dev mode)')
    } else {
      console.warn(
        'MP_WEBHOOK_SECRET not configured — accepting webhook without signature validation',
      )
    }

    // --- 2. Parse webhook payload ---
    const body = await req.json()
    const { action, data } = body

    if (!action || !data?.id) {
      return new Response(JSON.stringify({ error: 'Invalid payload: action and data.id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // --- 3. Only process preapproval.updated events ---
    if (action !== 'preapproval.updated') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const preapprovalId = data.id

    // --- 4. Fetch preapproval from MercadoPago to get authoritative status ---
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!mpAccessToken) {
      return new Response(JSON.stringify({ error: 'MP_ACCESS_TOKEN not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/preapproval/${preapprovalId}`,
      {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      },
    )

    if (!mpResponse.ok) {
      const mpError = await mpResponse.text()
      console.error('Failed to fetch preapproval from MP:', mpError)
      return new Response(JSON.stringify({ error: 'Failed to fetch preapproval from MP' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const preapproval = await mpResponse.json()

    // --- 5. Parse external_reference to identify user and plan ---
    // Format: sub_{user_id}_{plan_id}
    // Both user_id and plan_id are UUIDs (no underscores), so split('_') yields 3 parts
    const externalReference: string | undefined = preapproval.external_reference
    if (!externalReference || !externalReference.startsWith('sub_')) {
      console.error('Invalid or missing external_reference:', externalReference)
      return new Response(JSON.stringify({ error: 'Invalid external_reference' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const parts = externalReference.split('_')
    if (parts.length !== 3) {
      console.error('Unexpected external_reference format:', externalReference)
      return new Response(JSON.stringify({ error: 'Invalid external_reference format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const [, userId, planId] = parts

    // --- 6. Process status change ---
    const mpStatus: string = preapproval.status

    if (mpStatus === 'authorized') {
      // Fetch plan details to get slug and listing_priority
      const { data: plan } = await supabaseAdmin
        .from('subscription_plans')
        .select('slug, listing_priority')
        .eq('id', planId)
        .single()

      // Upsert subscription idempotently via mp_preapproval_id UNIQUE constraint
      const { error: upsertError } = await supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            plan_id: planId,
            mp_preapproval_id: preapprovalId,
            external_reference: externalReference,
            status: 'active',
            started_at: preapproval.date_created,
            expires_at: preapproval.next_billing_date,
          },
          { onConflict: 'mp_preapproval_id' },
        )

      if (upsertError) {
        console.error('Failed to upsert subscription:', upsertError)
        return new Response(JSON.stringify({ error: 'Database error during upsert' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Update profile with subscription level and expiration
      if (plan?.slug) {
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_type: plan.slug,
            subscription_expires_at: preapproval.next_billing_date,
          })
          .eq('id', userId)
      }

      // Feature all user's listings
      const priority = plan?.listing_priority ?? 1
      await supabaseAdmin
        .from('listings')
        .update({ is_featured: true, listing_priority: priority })
        .eq('user_id', userId)

      console.log(`Subscription authorized: user=${userId} plan=${planId} mp_id=${preapprovalId}`)
    } else if (mpStatus === 'cancelled') {
      // Update subscription status
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('mp_preapproval_id', preapprovalId)

      // Unfeature all user's listings
      await supabaseAdmin
        .from('listings')
        .update({ is_featured: false, listing_priority: 0 })
        .eq('user_id', userId)

      // Reset profile subscription
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_type: 'none', subscription_expires_at: null })
        .eq('id', userId)

      console.log(`Subscription cancelled: user=${userId} mp_id=${preapprovalId}`)
    } else if (mpStatus === 'expired') {
      // Update subscription status
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('mp_preapproval_id', preapprovalId)

      // Unfeature all user's listings
      await supabaseAdmin
        .from('listings')
        .update({ is_featured: false, listing_priority: 0 })
        .eq('user_id', userId)

      // Reset profile subscription
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_type: 'none', subscription_expires_at: null })
        .eq('id', userId)

      console.log(`Subscription expired: user=${userId} mp_id=${preapprovalId}`)
    } else {
      console.log(`Unhandled preapproval status: ${mpStatus} for id=${preapprovalId}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('mp-webhook error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
