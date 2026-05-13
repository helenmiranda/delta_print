/*
  # Create Storage Bucket for Artwork Files

  1. New Storage Bucket
    - `artwork-files` - Public bucket for storing artwork files
    - Accepts common image and document formats
    - Files are publicly accessible once uploaded
  
  2. Security
    - Bucket is public for easy access to artwork files
    - File size limit of 10MB
    - Accepted file types: images (jpg, jpeg, png, gif, webp, svg) and documents (pdf)
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artwork-files',
  'artwork-files',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can upload artwork files'
  ) THEN
    CREATE POLICY "Anyone can upload artwork files"
      ON storage.objects
      FOR INSERT
      WITH CHECK (bucket_id = 'artwork-files');
  END IF;
END $$;

-- Allow anyone to read files (public bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view artwork files'
  ) THEN
    CREATE POLICY "Anyone can view artwork files"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'artwork-files');
  END IF;
END $$;