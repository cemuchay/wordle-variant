-- 112_bible_passages_parables_handcrafted.sql
-- Handcrafted Bible questions: famous passages and parables.
-- Easy (2) and medium (3) difficulty.

-- ══════════════════════════════════════════════════════════════════════════════
-- BIBLE PASSAGES (20)
-- ══════════════════════════════════════════════════════════════════════════════

-- Easy passages (difficulty 2)
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('bible', 'Which book of the Bible begins with "In the beginning, God created the heavens and the earth"?', ARRAY['Genesis', 'Exodus', 'Psalms', 'Isaiah'], 'Genesis', 'The book of Genesis opens with the account of creation.', 2),
('bible', 'Which book of the Bible contains the famous verse "The Lord is my shepherd; I shall not want"?', ARRAY['Psalms', 'Proverbs', 'Isaiah', 'Job'], 'Psalms', 'Psalm 23 begins with "The Lord is my shepherd; I shall not want."', 2),
('bible', 'Which book of the Bible contains the verse "For God so loved the world that He gave His only begotten Son"?', ARRAY['John', 'Matthew', 'Romans', 'Genesis'], 'John', 'John 3:16 is one of the most quoted verses in the Bible.', 2),
('bible', 'Which book of the Bible says "I can do all things through Christ who strengthens me"?', ARRAY['Philippians', 'Ephesians', 'Colossians', 'Romans'], 'Philippians', 'Philippians 4:13 is a well-known verse about strength through Christ.', 2),
('bible', 'Which book of the Bible says "Love your neighbor as yourself"?', ARRAY['Leviticus', 'Deuteronomy', 'Exodus', 'Numbers'], 'Leviticus', 'Leviticus 19:18 commands us to love our neighbor as ourselves.', 2),
('bible', 'Which book of the Bible contains the command "Be strong and courageous. Do not be afraid"?', ARRAY['Joshua', 'Judges', 'Samuel', 'Kings'], 'Joshua', 'God spoke these words to Joshua as he prepared to lead Israel into the Promised Land.', 2),
('bible', 'Which book of the Bible says "Trust in the Lord with all your heart and lean not on your own understanding"?', ARRAY['Proverbs', 'Psalms', 'Ecclesiastes', 'Job'], 'Proverbs', 'Proverbs 3:5 encourages complete trust in God rather than our own wisdom.', 2),
('bible', 'Which book of the Bible lists the fruit of the Spirit as "love, joy, peace, patience, kindness, goodness, faithfulness"?', ARRAY['Galatians', 'Ephesians', 'Philippians', 'Colossians'], 'Galatians', 'Galatians 5:22-23 describes the fruit of the Spirit.', 2),
('bible', 'Which book of the Bible says "Let everything that has breath praise the Lord"?', ARRAY['Psalms', 'Revelation', 'Isaiah', 'Daniel'], 'Psalms', 'Psalm 150:6 is a call for all creation to praise God.', 2),
('bible', 'Which Gospel records the Beatitudes beginning with "Blessed are the poor in spirit"?', ARRAY['Matthew', 'Mark', 'Luke', 'John'], 'Matthew', 'The Beatitudes are found in Matthew 5, part of the Sermon on the Mount.', 2)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- Medium passages (difficulty 3)
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('bible', 'Which book of the Bible says "Be still, and know that I am God"?', ARRAY['Psalms', 'Exodus', 'Isaiah', 'Job'], 'Psalms', 'Psalm 46:10 is a call to stillness and recognition of God''s sovereignty.', 3),
('bible', 'Which book of the Bible says "The steadfast love of the Lord never ceases; His mercies are new every morning"?', ARRAY['Lamentations', 'Jeremiah', 'Hosea', 'Joel'], 'Lamentations', 'Lamentations 3:22-23 speaks of God''s unfailing love and daily mercies.', 3),
('bible', 'Which book of the Bible says "But those who hope in the Lord will renew their strength"?', ARRAY['Isaiah', 'Jeremiah', 'Ezekiel', 'Daniel'], 'Isaiah', 'Isaiah 40:31 promises renewed strength to those who wait on the Lord.', 3),
('bible', 'Which book of the Bible says "Your word is a lamp to my feet and a light to my path"?', ARRAY['Psalms', 'Proverbs', 'Isaiah', 'Jeremiah'], 'Psalms', 'Psalm 119:105 describes God''s word as a guide for life.', 3),
('bible', 'Which book of the Bible says "For I know the plans I have for you, declares the Lord, plans to prosper you"?', ARRAY['Jeremiah', 'Isaiah', 'Ezekiel', 'Daniel'], 'Jeremiah', 'Jeremiah 29:11 is a promise of God''s good plans for His people.', 3),
('bible', 'Which epistle says "I have fought the good fight, I have finished the race, I have kept the faith"?', ARRAY['2 Timothy', '1 Timothy', 'Titus', 'Hebrews'], '2 Timothy', 'Paul wrote these words near the end of his life in 2 Timothy 4:7.', 3),
('bible', 'Which Gospel records Jesus saying "Do not worry about tomorrow, for tomorrow will worry about itself"?', ARRAY['Matthew', 'Mark', 'Luke', 'John'], 'Matthew', 'This teaching is part of the Sermon on the Mount in Matthew 6:34.', 3),
('bible', 'Which book of the Bible says "The joy of the Lord is your strength"?', ARRAY['Nehemiah', 'Ezra', 'Chronicles', 'Kings'], 'Nehemiah', 'Nehemiah 8:10 reminds us that rejoicing in the Lord gives strength.', 3),
('bible', 'Which Gospel says "Greater love has no one than this: to lay down one''s life for one''s friends"?', ARRAY['John', 'Matthew', 'Luke', 'Mark'], 'John', 'Jesus spoke these words to His disciples in John 15:13.', 3),
('bible', 'Which book of the Bible says "Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God"?', ARRAY['Philippians', 'Colossians', 'Ephesians', '1 Thessalonians'], 'Philippians', 'Philippians 4:6 encourages us to bring all our concerns to God in prayer.', 3)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- BIBLE PARABLES (20)
-- ══════════════════════════════════════════════════════════════════════════════

