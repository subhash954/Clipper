-- ============================================================================
-- CLIPPER PHASE 4.6: STATE-WRITE FENCING & ATOMIC PROJECT STATUS TRANSITIONS
-- ============================================================================
-- 1. Authoritative lease-checked project status transition RPC:
--    update_project_status_if_lease_held()
-- 2. Ensures no stale, un-leased, or superseded worker can mutate project status
--    to 'transcribing', 'failed', or any other state without holding an active,
--    unexpired lease lock.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_project_status_if_lease_held(
  p_project_id UUID,
  p_lock_key TEXT,
  p_lease_token UUID,
  p_target_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_lease_generation BIGINT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock public.transcription_locks%ROWTYPE;
BEGIN
  IF p_lease_token IS NULL OR p_lock_key IS NULL OR p_project_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Acquire row-level exclusive lock on active lease
  SELECT * INTO v_lock
  FROM public.transcription_locks
  WHERE lock_key = p_lock_key
    AND lease_token = p_lease_token
    AND (p_lease_generation IS NULL OR lease_generation = p_lease_generation)
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Mutate project status conditionally within ACID transaction
  UPDATE public.projects
  SET status = p_target_status,
      error_message = COALESCE(p_error_message, error_message),
      updated_at = NOW()
  WHERE id = p_project_id;

  RETURN TRUE;
END;
$$;

-- Security lockdown
REVOKE ALL ON FUNCTION public.update_project_status_if_lease_held(UUID, TEXT, UUID, TEXT, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_project_status_if_lease_held(UUID, TEXT, UUID, TEXT, TEXT, BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.update_project_status_if_lease_held(UUID, TEXT, UUID, TEXT, TEXT, BIGINT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_project_status_if_lease_held(UUID, TEXT, UUID, TEXT, TEXT, BIGINT) TO service_role;
