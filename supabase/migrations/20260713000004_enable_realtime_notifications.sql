-- Enable Realtime for notifications table
-- This is needed for the frontend subscription to work
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
