-- Add next_term_start_date column to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS next_term_start_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN schools.next_term_start_date IS 'Date when the next term will start, displayed on report cards';
