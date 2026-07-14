/*
# Feature Listing RPC + Trigger GUC Bypass

1. Modifies `prevent_direct_featured_write` trigger to respect GUC bypass
2. Creates `feature_listing(uuid)` SECURITY DEFINER RPC

The trigger now checks `current_setting('app.allow_featured_write', true)`.
If it returns 'true', the trigger allows the write (used by the RPC).
Otherwise, it blocks client-side writes as before.

The RPC:
  - Verifies caller owns the listing
  - Validates active subscription
  - Counts current featured listings vs plan limit
  - Sets is_featured, listing_priority, featured_until atomically

Run in: Supabase Dashboard SQL Editor
Idempotent: yes
*/

-- ============================================================
-- 1. Update trigger to support GUC-based bypass
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_direct_featured_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF current_setting('app.allow_featured_write', true) = 'true' THEN
      -- Bypass: the RPC opted in via SET LOCAL
      RETURN NEW;
    END IF;

    IF NEW.is_featured IS DISTINCT FROM OLD.is_featured
       OR NEW.listing_priority IS DISTINCT FROM OLD.listing_priority
       OR NEW.featured_until IS DISTINCT FROM OLD.featured_until
    THEN
      RAISE EXCEPTION 'Only system processes can modify featured status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS check_featured_write_trigger ON listings;
CREATE TRIGGER check_featured_write_trigger
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_featured_write();

-- ============================================================
-- 2. feature_listing RPC — SECURITY DEFINER
-- ============================================================
CREATE OR REPLACE FUNCTION feature_listing(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing record;
  v_plan record;
  v_featured_count int;
  v_new_featured_until timestamptz;
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
    sp.id AS plan_id,
    sp.slug,
    sp.listing_priority,
    sp.max_featured,
    sp.featured_duration_days
  INTO v_plan
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.user_id = v_uid
    AND s.status = 'active'
    AND s.expires_at > now();

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'No tenés un plan activo';
  END IF;

  -- 4. Count current active featured listings for this user
  SELECT count(*) INTO v_featured_count
  FROM listings
  WHERE user_id = v_uid
    AND is_featured = true
    AND (featured_until IS NULL OR featured_until > now());

  IF v_featured_count >= v_plan.max_featured THEN
    RAISE EXCEPTION 'Llegaste al límite de avisos destacados (máximo %)', v_plan.max_featured;
  END IF;

  -- 5. Calculate featured_until
  v_new_featured_until := now() + (v_plan.featured_duration_days || ' days')::interval;

  -- 6. Bypass trigger via GUC and update listing
  PERFORM set_config('app.allow_featured_write', 'true', true);

  UPDATE listings
  SET is_featured = true,
      listing_priority = v_plan.listing_priority,
      featured_until = v_new_featured_until
  WHERE id = p_listing_id;

  -- 7. Return success
  RETURN jsonb_build_object(
    'ok', true,
    'listing_priority', v_plan.listing_priority,
    'featured_until', v_new_featured_until
  );
END;
$$;