-- Easy parables (difficulty 2)
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('bible', 'Which parable tells of a son who wasted his inheritance and was welcomed back by his father?', ARRAY['The Prodigal Son', 'The Good Samaritan', 'The Lost Sheep', 'The Mustard Seed'], 'The Prodigal Son', 'The Parable of the Prodigal Son (Luke 15) teaches about God''s forgiving love.', 2),
('bible', 'Which parable features a traveler robbed and left for dead, then helped by a stranger from a rival group?', ARRAY['The Good Samaritan', 'The Prodigal Son', 'The Lost Sheep', 'The Sower'], 'The Good Samaritan', 'The Parable of the Good Samaritan (Luke 10) teaches compassion beyond boundaries.', 2),
('bible', 'Which parable compares the Kingdom of Heaven to a tiny seed that grows into the largest garden plant?', ARRAY['The Mustard Seed', 'The Sower', 'The Wheat and Tares', 'The Fig Tree'], 'The Mustard Seed', 'The Parable of the Mustard Seed (Matthew 13) shows how small beginnings can grow greatly.', 2),
('bible', 'Which parable tells of a shepherd who leaves ninety-nine sheep to search for one that is lost?', ARRAY['The Lost Sheep', 'The Lost Coin', 'The Good Shepherd', 'The Prodigal Son'], 'The Lost Sheep', 'The Parable of the Lost Sheep (Luke 15) illustrates God''s joy over one repentant sinner.', 2),
('bible', 'Which parable is about a farmer who scatters seed on different types of ground?', ARRAY['The Sower', 'The Mustard Seed', 'The Wheat and Tares', 'The Vineyard'], 'The Sower', 'The Parable of the Sower (Matthew 13) explains how people respond differently to God''s word.', 2),
('bible', 'Which parable is about a woman who carefully searches her house until she finds a lost coin?', ARRAY['The Lost Coin', 'The Lost Sheep', 'The Hidden Treasure', 'The Pearl'], 'The Lost Coin', 'The Parable of the Lost Coin (Luke 15) teaches that heaven rejoices over every repentant sinner.', 2),
('bible', 'Which parable compares the Kingdom of Heaven to a treasure hidden in a field that a man sells everything to buy?', ARRAY['The Hidden Treasure', 'The Pearl of Great Price', 'The Mustard Seed', 'The Net'], 'The Hidden Treasure', 'The Parable of the Hidden Treasure (Matthew 13) shows the infinite value of God''s Kingdom.', 2),
('bible', 'Which parable contrasts a house built on rock with one built on sand?', ARRAY['The Wise and Foolish Builders', 'The House on the Rock', 'The Two Foundations', 'The Sower'], 'The Wise and Foolish Builders', 'The Parable of the Wise and Foolish Builders (Matthew 7) teaches the importance of obeying Jesus'' words.', 2),
('bible', 'Which parable teaches that we should forgive others generously, like a king forgave a huge debt?', ARRAY['The Unforgiving Servant', 'The Prodigal Son', 'The Lost Sheep', 'The Pharisee and Tax Collector'], 'The Unforgiving Servant', 'The Parable of the Unforgiving Servant (Matthew 18) teaches that forgiven people must forgive others.', 2),
('bible', 'Which parable is about workers hired at different times who all receive the same pay?', ARRAY['The Workers in the Vineyard', 'The Talents', 'The Vineyard', 'The Laborers'], 'The Workers in the Vineyard', 'The Parable of the Workers in the Vineyard (Matthew 20) teaches about God''s generosity.', 2)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;

