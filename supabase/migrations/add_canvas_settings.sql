-- Supabase Migration: Add Canvas and Background Settings
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- Add canvas dimensions columns (if they don't exist)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS canvas_width INTEGER DEFAULT 680;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS canvas_height INTEGER DEFAULT 445;

-- Add background color column (if it doesn't exist)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#000000';

-- Add full background settings as JSONB (includes type, gradient, image)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS background_settings JSONB;

-- Add aspect_ratio column for reference (optional)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS aspect_ratio TEXT;

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name IN ('canvas_width', 'canvas_height', 'background_color', 'background_settings', 'aspect_ratio');
