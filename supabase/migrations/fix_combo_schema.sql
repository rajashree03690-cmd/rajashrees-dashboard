-- Section 4.1: Fix combo table with auto-generated IDs and relaxed quantity constraint
-- Create sequence for combo_id if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS combo_id_seq START WITH 800000;

-- Alter combo table to use the sequence
ALTER TABLE public.combo
ALTER COLUMN combo_id SET DEFAULT nextval('combo_id_seq');

-- Make combo_quantity optional and default to 0 (as per business logic, stock is derived)
ALTER TABLE public.combo
ALTER COLUMN combo_quantity DROP NOT NULL;

ALTER TABLE public.combo
ALTER COLUMN combo_quantity SET DEFAULT 0;

-- Section 4.2: Fix combo_items table
-- Create sequence for combo_item_id
CREATE SEQUENCE IF NOT EXISTS combo_item_id_seq START WITH 70000000;

-- Alter combo_items to use sequence
ALTER TABLE public.combo_items
ALTER COLUMN combo_item_id SET DEFAULT nextval('combo_item_id_seq');

-- Ensure foreign keys are not null (Data Integrity)
ALTER TABLE public.combo_items
ALTER COLUMN combo_id SET NOT NULL;

ALTER TABLE public.combo_items
ALTER COLUMN variant_id SET NOT NULL;

-- Section 4.3: Prevent duplicate variants in same combo
CREATE UNIQUE INDEX IF NOT EXISTS uniq_combo_variant
ON public.combo_items (combo_id, variant_id);

-- Section 5.1: Database Function for Available Stock (Derived)
CREATE OR REPLACE FUNCTION public.get_available_combo_qty(p_combo_id numeric)
RETURNS integer
LANGUAGE sql
AS $$
  SELECT COALESCE(
    MIN(FLOOR(COALESCE(pv.stock, 0) / NULLIF(ci.quantity_per_combo, 0))),
    0
  )::integer
  FROM combo_items ci
  JOIN product_variants pv ON pv.variant_id = ci.variant_id
  WHERE ci.combo_id = p_combo_id;
$$;

-- Section 5.2: Database Function to Pack Order (Deduct Stock)
CREATE OR REPLACE FUNCTION public.pack_combo_order(p_combo_id numeric, p_order_qty integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rec record;
BEGIN
  -- Check stock availability first
  FOR rec IN
    SELECT ci.variant_id, ci.quantity_per_combo, pv.stock
    FROM combo_items ci
    JOIN product_variants pv ON pv.variant_id = ci.variant_id
    WHERE ci.combo_id = p_combo_id
  LOOP
    IF rec.stock < (rec.quantity_per_combo * p_order_qty) THEN
      RAISE EXCEPTION 'Insufficient stock for variant %', rec.variant_id;
    END IF;
  END LOOP;

  -- Deduct stock
  UPDATE product_variants pv
  SET stock = pv.stock - (ci.quantity_per_combo * p_order_qty)
  FROM combo_items ci
  WHERE pv.variant_id = ci.variant_id
    AND ci.combo_id = p_combo_id;
END;
$$;
