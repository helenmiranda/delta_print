/*
  # Fix quotes status inconsistency

  ## Problem
  The frontend code was using 'PRONTO_ENVIAR_CLIENTE' as the status value when uploading a quote PDF,
  but the CHECK constraint on the quotes table only allows 'PRONTO_PARA_ENVIAR'.
  This caused the UPDATE to fail silently, leaving quotes stuck at 'PENDENTE_ORCAMENTO'
  even after a quote_version was created.

  ## Changes
  1. Updates quotes that still have status 'PENDENTE_ORCAMENTO' but have at least one associated
     quote_version, setting them to 'PRONTO_PARA_ENVIAR' to reflect the correct state.
  2. Updates any quote_versions that may have had 'PRONTO_ENVIAR_CLIENTE' stored as their status
     (no constraint on quote_versions.status, so these may exist).

  ## Notes
  - No destructive operations
  - Safe to run multiple times (idempotent)
*/

UPDATE quotes
SET status = 'PRONTO_PARA_ENVIAR'
WHERE status = 'PENDENTE_ORCAMENTO'
  AND id IN (
    SELECT DISTINCT quote_id FROM quote_versions
  );

UPDATE quote_versions
SET status = 'PRONTO_ENVIAR_CLIENTE'
WHERE status = 'PRONTO_ENVIAR_CLIENTE';
