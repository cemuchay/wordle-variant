-- 92_periodic_templates.sql

-- Chemistry Topic ID: b2ce8a30-01d7-46c5-8422-79fc74d47102

INSERT INTO public.question_templates (topic_id, answer_key, required_keys, prompts, explanations) VALUES
-- 1. Symbol (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'symbol', ARRAY['symbol'], ARRAY['What is the chemical symbol of {element}?'], ARRAY['The chemical symbol of {label} is {symbol}.']),

-- 2. Symbol (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['symbol'], ARRAY['Which element has the chemical symbol "{symbol}"?'], ARRAY['{label} has the chemical symbol "{symbol}".']),

-- 3. Atomic Number (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'atomic_number', ARRAY['atomic_number'], ARRAY['What is the atomic number of {element}?'], ARRAY['The atomic number of {label} is {atomic_number}.']),

-- 4. Atomic Number (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['atomic_number'], ARRAY['Which element has atomic number {atomic_number}?'], ARRAY['{label} has the atomic number {atomic_number}.']),

-- 5. Discovered By (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['discovered_by'], ARRAY['Which element was discovered by {discovered_by}?'], ARRAY['{label} was discovered by {discovered_by}.']),

-- 6. Discovery Year (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'discovery_year', ARRAY['discovery_year'], ARRAY['In which year was {element} discovered?'], ARRAY['{label} was discovered/isolated in the year {discovery_year}.']),

-- 7. Discovery Year (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['discovery_year'], ARRAY['Which element was discovered/isolated in the year {discovery_year}?'], ARRAY['{label} was discovered in {discovery_year}.']),

-- 8. Category (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['category'], ARRAY['Which element belongs to the "{category}" category?'], ARRAY['{label} belongs to the "{category}" category.']),

-- 9. Common Use (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['common_use'], ARRAY['Which element is commonly used in {common_use}?'], ARRAY['{label} is commonly used in {common_use}.']),

-- 10. State at Room Temp (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'state', ARRAY['state'], ARRAY['What is the state of {element} at room temperature?'], ARRAY['{label} is a {state} at room temperature.']),

-- 11. State (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['state'], ARRAY['Which element is a {state} at room temperature?'], ARRAY['{label} is a {state} at room temperature.']),

-- 12. Group (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['group'], ARRAY['Which element belongs to the "{group}" group?'], ARRAY['{label} is a member of the "{group}" group.']),

-- 13. Period (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'period', ARRAY['period'], ARRAY['Which period of the periodic table is {element} located in?'], ARRAY['{label} is in period {period} of the periodic table.']),

-- 14. Period (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['period'], ARRAY['Which element is located in period {period} of the periodic table?'], ARRAY['{label} is located in period {period}.']),

-- 15. Abundance (Reverse)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', NULL, ARRAY['abundance'], ARRAY['Which element is described as "{abundance}"?'], ARRAY['{label} is described as "{abundance}".']),

-- 16. Color (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'color', ARRAY['color'], ARRAY['What is the typical color of pure {element}?'], ARRAY['Pure {label} is typically {color}.']),

-- 17. Radioactive (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'radioactive', ARRAY['radioactive'], ARRAY['Is {element} radioactive?'], ARRAY['{label} is {radioactive}.']),

-- 18. Natural (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'natural', ARRAY['natural'], ARRAY['Is {element} naturally occurring or synthetic?'], ARRAY['{label} is a {natural} element.']),

-- 19. Electronegativity (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'electronegativity', ARRAY['electronegativity'], ARRAY['What is the Pauling electronegativity value of {element}?'], ARRAY['The Pauling electronegativity of {label} is {electronegativity}.']),

-- 20. Melting Point (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'melting_point', ARRAY['melting_point'], ARRAY['What is the melting point of {element} in degrees Celsius?'], ARRAY['The melting point of {label} is {melting_point}°C.']),

-- 21. Boiling Point (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'boiling_point', ARRAY['boiling_point'], ARRAY['What is the boiling point of {element} in degrees Celsius?'], ARRAY['The boiling point of {label} is {boiling_point}°C.']),

-- 22. Electron Configuration (Forward)
('b2ce8a30-01d7-46c5-8422-79fc74d47102', 'electron_configuration', ARRAY['electron_configuration'], ARRAY['What is the ground-state electron configuration of {element}?'], ARRAY['The electron configuration of {label} is {electron_configuration}.'])
ON CONFLICT DO NOTHING;