-- Medium parables (difficulty 3)
INSERT INTO public.wordup_handcrafted_questions (category, prompt, choices, answer, explanation, difficulty) VALUES
('bible', 'In the Parable of the Good Samaritan, which person passed by the injured man first?', ARRAY['A priest', 'A Levite', 'A Pharisee', 'A scribe'], 'A priest', 'In Luke 10:31, a priest saw the injured man but passed by on the other side.', 3),
('bible', 'What did the father give his returning son in the Parable of the Prodigal Son?', ARRAY['A robe, a ring, and sandals', 'A bag of gold', 'A new house', 'A flock of sheep'], 'A robe, a ring, and sandals', 'In Luke 15:22, the father clothed his son with a robe, a ring, and sandals.', 3),
('bible', 'In the Parable of the Sower, what does the seed represent?', ARRAY['The word of God', 'Faith in God', 'The Kingdom of Heaven', 'The Holy Spirit'], 'The word of God', 'Jesus explains in Luke 8:11 that the seed is the word of God.', 3),
('bible', 'Which parable compares the Kingdom of Heaven to a merchant searching for fine pearls?', ARRAY['The Pearl of Great Price', 'The Hidden Treasure', 'The Mustard Seed', 'The Net'], 'The Pearl of Great Price', 'The Parable of the Pearl of Great Price (Matthew 13:45-46) shows the supreme worth of God''s Kingdom.', 3),
('bible', 'Which parable features a rich man who ignores a beggar named Lazarus?', ARRAY['The Rich Man and Lazarus', 'The Good Samaritan', 'The Unforgiving Servant', 'The Great Banquet'], 'The Rich Man and Lazarus', 'The Parable of the Rich Man and Lazarus (Luke 16) warns about neglecting the needy.', 3),
('bible', 'Which parable tells of a fig tree that is given one more year to bear fruit?', ARRAY['The Barren Fig Tree', 'The Mustard Seed', 'The Vineyard', 'The Sower'], 'The Barren Fig Tree', 'The Parable of the Barren Fig Tree (Luke 13) teaches about God''s patience and call for repentance.', 3),
('bible', 'Which parable compares the Kingdom of Heaven to ten bridesmaids waiting for a bridegroom?', ARRAY['The Ten Virgins', 'The Wedding Feast', 'The Great Banquet', 'The Wise Builder'], 'The Ten Virgins', 'The Parable of the Ten Virgins (Matthew 25) encourages readiness for Christ''s return.', 3),
('bible', 'Which parable compares the Kingdom of Heaven to a net that catches all kinds of fish?', ARRAY['The Net', 'The Hidden Treasure', 'The Pearl of Great Price', 'The Mustard Seed'], 'The Net', 'The Parable of the Net (Matthew 13:47-50) teaches about the final separation of the righteous and the wicked.', 3),
('bible', 'Which parable contrasts a proud religious leader and a humble tax collector praying in the temple?', ARRAY['The Pharisee and the Tax Collector', 'The Rich Man and Lazarus', 'The Good Samaritan', 'The Unforgiving Servant'], 'The Pharisee and the Tax Collector', 'The Parable of the Pharisee and the Tax Collector (Luke 18) teaches about humility before God.', 3),
('bible', 'Which parable warns about a man who stored up great wealth but died suddenly that very night?', ARRAY['The Rich Fool', 'The Rich Man and Lazarus', 'The Workers in the Vineyard', 'The Talents'], 'The Rich Fool', 'The Parable of the Rich Fool (Luke 12) warns against greed and storing treasures only on earth.', 3)
ON CONFLICT (prompt) DO UPDATE SET difficulty = EXCLUDED.difficulty WHERE wordup_handcrafted_questions.difficulty IS NULL;
