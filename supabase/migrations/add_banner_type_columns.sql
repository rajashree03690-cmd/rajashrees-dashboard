-- Migration: Add banner_type, placement, display_order, cta_text, target_pages to banners table
-- Run this in your Supabase SQL editor

ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS banner_type VARCHAR(50) DEFAULT 'hero',
  ADD COLUMN IF NOT EXISTS placement VARCHAR(100) DEFAULT 'homepage_top',
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cta_text VARCHAR(255) DEFAULT 'Shop Now',
  ADD COLUMN IF NOT EXISTS target_pages TEXT[] DEFAULT '{}';

-- Update existing banners to have default type
UPDATE banners SET banner_type = 'hero' WHERE banner_type IS NULL;
UPDATE banners SET placement = 'homepage_top' WHERE placement IS NULL;
UPDATE banners SET display_order = 0 WHERE display_order IS NULL;
UPDATE banners SET cta_text = 'Shop Now' WHERE cta_text IS NULL;
