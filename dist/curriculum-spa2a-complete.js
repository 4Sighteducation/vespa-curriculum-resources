/**
 * VESPA Curriculum Resources - Complete SPA v2.0
 * Part 1 of 2 - API and Core Functions
 * 
 * All 3 pages in ONE scene - Revolutionary improvement over KSENSE!
 */

console.log('[Curriculum SPA v2] Loading...');

// ===== CURRICULUM API (with proper config handling) =====
class CurriculumAPI {
    constructor(config) {
        this.config = config;
        console.log('[API] Initialized with config:', {
            hasAppId: !!config.knackAppId,
            hasApiKey: !!config.knackApiKey
        });
        this.cache = { books: null, activities: null, completions: null, lastFetch: {} };
        this.cacheExpiry = 5 * 60 * 1000;
    }

    getCurrentUser() {
        if (typeof Knack !== 'undefined' && Knack.getUserAttributes) {
            const user = Knack.getUserAttributes();
            return { id: user.id, email: user.email, name: user.name || user.values?.field_85 || 'User', ...user };
        }
        return null;
    }

    async fetchFromKnack(objectKey, filters = null) {
        const url = `https://eu-api.knack.com/v1/objects/${objectKey}/records`;
        const headers = {
            'X-Knack-Application-Id': this.config.knackAppId,
            'X-Knack-REST-API-Key': this.config.knackApiKey,
            'Content-Type': 'application/json'
        };

        let params = new URLSearchParams();
        if (filters) params.append('filters', JSON.stringify(filters));
        params.append('rows_per_page', '1000');

        const fullUrl = url + '?' + params.toString();
        
        try {
            const response = await fetch(fullUrl, { headers });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.error('[API] Fetch error:', error);
            throw error;
        }
    }

    async getBooks() {
        try {
            const records = await this.fetchFromKnack('object_56');
            return records.map(r => ({
                id: r.id,
                name: r.field_1429,
                imageUrl: this.extractImageUrl(r.field_1439_raw || r.field_1439)
            }));
        } catch (error) {
            console.error('[API] Failed to fetch books:', error);
            return [];
        }
    }

    async getActivities(bookName = null) {
        try {
            let filters = null;
            if (bookName) {
                filters = { match: 'and', rules: [{ field: 'field_2702', operator: 'is', value: bookName }] };
            }
            const records = await this.fetchFromKnack('object_58', filters);
            return records.map(r => ({
                id: r.id,
                book: r.field_2702,
                activityId: r.field_1446,
                theme: r.field_1461,
                name: r.field_1431,
                group: r.field_1435_raw || r.field_1435,
                content: r.field_1448_raw || r.field_1448
            }));
        } catch (error) {
            console.error('[API] Failed to fetch activities:', error);
            return [];
        }
    }

    async getUserCompletions() {
        const user = this.getCurrentUser();
        if (!user) return [];
        try {
            const filters = { match: 'and', rules: [{ field: 'field_1437', operator: 'is', value: user.id }] };
            const records = await this.fetchFromKnack('object_59', filters);
            return records.map(r => {
                let completed = {};
                try {
                    const raw = r.field_1432_raw || r.field_1432;
                    completed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                } catch (e) {}
                return { id: r.id, activitiesCompleted: completed };
            });
        } catch (error) {
            return [];
        }
    }

    async completeActivity(activityId, bookName) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('Not logged in');
        
        const completions = await this.getUserCompletions();
        let json = completions.length > 0 ? completions[0].activitiesCompleted : {};
        
        if (!json[bookName]) json[bookName] = [];
        if (!json[bookName].includes(activityId)) json[bookName].push(activityId);
        
        const data = {
            field_1437: [user.id],
            field_1432: JSON.stringify(json),
            field_1449: user.name,
            field_2295: new Date().toISOString()
        };
        
        const url = completions.length > 0 
            ? `https://eu-api.knack.com/v1/objects/object_59/records/${completions[0].id}`
            : `https://eu-api.knack.com/v1/objects/object_59/records`;
            
