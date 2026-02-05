-- Migration: Remove 'green' from theme_color options
-- Date: 2026-02-05
-- Reason: Consolidating color palette - green too similar to teal

-- Step 1: Migrate any existing profiles using 'green' to 'teal'
UPDATE profiles
SET theme_color = 'teal'
WHERE theme_color = 'green';

-- Step 2: Drop the old CHECK constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_theme_color_check;

-- Step 3: Add new CHECK constraint without 'green'
ALTER TABLE profiles
ADD CONSTRAINT profiles_theme_color_check
CHECK (theme_color IN ('teal', 'red', 'coral', 'olive', 'yellow', 'orange', 'purple', 'blue', 'gray'));

-- Note: Users who had 'green' will now have 'teal' as their theme color
-- This is acceptable as teal is visually similar and serves the same purpose
