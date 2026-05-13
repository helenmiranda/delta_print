/*
  # Fix quote_versions sequential numbering

  ## Problem
  Version numbers were being calculated from stale React state, causing jumps
  like V1, V16, V17, V22, V23 instead of V1, V2, V3...

  ## What this migration does
  Reassigns version_number for every quote_version so that within each quote,
  versions are numbered 1, 2, 3... in order of their created_at timestamp.

  ## Tables modified
  - quote_versions: version_number column reassigned per quote_id group
*/

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY quote_id ORDER BY created_at ASC) AS new_version_number
  FROM quote_versions
)
UPDATE quote_versions
SET version_number = ranked.new_version_number
FROM ranked
WHERE quote_versions.id = ranked.id;
