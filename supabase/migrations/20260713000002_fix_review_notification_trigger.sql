-- Fix fn_create_review_notification: schema-qualify all table references.
-- Original had SET search_path = '' but referenced notifications,
-- conversations, listings, profiles without public. prefix, causing
-- "relation does not exist" errors.
--
-- V2: Also fixed column reference — profiles has full_name, not display_name.

CREATE OR REPLACE FUNCTION fn_create_review_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_listing_id uuid;
  v_listing_title text;
  v_owner_id uuid;
  v_reviewer_name text;
BEGIN
  -- Get listing info from the conversation
  SELECT c.listing_id, l.title, l.user_id
  INTO v_listing_id, v_listing_title, v_owner_id
  FROM public.conversations c
  JOIN public.listings l ON l.id = c.listing_id
  WHERE c.id = NEW.conversation_id;

  -- Get reviewer name (profiles only has full_name, not display_name)
  SELECT COALESCE(NULLIF(full_name, ''), 'Usuario')
  INTO v_reviewer_name
  FROM public.profiles
  WHERE id = NEW.reviewer_id;

  -- Don't notify yourself
  IF v_owner_id = NEW.reviewer_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_owner_id,
    'review',
    'Nueva calificación',
    v_reviewer_name || ' te calificó con ' || NEW.rating || ' estrellas',
    jsonb_build_object(
      'listing_id', v_listing_id,
      'listing_title', v_listing_title,
      'review_id', NEW.id,
      'rating', NEW.rating
    )
  );

  RETURN NEW;
END;
$$;
