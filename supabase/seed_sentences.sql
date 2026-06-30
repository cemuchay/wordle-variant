-- Create curated_sentences table if not exists
create table if not exists public.curated_sentences (
  id uuid not null default gen_random_uuid(),
  template jsonb not null,
  word_count integer not null,
  created_at timestamp with time zone default now(),
  constraint curated_sentences_pkey primary key (id)
);

-- Enable Row Level Security
alter table public.curated_sentences enable row level security;

-- Create policy to allow select access to anyone (public)
create policy "Allow select access to everyone"
  on public.curated_sentences for select
  using (true);

-- Create policy to allow insert/update/delete to authenticated creators
create policy "Allow all actions to authenticated creators"
  on public.curated_sentences for all
  to authenticated
  using (true)
  with check (true);

-- Clear existing seed data if necessary
truncate table public.curated_sentences;

-- Insert seed templates for 3-10 word count sentences
insert into public.curated_sentences (template, word_count) values
  -- 3 words
  ('["THE", ["CAT", "DOG", "FOX", "BEAR", "LION"], ["SLEEPS", "WALKS", "RUNS", "JUMPS", "PLAYS"]]', 3),
  ('["MANY", ["BIRDS", "FROGS", "DUCKS", "GEESE"], ["FLY", "SING", "SWIM", "JUMP"]]', 3),
  ('["YOU", ["WIN", "PLAY", "LOVE"], ["GAMES", "SPORTS", "WORDS"]]', 3),

  -- 4 words
  ('["THE", ["WIND", "RAIN", "SNOW", "HEAT"], ["BLOWS", "FALLS", "COMES"], ["COLD", "FAST", "LATE", "SOON"]]', 4),
  ('[["SOME", "MANY", "FEW"], ["BOYS", "GIRLS", "KIDS"], ["LIKE", "WANT", "LOVE"], ["TOYS", "GAMES", "BOOKS"]]', 4),
  ('["WILD", ["BEARS", "TIGERS", "LIONS", "WOLVES"], ["HUNT", "ROAM", "SLEEP"], ["HERE", "THERE", "TODAY"]]', 4),

  -- 5 words
  ('[["HAPPY", "YOUNG", "SMART"], ["KIDS", "PUPILS", "KITTENS"], ["PLAY", "STUDY", "WRITE"], ["WITH", "ABOUT", "UNDER"], ["TOYS", "BOOKS", "TREES"]]', 5),
  ('["THIS", ["GREAT", "CLEVER", "LOVELY"], "GAME", ["FEELS", "SEEMS", "PROVES"], ["FUN", "GOOD", "NEAT"]]', 5),
  ('["FRESH", ["WATER", "RIVER", "SPRING"], ["FLOWS", "RUSHES", "DRAINS"], "FROM", ["HILLS", "MOUNTAINS", "ROCKS"]]', 5),

  -- 6 words
  ('[["YOU", "WE", "THEY"], ["CAN", "WILL", "MUST"], ["PLAY", "ENJOY", "SHARE", "SOLVE"], "THIS", "GREAT", ["GAME", "PUZZLE", "CHALLENGE"]]', 6),
  ('["LIGHT", ["SHINES", "GLEAMS", "FLASHES"], "THROUGH", "THE", ["DARK", "GREY", "BLACK"], ["CLOUDS", "SHADOWS", "NIGHTS"]]', 6),
  ('[["SMART", "YOUNG"], ["BOYS", "GIRLS"], ["RIDE", "DRIVE", "STEER"], ["FAST", "BRIGHT", "CLEAN"], ["RED", "BLUE", "GREEN"], ["BIKES", "BOATS", "CARS"]]', 6),

  -- 7 words
  ('["THE", ["QUICK", "BROWN", "SLEEPY"], ["FOX", "DOG", "CAT"], ["JUMPS", "RUNS", "WALKS"], "OVER", ["LAZY", "QUIET", "YOUNG"], ["DOG", "BEAR", "COW"]]', 7),
  ('[["THEY", "PEOPLE"], ["BUILT", "PAINTED", "BOUGHT"], ["MANY", "SHINY", "GREAT"], ["HOMES", "SHOPS", "BOATS"], ["NEAR", "ALONG", "BESIDE"], "THE", ["RIVER", "OCEAN", "FOREST"]]', 7),

  -- 8 words
  ('[["STRONG", "GENTLE"], ["WINDS", "BREEZES"], ["MAKE", "FORCE"], ["TALL", "YOUNG"], ["TREES", "PLANTS"], ["BEND", "SWAY"], "VERY", ["LOW", "FAST", "SLOW"]]', 8),
  ('[["SMART", "KIND"], ["TEACHERS", "PARENTS"], ["GUIDE", "DIRECT"], ["THEIR", "YOUNG"], ["STUDENTS", "CHILDREN"], "TOWARD", ["BRIGHT", "BETTER"], ["PATHS", "GOALS"]]', 8),

  -- 9 words
  ('[["THREE", "SEVEN", "HAPPY"], ["SMALL", "YOUNG", "WHITE"], ["FISH", "DUCKS", "SWANS"], ["SWIM", "GLIDE"], ["UNDER", "ACROSS"], "THE", ["DEEP", "CLEAR", "BLUE"], ["LAKE", "RIVER", "POND"], ["TODAY", "DAILY"]]', 9),
  ('["EVERY", ["MORNING", "EVENING"], "THE", ["OLD", "KIND", "HAPPY"], ["MAN", "LADY", "CHILD"], ["WALKS", "GUIDES"], ["HIS", "THEIR"], ["LOYAL", "PLAYFUL"], ["DOG", "PONY"]]', 9),

  -- 10 words
  ('[["SEVEN", "COLD", "WHITE"], ["WINTER", "AUTUMN"], ["SNOWS", "STORMS"], ["COVER", "COVERS"], "THE", ["ENTIRE", "SILENT"], ["FOREST", "VALLEY"], "WITH", ["WHITE", "FRESH"], ["SHEETS", "CLOAKS"]]', 10),
  ('[["EVERY", "EACH"], ["SINGLE", "ACTIVE"], ["MEMBER", "PLAYER"], ["WRITES", "SOLVES"], "SHORT", ["WORDS", "PUZZLES"], ["FOR", "UNDER"], ["THEIR", "DAILY"], ["CLASS", "COURSE"], ["HOURS", "TASKS"]]', 10);
