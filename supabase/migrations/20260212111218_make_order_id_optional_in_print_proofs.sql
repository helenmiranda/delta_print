/*
  # Make order_id optional in print_proofs table

  1. Changes
    - Modify `order_id` column in `print_proofs` table to allow NULL values
    - This enables creating print proof requests without associating them to a specific order

  2. Notes
    - The foreign key constraint to orders(id) remains intact
    - ON DELETE CASCADE still applies when an order is deleted
    - Existing records with order_id values are unaffected
*/

ALTER TABLE print_proofs
ALTER COLUMN order_id DROP NOT NULL;