        const method = completions.length > 0 ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'X-Knack-Application-Id': this.config.knackAppId,
                'X-Knack-REST-API-Key': this.config.knackApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('Failed to save completion');
        this.cache.completions = null;
        return await response.json();
    }

    async getDiscussions(activityId) {
        try {
            const filters = { match: 'and', rules: [{ field: 'field_1444', operator: 'is', value: activityId }] };
            const records = await this.fetchFromKnack('object_60', filters);
            return records.map(r => ({
                id: r.id,
                author: r.field_1445_raw?.[0]?.identifier || 'Unknown',
                comment: r.field_1433,
                date: r.field_1447_raw?.date_formatted || r.field_1447
            }));
        } catch (error) {
            return [];
        }
    }

    async addDiscussion(activityId, comment) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('Not logged in');
        
        const data = {
            field_1444: [activityId],
            field_1445: [user.id],
            field_1433: comment,
            field_1447: new Date().toISOString()
        };
        
        const response = await fetch('https://eu-api.knack.com/v1/objects/object_60/records', {
            method: 'POST',
            headers: {
                'X-Knack-Application-Id': this.config.knackAppId,
                'X-Knack-REST-API-Key': this.config.knackApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('Failed to add comment');
        return await response.json();
    }

    async calculateProgress(bookName) {
        const [activities, completions] = await Promise.all([
            this.getActivities(bookName),
            this.getUserCompletions()
        ]);
        
        if (completions.length === 0) {
            return { total: activities.length, completed: 0, percentage: 0, completedIds: [] };
        }
        
        const ids = completions[0].activitiesCompleted[bookName] || [];
        return {
            total: activities.length,
            completed: ids.length,
            percentage: Math.round((ids.length / activities.length) * 100),
            completedIds: ids
        };
    }

    extractImageUrl(html) {
        if (!html) return '';
        if (typeof html === 'string' && html.startsWith('http')) return html;
        if (typeof html === 'string' && html.includes('<img')) {
            const match = html.match(/src="([^"]+)"/);
            return match ? match[1] : '';
        }
        return html?.url || '';
    }
}

window.CurriculumAPI = CurriculumAPI;

