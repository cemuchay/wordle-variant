-- SQL Seed script for Flag Bearer category in WordUp
-- Run this in your Supabase SQL editor to populate the database.

-- First, ensure any old flag_bearer entities are cleaned up
DELETE FROM wordup_entities WHERE type = 'flag_bearer';

-- Insert new flag_bearer entities with metadata
INSERT INTO wordup_entities (type, label, metadata, difficulty, tags) VALUES
-- Easy Countries (Difficulty 1-2)
('flag_bearer', 'Nigeria', '{"flag_code": "ng", "colors": "Green, White", "continent": "Africa", "capital": "Abuja", "primary_language": "English"}', 1, ARRAY['africa', 'easy']),
('flag_bearer', 'France', '{"flag_code": "fr", "colors": "Blue, White, Red", "continent": "Europe", "capital": "Paris", "primary_language": "French"}', 1, ARRAY['europe', 'easy']),
('flag_bearer', 'Germany', '{"flag_code": "de", "colors": "Black, Red, Yellow", "continent": "Europe", "capital": "Berlin", "primary_language": "German"}', 1, ARRAY['europe', 'easy']),
('flag_bearer', 'Japan', '{"flag_code": "jp", "colors": "White, Red", "continent": "Asia", "capital": "Tokyo", "primary_language": "Japanese"}', 1, ARRAY['asia', 'easy']),
('flag_bearer', 'United Kingdom', '{"flag_code": "gb", "colors": "Blue, White, Red", "continent": "Europe", "capital": "London", "primary_language": "English"}', 1, ARRAY['europe', 'easy']),
('flag_bearer', 'United States', '{"flag_code": "us", "colors": "Red, White, Blue", "continent": "Americas", "capital": "Washington D.C.", "primary_language": "English"}', 1, ARRAY['americas', 'easy']),
('flag_bearer', 'Canada', '{"flag_code": "ca", "colors": "Red, White", "continent": "Americas", "capital": "Ottawa", "primary_language": "English"}', 1, ARRAY['americas', 'easy']),
('flag_bearer', 'Brazil', '{"flag_code": "br", "colors": "Green, Yellow, Blue, White", "continent": "Americas", "capital": "Brasilia", "primary_language": "Portuguese"}', 1, ARRAY['americas', 'easy']),
('flag_bearer', 'Australia', '{"flag_code": "au", "colors": "Blue, White, Red", "continent": "Oceania", "capital": "Canberra", "primary_language": "English"}', 1, ARRAY['oceania', 'easy']),
('flag_bearer', 'Italy', '{"flag_code": "it", "colors": "Green, White, Red", "continent": "Europe", "capital": "Rome", "primary_language": "Italian"}', 1, ARRAY['europe', 'easy']),
('flag_bearer', 'Spain', '{"flag_code": "es", "colors": "Red, Yellow", "continent": "Europe", "capital": "Madrid", "primary_language": "Spanish"}', 1, ARRAY['europe', 'easy']),
('flag_bearer', 'China', '{"flag_code": "cn", "colors": "Red, Yellow", "continent": "Asia", "capital": "Beijing", "primary_language": "Chinese"}', 1, ARRAY['asia', 'easy']),
('flag_bearer', 'India', '{"flag_code": "in", "colors": "Saffron, White, Green, Blue", "continent": "Asia", "capital": "New Delhi", "primary_language": "Hindi"}', 1, ARRAY['asia', 'easy']),
('flag_bearer', 'Mexico', '{"flag_code": "mx", "colors": "Green, White, Red", "continent": "Americas", "capital": "Mexico City", "primary_language": "Spanish"}', 1, ARRAY['americas', 'easy']),
('flag_bearer', 'Russia', '{"flag_code": "ru", "colors": "White, Blue, Red", "continent": "Europe", "capital": "Moscow", "primary_language": "Russian"}', 1, ARRAY['europe', 'asia', 'easy']),

