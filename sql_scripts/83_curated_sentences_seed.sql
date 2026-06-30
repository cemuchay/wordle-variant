-- 83_curated_sentences_seed.sql
-- Seed 25 curated sentence templates for generating coherent challenges.
-- Each template is a jsonb array: strings = static words, arrays = variable choices.
-- All words are uppercase, 3-10 letters, and common English.
-- Run: psql -U <user> -d <db> -f 83_curated_sentences_seed.sql

INSERT INTO public.curated_sentences (template, word_count) VALUES
  ('["THE", ["CAT", "DOG", "FOX", "HEN"], ["RAN", "SAT", "ATE", "FED"]]', 3),
  ('[["THE", "THAT", "THIS", "YOUR"], ["BIG", "HOT", "NEW", "RED"], ["CAR", "BOAT", "HOUSE", "BOOK"]]', 3),
  ('["THE", "BIG", ["CAT", "DOG", "FOX", "HEN"], ["RAN", "ATE", "SAT", "FED"]]', 4),
  ('["YOUR", ["OLD", "NEW", "BIG", "WET"], ["CAT", "DOG", "FOX", "HEN"], ["ATE", "RAN", "SAT", "FED"]]', 4),
  ('["THAT", ["WET", "DRY", "RED", "BLUE"], ["BALL", "FISH", "CAKE", "BOOK"], ["FELL", "WENT", "CAME", "BURN"]]', 4),
  ('[["THE", "THAT", "THIS", "YOUR"], ["COLD", "WARM", "SOFT", "HARD"], ["WATER", "HOUSE", "ROBOT", "LIGHT"]]', 3),
  ('["THE", "OLD", ["CAT", "DOG", "FOX", "HEN"], "ATE", ["RICE", "FISH", "CAKE", "MEAT"]]', 5),
  ('[["OUR", "YOUR", "HIS", "HER"], "BIG", ["BLUE", "RED", "GREEN", "GRAY"], ["CAR", "BOAT", "SHIP", "VAN"]]', 4),
  ('[["THE", "THAT", "THIS", "YOUR"], ["BEST", "LAST", "SAME", "ONLY"], ["PLAN", "MAP", "BOOK", "CARD"]]', 3),
  ('["YOUR", ["FAST", "SLOW", "WILD", "TAME"], ["CAT", "DOG", "FOX", "BEAR"], ["JUMP", "WALK", "SWIM", "PLAY"]]', 4),
  ('["THAT", ["TALL", "WIDE", "DEEP", "LONG"], ["TOWER", "RIVER", "HOUSE", "ROBOT"], ["STOOD", "LAY", "SAT", "HUNG"]]', 4),
  ('["THE", ["BLUE", "GREEN", "GRAY", "DARK"], ["RIVER", "FOREST", "GARDEN", "MOUNT"]]', 3),
  ('["THAT", ["HAPPY", "SILLY", "LUCKY", "CLEAN"], ["CHILD", "ROBOT", "HORSE", "MOUSE"], ["JUMP", "PLAY", "SING", "LAUGH"]]', 4),
  ('["THE", "NEW", ["TEACHER", "STUDENT", "DOCTOR", "WRITER"], ["CAME", "LEFT", "STAY", "WENT"]]', 4),
  ('[["YOUR", "THEIR", "OUR"], "BEST", ["PLAN", "MOVE", "SHOT", "PLAY"], ["WON", "LOST", "WORK", "FAIL"]]', 4),
  ('["THE", ["GOLD", "BLUE", "PINK", "GRAY"], ["RING", "GEM", "COIN", "BELL"], ["SHONE", "RANG", "FELL", "LAY"]]', 4),
  ('["YOUR", ["SMART", "BRAVE", "KIND", "WISE"], ["FRIEND", "TEACHER", "DOCTOR", "GUARDIAN"]]', 3),
  ('[["THE", "THAT", "THIS", "YOUR"], ["SWEET", "SOUR", "SALTY", "BITTER"], ["DRINK", "FRUIT", "TREAT", "MEAL"]]', 3),
  ('["THE", ["BRIGHT", "SHINY", "LIVELY", "PEACEFUL"], ["GARDEN", "FOREST", "RIVER", "MEADOW"]]', 3),
  ('["THAT", ["WILD", "TAME", "CUTE", "RARE"], ["RABBIT", "PARROT", "TURTLE", "HAMSTER"]]', 3),
  ('[["HIS", "HER", "ITS", "YOUR"], ["LEATHER", "VELVET", "SILVER", "COTTON"], ["JACKET", "SCARF", "BELT", "BAG"]]', 3),
  ('["THE", ["ANCIENT", "MIGHTY", "SACRED", "LOST"], ["TEMPLE", "KINGDOM", "PALACE", "CASTLE"], ["FELL", "BURN", "FROZE", "WOKE"]]', 4),
  ('["YOUR", ["FIRST", "FINAL", "ONLY", "BEST"], ["CHANCE", "CHOICE", "MOVE", "TURN"], "IS", ["NOW", "HERE", "OVER", "NEXT"]]', 5),
  ('[["THE", "THAT", "THIS", "YOUR"], ["SILENT", "ACTIVE", "RAPID", "STEADY"], ["WIND", "RIVER", "FIRE", "RAIN"], ["CROSSED", "FILLED", "COVERED", "OPENED"]]', 4),
  ('["THE", ["BRAVE", "LOYAL", "NOBLE", "FLEET"], ["KNIGHT", "SOLDIER", "SAILOR", "GUARD"], ["STOOD", "FOUGHT", "SAILED", "WATCHED"]]', 4);
