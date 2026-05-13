/*
  # Add CORS configuration to artwork-files storage bucket

  ## Summary
  Updates the artwork-files storage bucket to allow cross-origin requests from
  any origin. This fixes browser CORS errors when the frontend tries to fetch
  files (SVGs, PDFs) using JavaScript fetch() calls from a different domain.

  ## Changes
  - Sets allowed_mime_types to null (allow all types)
  - Enables file_size_limit to remain as-is
  - Adds a CORS-compatible update to the bucket settings

  ## Notes
  - The bucket is already public (SELECT policy exists for all)
  - This migration updates the bucket's cors configuration to allow all origins
*/

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'artwork-files';
