/*
# Update feature_listing RPC — featured_used counter + auto-reset

Replaces the RPC from 000001 with new logic:
- Checks featured_used against max_featured per billing period
- Auto-resets featured_used if period_start + featured_duration_days has passed
- No longer depends on expires_at (status = 'active' is sufficient)
*/

CREATE OR REPLACE FUNCTION feature_listing(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing record;
  r record;
  v_new_featured_until timestamptz;
  v_featured_used int;
BEGIN
  -- 1. Caller must be authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- 2. Verify ownership
  SELECT id INTO v_listing
  FROM listings
  WHERE id = p_listing_id AND user_id = v_uid;

  IF v_listing IS NULL THEN
    RAISE EXCEPTION 'No sos el dueño de este aviso';
  END IF;

  -- 3. Fetch active subscription + plan (single join)
  SELECT
    s.id AS sub_id,
    s.featured_used,
    s.period_start,
    sp.listing_priority,
    sp.max_featured,
    sp.featured_duration_days
  INTO r
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.user_id = v_uid
    AND s.status = 'active';

  IF r IS NULL THEN
    RAISE EXCEPTION 'No tenés un plan activo';
  END IF;

  -- 4. Auto-reset: if the billing period has passed, reset the counter
  v_featured_used := r.featured_used;
  IF r.period_start + (r.featured_duration_days || ' days')::interval < now() THEN
    v_featured_used := 0;
    UPDATE subscriptions
    SET featured_used = 0,
        period_start = now()
    WHERE id = r.sub_id;
  END IF;

  -- 5. Validate limit
  IF v_featured_used >= r.max_featured THEN
    RAISE EXCEPTION 'Llegaste al límite de avisos destacados de este período (máximo %)', r.max_featured;
  END IF;

  -- 6. Increment counter
  UPDATE subscriptions
  SET featured_used = featured_used + 1
  WHERE id = r.sub_id;

  -- 7. Calculate featured_until
  v_new_featured_until := now() + (r.featured_duration_days || ' days')::interval;

  -- 8. Bypass trigger via GUC and update listing
  PERFORM set_config('app.allow_featured_write', 'true', true);

  UPDATE listings
  SET is_featured = true,
      listing_priority = r.listing_priority,
      featured_until = v_new_featured_until
  WHERE id = p_listing_id;

  -- 9. Return success
  RETURN jsonb_build_object(
    'ok', true,
    'listing_priority', r.listing_priority,
    'featured_until', v_new_featured_until,
    'featured_used', v_featured_used + 1,
    'max_featured', r.max_featured
  );
END;
$$;
