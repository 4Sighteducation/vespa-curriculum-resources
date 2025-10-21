/**
 * VESPA Curriculum Resources - Complete Single Page App v2.0
 * 
 * All 3 pages in ONE scene (scene_1280) - No navigation, just show/hide
 * NEW FEATURES:
 * - Search by student problem (converts from student JSON)
 * - Recently viewed activities
 * - Quick stats
 * - Keyboard shortcuts
 * - Faster than KSENSE!
 */

console.log('[Curriculum SPA] Loading v2.0...');

// ===== PROBLEM MAPPINGS (Converted to 3rd person for tutors) =====
const STUDENT_PROBLEMS = {
    "Vision": [
        { text: "Student is unsure about future goals", activities: ["21st Birthday", "Roadmap", "Personal Compass", "Perfect Day"] },
        { text: "Student is not feeling motivated", activities: ["Motivation Diamond", "Five Roads", "Mission & Medal"] },
        { text: "Student can't see how school connects to future", activities: ["Success Leaves Clues", "There and Back", "20 Questions", "SMART Goals"] },
        { text: "Student doesn't know what success looks like", activities: ["Perfect Day", "Fix your dashboard", "Getting Dreams Done"] },
        { text: "Student hasn't thought about achievements this year", activities: ["SMART Goals", "Roadmap", "Mental Contrasting", "21st Birthday"] },
        { text: "Student finds it hard to picture doing well", activities: ["Fake It!", "Perfect Day", "Inner Story Telling", "Force Field"] },
        { text: "Student rarely thinks about where heading or why", activities: ["Personal Compass", "Five Roads", "One to Ten", "20 Questions"] }
    ],
    "Effort": [
        { text: "Student struggles to complete homework on time", activities: ["Weekly Planner", "25min Sprints", "Priority Matrix", "Now vs Most"] },
        { text: "Student finds it hard to keep trying when difficult", activities: ["Will vs Skill", "Effort Thermometer", "Looking under Rocks", "Kill Your Critic"] },
        { text: "Student gives up if doesn't get things right straight away", activities: ["Failing Forwards", "Growth Mindset", "2 Slow, 1 Fast", "Learn from Mistakes"] },
        { text: "Student does bare minimum just to get by", activities: ["Effort Thermometer", "Mission & Medal", "Working Weeks", "The Bottom Left"] },
        { text: "Student gets distracted easily when studying", activities: ["High Flow Spaces", "Types of Attention", "Pre-Made Decisions", "Chunking Steps"] },
        { text: "Student avoids topics or tasks that feel too hard", activities: ["Will vs Skill", "Looking under Rocks", "2 Slow, 1 Fast", "The Lead Domino"] },
        { text: "Student puts things off until under pressure", activities: ["10min Rule", "Frogs & Bannisters", "Now vs Most", "25min Sprints"] }
    ],
    "Systems": [
        { text: "Student is not very organized with notes and deadlines", activities: ["Weekly Planner", "Priority Matrix", "STQR", "Graphic Organisers"] },
        { text: "Student doesn't have a good revision plan", activities: ["Leitner Box", "Revision Questionnaire", "Spaced Practice", "2-4-8 Rule"] },
        { text: "Student keeps forgetting homework", activities: ["Weekly Planner", "Rule of 3", "Project Progress Chart", "Packing Bags"] },
        { text: "Student leaves everything to last minute", activities: ["Eisenhower Matrix", "Priority Matrix", "The Lead Domino", "10min Rule"] },
        { text: "Student doesn't use planner or calendar", activities: ["Weekly Planner", "Project Progress Chart", "Working Weeks", "Rule of 3"] },
        { text: "Student's notes are all over the place", activities: ["Graphic Organisers", "STQR", "Right-Wrong-Right", "Chunking Steps"] },
        { text: "Student struggles to prioritise what to do first", activities: ["Priority Matrix", "Eisenhower Matrix", "The Lead Domino", "Now vs Most"] }
    ],
    "Practice": [
        { text: "Student doesn't review work regularly", activities: ["Test Yourself", "Spaced Practice", "Leitner Box", "2-4-8 Rule"] },
        { text: "Student tends to cram before tests", activities: ["Revision Questionnaire", "Spaced Practice", "Snack Don't Binge", "2-4-8 Rule"] },
        { text: "Student avoids practising hard topics", activities: ["Will vs Skill", "2 Slow, 1 Fast", "Looking under Rocks", "The Bottom Left"] },
        { text: "Student is not sure how to revise effectively", activities: ["Time to Teach", "9 Box Grid", "Practice Questionnaire", "Test Yourself"] },
        { text: "Student doesn't practise exam questions enough", activities: ["Test Yourself", "Know the Skills", "Mechanical vs Flexible", "Right-Wrong-Right"] },
        { text: "Student doesn't learn from mistakes", activities: ["Failing Forwards", "Learn from Mistakes", "Right-Wrong-Right", "Problem Solving"] },
        { text: "Student rarely checks understanding before moving on", activities: ["Test Yourself", "Independent Learning", "9 Box Grid", "Time to Teach"] }
    ],
    "Attitude": [
        { text: "Student worries not smart enough", activities: ["Growth Mindset", "The Battery", "Managing Reactions", "Stopping Negative Thoughts"] },
        { text: "Student gets easily discouraged by setbacks", activities: ["Failing Forwards", "Benefit Finding", "Change Curve", "The First Aid Kit"] },
        { text: "Student compares to others and feels behind", activities: ["The Battery", "Network Audits", "Vampire Test", "One to Ten"] },
        { text: "Student doesn't believe effort makes a difference", activities: ["Growth Mindset", "Effort Thermometer", "Force Field", "Will vs Skill"] },
        { text: "Student feels overwhelmed when doesn't get something", activities: ["The First Aid Kit", "Stand Tall", "Managing Reactions", "Power of If"] },
        { text: "Student tells themself not good at certain subjects", activities: ["Growth Mindset", "Stopping Negative Thoughts", "Kill Your Critic", "Fake It!"] },
        { text: "Student finds it hard to stay positive about school", activities: ["Network Audits", "The Battery", "Vampire Test", "Benefit Finding"] }
    ]
};

console.log('[Curriculum SPA] Student problems loaded:', Object.keys(STUDENT_PROBLEMS).length, 'categories');

// Load this as a global so the main curriculum code can use it
window.CURRICULUM_STUDENT_PROBLEMS = STUDENT_PROBLEMS;

// Signal that problems are ready
console.log('[Curriculum SPA] Problem-based search ready!');

