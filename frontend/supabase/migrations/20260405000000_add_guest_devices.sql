-- Guest device tracking for limiting unauthenticated usage
-- Tracks note generation count per device

CREATE TABLE IF NOT EXISTS guest_devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     text NOT NULL UNIQUE,
  notes_count   integer NOT NULL DEFAULT 0,
  last_seen     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed — only accessed via service role key from backend
-- Index for fast lookup by device_id
CREATE INDEX IF NOT EXISTS guest_devices_device_id_idx ON guest_devices(device_id);
