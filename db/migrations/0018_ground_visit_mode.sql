-- How a land visit crossed: by rail or by road. NULL keeps a legacy or unspecified way; sea and unknown entries have none.
ALTER TABLE ground_visits ADD COLUMN mode TEXT
  CHECK (mode IS NULL OR (mode IN ('rail', 'road') AND entry_method = 'land'));
