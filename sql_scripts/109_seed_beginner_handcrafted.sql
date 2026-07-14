-- 109_seed_beginner_handcrafted.sql
-- Seeds ~20 beginner (difficulty=1) handcrafted questions per trivia category
-- so new/low-ranked users see genuinely easy questions.

-- === MATHS ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('maths', 'What is 2 + 2?', ARRAY['3', '4', '5', '6'], '4', '2 plus 2 equals 4.', 1),
('maths', 'What is 5 + 3?', ARRAY['6', '7', '8', '9'], '8', '5 plus 3 equals 8.', 1),
('maths', 'What is 10 - 4?', ARRAY['5', '6', '7', '8'], '6', '10 minus 4 equals 6.', 1),
('maths', 'What is 3 × 3?', ARRAY['6', '7', '8', '9'], '9', '3 multiplied by 3 equals 9.', 1),
('maths', 'What is 12 ÷ 3?', ARRAY['3', '4', '5', '6'], '4', '12 divided by 3 equals 4.', 1),
('maths', 'What is 7 + 6?', ARRAY['11', '12', '13', '14'], '13', '7 plus 6 equals 13.', 1),
('maths', 'What is 15 - 7?', ARRAY['6', '7', '8', '9'], '8', '15 minus 7 equals 8.', 1),
('maths', 'What is 4 × 2?', ARRAY['6', '7', '8', '9'], '8', '4 multiplied by 2 equals 8.', 1),
('maths', 'What is 20 ÷ 4?', ARRAY['4', '5', '6', '7'], '5', '20 divided by 4 equals 5.', 1),
('maths', 'What is 9 + 9?', ARRAY['16', '17', '18', '19'], '18', '9 plus 9 equals 18.', 1),
('maths', 'How many sides does a triangle have?', ARRAY['2', '3', '4', '5'], '3', 'A triangle has 3 sides.', 1),
('maths', 'How many sides does a square have?', ARRAY['3', '4', '5', '6'], '4', 'A square has 4 equal sides.', 1),
('maths', 'What is 50 - 25?', ARRAY['20', '25', '30', '35'], '25', '50 minus 25 equals 25.', 1),
('maths', 'What is 6 × 2?', ARRAY['10', '11', '12', '13'], '12', '6 multiplied by 2 equals 12.', 1),
('maths', 'What is 30 ÷ 5?', ARRAY['5', '6', '7', '8'], '6', '30 divided by 5 equals 6.', 1),
('maths', 'What is 100 - 50?', ARRAY['40', '45', '50', '55'], '50', '100 minus 50 equals 50.', 1),
('maths', 'How many minutes are in an hour?', ARRAY['30', '45', '60', '100'], '60', 'There are 60 minutes in an hour.', 1),
('maths', 'What is 8 + 7?', ARRAY['13', '14', '15', '16'], '15', '8 plus 7 equals 15.', 1),
('maths', 'What is 25 × 1?', ARRAY['1', '25', '50', '100'], '25', 'Any number multiplied by 1 stays the same.', 1),
('maths', 'What is 0 + 14?', ARRAY['0', '7', '14', '28'], '14', '0 plus 14 equals 14.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === ENGLISH LANGUAGE ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('english_language', 'Which word means the opposite of "hot"?', ARRAY['warm', 'cold', 'wet', 'dry'], 'cold', 'Cold is the opposite of hot.', 1),
('english_language', 'Which word means the opposite of "big"?', ARRAY['large', 'tiny', 'fast', 'loud'], 'tiny', 'Tiny means very small, the opposite of big.', 1),
('english_language', 'Which word is a greeting?', ARRAY['goodbye', 'hello', 'sleep', 'run'], 'hello', 'Hello is a common greeting.', 1),
('english_language', 'Which word is a color?', ARRAY['table', 'green', 'chair', 'door'], 'green', 'Green is a color.', 1),
('english_language', 'Which word is an animal?', ARRAY['tree', 'river', 'dog', 'house'], 'dog', 'A dog is an animal.', 1),
('english_language', 'Which word means the same as "happy"?', ARRAY['sad', 'angry', 'glad', 'tired'], 'glad', 'Glad is a synonym for happy.', 1),
('english_language', 'Which word is a type of fruit?', ARRAY['carrot', 'apple', 'bread', 'cheese'], 'apple', 'An apple is a fruit.', 1),
('english_language', 'Which word is a type of weather?', ARRAY['shoes', 'rain', 'book', 'table'], 'rain', 'Rain is a type of weather.', 1),
('english_language', 'Which word means "to move quickly"?', ARRAY['sit', 'run', 'sleep', 'stand'], 'run', 'To run means to move quickly.', 1),
('english_language', 'Which word is a body part?', ARRAY['shirt', 'hand', 'hat', 'shoe'], 'hand', 'A hand is a part of the body.', 1),
('english_language', 'Which word is a number?', ARRAY['red', 'seven', 'big', 'soft'], 'seven', 'Seven is a number.', 1),
('english_language', 'Which word means the same as "small"?', ARRAY['huge', 'little', 'tall', 'wide'], 'little', 'Little means the same as small.', 1),
('english_language', 'Which word is something you wear?', ARRAY['plate', 'jacket', 'spoon', 'cup'], 'jacket', 'A jacket is an item of clothing.', 1),
('english_language', 'Which word is a day of the week?', ARRAY['January', 'Monday', 'Spring', 'Noon'], 'Monday', 'Monday is a day of the week.', 1),
('english_language', 'Which word means "to look at"?', ARRAY['hear', 'see', 'touch', 'taste'], 'see', 'To see means to look at something.', 1),
('english_language', 'Which word is a piece of furniture?', ARRAY['spoon', 'chair', 'plate', 'cup'], 'chair', 'A chair is a piece of furniture.', 1),
('english_language', 'Which word is the opposite of "up"?', ARRAY['over', 'down', 'above', 'high'], 'down', 'Down is the opposite of up.', 1),
('english_language', 'Which word means "to make a sound with your voice"?', ARRAY['whisper', 'shout', 'sing', 'all of these'], 'all of these', 'Whispering, shouting, and singing all involve making sounds with your voice.', 1),
('english_language', 'Which word is a month?', ARRAY['Tuesday', 'March', 'Summer', 'Year'], 'March', 'March is a month of the year.', 1),
('english_language', 'Which word means the same as "quick"?', ARRAY['slow', 'fast', 'late', 'long'], 'fast', 'Fast is a synonym for quick.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === FLAGS ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('flag_bearer', 'Which country has a red circle on a white background as its flag?', ARRAY['China', 'Japan', 'France', 'Brazil'], 'Japan', 'Japan flag has a red circle (sun) on a white background.', 1),
('flag_bearer', 'Which country flag has stars and stripes (red, white, and blue)?', ARRAY['United Kingdom', 'United States', 'Canada', 'Australia'], 'United States', 'The US flag has 50 stars and 13 red and white stripes.', 1),
('flag_bearer', 'Which country flag is a red square with a white cross?', ARRAY['Denmark', 'Switzerland', 'Norway', 'Sweden'], 'Switzerland', 'Switzerland flag is a red square with a white cross.', 1),
('flag_bearer', 'Which country has a green, yellow, and blue flag?', ARRAY['Argentina', 'Brazil', 'Mexico', 'Portugal'], 'Brazil', 'Brazil flag is green with a yellow diamond and blue circle.', 1),
('flag_bearer', 'Which country flag is entirely red?', ARRAY['Morocco', 'China', 'Turkey', 'Vietnam'], 'China', 'China flag is red with five yellow stars.', 1),
('flag_bearer', 'Which country has a tricolor of blue, white, and red vertical stripes?', ARRAY['Germany', 'France', 'Italy', 'Netherlands'], 'France', 'The French flag has blue, white, and red vertical stripes.', 1),
('flag_bearer', 'Which country has a maple leaf on its flag?', ARRAY['United States', 'Canada', 'Mexico', 'Brazil'], 'Canada', 'Canada flag has a red maple leaf in the center.', 1),
('flag_bearer', 'Which country flag has the Union Jack?', ARRAY['France', 'United Kingdom', 'Germany', 'Spain'], 'United Kingdom', 'The Union Jack is the flag of the United Kingdom.', 1),
('flag_bearer', 'Which country has a green flag with a crescent and star?', ARRAY['Saudi Arabia', 'Pakistan', 'Turkey', 'Algeria'], 'Pakistan', 'Pakistan flag is green with a white crescent and star.', 1),
('flag_bearer', 'Which country has black, red, and gold horizontal stripes?', ARRAY['France', 'Belgium', 'Germany', 'Netherlands'], 'Germany', 'Germany flag has black, red, and gold horizontal stripes.', 1),
('flag_bearer', 'Which country flag is a white crescent and star on a red background?', ARRAY['Turkey', 'Tunisia', 'Algeria', 'Morocco'], 'Turkey', 'Turkey flag is red with a white crescent and star.', 1),
('flag_bearer', 'Which country has a blue flag with a yellow cross?', ARRAY['Sweden', 'Norway', 'Finland', 'Denmark'], 'Sweden', 'Sweden flag is blue with a yellow cross.', 1),
('flag_bearer', 'Which country flag has green, white, and orange vertical stripes?', ARRAY['Italy', 'Ireland', 'France', 'India'], 'Ireland', 'Ireland flag has green, white, and orange vertical stripes.', 1),
('flag_bearer', 'Which country has a white flag with a red circle?', ARRAY['Japan', 'South Korea', 'Bangladesh', 'Taiwan'], 'Japan', 'Japan flag is white with a red circle representing the sun.', 1),
('flag_bearer', 'Which country flag has vertical blue and yellow stripes?', ARRAY['Sweden', 'Ukraine', 'Poland', 'Romania'], 'Ukraine', 'Ukraine flag has blue and yellow horizontal stripes.', 1),
('flag_bearer', 'Which country has a cross of St George, St Andrew, and St Patrick?', ARRAY['France', 'United Kingdom', 'Spain', 'Italy'], 'United Kingdom', 'The Union Jack combines crosses of St George, St Andrew, and St Patrick.', 1),
('flag_bearer', 'Which country flag is green and white stripes?', ARRAY['Nigeria', 'Pakistan', 'Saudi Arabia', 'Ireland'], 'Nigeria', 'Nigeria flag has green and white vertical stripes.', 1),
('flag_bearer', 'Which country has a blue flag with a white cross?', ARRAY['Greece', 'Finland', 'Norway', 'Iceland'], 'Greece', 'Greece flag is blue with a white cross and white stripes.', 1),
('flag_bearer', 'Which country flag has a red and white diagonal cross?', ARRAY['Scotland', 'England', 'Wales', 'Ireland'], 'Scotland', 'Scotland flag (St Andrew Cross) is a white diagonal cross on blue.', 1),
('flag_bearer', 'Which country flag is green, white, and red vertical stripes?', ARRAY['France', 'Italy', 'Mexico', 'Ireland'], 'Italy', 'Italy flag has green, white, and red vertical stripes.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === CHEMISTRY ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('chemistry', 'What is the chemical symbol for water?', ARRAY['H2O', 'CO2', 'NaCl', 'O2'], 'H2O', 'Water is H2O — two hydrogen atoms and one oxygen atom.', 1),
('chemistry', 'What is the chemical symbol for oxygen?', ARRAY['O', 'O2', 'H2O', 'CO2'], 'O', 'The chemical symbol for oxygen is O.', 1),
('chemistry', 'What gas do plants absorb from the air?', ARRAY['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 'Carbon dioxide', 'Plants absorb carbon dioxide for photosynthesis.', 1),
('chemistry', 'What planet is known as the Red Planet?', ARRAY['Venus', 'Mars', 'Jupiter', 'Saturn'], 'Mars', 'Mars appears red due to iron oxide (rust) on its surface.', 1),
('chemistry', 'What is the most abundant gas in Earth''s atmosphere?', ARRAY['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Argon'], 'Nitrogen', 'Nitrogen makes up about 78% of Earth''s atmosphere.', 1),
('chemistry', 'What is the chemical symbol for gold?', ARRAY['Go', 'Gd', 'Au', 'Ag'], 'Au', 'The chemical symbol for gold is Au from the Latin word aurum.', 1),
('chemistry', 'What is the chemical symbol for carbon?', ARRAY['Ca', 'Co', 'C', 'Cr'], 'C', 'The chemical symbol for carbon is C.', 1),
('chemistry', 'What is the chemical symbol for iron?', ARRAY['Ir', 'Fe', 'In', 'Io'], 'Fe', 'The symbol for iron is Fe from the Latin ferrum.', 1),
('chemistry', 'What is the freezing point of water in Celsius?', ARRAY['0°C', '32°C', '100°C', '-10°C'], '0°C', 'Water freezes at 0 degrees Celsius.', 1),
('chemistry', 'What is the boiling point of water in Celsius?', ARRAY['50°C', '100°C', '150°C', '200°C'], '100°C', 'Water boils at 100 degrees Celsius.', 1),
('chemistry', 'Which element is needed for breathing?', ARRAY['Nitrogen', 'Oxygen', 'Carbon', 'Hydrogen'], 'Oxygen', 'Humans and animals need oxygen to breathe.', 1),
('chemistry', 'What gas do humans breathe out?', ARRAY['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 'Carbon dioxide', 'Humans exhale carbon dioxide.', 1),
('chemistry', 'Which of these is a liquid at room temperature?', ARRAY['Water', 'Iron', 'Salt', 'Sugar'], 'Water', 'Water is a liquid at room temperature.', 1),
('chemistry', 'What happens to water when it reaches 100°C?', ARRAY['It freezes', 'It boils', 'It evaporates instantly', 'It turns to ice'], 'It boils', 'Water boils at 100°C and turns into steam.', 1),
('chemistry', 'What is the chemical symbol for silver?', ARRAY['Si', 'Sv', 'Ag', 'Au'], 'Ag', 'The symbol for silver is Ag from the Latin argentum.', 1),
('chemistry', 'Which of these is NOT a state of matter?', ARRAY['Solid', 'Liquid', 'Gas', 'Energy'], 'Energy', 'Energy is not a state of matter — solid, liquid, and gas are.', 1),
('chemistry', 'What is the chemical symbol for sodium?', ARRAY['So', 'Na', 'Sd', 'Sm'], 'Na', 'The symbol for sodium is Na from the Latin natrium.', 1),
('chemistry', 'Which gas is commonly used in balloons to make them float?', ARRAY['Oxygen', 'Helium', 'Nitrogen', 'Carbon dioxide'], 'Helium', 'Helium is lighter than air and makes balloons float.', 1),
('chemistry', 'What is the pH of pure water?', ARRAY['1', '5', '7', '14'], '7', 'Pure water has a neutral pH of 7.', 1),
('chemistry', 'What is the chemical symbol for hydrogen?', ARRAY['Hy', 'Hd', 'H', 'Hg'], 'H', 'The chemical symbol for hydrogen is H.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === FOOTBALL ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('football', 'How many players are on a soccer team on the field?', ARRAY['9', '10', '11', '12'], '11', 'A soccer team has 11 players on the field including the goalkeeper.', 1),
('football', 'Which color card does a referee show for a serious foul?', ARRAY['Yellow', 'Red', 'Blue', 'Green'], 'Red', 'A red card means a player is sent off the field.', 1),
('football', 'What is the World Cup trophy called?', ARRAY['Golden Ball', 'World Cup Trophy', 'FIFA Cup', 'Jules Rimet Trophy'], 'FIFA Cup', 'The current trophy is officially called the FIFA World Cup Trophy.', 1),
('football', 'Which country has won the most World Cups (men''s)?', ARRAY['Germany', 'Argentina', 'Brazil', 'Italy'], 'Brazil', 'Brazil has won the men''s World Cup 5 times.', 1),
('football', 'How long is a standard soccer match?', ARRAY['60 minutes', '90 minutes', '120 minutes', '45 minutes'], '90 minutes', 'A standard match is 90 minutes played as two 45-minute halves.', 1),
('football', 'What is the penalty spot distance from the goal?', ARRAY['10 yards', '11 yards', '12 yards', '18 yards'], '12 yards', 'The penalty spot is 12 yards (11 meters) from the goal line.', 1),
('football', 'What is a hat-trick in soccer?', ARRAY['Three saves', 'Three goals by one player', 'Three fouls', 'Three substitutions'], 'Three goals by one player', 'A hat-trick is when a player scores three goals in one match.', 1),
('football', 'Which position is the only one allowed to touch the ball with hands?', ARRAY['Defender', 'Midfielder', 'Forward', 'Goalkeeper'], 'Goalkeeper', 'Only the goalkeeper can use their hands within the penalty area.', 1),
('football', 'What happens when the ball goes over the sideline?', ARRAY['Corner kick', 'Goal kick', 'Throw-in', 'Free kick'], 'Throw-in', 'A throw-in is awarded when the ball goes over the sideline.', 1),
('football', 'How many substitutes are typically allowed in a professional match?', ARRAY['3', '5', '7', '11'], '5', 'Most professional leagues allow 5 substitutes per match.', 1),
('football', 'Which tournament is held every four years for national teams?', ARRAY['Champions League', 'World Cup', 'Premier League', 'Europa League'], 'World Cup', 'The FIFA World Cup is held every four years.', 1),
('football', 'What is the offside rule designed to prevent?', ARRAY['Fouls', 'Goal hanging', 'Time wasting', 'Diving'], 'Goal hanging', 'The offside rule prevents attackers from staying near the opponent''s goal.', 1),
('football', 'Which club has won the most UEFA Champions League titles?', ARRAY['Barcelona', 'Real Madrid', 'Bayern Munich', 'AC Milan'], 'Real Madrid', 'Real Madrid has won the Champions League 14 times.', 1),
('football', 'What is Lionel Messi''s nationality?', ARRAY['Brazilian', 'Argentinian', 'Spanish', 'Portuguese'], 'Argentinian', 'Lionel Messi is from Argentina.', 1),
('football', 'What is the width of a standard soccer goal?', ARRAY['6 yards', '7.32 yards', '8 yards', '10 yards'], '7.32 yards', 'A standard goal is 7.32 meters (8 yards) wide.', 1),
('football', 'Which country hosted the 2014 World Cup?', ARRAY['South Africa', 'Brazil', 'Russia', 'Qatar'], 'Brazil', 'Brazil hosted the 2014 FIFA World Cup.', 1),
('football', 'What does VAR stand for?', ARRAY['Video Assistant Referee', 'Virtual Action Review', 'Visual Accuracy Replay', 'Verified Assist Rule'], 'Video Assistant Referee', 'VAR is Video Assistant Referee technology.', 1),
('football', 'How many World Cups has Cristiano Ronaldo won?', ARRAY['0', '1', '2', '5'], '0', 'Cristiano Ronaldo has never won the men''s World Cup.', 1),
('football', 'What is the top tier of English football called?', ARRAY['Premier League', 'La Liga', 'Serie A', 'Bundesliga'], 'Premier League', 'The Premier League is the top division of English football.', 1),
('football', 'Which country invented modern soccer?', ARRAY['Brazil', 'Italy', 'England', 'France'], 'England', 'Modern soccer was codified in England in 1863.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === SPORTS ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('sports', 'In which sport do players use a racket and hit a ball over a net?', ARRAY['Basketball', 'Tennis', 'Golf', 'Baseball'], 'Tennis', 'Tennis is played with rackets and a ball over a net.', 1),
('sports', 'How many points is a touchdown worth in American football?', ARRAY['3', '5', '6', '7'], '6', 'A touchdown is worth 6 points in American football.', 1),
('sports', 'In which sport do players try to hit a ball with a bat and run between wickets?', ARRAY['Baseball', 'Cricket', 'Tennis', 'Golf'], 'Cricket', 'Cricket involves bats, balls, and wickets.', 1),
('sports', 'How many players are on a basketball team on the court?', ARRAY['3', '5', '6', '7'], '5', 'A basketball team has 5 players on the court at a time.', 1),
('sports', 'In which sport do you score goals by shooting a puck into a net?', ARRAY['Field hockey', 'Ice hockey', 'Lacrosse', 'Handball'], 'Ice hockey', 'Ice hockey players use sticks to shoot a puck into a goal.', 1),
('sports', 'What is a grand slam in tennis?', ARRAY['A powerful serve', 'Winning all four majors in a year', 'A 6-0 set', 'A double fault'], 'Winning all four majors in a year', 'A grand slam means winning all four major tournaments in a calendar year.', 1),
('sports', 'In which Olympic sport do athletes perform routines on a balance beam?', ARRAY['Swimming', 'Gymnastics', 'Diving', 'Figure skating'], 'Gymnastics', 'The balance beam is an apparatus in women''s artistic gymnastics.', 1),
('sports', 'How many holes are played in a standard round of golf?', ARRAY['9', '18', '27', '36'], '18', 'A standard round of golf consists of 18 holes.', 1),
('sports', 'In which sport do teams try to score a try by touching the ball to the ground?', ARRAY['American football', 'Rugby', 'Soccer', 'Handball'], 'Rugby', 'In rugby, a try is scored by touching the ball down in the try zone.', 1),
('sports', 'Which sport uses a shuttlecock instead of a ball?', ARRAY['Tennis', 'Badminton', 'Squash', 'Table tennis'], 'Badminton', 'Badminton uses a shuttlecock (also called a birdie).', 1),
('sports', 'What is the maximum score in a 10-pin bowling game?', ARRAY['200', '250', '300', '350'], '300', 'A perfect game in bowling is 300 (12 strikes in a row).', 1),
('sports', 'In which sport do players use a cue to hit balls on a felt-covered table?', ARRAY['Billiards', 'Table tennis', 'Shuffleboard', 'Curling'], 'Billiards', 'Billiards (pool) uses a cue stick and balls on a felt table.', 1),
('sports', 'Which country hosted the first modern Olympic Games in 1896?', ARRAY['France', 'Greece', 'England', 'United States'], 'Greece', 'The first modern Olympics were held in Athens, Greece.', 1),
('sports', 'In which sport do athletes throw a javelin?', ARRAY['Track and field', 'Baseball', 'Football', 'Cricket'], 'Track and field', 'Javelin throw is a track and field event.', 1),
('sports', 'How many laps make up the Indianapolis 500 race?', ARRAY['200', '300', '400', '500'], '200', 'The Indianapolis 500 is 200 laps (500 miles).', 1),
('sports', 'In boxing, what is a knockout?', ARRAY['A judge decision', 'When a fighter cannot get up', 'A foul', 'A draw'], 'When a fighter cannot get up', 'A knockout occurs when a fighter is knocked down and cannot get up.', 1),
('sports', 'Which sport features the Tour de France?', ARRAY['Running', 'Swimming', 'Cycling', 'Skiing'], 'Cycling', 'The Tour de France is the world''s most famous cycling race.', 1),
('sports', 'In which sport do athletes perform flips and twists off a springboard?', ARRAY['Gymnastics', 'Diving', 'Swimming', 'Cheerleading'], 'Diving', 'Diving involves jumping or falling into water from a springboard.', 1),
('sports', 'How many players are on a volleyball team on the court?', ARRAY['4', '5', '6', '7'], '6', 'A volleyball team has 6 players on the court at a time.', 1),
('sports', 'What does MLB stand for?', ARRAY['Major League Baseball', 'Minor League Basketball', 'Main League Boxing', 'Major Lacrosse Board'], 'Major League Baseball', 'MLB is Major League Baseball, the top US baseball league.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === GEOGRAPHY ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('geography', 'Which is the largest continent by land area?', ARRAY['Africa', 'Asia', 'North America', 'Europe'], 'Asia', 'Asia is the largest continent by land area.', 1),
('geography', 'Which ocean is the largest?', ARRAY['Atlantic', 'Indian', 'Pacific', 'Arctic'], 'Pacific', 'The Pacific Ocean is the largest and deepest ocean on Earth.', 1),
('geography', 'What is the capital of France?', ARRAY['London', 'Paris', 'Berlin', 'Madrid'], 'Paris', 'Paris is the capital city of France.', 1),
('geography', 'What is the longest river in the world?', ARRAY['Amazon', 'Nile', 'Mississippi', 'Yangtze'], 'Nile', 'The Nile River in Africa is generally considered the longest river.', 1),
('geography', 'Which is the highest mountain in the world?', ARRAY['K2', 'Mount Everest', 'Kilimanjaro', 'Mount Fuji'], 'Mount Everest', 'Mount Everest in Nepal is the highest mountain on Earth.', 1),
('geography', 'What is the smallest country in the world?', ARRAY['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], 'Vatican City', 'Vatican City is the smallest independent country in the world.', 1),
('geography', 'Which country has the most people?', ARRAY['United States', 'India', 'China', 'Indonesia'], 'India', 'India is currently the most populous country in the world.', 1),
('geography', 'What is the capital of Japan?', ARRAY['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], 'Tokyo', 'Tokyo is the capital and largest city of Japan.', 1),
('geography', 'Which desert is the largest hot desert?', ARRAY['Gobi', 'Sahara', 'Kalahari', 'Arabian'], 'Sahara', 'The Sahara Desert in Africa is the largest hot desert.', 1),
('geography', 'How many continents are there?', ARRAY['5', '6', '7', '8'], '7', 'There are 7 continents: Africa, Antarctica, Asia, Europe, North America, Australia, and South America.', 1),
('geography', 'What is the capital of Australia?', ARRAY['Sydney', 'Melbourne', 'Canberra', 'Perth'], 'Canberra', 'Canberra is the capital city of Australia.', 1),
('geography', 'Which country is known as the Land of the Rising Sun?', ARRAY['China', 'Japan', 'South Korea', 'Thailand'], 'Japan', 'Japan is called the Land of the Rising Sun.', 1),
('geography', 'Which river runs through London?', ARRAY['Seine', 'Thames', 'Danube', 'Rhine'], 'Thames', 'The River Thames flows through London.', 1),
('geography', 'What is the largest lake in the world?', ARRAY['Lake Superior', 'Caspian Sea', 'Lake Victoria', 'Lake Baikal'], 'Caspian Sea', 'The Caspian Sea is the largest lake by surface area.', 1),
('geography', 'Which country borders both the Atlantic and Pacific Oceans?', ARRAY['United States', 'Mexico', 'Colombia', 'Argentina'], 'United States', 'The United States has coastlines on both the Atlantic and Pacific.', 1),
('geography', 'What is the capital of Egypt?', ARRAY['Cairo', 'Alexandria', 'Luxor', 'Giza'], 'Cairo', 'Cairo is the capital and largest city of Egypt.', 1),
('geography', 'Which European country is shaped like a boot?', ARRAY['France', 'Spain', 'Italy', 'Greece'], 'Italy', 'Italy is famously shaped like a boot.', 1),
('geography', 'What is the largest island in the world?', ARRAY['Greenland', 'Madagascar', 'Borneo', 'Australia'], 'Greenland', 'Greenland is the world''s largest island.', 1),
('geography', 'Which country is the largest by area?', ARRAY['China', 'United States', 'Canada', 'Russia'], 'Russia', 'Russia is the largest country by land area.', 1),
('geography', 'What is the capital of Brazil?', ARRAY['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'], 'Brasília', 'Brasília is the capital city of Brazil.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === BIBLE ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('bible', 'According to the Bible, who built the ark?', ARRAY['Moses', 'Noah', 'Abraham', 'David'], 'Noah', 'God instructed Noah to build an ark to survive the great flood.', 1),
('bible', 'How many days did God take to create the world?', ARRAY['5', '6', '7', '10'], '6', 'God created the world in six days and rested on the seventh.', 1),
('bible', 'Who was the first man according to the Bible?', ARRAY['Eve', 'Adam', 'Cain', 'Abel'], 'Adam', 'Adam was the first man created by God in the Book of Genesis.', 1),
('bible', 'Which sea did Moses part?', ARRAY['Mediterranean Sea', 'Red Sea', 'Dead Sea', 'Sea of Galilee'], 'Red Sea', 'Moses parted the Red Sea so the Israelites could escape Egypt.', 1),
('bible', 'Who betrayed Jesus for 30 pieces of silver?', ARRAY['Peter', 'John', 'Judas', 'Thomas'], 'Judas', 'Judas Iscariot betrayed Jesus for 30 pieces of silver.', 1),
('bible', 'What is the first book of the Bible?', ARRAY['Exodus', 'Genesis', 'Leviticus', 'Deuteronomy'], 'Genesis', 'Genesis is the first book of the Bible.', 1),
('bible', 'How many disciples did Jesus have?', ARRAY['7', '10', '12', '14'], '12', 'Jesus had 12 disciples (apostles).', 1),
('bible', 'What did God create on the first day?', ARRAY['Water', 'Light', 'Animals', 'Plants'], 'Light', 'God created light on the first day, separating it from darkness.', 1),
('bible', 'Who was the mother of Jesus?', ARRAY['Mary', 'Martha', 'Elizabeth', 'Anna'], 'Mary', 'Mary was the mother of Jesus Christ.', 1),
('bible', 'Which fruit did Eve eat from the forbidden tree?', ARRAY['Apple', 'Fig', 'Grape', 'Orange'], 'Apple', 'Eve ate an apple from the tree of knowledge of good and evil.', 1),
('bible', 'What did David use to defeat Goliath?', ARRAY['A sword', 'A spear', 'A sling and a stone', 'A bow and arrow'], 'A sling and a stone', 'David defeated Goliath using a sling and a stone.', 1),
('bible', 'Who was the first king of Israel?', ARRAY['David', 'Solomon', 'Saul', 'Samuel'], 'Saul', 'Saul was the first king of Israel.', 1),
('bible', 'What is the last book of the Bible?', ARRAY['Revelation', 'Jude', 'John', 'Acts'], 'Revelation', 'Revelation is the last book of the New Testament.', 1),
('bible', 'How many plagues struck Egypt in Exodus?', ARRAY['7', '10', '12', '40'], '10', 'God sent 10 plagues upon Egypt to free the Israelites.', 1),
('bible', 'Who was sold into slavery by his brothers?', ARRAY['Moses', 'Jacob', 'Joseph', 'Benjamin'], 'Joseph', 'Joseph was sold into slavery by his jealous brothers.', 1),
('bible', 'What mountain did Moses receive the Ten Commandments on?', ARRAY['Mount Ararat', 'Mount Sinai', 'Mount Olympus', 'Mount Zion'], 'Mount Sinai', 'Moses received the Ten Commandments on Mount Sinai.', 1),
('bible', 'Which apostle denied Jesus three times?', ARRAY['Peter', 'Paul', 'John', 'Andrew'], 'Peter', 'Peter denied knowing Jesus three times before the rooster crowed.', 1),
('bible', 'What is the shortest verse in the Bible?', ARRAY['God is love', 'Jesus wept', 'Fear not', 'Rejoice always'], 'Jesus wept', '"Jesus wept" (John 11:35) is the shortest verse in the Bible.', 1),
('bible', 'How many days and nights did it rain during Noah''s flood?', ARRAY['7', '30', '40', '100'], '40', 'It rained for 40 days and 40 nights during the great flood.', 1),
('bible', 'Who built the Tower of Babel?', ARRAY['The Egyptians', 'The Israelites', 'The people of Babylon', 'The Romans'], 'The people of Babylon', 'The people of Babylon built the Tower of Babel.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === POLITICS ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('global-politics', 'Which document begins with "We the People"?', ARRAY['Declaration of Independence', 'US Constitution', 'Magna Carta', 'Bill of Rights'], 'US Constitution', 'The US Constitution begins with "We the People of the United States".', 1),
('global-politics', 'What is the United Nations primarily for?', ARRAY['Trade', 'Peace and cooperation', 'Banking', 'Sports'], 'Peace and cooperation', 'The UN was founded to promote international peace and cooperation.', 1),
('global-politics', 'How many branches of government does the US have?', ARRAY['2', '3', '4', '5'], '3', 'The US has three branches: executive, legislative, and judicial.', 1),
('global-politics', 'Who is the head of state in the United Kingdom?', ARRAY['The Prime Minister', 'The King or Queen', 'The Speaker', 'The Chancellor'], 'The King or Queen', 'The monarch is the head of state in the UK.', 1),
('global-politics', 'What is the voting age in most democracies?', ARRAY['16', '18', '21', '25'], '18', 'The voting age is 18 in most democratic countries.', 1),
('global-politics', 'What is the European Union?', ARRAY['A military alliance', 'A political and economic union', 'A sports federation', 'A trade company'], 'A political and economic union', 'The EU is a political and economic union of European countries.', 1),
('global-politics', 'Who was the first President of the United States?', ARRAY['John Adams', 'Thomas Jefferson', 'George Washington', 'Benjamin Franklin'], 'George Washington', 'George Washington was the first US President.', 1),
('global-politics', 'What does NATO stand for?', ARRAY['North Atlantic Treaty Organization', 'National Alliance Treaty Office', 'North American Trade Organization', 'New Atlantic Treaty Order'], 'North Atlantic Treaty Organization', 'NATO is a military alliance of North American and European countries.', 1),
('global-politics', 'Which country has the most people?', ARRAY['China', 'India', 'United States', 'Indonesia'], 'India', 'India currently has the world''s largest population.', 1),
('global-politics', 'What is a democracy?', ARRAY['Rule by one person', 'Rule by the people', 'Rule by a few', 'Rule by the military'], 'Rule by the people', 'Democracy means government by the people through elected representatives.', 1),
('global-politics', 'What is the capital of the United States?', ARRAY['New York', 'Los Angeles', 'Washington DC', 'Chicago'], 'Washington DC', 'Washington DC is the capital of the United States.', 1),
('global-politics', 'Which international organization has a flag with a world map?', ARRAY['NATO', 'United Nations', 'European Union', 'World Bank'], 'United Nations', 'The United Nations flag features a world map surrounded by olive branches.', 1),
('global-politics', 'What does GDP stand for?', ARRAY['Gross Domestic Product', 'General Development Plan', 'Global Distribution Protocol', 'Government Defense Policy'], 'Gross Domestic Product', 'GDP is the total value of goods and services produced in a country.', 1),
('global-politics', 'How often are US presidential elections held?', ARRAY['Every 2 years', 'Every 4 years', 'Every 5 years', 'Every 6 years'], 'Every 4 years', 'US presidential elections are held every 4 years.', 1),
('global-politics', 'What is the main purpose of taxes?', ARRAY['To punish citizens', 'To fund government services', 'To control businesses', 'To limit trade'], 'To fund government services', 'Taxes fund public services like roads, schools, and healthcare.', 1),
('global-politics', 'Which country is a permanent member of the UN Security Council?', ARRAY['Germany', 'Japan', 'France', 'India'], 'France', 'France is one of the five permanent members of the UN Security Council.', 1),
('global-politics', 'What is a constitution?', ARRAY['A type of government', 'A set of fundamental laws', 'An international treaty', 'A political party'], 'A set of fundamental laws', 'A constitution is the fundamental set of principles or laws of a country.', 1),
('global-politics', 'Which war lasted from 1914 to 1918?', ARRAY['World War II', 'World War I', 'The Civil War', 'The Cold War'], 'World War I', 'World War I lasted from 1914 to 1918.', 1),
('global-politics', 'What does the term "embargo" mean?', ARRAY['A tax on imports', 'A ban on trade', 'A trade agreement', 'A military alliance'], 'A ban on trade', 'An embargo is an official ban on trade with a particular country.', 1),
('global-politics', 'Which political system is also known as a "dictatorship"?', ARRAY['Democracy', 'Authoritarianism', 'Republic', 'Monarchy'], 'Authoritarianism', 'Authoritarianism is a system where power is concentrated in one leader or group.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === HISTORY ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('history', 'Who was the first President of the United States?', ARRAY['Thomas Jefferson', 'George Washington', 'Abraham Lincoln', 'John Adams'], 'George Washington', 'George Washington served as the first US President from 1789 to 1797.', 1),
('history', 'In which year did World War II end?', ARRAY['1944', '1945', '1946', '1947'], '1945', 'World War II ended in 1945 after the surrender of Germany and Japan.', 1),
('history', 'Which ancient civilization built the pyramids of Giza?', ARRAY['Romans', 'Greeks', 'Egyptians', 'Persians'], 'Egyptians', 'The ancient Egyptians built the pyramids of Giza as tombs for pharaohs.', 1),
('history', 'Who discovered America in 1492?', ARRAY['Vasco da Gama', 'Christopher Columbus', 'Ferdinand Magellan', 'Amerigo Vespucci'], 'Christopher Columbus', 'Christopher Columbus reached the Americas in 1492.', 1),
('history', 'Which famous wall divided Berlin?', ARRAY['Great Wall', 'Berlin Wall', 'Hadrian''s Wall', 'Western Wall'], 'Berlin Wall', 'The Berlin Wall divided East and West Berlin from 1961 to 1989.', 1),
('history', 'Who was the first man to walk on the moon?', ARRAY['Buzz Aldrin', 'Neil Armstrong', 'Yuri Gagarin', 'John Glenn'], 'Neil Armstrong', 'Neil Armstrong walked on the moon in 1969 during Apollo 11.', 1),
('history', 'Which ship sank on its maiden voyage in 1912?', ARRAY['Lusitania', 'Titanic', 'Britannic', 'Andrea Doria'], 'Titanic', 'The RMS Titanic sank on its maiden voyage in April 1912.', 1),
('history', 'What ancient wonder was located in Alexandria, Egypt?', ARRAY['Colossus', 'Lighthouse', 'Hanging Gardens', 'Temple of Artemis'], 'Lighthouse', 'The Lighthouse of Alexandria was one of the Seven Wonders of the Ancient World.', 1),
('history', 'Which empire was ruled by Genghis Khan?', ARRAY['Roman Empire', 'Mongol Empire', 'Ottoman Empire', 'Persian Empire'], 'Mongol Empire', 'Genghis Khan founded and ruled the Mongol Empire.', 1),
('history', 'What year did World War I begin?', ARRAY['1913', '1914', '1915', '1916'], '1914', 'World War I began in 1914 after the assassination of Archduke Franz Ferdinand.', 1),
('history', 'Who was the first Emperor of Rome?', ARRAY['Julius Caesar', 'Augustus', 'Nero', 'Caligula'], 'Augustus', 'Augustus (Octavian) became the first Roman Emperor in 27 BC.', 1),
('history', 'Which civilization built Machu Picchu?', ARRAY['Aztecs', 'Incas', 'Mayans', 'Olmecs'], 'Incas', 'Machu Picchu was built by the Inca Empire in modern-day Peru.', 1),
('history', 'What was the Renaissance?', ARRAY['A war', 'A cultural rebirth', 'A religious movement', 'An exploration era'], 'A cultural rebirth', 'The Renaissance was a period of cultural and artistic rebirth in Europe.', 1),
('history', 'Who wrote the Declaration of Independence?', ARRAY['George Washington', 'Thomas Jefferson', 'Benjamin Franklin', 'John Adams'], 'Thomas Jefferson', 'Thomas Jefferson was the primary author of the Declaration of Independence.', 1),
('history', 'Which empire built the Colosseum?', ARRAY['Greek Empire', 'Roman Empire', 'Egyptian Empire', 'Persian Empire'], 'Roman Empire', 'The Colosseum was built by the Roman Empire in the first century AD.', 1),
('history', 'What is the oldest known civilization?', ARRAY['Greek', 'Mesopotamian', 'Chinese', 'Indian'], 'Mesopotamian', 'Mesopotamia (modern-day Iraq) is considered the world''s oldest civilization.', 1),
('history', 'Who was the last pharaoh of Egypt?', ARRAY['Nefertiti', 'Cleopatra', 'Hatshepsut', 'Ramesses'], 'Cleopatra', 'Cleopatra VII was the last active pharaoh of Ancient Egypt.', 1),
('history', 'Which explorer first sailed around the world?', ARRAY['Columbus', 'Magellan', 'Drake', 'Cook'], 'Magellan', 'Ferdinand Magellan led the first circumnavigation of the globe (completed by his crew).', 1),
('history', 'What was the Cold War primarily between?', ARRAY['US and Germany', 'US and Soviet Union', 'Britain and France', 'China and Japan'], 'US and Soviet Union', 'The Cold War was between the United States and the Soviet Union.', 1),
('history', 'Which document signed in 1215 limited the power of the English king?', ARRAY['Bill of Rights', 'Magna Carta', 'Constitution', 'Petition of Right'], 'Magna Carta', 'The Magna Carta signed in 1215 limited the power of King John of England.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === GENERAL KNOWLEDGE ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('general_knowledge', 'How many months are in a year?', ARRAY['10', '11', '12', '13'], '12', 'There are 12 months in a year.', 1),
('general_knowledge', 'What color are most school buses?', ARRAY['Red', 'Yellow', 'Blue', 'White'], 'Yellow', 'Most school buses are painted yellow for visibility and safety.', 1),
('general_knowledge', 'How many legs does a dog have?', ARRAY['2', '3', '4', '5'], '4', 'Dogs have 4 legs.', 1),
('general_knowledge', 'What do bees produce?', ARRAY['Milk', 'Honey', 'Wax', 'Silk'], 'Honey', 'Bees produce honey from flower nectar.', 1),
('general_knowledge', 'What is the largest mammal in the world?', ARRAY['Elephant', 'Blue whale', 'Giraffe', 'Hippopotamus'], 'Blue whale', 'The blue whale is the largest animal on Earth.', 1),
('general_knowledge', 'What planet do we live on?', ARRAY['Mars', 'Earth', 'Venus', 'Jupiter'], 'Earth', 'Earth is our home planet.', 1),
('general_knowledge', 'How many days are in a week?', ARRAY['5', '6', '7', '8'], '7', 'There are 7 days in a week.', 1),
('general_knowledge', 'What is the boiling point of water in Celsius?', ARRAY['50°C', '100°C', '150°C', '200°C'], '100°C', 'Water boils at 100 degrees Celsius at sea level.', 1),
('general_knowledge', 'How many letters are in the English alphabet?', ARRAY['24', '25', '26', '27'], '26', 'The English alphabet has 26 letters.', 1),
('general_knowledge', 'What is the tallest animal on Earth?', ARRAY['Elephant', 'Giraffe', 'Camel', 'Horse'], 'Giraffe', 'The giraffe is the tallest living animal.', 1),
('general_knowledge', 'Which sense do you use to read a book?', ARRAY['Hearing', 'Sight', 'Touch', 'Smell'], 'Sight', 'You use your sense of sight to read.', 1),
('general_knowledge', 'What instrument do doctors use to listen to your heartbeat?', ARRAY['Thermometer', 'Stethoscope', 'X-ray', 'Blood pressure cuff'], 'Stethoscope', 'A stethoscope is used to listen to heart and lung sounds.', 1),
('general_knowledge', 'What is the currency used in the United States?', ARRAY['Euro', 'Dollar', 'Pound', 'Yen'], 'Dollar', 'The US Dollar is the currency of the United States.', 1),
('general_knowledge', 'How many seconds are in a minute?', ARRAY['30', '45', '60', '100'], '60', 'There are 60 seconds in a minute.', 1),
('general_knowledge', 'What is the opposite of day?', ARRAY['Morning', 'Night', 'Evening', 'Noon'], 'Night', 'Night is the opposite of day.', 1),
('general_knowledge', 'Which of these is a primary color?', ARRAY['Green', 'Purple', 'Blue', 'Orange'], 'Blue', 'Blue is a primary color (along with red and yellow).', 1),
('general_knowledge', 'What appliance is used to keep food cold?', ARRAY['Oven', 'Refrigerator', 'Toaster', 'Microwave'], 'Refrigerator', 'A refrigerator keeps food cold and fresh.', 1),
('general_knowledge', 'What is the most spoken language in the world?', ARRAY['English', 'Mandarin Chinese', 'Spanish', 'Hindi'], 'English', 'English is the most spoken language by total speakers.', 1),
('general_knowledge', 'How many zeros are in one thousand?', ARRAY['2', '3', '4', '5'], '3', 'One thousand is written as 1000, which has 3 zeros.', 1),
('general_knowledge', 'Which planet is known as the Morning Star?', ARRAY['Mars', 'Venus', 'Mercury', 'Jupiter'], 'Venus', 'Venus is often called the Morning Star or Evening Star because of its brightness.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === MOVIES ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('movies', 'Which animated movie features a clownfish named Nemo?', ARRAY['Shark Tale', 'Finding Nemo', 'The Little Mermaid', 'Rio'], 'Finding Nemo', 'Finding Nemo is about a clownfish searching for his son.', 1),
('movies', 'Who played Iron Man in the Marvel movies?', ARRAY['Chris Evans', 'Robert Downey Jr.', 'Chris Hemsworth', 'Mark Ruffalo'], 'Robert Downey Jr.', 'Robert Downey Jr. played Tony Stark / Iron Man.', 1),
('movies', 'Which movie features a teenager named Marty McFly?', ARRAY['Back to the Future', 'E.T.', 'The Goonies', 'Ghostbusters'], 'Back to the Future', 'Back to the Future follows Marty McFly traveling through time.', 1),
('movies', 'What is the highest-grossing film of all time (not adjusted for inflation)?', ARRAY['Titanic', 'Avatar', 'Avengers: Endgame', 'Star Wars'], 'Avatar', 'Avatar (2009) is the highest-grossing film of all time.', 1),
('movies', 'Which film features the character Darth Vader?', ARRAY['Star Trek', 'Star Wars', 'The Matrix', 'Doctor Who'], 'Star Wars', 'Darth Vader is the iconic villain from Star Wars.', 1),
('movies', 'In which movie does Forrest Gump say "Life is like a box of chocolates"?', ARRAY['Big', 'Forrest Gump', 'Cast Away', 'Philadelphia'], 'Forrest Gump', 'Forrest Gump is famous for the "box of chocolates" quote.', 1),
('movies', 'Which studio produces movies with a roaring lion logo?', ARRAY['Universal', 'MGM', 'Warner Bros.', 'Paramount'], 'MGM', 'MGM''s logo features a roaring lion.', 1),
('movies', 'What kind of animal is Simba in The Lion King?', ARRAY['Tiger', 'Lion', 'Cheetah', 'Leopard'], 'Lion', 'Simba is a young lion who becomes king of the Pride Lands.', 1),
('movies', 'Who directed Jurassic Park?', ARRAY['James Cameron', 'Steven Spielberg', 'Ridley Scott', 'George Lucas'], 'Steven Spielberg', 'Steven Spielberg directed Jurassic Park (1993).', 1),
('movies', 'Which movie won the first Academy Award for Best Animated Feature?', ARRAY['Toy Story', 'Shrek', 'Finding Nemo', 'Spirited Away'], 'Shrek', 'Shrek won the first Oscar for Best Animated Feature in 2002.', 1),
('movies', 'What is the name of the hobbit played by Elijah Wood?', ARRAY['Bilbo', 'Frodo', 'Sam', 'Pippin'], 'Frodo', 'Elijah Wood played Frodo Baggins in The Lord of the Rings.', 1),
('movies', 'Which movie is about a shark terrorizing a beach town?', ARRAY['Jaws', 'Sharknado', 'The Shallows', 'Deep Blue Sea'], 'Jaws', 'Jaws (1975) is about a great white shark attacking a beach town.', 1),
('movies', 'Who played Jack Dawson in Titanic?', ARRAY['Brad Pitt', 'Leonardo DiCaprio', 'Tom Cruise', 'Johnny Depp'], 'Leonardo DiCaprio', 'Leonardo DiCaprio played Jack Dawson in Titanic.', 1),
('movies', 'Which movie series features wizards and magic?', ARRAY['Twilight', 'Harry Potter', 'The Hunger Games', 'Percy Jackson'], 'Harry Potter', 'Harry Potter follows a young wizard and his adventures.', 1),
('movies', 'What year was the first Mickey Mouse cartoon released?', ARRAY['1925', '1928', '1930', '1935'], '1928', 'Steamboat Willie, the first Mickey Mouse cartoon, debuted in 1928.', 1),
('movies', 'In The Wizard of Oz, what color is the brick road?', ARRAY['Red', 'Yellow', 'Blue', 'Green'], 'Yellow', 'The Yellow Brick Road leads to the Emerald City.', 1),
('movies', 'Which actor played the Joker in The Dark Knight?', ARRAY['Jack Nicholson', 'Heath Ledger', 'Jared Leto', 'Joaquin Phoenix'], 'Heath Ledger', 'Heath Ledger famously played the Joker in The Dark Knight (2008).', 1),
('movies', 'What is the name of the fictional African country in Black Panther?', ARRAY['Wakanda', 'Zamunda', 'Genovia', 'Latveria'], 'Wakanda', 'Wakanda is the technologically advanced nation in Black Panther.', 1),
('movies', 'Which movie features the song "My Heart Will Go On"?', ARRAY['Titanic', 'The Bodyguard', 'Dirty Dancing', 'Grease'], 'Titanic', 'Celine Dion sang "My Heart Will Go On" for the movie Titanic.', 1),
('movies', 'Who is the main character in the Matrix series?', ARRAY['Trinity', 'Morpheus', 'Neo', 'Agent Smith'], 'Neo', 'Keanu Reeves plays Neo, the main character in The Matrix.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === TELEVISION ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('television', 'In Friends, what is the name of the coffee shop?', ARRAY['Central Perk', 'Starbucks', 'The Coffee Bean', 'Moondance Diner'], 'Central Perk', 'Central Perk is the coffee shop where the Friends characters hang out.', 1),
('television', 'How many seasons did Breaking Bad have?', ARRAY['3', '4', '5', '6'], '5', 'Breaking Bad ran for 5 seasons from 2008 to 2013.', 1),
('television', 'Which TV show features a yellow family with a dad named Homer?', ARRAY['Family Guy', 'The Simpsons', 'South Park', 'King of the Hill'], 'The Simpsons', 'The Simpsons features Homer, Marge, Bart, Lisa, and Maggie.', 1),
('television', 'In which TV show do contestants try to guess a word from a drawing?', ARRAY['Jeopardy!', 'Pictionary', 'Wheel of Fortune', 'Family Feud'], 'Pictionary', 'In Pictionary, contestants draw words for their teammates to guess.', 1),
('television', 'What is the longest-running American sitcom?', ARRAY['Friends', 'The Simpsons', 'Cheers', 'Seinfeld'], 'The Simpsons', 'The Simpsons is the longest-running American sitcom (since 1989).', 1),
('television', 'Which medical drama follows the staff of Seattle Grace Hospital?', ARRAY['House', 'Grey''s Anatomy', 'ER', 'Scrubs'], 'Grey''s Anatomy', 'Grey''s Anatomy is set at Seattle Grace Hospital.', 1),
('television', 'What TV show features dragons and the Iron Throne?', ARRAY['Lord of the Rings', 'Game of Thrones', 'The Witcher', 'Vikings'], 'Game of Thrones', 'Game of Thrones is a fantasy series about ruling the Seven Kingdoms.', 1),
('television', 'Which reality show tests cooking skills?', ARRAY['Survivor', 'Hell''s Kitchen', 'The Amazing Race', 'Big Brother'], 'Hell''s Kitchen', 'Hell''s Kitchen is a cooking competition hosted by Gordon Ramsay.', 1),
('television', 'In which TV show did Walter White sell methamphetamine?', ARRAY['Breaking Bad', 'Narcos', 'The Wire', 'Ozark'], 'Breaking Bad', 'Walter White is the main character of Breaking Bad.', 1),
('television', 'Who hosted Jeopardy! for over 30 years?', ARRAY['Bob Barker', 'Alex Trebek', 'Pat Sajak', 'Steve Harvey'], 'Alex Trebek', 'Alex Trebek hosted Jeopardy! from 1984 until his death in 2020.', 1),
('television', 'What TV series is set in the fictional office of Dunder Mifflin?', ARRAY['The Office', 'Parks and Rec', '30 Rock', 'Community'], 'The Office', 'The Office takes place at Dunder Mifflin Paper Company.', 1),
('television', 'Which kids show features a yellow sponge who lives in a pineapple?', ARRAY['SpongeBob SquarePants', 'Rugrats', 'The Fairly OddParents', 'Arthur'], 'SpongeBob SquarePants', 'SpongeBob SquarePants lives in a pineapple under the sea.', 1),
('television', 'In which show does Sheldon Cooper appear?', ARRAY['The Big Bang Theory', 'How I Met Your Mother', 'Two and a Half Men', 'The IT Crowd'], 'The Big Bang Theory', 'Sheldon Cooper is a main character in The Big Bang Theory.', 1),
('television', 'What is the reality show where people survive on an island?', ARRAY['Big Brother', 'Survivor', 'Alone', 'The Island'], 'Survivor', 'Survivor strands contestants in a remote location to compete.', 1),
('television', 'Which Netflix series follows the Stranger Things kids?', ARRAY['Dark', 'Stranger Things', 'The OA', 'The Umbrella Academy'], 'Stranger Things', 'Stranger Things follows kids in Hawkins, Indiana dealing with supernatural events.', 1),
('television', 'What does TV stand for?', ARRAY['Transmitted Video', 'Television', 'TeleVision', 'True View'], 'Television', 'TV stands for television.', 1),
('television', 'Which show features characters like Jerry, George, Elaine, and Kramer?', ARRAY['Friends', 'Seinfeld', 'Cheers', 'Frasier'], 'Seinfeld', 'Seinfeld is about comedian Jerry Seinfeld and his friends.', 1),
('television', 'What channel is known for nature documentaries?', ARRAY['MTV', 'National Geographic', 'ESPN', 'CNN'], 'National Geographic', 'National Geographic is famous for nature and science documentaries.', 1),
('television', 'In which show do contestants answer trivia questions for money?', ARRAY['Who Wants to Be a Millionaire?', 'The Price Is Right', 'Let''s Make a Deal', 'The Chase'], 'Who Wants to Be a Millionaire?', 'Contestants answer increasingly difficult trivia questions for cash prizes.', 1),
('television', 'Which cartoon features a boy named Bart?', ARRAY['Family Guy', 'The Simpsons', 'Arthur', 'Phineas and Ferb'], 'The Simpsons', 'Bart Simpson is one of the main characters in The Simpsons.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === VIDEO GAMES ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('video_games', 'Which plumber is the mascot of Nintendo?', ARRAY['Sonic', 'Mario', 'Crash', 'Spyro'], 'Mario', 'Mario is Nintendo''s mascot and one of the most famous video game characters.', 1),
('video_games', 'What does the "64" in Nintendo 64 stand for?', ARRAY['64-bit processor', '64 games', '64 MB memory', '1996 release'], '64-bit processor', 'The Nintendo 64 featured a 64-bit processor.', 1),
('video_games', 'Which game features a blocky world where you mine and build?', ARRAY['Terraria', 'Minecraft', 'Roblox', 'Fortnite'], 'Minecraft', 'Minecraft is a sandbox game about placing blocks and going on adventures.', 1),
('video_games', 'In which game do players fight to be the last one standing?', ARRAY['Fortnite', 'Minecraft', 'The Sims', 'Animal Crossing'], 'Fortnite', 'Fortnite is a battle royale game where 100 players fight until one remains.', 1),
('video_games', 'Which video game console was made by Sony?', ARRAY['Xbox', 'PlayStation', 'Nintendo Switch', 'Sega Genesis'], 'PlayStation', 'PlayStation is a series of gaming consoles by Sony.', 1),
('video_games', 'What is the best-selling video game of all time?', ARRAY['Grand Theft Auto V', 'Minecraft', 'Tetris', 'Wii Sports'], 'Minecraft', 'Minecraft is the best-selling video game of all time.', 1),
('video_games', 'Which game features a character named Link?', ARRAY['The Legend of Zelda', 'Super Mario', 'Final Fantasy', 'Metroid'], 'The Legend of Zelda', 'Link is the main hero in The Legend of Zelda series.', 1),
('video_games', 'What is the name of the yellow circle character from Pac-Man?', ARRAY['Pac-Man', 'Ms. Pac-Man', 'Blinky', 'Pac-Dot'], 'Pac-Man', 'The main character in Pac-Man is a yellow circle that eats dots.', 1),
('video_games', 'Which company makes the Xbox?', ARRAY['Sony', 'Microsoft', 'Nintendo', 'Sega'], 'Microsoft', 'The Xbox is a gaming console brand from Microsoft.', 1),
('video_games', 'Which game involves building structures and fighting zombies at night?', ARRAY['Minecraft', 'Fortnite', 'Call of Duty', 'Resident Evil'], 'Minecraft', 'In Minecraft, zombies come out at night and players must build shelter.', 1),
('video_games', 'What does RPG stand for?', ARRAY['Real-time Play Game', 'Role-Playing Game', 'Rapid Power Gaming', 'Random Puzzle Generator'], 'Role-Playing Game', 'RPG stands for Role-Playing Game.', 1),
('video_games', 'Which mobile game involves matching colored gems?', ARRAY['Candy Crush', 'Angry Birds', 'Clash of Clans', 'Subway Surfers'], 'Candy Crush', 'Candy Crush Saga is a match-three puzzle game.', 1),
('video_games', 'In which year was the first Super Mario Bros. released?', ARRAY['1983', '1985', '1987', '1990'], '1985', 'Super Mario Bros. was released in 1985 for the NES.', 1),
('video_games', 'Which game series features Master Chief?', ARRAY['Gears of War', 'Halo', 'Call of Duty', 'Destiny'], 'Halo', 'Master Chief is the main character in the Halo series.', 1),
('video_games', 'What is a "boss" in video games?', ARRAY['A save point', 'A difficult enemy', 'A bonus level', 'A type of weapon'], 'A difficult enemy', 'A boss is a powerful enemy that players must defeat to progress.', 1),
('video_games', 'Which game uses a pikmin-like creature called a Pikmin?', ARRAY['Pokémon', 'Pikmin', 'Kirby', 'Splatoon'], 'Pikmin', 'Pikmin stars tiny plant-like creatures that help the player.', 1),
('video_games', 'What is the name of Sonic the Hedgehog''s best friend?', ARRAY['Knuckles', 'Tails', 'Shadow', 'Amy'], 'Tails', 'Tails (Miles Prower) is Sonic''s two-tailed fox friend.', 1),
('video_games', 'Which handheld console was made by Nintendo and features two screens?', ARRAY['Game Boy', 'Nintendo DS', 'PlayStation Portable', 'Sega Game Gear'], 'Nintendo DS', 'The Nintendo DS features two screens, one of which is a touchscreen.', 1),
('video_games', 'In which game do you collect Pokémon and battle trainers?', ARRAY['Yu-Gi-Oh!', 'Pokémon', 'Digimon', 'Bakugan'], 'Pokémon', 'The Pokémon games involve catching, training, and battling creatures.', 1),
('video_games', 'What video game genre is FIFA?', ARRAY['Racing', 'Sports', 'Action', 'Puzzle'], 'Sports', 'FIFA is a football (soccer) sports simulation game.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === MUSIC ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('music', 'How many strings does a standard guitar have?', ARRAY['4', '5', '6', '7'], '6', 'A standard guitar has 6 strings.', 1),
('music', 'Which musical instrument has black and white keys?', ARRAY['Guitar', 'Piano', 'Violin', 'Drums'], 'Piano', 'A piano has black and white keys that produce sound.', 1),
('music', 'What is the highest female singing voice called?', ARRAY['Alto', 'Soprano', 'Tenor', 'Bass'], 'Soprano', 'Soprano is the highest female vocal range.', 1),
('music', 'Who is known as the King of Pop?', ARRAY['Prince', 'Michael Jackson', 'Elvis Presley', 'Madonna'], 'Michael Jackson', 'Michael Jackson is famously known as the King of Pop.', 1),
('music', 'Which band wrote "Bohemian Rhapsody"?', ARRAY['The Beatles', 'Queen', 'Led Zeppelin', 'Pink Floyd'], 'Queen', 'Queen wrote and performed "Bohemian Rhapsody".', 1),
('music', 'How many notes are in a standard musical octave?', ARRAY['5', '7', '8', '12'], '8', 'An octave contains 8 notes (do-re-mi-fa-so-la-ti-do).', 1),
('music', 'Which instrument is part of the brass family?', ARRAY['Flute', 'Trumpet', 'Clarinet', 'Cello'], 'Trumpet', 'The trumpet is a brass instrument.', 1),
('music', 'Who sang "Rolling in the Deep" (2010)?', ARRAY['Beyoncé', 'Adele', 'Lady Gaga', 'Rihanna'], 'Adele', 'Adele sang "Rolling in the Deep".', 1),
('music', 'What tempo marking means "slow" in music?', ARRAY['Allegro', 'Adagio', 'Presto', 'Vivace'], 'Adagio', 'Adagio means slow and stately tempo in music.', 1),
('music', 'Which of these is a string instrument?', ARRAY['Trumpet', 'Violin', 'Flute', 'Saxophone'], 'Violin', 'The violin is a string instrument played with a bow.', 1),
('music', 'Who was the lead singer of The Beatles?', ARRAY['Paul McCartney', 'John Lennon', 'George Harrison', 'Ringo Starr'], 'John Lennon', 'John Lennon was one of the lead singers and founder of The Beatles.', 1),
('music', 'What does the treble clef symbol represent?', ARRAY['Low notes', 'High notes', 'Rhythm', 'Silence'], 'High notes', 'The treble clef indicates higher-pitched notes on the staff.', 1),
('music', 'Which year did Michael Jackson release "Thriller"?', ARRAY['1980', '1982', '1984', '1986'], '1982', 'Michael Jackson released "Thriller" in 1982.', 1),
('music', 'What is the most-played instrument in the world?', ARRAY['Guitar', 'Piano', 'Drums', 'Voice'], 'Voice', 'The human voice is the most played instrument worldwide.', 1),
('music', 'Which famous composer was deaf?', ARRAY['Mozart', 'Bach', 'Beethoven', 'Chopin'], 'Beethoven', 'Ludwig van Beethoven continued composing even after going completely deaf.', 1),
('music', 'What genre of music originated in New Orleans?', ARRAY['Rock', 'Jazz', 'Country', 'Hip Hop'], 'Jazz', 'Jazz music originated in New Orleans in the early 20th century.', 1),
('music', 'Which band had a drummer named Ringo Starr?', ARRAY['The Rolling Stones', 'The Beatles', 'The Who', 'The Kinks'], 'The Beatles', 'Ringo Starr was the drummer for The Beatles.', 1),
('music', 'What is a group of singers performing together called?', ARRAY['Band', 'Orchestra', 'Choir', 'Ensemble'], 'Choir', 'A choir is a group of singers who perform together.', 1),
('music', 'Who sang "Like a Rolling Stone"?', ARRAY['Bob Dylan', 'Bruce Springsteen', 'Elvis Presley', 'Johnny Cash'], 'Bob Dylan', 'Bob Dylan wrote and sang "Like a Rolling Stone".', 1),
('music', 'What is the fastest known rap song syllable count?', ARRAY['Godzilla by Eminem', 'Rap God by Eminem', 'Guinness World Record song', 'Killshot by Eminem'], 'Rap God by Eminem', 'Eminem''s "Rap God" holds records for rapid-fire syllables.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === ANIMALS ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('animals', 'Which animal is known as the King of the Jungle?', ARRAY['Tiger', 'Lion', 'Bear', 'Elephant'], 'Lion', 'The lion is often called the King of the Jungle.', 1),
('animals', 'What is the largest mammal in the world?', ARRAY['Elephant', 'Blue whale', 'Giraffe', 'Hippopotamus'], 'Blue whale', 'The blue whale is the largest mammal on Earth.', 1),
('animals', 'How many legs does a spider have?', ARRAY['6', '8', '10', '12'], '8', 'Spiders have 8 legs.', 1),
('animals', 'Which animal can change its color to blend in?', ARRAY['Lizard', 'Chameleon', 'Snake', 'Frog'], 'Chameleon', 'Chameleons can change their skin color for camouflage.', 1),
('animals', 'Which bird cannot fly?', ARRAY['Eagle', 'Penguin', 'Sparrow', 'Hawk'], 'Penguin', 'Penguins are flightless birds that are excellent swimmers.', 1),
('animals', 'What do pandas mainly eat?', ARRAY['Meat', 'Bamboo', 'Fish', 'Fruit'], 'Bamboo', 'Giant pandas eat mostly bamboo.', 1),
('animals', 'Which animal lives in a hive and produces honey?', ARRAY['Ant', 'Bee', 'Wasp', 'Fly'], 'Bee', 'Bees live in hives and produce honey.', 1),
('animals', 'What is the fastest land animal?', ARRAY['Lion', 'Cheetah', 'Horse', 'Greyhound'], 'Cheetah', 'The cheetah is the fastest land animal, reaching speeds up to 70 mph.', 1),
('animals', 'Which animal has a long trunk?', ARRAY['Rhinoceros', 'Elephant', 'Hippopotamus', 'Walrus'], 'Elephant', 'Elephants have a long trunk used for breathing, eating, and lifting.', 1),
('animals', 'What type of animal is a dolphin?', ARRAY['Fish', 'Mammal', 'Reptile', 'Amphibian'], 'Mammal', 'Dolphins are marine mammals, not fish.', 1),
('animals', 'Which animal is the symbol of wisdom?', ARRAY['Fox', 'Owl', 'Wolf', 'Eagle'], 'Owl', 'The owl is a traditional symbol of wisdom and knowledge.', 1),
('animals', 'How many hearts does an octopus have?', ARRAY['1', '2', '3', '4'], '3', 'An octopus has 3 hearts.', 1),
('animals', 'Which animal is known to "play dead" as a defense?', ARRAY['Opossum', 'Raccoon', 'Skunk', 'Badger'], 'Opossum', 'Opossums play dead (play possum) as a defense mechanism.', 1),
('animals', 'What is a baby cat called?', ARRAY['Puppy', 'Kitten', 'Cub', 'Foal'], 'Kitten', 'A baby cat is called a kitten.', 1),
('animals', 'Which animal has stripes?', ARRAY['Leopard', 'Tiger', 'Panther', 'Cheetah'], 'Tiger', 'Tigers have distinctive orange and black stripes.', 1),
('animals', 'Which animal is the tallest on Earth?', ARRAY['Elephant', 'Giraffe', 'Camel', 'Horse'], 'Giraffe', 'The giraffe is the tallest living animal.', 1),
('animals', 'What do you call a group of fish?', ARRAY['Herd', 'School', 'Pack', 'Flock'], 'School', 'A group of fish is called a school.', 1),
('animals', 'Which animal is born with spots that later become its stripes?', ARRAY['Zebra', 'Tiger', 'Leopard', 'Cheetah'], 'Tiger', 'Baby tigers are born with spots that fade as their stripes develop.', 1),
('animals', 'What is the only mammal that can truly fly?', ARRAY['Flying squirrel', 'Bat', 'Bird', 'Pterodactyl'], 'Bat', 'Bats are the only mammals capable of true flight.', 1),
('animals', 'Which animal is the largest species of shark?', ARRAY['Great white shark', 'Whale shark', 'Hammerhead shark', 'Tiger shark'], 'Whale shark', 'The whale shark is the largest shark and largest fish in the ocean.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- === COMPUTERS ===
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('computers', 'What does CPU stand for?', ARRAY['Central Processing Unit', 'Computer Personal Unit', 'Core Program Utility', 'Central Power Unit'], 'Central Processing Unit', 'The CPU is the brain of the computer.', 1),
('computers', 'What does "www" stand for?', ARRAY['World Wide Web', 'Web World Wide', 'World Web Wide', 'Wide Web World'], 'World Wide Web', 'WWW stands for World Wide Web.', 1),
('computers', 'What does "RAM" stand for?', ARRAY['Read Access Memory', 'Random Access Memory', 'Run App Memory', 'Rapid Access Module'], 'Random Access Memory', 'RAM is temporary memory used by programs while they run.', 1),
('computers', 'Which device is used to type text into a computer?', ARRAY['Mouse', 'Keyboard', 'Monitor', 'Printer'], 'Keyboard', 'A keyboard is used to type text and input commands.', 1),
('computers', 'What does "USB" stand for?', ARRAY['Universal Serial Bus', 'Universal System Board', 'United Serial Bus', 'User Service Bus'], 'Universal Serial Bus', 'USB is a standard for connecting devices to computers.', 1),
('computers', 'What is the most common operating system for personal computers?', ARRAY['Linux', 'macOS', 'Windows', 'Chrome OS'], 'Windows', 'Microsoft Windows is the most common OS for personal computers.', 1),
('computers', 'What does "email" stand for?', ARRAY['Electric Mail', 'Electronic Mail', 'Efficient Mail', 'E-message'], 'Electronic Mail', 'Email (electronic mail) is digital messaging over the internet.', 1),
('computers', 'Which company created the Android operating system?', ARRAY['Apple', 'Google', 'Microsoft', 'Samsung'], 'Google', 'Google developed the Android operating system.', 1),
('computers', 'What is the brain of a computer called?', ARRAY['Hard drive', 'CPU', 'RAM', 'GPU'], 'CPU', 'The CPU (Central Processing Unit) is the brain of the computer.', 1),
('computers', 'Which programming language is often used for web development?', ARRAY['Python', 'JavaScript', 'C++', 'Swift'], 'JavaScript', 'JavaScript is the most popular language for web development.', 1),
('computers', 'What does "HTML" stand for?', ARRAY['HyperText Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyper Transfer Markup Language'], 'HyperText Markup Language', 'HTML is the standard language for creating web pages.', 1),
('computers', 'Which social media platform is known for short-form videos called TikTok?', ARRAY['Instagram', 'TikTok', 'Snapchat', 'YouTube'], 'TikTok', 'TikTok is a platform for short-form video content.', 1),
('computers', 'What is a "byte" made of?', ARRAY['2 bits', '8 bits', '16 bits', '32 bits'], '8 bits', 'A byte consists of 8 bits.', 1),
('computers', 'Which company makes the iPhone?', ARRAY['Google', 'Samsung', 'Apple', 'Microsoft'], 'Apple', 'Apple manufactures the iPhone.', 1),
('computers', 'What does "Wi-Fi" allow you to do?', ARRAY['Make coffee', 'Connect wirelessly to internet', 'Charge your phone', 'Print documents'], 'Connect wirelessly to internet', 'Wi-Fi enables wireless internet connectivity.', 1),
('computers', 'Which search engine is the most popular in the world?', ARRAY['Bing', 'Yahoo', 'Google', 'DuckDuckGo'], 'Google', 'Google is the most popular search engine globally.', 1),
('computers', 'What is a "firewall" used for?', ARRAY['To put out fires', 'To protect from hackers', 'To speed up internet', 'To store files'], 'To protect from hackers', 'A firewall is a security system that monitors and controls network traffic.', 1),
('computers', 'Which display technology is commonly used in modern TVs?', ARRAY['CRT', 'LED', 'Plasma', 'Projection'], 'LED', 'LED (Light Emitting Diode) is the most common TV display technology.', 1),
('computers', 'What does "PDF" stand for?', ARRAY['Portable Document Format', 'Printable Document File', 'Personal Data File', 'Public Display Format'], 'Portable Document Format', 'PDF is a file format for documents that can contain text and images.', 1),
('computers', 'Which company created the Windows operating system?', ARRAY['Apple', 'Google', 'Microsoft', 'IBM'], 'Microsoft', 'Microsoft created and distributes the Windows operating system.', 1)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;
