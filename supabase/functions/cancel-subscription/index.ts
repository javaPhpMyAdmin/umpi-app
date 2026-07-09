import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
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
    // --- 1. Validate JWT and get user ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // --- 2. Get user's active subscription ---
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: 'No se encontró una suscripción activa' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // --- 3. Call MercadoPago API to cancel preapproval ---
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!mpAccessToken) {
      return new Response(JSON.stringify({ error: 'MP_ACCESS_TOKEN not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const preapprovalId = subscription.mp_preapproval_id
    if (!preapprovalId) {
      return new Response(JSON.stringify({ error: 'No se encontró el ID de preaprobación en MP' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/preapproval/${preapprovalId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      },
    )

    if (!mpResponse.ok) {
      const mpError = await mpResponse.text()
      console.error('MP API cancel error:', mpError)
      return new Response(JSON.stringify({ error: 'Error al cancelar en MercadoPago' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // --- 4. Update local DB (only after successful MP cancellation) ---
    // Update subscription status to cancelled
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subscription.id)

    // Unfeature all user's listings
    await supabaseAdmin
      .from('listings')
      .update({ is_featured: false, listing_priority: 0 })
      .eq('user_id', user.id)

    // Reset profile subscription
    await supabaseAdmin
      .from('profiles')
      .update({ subscription_type: 'none', subscription_expires_at: null })
      .eq('id', user.id)

    console.log(`Subscription cancelled: user=${user.id} mp_id=${preapprovalId}`)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('cancel-subscription error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