// ===== UTILITIES =====
const Utils = {
    themeColors: {
        Vision: '#FFA500', Effort: '#a4c2f4', Systems: '#aad950',
        Practice: '#a986ff', Attitude: '#ff769c',
        VISION: '#FFA500', EFFORT: '#a4c2f4', SYSTEMS: '#aad950',
        PRACTICE: '#a986ff', ATTITUDE: '#ff769c'
    },
    
    getThemeColor(theme) {
        if (!theme) return '#079baa';
        return this.themeColors[theme.trim()] || this.themeColors[theme.trim().toUpperCase()] || '#079baa';
    },
    
    extractIframe(html) {
        if (!html) return null;
        if (html.trim().startsWith('<iframe')) return html;
        const match = html.match(/<iframe[^>]*>[\s\S]*?<\/iframe>/i);
        return match ? match[0] : null;
    },
    
    extractPdfLink(html) {
        if (!html) return null;
        const match = html.match(/href="([^"]*\.pdf[^"]*)"/i);
        return match ? match[1] : null;
    },
    
    sortMonths(months) {
        const order = ['September', 'October', 'November', 'December',
                      'January', 'Febuary', 'February', 'March', 'April', 'May', 'June', 'July'];
        return months.sort((a, b) => {
            const iA = order.indexOf(a);
            const iB = order.indexOf(b);
            if (iA === -1) return 1;
            if (iB === -1) return -1;
            return iA - iB;
        });
    },
    
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'success-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

console.log('[Curriculum SPA v2] Core functions loaded');

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

/**
 * VESPA Curriculum SPA v2.0 - Part 2: Main Application
 * Complete single-page curriculum system
 */

// ===== STATE MANAGEMENT =====
const AppState = {
    currentPage: 'books', // books | browser | viewer
    currentBook: null,
    currentActivity: null,
    activities: [],
    completedIds: [],
    recentlyViewed: JSON.parse(localStorage.getItem('recentlyViewedActivities') || '[]'),
    
    setPage(page) {
        this.currentPage = page;
        this.render();
    },
    
    selectBook(bookName) {
        this.currentBook = bookName;
        this.currentPage = 'browser';
        this.render();
    },
    
    selectActivity(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (activity) {
            this.currentActivity = activity;
            this.currentPage = 'viewer';
            this.addToRecentlyViewed(activity);
            this.render();
        }
    },
    
    addToRecentlyViewed(activity) {
        this.recentlyViewed = this.recentlyViewed.filter(a => a.id !== activity.id);
        this.recentlyViewed.unshift({ id: activity.id, name: activity.name, book: activity.book });
        this.recentlyViewed = this.recentlyViewed.slice(0, 10);
        localStorage.setItem('recentlyViewedActivities', JSON.stringify(this.recentlyViewed));
    },
    
    render() {
        document.querySelectorAll('.curriculum-page').forEach(p => p.classList.remove('active'));
        const activePage = document.querySelector(`.curriculum-page[data-page="${this.currentPage}"]`);
        if (activePage) activePage.classList.add('active');
    }
};

// ===== PAGE 1: BOOK SELECTION =====
const Page1 = {
    async render(api) {
        const container = document.getElementById('page-books');
        if (!container) return;
        
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading books...</p></div>';
        
        try {
            const books = await api.getBooks();
            const progressData = await Promise.all(books.map(b => api.calculateProgress(b.name)));
            
            container.innerHTML = `
                <div class="books-page-header">
                    <h1>Choose Your Curriculum</h1>
                    <p>Select a book to explore 120+ teaching activities</p>
                </div>
                <div id="books-grid"></div>
            `;
            
            const grid = container.querySelector('#books-grid');
            books.forEach((book, i) => {
                const progress = progressData[i];
                const card = document.createElement('div');
                card.className = 'book-card';
                card.innerHTML = `
                    <img src="${book.imageUrl}" alt="${book.name}">
                    <h2>${book.name}</h2>
                    <div class="book-progress">
                        <div class="progress-percentage">${progress.percentage}%</div>
                        <div class="progress-label">Complete</div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${progress.percentage}%"></div>
                        </div>
                        <div class="progress-stats">${progress.completed} of ${progress.total} activities</div>
                    </div>
                    <button class="btn-explore">Explore Activities</button>
                `;
                
                card.onclick = () => {
                    AppState.selectBook(book.name);
                    Page2.load(api, book.name);
                };
                
                grid.appendChild(card);
            });
        } catch (error) {
            container.innerHTML = '<div class="error-state"><h3>Failed to load books</h3><p>' + error.message + '</p></div>';
        }
    }
};

// ===== PAGE 2: ACTIVITY BROWSER =====
const Page2 = {
    filterState: { search: '', theme: 'All', month: 'All', problem: '' },
    
    async load(api, bookName) {
        const container = document.getElementById('page-browser');
        if (!container) return;
        
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading activities...</p></div>';
        
        try {
            const [activities, completions] = await Promise.all([
                api.getActivities(bookName),
                api.getUserCompletions()
            ]);
            
            AppState.activities = activities;
            AppState.completedIds = completions.length > 0 ? (completions[0].activitiesCompleted[bookName] || []) : [];
            
            this.render();
        } catch (error) {
            container.innerHTML = '<div class="error-state"><h3>Failed to load activities</h3></div>';
        }
    },
    
    render() {
        const container = document.getElementById('page-browser');
        const activities = this.getFilteredActivities();
        const months = [...new Set(activities.map(a => this.extractMonth(a.group)))].filter(Boolean);
        const themes = ['All', 'Vision', 'Effort', 'Systems', 'Practice', 'Attitude'];
        
        container.innerHTML = `
            <div class="browser-header">
                <div class="browser-title">
                    <h1>${AppState.currentBook}</h1>
                    <p class="browser-subtitle">${activities.length} activities</p>
                </div>
                <button class="btn-back" onclick="AppState.setPage('books')">← Back to Books</button>
            </div>
            
            <div class="search-section">
                <div class="search-row">
                    <input type="text" class="search-input" placeholder="🔍 Search activities..." 
                           value="${this.filterState.search}" onkeyup="Page2.updateFilter('search', this.value)">
                    
                    <select class="filter-select" onchange="Page2.updateFilter('theme', this.value)">
                        ${themes.map(t => `<option value="${t}" ${this.filterState.theme === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    
                    <select class="filter-select" onchange="Page2.updateFilter('month', this.value)">
                        <option value="All">All Months</option>
                        ${Utils.sortMonths(months).map(m => `<option value="${m}" ${this.filterState.month === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </div>
                
                <div class="problem-search">
                    <label>🎯 Or search by student problem:</label>
                    <select class="problem-select" onchange="Page2.searchByProblem(this.value)">
                        <option value="">Select a common student challenge...</option>
                        ${this.getProblemOptions()}
                    </select>
                </div>
                
                <div class="quick-stats">
                    <div class="stat-card"><div class="stat-number">${activities.length}</div><div class="stat-label">Total</div></div>
                    <div class="stat-card" style="background: linear-gradient(135deg, #4caf50, #66bb6a)">
                        <div class="stat-number">${AppState.completedIds.length}</div><div class="stat-label">Completed</div>
                    </div>
                    <div class="stat-card" style="background: linear-gradient(135deg, #ff9800, #ffa726)">
                        <div class="stat-number">${activities.length - AppState.completedIds.length}</div><div class="stat-label">Remaining</div>
                    </div>
                </div>
            </div>
            
            <div id="activities-list"></div>
        `;
        
        this.renderActivities(activities);
    },
    
    getProblemOptions() {
        const problems = window.CURRICULUM_STUDENT_PROBLEMS || {};
        let html = '';
        Object.keys(problems).forEach(theme => {
            html += `<optgroup label="${theme}">`;
            problems[theme].forEach((p, i) => {
                html += `<option value="${theme}:${i}">${p.text}</option>`;
            });
            html += '</optgroup>';
        });
        return html;
    },
    
    searchByProblem(value) {
        if (!value) return;
        const [theme, index] = value.split(':');
        const problems = window.CURRICULUM_STUDENT_PROBLEMS || {};
        const problem = problems[theme]?.[parseInt(index)];
        
        if (problem && problem.activities) {
            // Filter to show only recommended activities
            this.filterState.search = problem.activities.join('|');
            this.render();
            Utils.showToast(`Showing activities for: ${problem.text}`);
        }
    },
    
    updateFilter(key, value) {
        this.filterState[key] = value;
        this.render();
    },
    
    getFilteredActivities() {
        let filtered = AppState.activities;
        
        if (this.filterState.search) {
            const query = this.filterState.search.toLowerCase();
            filtered = filtered.filter(a => 
                a.name.toLowerCase().includes(query) ||
                a.theme.toLowerCase().includes(query) ||
                a.activityId.toString().includes(query)
            );
        }
        
        if (this.filterState.theme !== 'All') {
            filtered = filtered.filter(a => a.theme.toLowerCase() === this.filterState.theme.toLowerCase());
        }
        
        if (this.filterState.month !== 'All') {
            filtered = filtered.filter(a => this.extractMonth(a.group) === this.filterState.month);
        }
        
        return filtered;
    },
    
    extractMonth(group) {
        const arr = Array.isArray(group) ? group : [group];
        for (const g of arr) {
            const str = typeof g === 'string' ? g : g?.identifier || '';
            if (str) return str.split(' - ')[0] || '';
        }
        return '';
    },
    
    renderActivities(activities) {
        const container = document.getElementById('activities-list');
        const grouped = {};
        
        activities.forEach(a => {
            const month = this.extractMonth(a.group) || 'Other';
            if (!grouped[month]) grouped[month] = [];
            grouped[month].push(a);
        });
        
        container.innerHTML = Object.keys(grouped).length === 0 
            ? '<div style="text-align:center; padding: 60px; color: #999;"><h3>No activities found</h3><p>Try adjusting your filters</p></div>'
            : '';
        
        Utils.sortMonths(Object.keys(grouped)).forEach(month => {
            const section = document.createElement('div');
            section.className = 'month-section';
            section.innerHTML = `
                <h2 class="month-header">${month}</h2>
                <div class="activities-grid" id="month-${month.replace(/\s/g, '')}"></div>
            `;
            container.appendChild(section);
            
            const grid = section.querySelector('.activities-grid');
            grouped[month].forEach(activity => {
                const isCompleted = AppState.completedIds.includes(activity.id);
                const card = document.createElement('div');
                card.className = 'activity-card' + (isCompleted ? ' completed' : '');
                card.innerHTML = `
                    <div class="activity-header" style="border-left-color: ${Utils.getThemeColor(activity.theme)}">
                        <span class="theme-badge" style="background: ${Utils.getThemeColor(activity.theme)}">${activity.theme}</span>
                        <span class="activity-id">#${activity.activityId}</span>
                    </div>
                    <div class="activity-body">
                        <h3 class="activity-name">${activity.name}</h3>
                        ${isCompleted ? '<span class="completed-badge">✓ Completed</span>' : ''}
                    </div>
                    <div class="activity-footer">
                        <button class="btn-view">${isCompleted ? 'View Again' : 'Start Activity'}</button>
                    </div>
                `;
                
                card.onclick = () => {
                    AppState.selectActivity(activity.id);
                    Page3.load(window.curriculumAPI, activity);
                };
                
                grid.appendChild(card);
            });
        });
    }
};

console.log('[Curriculum SPA v2] Pages 1 & 2 loaded');

/**
 * VESPA Curriculum SPA v2.0 - Part 3: Activity Viewer & Init
 */

// ===== PAGE 3: ACTIVITY VIEWER =====
const Page3 = {
    async load(api, activity) {
        const container = document.getElementById('page-viewer');
        if (!container) return;
        
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading activity...</p></div>';
        
        try {
            const [discussions, completions] = await Promise.all([
                api.getDiscussions(activity.id),
                api.getUserCompletions()
            ]);
            
            const isCompleted = completions.length > 0 && 
                               (completions[0].activitiesCompleted[AppState.currentBook] || []).includes(activity.id);
            
            this.render(activity, discussions, isCompleted, api);
        } catch (error) {
            container.innerHTML = '<div class="error-state"><h3>Failed to load activity</h3></div>';
        }
    },
    
    render(activity, discussions, isCompleted, api) {
        const container = document.getElementById('page-viewer');
        const iframe = Utils.extractIframe(activity.content);
        const pdfLink = Utils.extractPdfLink(activity.content);
        
        container.innerHTML = `
            <div class="viewer-header">
                <div class="breadcrumbs">
                    <a href="#" onclick="AppState.setPage('books'); return false;">📚 Books</a> › 
                    <a href="#" onclick="AppState.setPage('browser'); return false;">${AppState.currentBook}</a> › 
                    <span>${activity.name}</span>
                </div>
                
                <div class="activity-meta">
                    <span class="meta-badge">#${activity.activityId}</span>
                    <span class="meta-badge theme-badge" style="background: ${Utils.getThemeColor(activity.theme)}">${activity.theme}</span>
                    ${isCompleted ? '<span class="meta-badge completed-large">✓ Completed</span>' : ''}
                </div>
                
                <h1 class="activity-title">${activity.name}</h1>
            </div>
            
            <div class="content-section">
                ${iframe ? `<div class="activity-iframe">${iframe}</div>` : '<p style="text-align:center; color: #999;">No embedded content</p>'}
                ${pdfLink ? `<div class="pdf-download"><a href="${pdfLink}" target="_blank" class="btn-pdf">📄 Download PDF</a></div>` : ''}
            </div>
            
            <div class="completion-section">
                ${isCompleted 
                    ? '<div class="completed-message">✓ You completed this activity</div>'
                    : '<button class="btn-complete" onclick="Page3.complete()">✓ Complete and Continue</button>'}
            </div>
            
            <div class="discussions-section">
                <div class="discussions-header">
                    <h2>Discussion <span style="color: var(--vespa-blue)">(${discussions.length})</span></h2>
                </div>
                
                <div class="comment-form">
                    <textarea id="new-comment" class="comment-textarea" rows="3" placeholder="Share your thoughts on this activity..."></textarea>
                    <button class="btn-post-comment" onclick="Page3.addComment()">Post Comment</button>
                </div>
                
                <div id="discussions-list">
                    ${discussions.length === 0 
                        ? '<p style="text-align:center; color: #999; padding: 30px;">No comments yet. Be the first!</p>'
                        : discussions.map(d => `
                            <div class="discussion-item">
                                <div class="discussion-meta">
                                    <span class="discussion-author">${d.author}</span>
                                    <span class="discussion-date">${d.date}</span>
                                </div>
                                <div class="discussion-text">${d.comment}</div>
                            </div>
                        `).join('')}
                </div>
            </div>
            
            <div class="nav-buttons">
                <button class="btn-nav" onclick="AppState.setPage('browser')">← Back to Activities</button>
                <button class="btn-nav" onclick="AppState.setPage('books')">📚 Back to Books</button>
            </div>
        `;
    },
    
    async complete() {
        const btn = document.querySelector('.btn-complete');
        if (!btn) return;
        
        btn.disabled = true;
        btn.textContent = 'Completing...';
        
        try {
            await window.curriculumAPI.completeActivity(AppState.currentActivity.id, AppState.currentBook);
            Utils.showToast('Activity completed! 🎉');
            
            // Reload to show completed state
            await this.load(window.curriculumAPI, AppState.currentActivity);
        } catch (error) {
            alert('Failed to complete activity. Please try again.');
            btn.disabled = false;
            btn.textContent = '✓ Complete and Continue';
        }
    },
    
    async addComment() {
        const textarea = document.getElementById('new-comment');
        const comment = textarea?.value?.trim();
        if (!comment) return;
        
        const btn = document.querySelector('.btn-post-comment');
        btn.disabled = true;
        btn.textContent = 'Posting...';
        
        try {
            await window.curriculumAPI.addDiscussion(AppState.currentActivity.id, comment);
            Utils.showToast('Comment posted!');
            
            // Reload discussions
            await this.load(window.curriculumAPI, AppState.currentActivity);
        } catch (error) {
            alert('Failed to post comment. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Post Comment';
        }
    }
};

// ===== INITIALIZATION =====
window.initializeCurriculumSPA = async function() {
    console.log('[Curriculum SPA v2] Initializing...');
    
    const config = window.CURRICULUM_RESOURCES_CONFIG;
    if (!config) {
        console.error('[Curriculum SPA] No config found');
        return;
    }
    
    console.log('[Curriculum SPA] Config loaded');
    
    // Wait for view to exist
    const waitForView = setInterval(() => {
        const view = document.querySelector('#' + config.viewKey);
        if (view) {
            clearInterval(waitForView);
            initApp();
        }
    }, 100);
    
    async function initApp() {
        console.log('[Curriculum SPA] View found, creating SPA container');
        
        const view = document.querySelector('#' + config.viewKey);
        let container = document.getElementById('curriculum-spa-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'curriculum-spa-container';
            view.parentElement.appendChild(container);
        }
        
        container.innerHTML = `
            <div class="curriculum-page active" data-page="books" id="page-books"></div>
            <div class="curriculum-page" data-page="browser" id="page-browser"></div>
            <div class="curriculum-page" data-page="viewer" id="page-viewer"></div>
        `;
        
        // Initialize API with proper credentials
        window.curriculumAPI = new CurriculumAPI({
            knackAppId: config.knackAppId,
            knackApiKey: config.knackApiKey
        });
        
        console.log('[Curriculum SPA] API initialized');
        
        // Load Page 1
        await Page1.render(window.curriculumAPI);
        
        console.log('[Curriculum SPA] 🎉 Ready! All 3 pages loaded in ONE scene!');
    }
};

// Expose Page2 and Page3 globally for onclick handlers
window.Page2 = Page2;
window.Page3 = Page3;
window.AppState = AppState;

console.log('[Curriculum SPA v2] ✅ All components loaded - Ready to initialize!');

