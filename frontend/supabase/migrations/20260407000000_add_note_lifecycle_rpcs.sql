-- Note lifecycle RPC functions used by the scheduler
-- archive_expired_notes: moves notes older than 25 days to 'archived' status
-- delete_old_archived_notes: soft-deletes notes that have been archived for 7+ days

CREATE OR REPLACE FUNCTION archive_expired_notes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_count integer;
BEGIN
  UPDATE notes
  SET
    status = 'archived',
    archived_at = now()
  WHERE
    status = 'active'
    AND created_at < now() - interval '25 days';

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

CREATE OR REPLACE FUNCTION delete_old_archived_notes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  UPDATE notes
  SET status = 'deleted'
  WHERE
    status = 'archived'
    AND archived_at < now() - interval '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
