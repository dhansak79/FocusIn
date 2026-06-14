export const SLOP_PHRASES = [
  "in today's fast-paced",
  'let that sink in',
  'game-changer',
  'game changer',
  'thought leadership',
  'key takeaways',
  'at the end of the day',
  'synergy',
  'paradigm shift',
  'move the needle',
  'deep dive',
  "it's important to note",
  "here's what i learned",
  'excited to share',
  'humbled and honored',
  'honored and humbled',
  'thrilled to announce',
  'delve',
  'leverage',
  'unlock your',
  'join the journey',
  'repost to',
  'save this',
  "sit with that for",
  "let that sit",
  "digital ambition",
  "strategy becomes real",
  "seeing an interesting shift",
  "excited to be part of",

  // LLM tells
  'in the realm of',
  'navigating the complexities',
  'ever-evolving landscape',
  'tapestry',
  'embark on a journey',
  'harness the power',
  'foster a culture',
  'seamless integration',
  'meticulously crafted',
  'carefully curated',
  'in conclusion',
  'in summary',
  'whether you are a seasoned',
  'treasure trove',
  'usher in a new era',
  'holistic approach',

  // Filler hooks that signal obvious reveal (via Dustin Andrews)
  'the fix:',
  'the solution:',
  "here's how:",
  'the secret:',
  'what you need to do:',
  'the key insight:',
  'why this works:',
  'the bottom line:',

  // Filler phrases that precede obvious statements (via Dustin Andrews)
  'the brutal truth',
  'the honest truth',
  "here's the thing",
  "but here's the thing",
  'long story short',
  'when all is said and done',
  'make no mistake',
  'you cannot unsee it',
  "let's be real",
  'the uncomfortable truth',
  'what it comes down to',

  // AI buzzword bingo (via Dustin Andrews)
  'agentic',
  'game-changing',

  // "Unpopular opinion" / hot take hooks — very specific to slop
  'unpopular opinion:',
  'unpopular opinion,',
  'hot take:',
  'real talk:',

  // Fake vulnerability and humility bait
  'i was wrong about',
  'i almost quit',
  'full transparency,',
  'full transparency:',

  // Question engagement hooks
  'what if i told you',
  'raise your hand if',
  'who needs to hear this',
  'you need to hear this',

  // Pseudo-revelatory patterns
  'this is your sign',
  'this is your reminder',
  'no one tells you',

  // LinkedIn engagement bait
  'drop a comment',
  'comment below',
  'tag someone who',
  'ring the bell',
  'read that again',
  'what nobody tells you',
  'some personal news',
  'proud to announce',
  'pleased to announce',
  'stop scrolling',
  'follow me for more',

  // Corporate filler
  'actionable insights',
  'data-driven insights',
  'north star metric',
  'circle back',
  'boil the ocean',
  'secret sauce',
  'flywheel effect',

  // "X just dropped" breathlessness
  'just dropped',
  'blown away',
  'just announced',
  'just changed everything',
  'just killed',
  'just made obsolete',
  'quietly released',
  'silently released',
  'nobody is talking about',
  'everyone is sleeping on',
  'while you were sleeping',
  'this went under the radar',

  // Apocalyptic job claims
  'jobs are gone',
  'will be obsolete',
  'replace developers',
  'replace programmers',
  'replace your job',
  'coding is dead',
  'programming is dead',
  'seo is dead',
  'google is dead',
  'the end of software',
  'why hire a',
  'fired their entire',
  'you will be replaced by someone using ai',
  'adapt or die',
  'left behind',
  'get left behind',

  // The naive power-user flex
  'i built an app in',
  'built a saas in',
  'in under an hour with ai',
  'with zero coding experience',
  'without writing a single line of code',
  'one prompt away',
  'with just one prompt',
  'this prompt will',
  'steal my prompt',
  'copy this prompt',
  'the only prompt you need',
  'prompts that feel illegal',
  'feel illegal to know',
  'insane prompts',
  'god-tier prompt',
  'mega prompt',
  '10x your productivity',
  '100x your',
  'like having a team of',
  'an army of agents',
  'a phd in your pocket',

  // "You're using it wrong" gatekeeping
  "you're using chatgpt wrong",
  "you're using ai wrong",
  '99% of people use ai wrong',
  '99% of people don',
  'most people don\'t know this',
  'almost nobody knows',
  'the hack nobody shares',
  'ai cheat sheet',
  'cheat code',

  // Hype vocabulary
  'mind-blowing',
  'mind blown',
  'jaw-dropping',
  'this is insane',
  'absolutely insane',
  'is wild',
  'gone are the days',
  'we are so back',
  'it\'s over for',
  'cooked',
  'no one is ready for',
  'you are not ready for',
  'the singularity',
  'exponential growth',
  'hockey stick',
  'iphone moment',
  'gpt moment',
  'sputnik moment',
  'this is just the beginning',
  'we are still early',
  'still so early',
  'the next 12 months',
  'in 6 months ai will',

  // "The [Noun]" framing — presenting ordinary advice as a proprietary system
  'the playbook',
  'the blueprint',
  'the formula',
  'the masterclass',
  'the cheat code',
  'the shortcut',
  'the roadmap to',

  // "Normalize" virtue signalling — uniquely LinkedIn
  'normalize asking',
  'normalize taking',
  'normalize saying',
  'normalize talking about',
  'normalize being',

  // "Prove them wrong" underdog narrative
  'prove them wrong',
  'they said i couldn\'t',
  'everyone said it couldn\'t',
  'they laughed at me',
  'they doubted me',

  // More false wisdom clichés
  'work smarter',
  'if you\'re the smartest person in the room',
  'you are the average of',
  'iron sharpens iron',
  'fall seven times',

  // "This is why" clickbait hooks
  'this is why most people',
  'this is why you\'re not',
  'this is why i left',
  'this is why i quit',

  // Personal branding ecosystem
  'personal brand',
  'build your brand',
  'thought leader',
  'content creator',
  'creator economy',

  // "What I wish" reflections — formulaic wisdom posts
  'what i wish i knew',
  'what i wish someone told me',
  'what i wish i had known',
  'what nobody told me',

  // "Stop X" imperatives — motivation slop
  'stop overthinking',
  'stop waiting for',
  'stop comparing yourself',
  'stop playing small',
  'stop shrinking',

  // More narrative arc phrases
  'changed my life',
  'wake-up call',
  'i have a confession',
  'confession:',
  'the moment i realised',
  'the moment i realized',

  // LinkedIn ecosystem specific
  'your network is your net worth',
  'beat the algorithm',
  'most underrated',
  'most overlooked',
  'an open letter to',
  'the secret to',

  // Reminder posts — a whole LinkedIn genre unto itself
  'gentle reminder:',
  'gentle reminder,',
  'friendly reminder:',
  'reminder that',
  'reminder:',

  // Fear-based engagement
  'before it\'s too late',
  'don\'t make this mistake',
  'avoid this mistake',
  'biggest mistake',
  'the number one reason',
  'number one mistake',

  // Narrative formula phrases
  'fast forward',
  'that moment changed everything',
  'i will never forget',
  'everything changed when',
  'it all changed when',

  // LLM vocabulary tells
  'transformative',
  'unprecedented',
  'empower',
  'supercharge',
  'game plan',
  'life hack',
  'tl;dr',

  // Anecdote / storytime hooks
  'story time:',
  'storytime:',
  'true story:',
  'i remember the day',
  'plot twist:',

  // Engagement solicitation
  'agree or disagree?',
  'can anyone relate?',
  'am i the only one',
  'would you agree?',
  'what would you add?',

  // Self-promotion patterns
  'link in comments',
  'link in bio',
  'dm me for',
  'dm me if',

  // False wisdom and tautologies
  'done is better than perfect',
  'embrace the journey',
  'enjoy the ride',
  'fall in love with the journey',
  'one day at a time',

  // Career and hustle culture porn
  '6-figure',
  'quit my 9-5',
  'quit my job',
  'passive income',
  'financial freedom',
  'escape the rat race',
  'side hustle',
  'multiple streams',
  'build in public',
  'solopreneur',

  // Motivational fluff
  'trust the process',
  'fall in love with the process',
  'you are enough',
  'you got this',
  'protect your peace',
  'choose yourself',
  'bet on yourself',
  'back yourself',
  'give yourself permission',
  'your future self',
  'the best version of yourself',
  'invest in yourself',

  // Listicle bait
  'ai tools you need',
  'tools that feel illegal',
  'websites that feel illegal',
  '10 ai tools',
  'free ai tools',
  'bookmark this',
  'save this list',
  'thread below',
  'a thread'
]

export const SLOP_PATTERNS = [
  // "It’s not X. It’s Y." / "This isn’t X. This is Y." / "That’s not X. That’s Y."
  // Short contrasting clauses — classic AI-ghostwritten LinkedIn structure (via Dustin Andrews)
  /it['‘’]s not [^.!?\n]{1,60}[.!?][ \t\n]+it['‘’]s /i,
  /this isn['‘’]t [^.!?\n]{1,60}[.!?][ \t\n]+this is /i,
  /that['‘’]s not [^.!?\n]{1,60}[.!?][ \t\n]+that['‘’]s /i,
  // Em dash — almost never typed manually; heavily used by LLMs
  /—/,
  // Arrow bullet lists — AI listicle format, rarely used by genuine writers
  /^→ .+\n.*^→ /ms,
  // Twitter thread format on LinkedIn — "1/" "2/" "3/" numbered items
  /^\d+\/ /m,
]