-- Medium Countries (Difficulty 2-3)
('flag_bearer', 'Argentina', '{"flag_code": "ar", "colors": "Light Blue, White, Yellow", "continent": "Americas", "capital": "Buenos Aires", "primary_language": "Spanish"}', 2, ARRAY['americas', 'medium']),
('flag_bearer', 'South Africa', '{"flag_code": "za", "colors": "Red, Blue, Green, Black, White, Yellow", "continent": "Africa", "capital": "Pretoria", "primary_language": "English"}', 2, ARRAY['africa', 'medium']),
('flag_bearer', 'South Korea', '{"flag_code": "kr", "colors": "White, Red, Blue, Black", "continent": "Asia", "capital": "Seoul", "primary_language": "Korean"}', 2, ARRAY['asia', 'medium']),
('flag_bearer', 'Egypt', '{"flag_code": "eg", "colors": "Red, White, Black, Gold", "continent": "Africa", "capital": "Cairo", "primary_language": "Arabic"}', 2, ARRAY['africa', 'medium']),
('flag_bearer', 'Netherlands', '{"flag_code": "nl", "colors": "Red, White, Blue", "continent": "Europe", "capital": "Amsterdam", "primary_language": "Dutch"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Switzerland', '{"flag_code": "ch", "colors": "Red, White", "continent": "Europe", "capital": "Bern", "primary_language": "German"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Sweden', '{"flag_code": "se", "colors": "Blue, Yellow", "continent": "Europe", "capital": "Stockholm", "primary_language": "Swedish"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Norway', '{"flag_code": "no", "colors": "Red, White, Blue", "continent": "Europe", "capital": "Oslo", "primary_language": "Norwegian"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Turkey', '{"flag_code": "tr", "colors": "Red, White", "continent": "Europe", "capital": "Ankara", "primary_language": "Turkish"}', 2, ARRAY['europe', 'asia', 'medium']),
('flag_bearer', 'Greece', '{"flag_code": "gr", "colors": "Blue, White", "continent": "Europe", "capital": "Athens", "primary_language": "Greek"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Portugal', '{"flag_code": "pt", "colors": "Green, Red, Gold", "continent": "Europe", "capital": "Lisbon", "primary_language": "Portuguese"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Ireland', '{"flag_code": "ie", "colors": "Green, White, Orange", "continent": "Europe", "capital": "Dublin", "primary_language": "English"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'New Zealand', '{"flag_code": "nz", "colors": "Blue, Red, White", "continent": "Oceania", "capital": "Wellington", "primary_language": "English"}', 2, ARRAY['oceania', 'medium']),
('flag_bearer', 'Ukraine', '{"flag_code": "ua", "colors": "Blue, Yellow", "continent": "Europe", "capital": "Kyiv", "primary_language": "Ukrainian"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Poland', '{"flag_code": "pl", "colors": "White, Red", "continent": "Europe", "capital": "Warsaw", "primary_language": "Polish"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Austria', '{"flag_code": "at", "colors": "Red, White", "continent": "Europe", "capital": "Vienna", "primary_language": "German"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Belgium', '{"flag_code": "be", "colors": "Black, Yellow, Red", "continent": "Europe", "capital": "Brussels", "primary_language": "French"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Denmark', '{"flag_code": "dk", "colors": "Red, White", "continent": "Europe", "capital": "Copenhagen", "primary_language": "Danish"}', 2, ARRAY['europe', 'medium']),
('flag_bearer', 'Finland', '{"flag_code": "fi", "colors": "White, Blue", "continent": "Europe", "capital": "Helsinki", "primary_language": "Finnish"}', 2, ARRAY['europe', 'medium']),

-- Hard/Complex Countries (Difficulty 3-4)
('flag_bearer', 'Saudi Arabia', '{"flag_code": "sa", "colors": "Green, White", "continent": "Asia", "capital": "Riyadh", "primary_language": "Arabic"}', 3, ARRAY['asia', 'medium']),
('flag_bearer', 'Kenya', '{"flag_code": "ke", "colors": "Black, Red, Green, White", "continent": "Africa", "capital": "Nairobi", "primary_language": "Swahili"}', 3, ARRAY['africa', 'medium']),
('flag_bearer', 'Singapore', '{"flag_code": "sg", "colors": "Red, White", "continent": "Asia", "capital": "Singapore", "primary_language": "English"}', 3, ARRAY['asia', 'medium']),
('flag_bearer', 'Vietnam', '{"flag_code": "vn", "colors": "Red, Yellow", "continent": "Asia", "capital": "Hanoi", "primary_language": "Vietnamese"}', 3, ARRAY['asia', 'medium']),
('flag_bearer', 'Thailand', '{"flag_code": "th", "colors": "Red, White, Blue", "continent": "Asia", "capital": "Bangkok", "primary_language": "Thai"}', 3, ARRAY['asia', 'medium']),
('flag_bearer', 'Morocco', '{"flag_code": "ma", "colors": "Red, Green", "continent": "Africa", "capital": "Rabat", "primary_language": "Arabic"}', 3, ARRAY['africa', 'medium']),
('flag_bearer', 'Colombia', '{"flag_code": "co", "colors": "Yellow, Blue, Red", "continent": "Americas", "capital": "Bogota", "primary_language": "Spanish"}', 3, ARRAY['americas', 'medium']),
('flag_bearer', 'Peru', '{"flag_code": "pe", "colors": "Red, White", "continent": "Americas", "capital": "Lima", "primary_language": "Spanish"}', 3, ARRAY['americas', 'medium']),
('flag_bearer', 'Chile', '{"flag_code": "cl", "colors": "Red, White, Blue", "continent": "Americas", "capital": "Santiago", "primary_language": "Spanish"}', 3, ARRAY['americas', 'medium']),
('flag_bearer', 'Pakistan', '{"flag_code": "pk", "colors": "Green, White", "continent": "Asia", "capital": "Islamabad", "primary_language": "Urdu"}', 3, ARRAY['asia', 'medium']),
('flag_bearer', 'Bangladesh', '{"flag_code": "bd", "colors": "Green, Red", "continent": "Asia", "capital": "Dhaka", "primary_language": "Bengali"}', 3, ARRAY['asia', 'medium']),
('flag_bearer', 'Jamaica', '{"flag_code": "jm", "colors": "Green, Yellow, Black", "continent": "Americas", "capital": "Kingston", "primary_language": "English"}', 3, ARRAY['americas', 'medium']),
('flag_bearer', 'Cuba', '{"flag_code": "cu", "colors": "Blue, White, Red", "continent": "Americas", "capital": "Havana", "primary_language": "Spanish"}', 3, ARRAY['americas', 'medium']),
('flag_bearer', 'Croatia', '{"flag_code": "hr", "colors": "Red, White, Blue", "continent": "Europe", "capital": "Zagreb", "primary_language": "Croatian"}', 3, ARRAY['europe', 'medium']),
('flag_bearer', 'Hungary', '{"flag_code": "hu", "colors": "Red, White, Green", "continent": "Europe", "capital": "Budapest", "primary_language": "Hungarian"}', 3, ARRAY['europe', 'medium']),
('flag_bearer', 'Czech Republic', '{"flag_code": "cz", "colors": "White, Red, Blue", "continent": "Europe", "capital": "Prague", "primary_language": "Czech"}', 3, ARRAY['europe', 'medium']),
('flag_bearer', 'Romania', '{"flag_code": "ro", "colors": "Blue, Yellow, Red", "continent": "Europe", "capital": "Bucharest", "primary_language": "Romanian"}', 3, ARRAY['europe', 'medium']),
('flag_bearer', 'Ghana', '{"flag_code": "gh", "colors": "Red, Yellow, Green, Black", "continent": "Africa", "capital": "Accra", "primary_language": "English"}', 3, ARRAY['africa', 'medium']),

-- Very Hard Countries (Difficulty 4-5)
('flag_bearer', 'Iceland', '{"flag_code": "is", "colors": "Blue, White, Red", "continent": "Europe", "capital": "Reykjavik", "primary_language": "Icelandic"}', 4, ARRAY['europe', 'hard']),
('flag_bearer', 'Nepal', '{"flag_code": "np", "colors": "Blue, Red, White", "continent": "Asia", "capital": "Kathmandu", "primary_language": "Nepali"}', 4, ARRAY['asia', 'hard']),
('flag_bearer', 'Mongolia', '{"flag_code": "mn", "colors": "Red, Blue, Yellow", "continent": "Asia", "capital": "Ulaanbaatar", "primary_language": "Mongolian"}', 4, ARRAY['asia', 'hard']),
('flag_bearer', 'Madagascar', '{"flag_code": "mg", "colors": "Red, Green, White", "continent": "Africa", "capital": "Antananarivo", "primary_language": "Malagasy"}', 4, ARRAY['africa', 'hard']),
('flag_bearer', 'Sri Lanka', '{"flag_code": "lk", "colors": "Green, Orange, Red, Yellow", "continent": "Asia", "capital": "Colombo", "primary_language": "Sinhala"}', 4, ARRAY['asia', 'hard']),
('flag_bearer', 'Ethiopia', '{"flag_code": "et", "colors": "Green, Yellow, Red, Blue", "continent": "Africa", "capital": "Addis Ababa", "primary_language": "Amharic"}', 4, ARRAY['africa', 'hard']),
('flag_bearer', 'Bhutan', '{"flag_code": "bt", "colors": "Yellow, Orange, White", "continent": "Asia", "capital": "Thimphu", "primary_language": "Dzongkha"}', 5, ARRAY['asia', 'hard']);
