/**
 * VESPA Curriculum SPA v2b - Desktop-First, Information-Dense
 * Complete rewrite focused on showing MORE with LESS scrolling
 */

console.log('[Curriculum SPA v2b] Loading...');

// ===== API CLASS =====
class CurriculumAPI {
    constructor(config) {
        this.config = config;
        this.cache = {};
    }

    getCurrentUser() {
        if (typeof Knack !== 'undefined' && Knack.getUserAttributes) {
            const user = Knack.getUserAttributes();
            return { id: user.id, email: user.email, name: user.name || 'User' };
        }
        return null;
    }

    async fetch(objectKey, filters = null) {
        const url = `https://eu-api.knack.com/v1/objects/${objectKey}/records`;
        let params = new URLSearchParams({ rows_per_page: '1000' });
        if (filters) params.append('filters', JSON.stringify(filters));
        
        const response = await fetch(url + '?' + params, {
            headers: {
                'X-Knack-Application-Id': this.config.knackAppId,
                'X-Knack-REST-API-Key': this.config.knackApiKey,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        return data.records || [];
    }

    async getBooks() {
        const records = await this.fetch('object_56');
        return records.map(r => ({
            id: r.id,
            name: r.field_1429,
            imageUrl: (r.field_1439 || '').match(/src="([^"]+)"/) ? (r.field_1439.match(/src="([^"]+)"/)[1]) : ''
        }));
    }

    async getActivities(bookName) {
        console.log('[API] Fetching activities for book:', bookName);
        
        // FIXED: Proper filter for book name
        const filters = {
            match: 'and',
            rules: [{
                field: 'field_2702',
                operator: 'is',
                value: bookName
            }]
        };
        
        const records = await this.fetch('object_58', filters);
        console.log('[API] Fetched', records.length, 'activities for', bookName);
        
        return records.map(r => ({
            id: r.id,
            book: r.field_2702,
            activityId: r.field_1446,
            theme: r.field_1461 || 'General',
            name: r.field_1431,
            group: r.field_1435_raw || r.field_1435,
            content: r.field_1448_raw || r.field_1448
        }));
    }

    async getUserCompletions() {
        const user = this.getCurrentUser();
        if (!user) return [];
        
        const filters = {
            match: 'and',
            rules: [{ field: 'field_1437', operator: 'is', value: user.id }]
        };
        
        const records = await this.fetch('object_59', filters);
        return records.map(r => {
            let json = {};
            try {
                const raw = r.field_1432_raw || r.field_1432;
                json = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch (e) {}
            return { id: r.id, completed: json };
        });
    }

    async calculateProgress(bookName) {
        const [activities, completions] = await Promise.all([
            this.getActivities(bookName),
            this.getUserCompletions()
        ]);
        
        const ids = completions[0]?.completed[bookName] || [];
        return {
            total: activities.length,
            completed: ids.length,
            percentage: Math.round((ids.length / activities.length) * 100),
            ids
        };
    }

    async completeActivity(activityId, bookName) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('Not logged in');
        
        const completions = await this.getUserCompletions();
        let json = completions[0]?.completed || {};
        
        if (!json[bookName]) json[bookName] = [];
        if (!json[bookName].includes(activityId)) json[bookName].push(activityId);
        
        const data = {
            field_1437: [user.id],
            field_1432: JSON.stringify(json),
            field_2295: new Date().toISOString()
        };
        
        const url = completions.length > 0
            ? `https://eu-api.knack.com/v1/objects/object_59/records/${completions[0].id}`
            : 'https://eu-api.knack.com/v1/objects/object_59/records';
        
        const response = await fetch(url, {
            method: completions.length > 0 ? 'PUT' : 'POST',
            headers: {
                'X-Knack-Application-Id': this.config.knackAppId,
                'X-Knack-REST-API-Key': this.config.knackApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('Failed');
        return response.json();
    }

    async getDiscussions(activityId) {
        const filters = {
            match: 'and',
            rules: [{ field: 'field_1444', operator: 'is', value: activityId }]
        };
        
        const records = await this.fetch('object_60', filters);
        return records.map(r => ({
            author: r.field_1445_raw?.[0]?.identifier || 'Unknown',
            comment: r.field_1433,
            date: r.field_1447_raw?.date_formatted || r.field_1447
        }));
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
        
        if (!response.ok) throw new Error('Failed');
        return response.json();
    }
}

// ===== UTILITIES =====
const U = {
    colors: { Vision: '#FFA500', Effort: '#a4c2f4', Systems: '#aad950', Practice: '#a986ff', Attitude: '#ff769c' },
    getColor(theme) { return this.colors[theme?.trim()] || this.colors[theme?.trim().toUpperCase()] || '#079baa'; },
    iframe(html) { 
        if (!html) return null;
        if (html.trim().startsWith('<iframe')) return html;
        const m = html.match(/<iframe[^>]*>[\s\S]*?<\/iframe>/i);
        return m ? m[0] : null;
    },
    pdf(html) {
        if (!html) return null;
        const m = html.match(/href="([^"]*\.pdf[^"]*)"/i);
        return m ? m[1] : null;
    },
    month(group) {
        const arr = Array.isArray(group) ? group : [group];
        for (const g of arr) {
            const str = typeof g === 'string' ? g : g?.identifier || '';
            if (str) return str.split(' - ')[0];
        }
        return 'Other';
    },
    toast(msg) {
        const t = document.createElement('div');
        t.className = 'success-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
    }
};

// ===== STATE =====
const State = {
    page: 'books',
    book: null,
    activity: null,
    activities: [],
    completedIds: [],
    filters: { search: '', theme: 'All', month: 'All' }
};

// ===== PAGE 1: BOOKS =====
const P1 = {
    async show(api) {
        const c = document.getElementById('page-books');
        c.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
        
        try {
            const books = await api.getBooks();
            const progress = await Promise.all(books.map(b => api.calculateProgress(b.name)));
            
            c.innerHTML = `
                <div class="books-header">
                    <h1>Choose Your Curriculum</h1>
                    <p>Select a book to explore teaching activities</p>
                </div>
                <div id="books-grid"></div>
            `;
            
            const grid = c.querySelector('#books-grid');
            books.forEach((b, i) => {
                const p = progress[i];
                const card = document.createElement('div');
                card.className = 'book-card';
                card.innerHTML = `
                    <img src="${b.imageUrl}" alt="${b.name}">
                    <h2>${b.name}</h2>
                    <div class="book-progress">
                        <div class="progress-percentage">${p.percentage}%</div>
                        <div class="progress-label">Complete</div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${p.percentage}%"></div>
                        </div>
                        <div class="progress-stats">${p.completed} of ${p.total}</div>
                    </div>
                    <button class="btn-explore">Explore Activities</button>
                `;
                card.onclick = () => P2.show(api, b.name);
                grid.appendChild(card);
            });
        } catch (e) {
            c.innerHTML = '<div class="error-state"><h3>Error loading books</h3></div>';
        }
    }
};

console.log('[Curriculum SPA v2b] Core loaded, building pages...');

/**
 * Page 2: Compact Activity Browser - Shows 15-20 activities at once
 */

const P2 = {
    async show(api, bookName) {
        State.book = bookName;
        State.page = 'browser';
        document.querySelectorAll('.curriculum-page').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-page="browser"]').classList.add('active');
        
        const c = document.getElementById('page-browser');
        c.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
        
        try {
            const [activities, completions] = await Promise.all([
                api.getActivities(bookName),
                api.getUserCompletions()
            ]);
            
            console.log('[P2] Loaded', activities.length, 'activities for', bookName);
            
            State.activities = activities;
            State.completedIds = completions[0]?.completed[bookName] || [];
            
            this.render();
        } catch (e) {
            console.error('[P2] Error:', e);
            c.innerHTML = '<div class="error-state"><h3>Failed to load activities</h3></div>';
        }
    },
    
    render() {
        const c = document.getElementById('page-browser');
        const filtered = this.getFiltered();
        const months = [...new Set(State.activities.map(a => U.month(a.group)))];
        const themes = ['All', 'Vision', 'Effort', 'Systems', 'Practice', 'Attitude'];
        const progress = State.activities.length > 0 
            ? Math.round((State.completedIds.length / State.activities.length) * 100)
            : 0;
        
        c.innerHTML = `
            <div class="browser-top">
                <div class="browser-header">
                    <div class="browser-title">
                        <h1>${State.book}</h1>
                        <span class="activity-count">${filtered.length} of ${State.activities.length} activities</span>
                    </div>
                    <button class="btn-back" onclick="P1.show(window.api)">← Back to Books</button>
                </div>
                
                <div class="overall-progress">
                    <div class="overall-progress-label">
                        <span>Overall Progress</span>
                        <span>${State.completedIds.length} / ${State.activities.length} (${progress}%)</span>
                    </div>
                    <div class="overall-progress-bar">
                        <div class="overall-progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
                
                <div class="filters-row">
                    <input type="text" class="search-input" placeholder="🔍 Search by name, theme, or ID..." 
                           value="${State.filters.search}" oninput="P2.filter('search', this.value)">
                    
                    <div class="problem-search">
                        <label>🎯 Or search by student problem:</label>
                        <select class="problem-select" onchange="P2.searchProblem(this.value)">
                            <option value="">Select challenge...</option>
                            ${this.getProblemOptions()}
                        </select>
                    </div>
                </div>
                
                <div class="theme-filters">
                    ${themes.map(t => `
                        <button class="theme-chip ${State.filters.theme === t ? 'active' : ''}" 
                                data-theme="${t}"
                                onclick="P2.filter('theme', '${t}')">
                            ${t} ${t !== 'All' ? '(' + State.activities.filter(a => a.theme === t).length + ')' : ''}
                        </button>
                    `).join('')}
                </div>
                
                <div class="month-tabs">
                    <button class="month-tab ${State.filters.month === 'All' ? 'active' : ''}" 
                            onclick="P2.filter('month', 'All')">All Months</button>
                    ${months.map(m => `
                        <button class="month-tab ${State.filters.month === m ? 'active' : ''}" 
                                onclick="P2.filter('month', '${m}')">${m}</button>
                    `).join('')}
                </div>
            </div>
            
            <div class="activities-container" id="activities-list"></div>
        `;
        
        this.renderActivities(filtered);
    },
    
    renderActivities(activities) {
        const list = document.getElementById('activities-list');
        
        if (activities.length === 0) {
            list.innerHTML = '<div class="no-results"><h3>No activities found</h3><p>Try adjusting your filters</p></div>';
            return;
        }
        
        list.innerHTML = activities.map(a => {
            const isCompleted = State.completedIds.includes(a.id);
            const month = U.month(a.group);
            
            return `
                <div class="activity-row ${isCompleted ? 'completed' : ''}" onclick="P3.show(window.api, '${a.id}')">
                    <div class="row-id">#${a.activityId}</div>
                    <div class="row-theme" style="background: ${U.getColor(a.theme)}">${a.theme}</div>
                    <div class="row-name">${a.name}</div>
                    <div class="row-month">${month}</div>
                    <div class="row-status">
                        ${isCompleted 
                            ? '<span class="status-completed">✓ Done</span>' 
                            : '<button class="btn-view-activity">View</button>'}
                    </div>
                </div>
            `;
        }).join('');
    },
    
    getFiltered() {
        let filtered = State.activities;
        
        if (State.filters.search) {
            const q = State.filters.search.toLowerCase();
            filtered = filtered.filter(a => 
                a.name.toLowerCase().includes(q) ||
                a.theme.toLowerCase().includes(q) ||
                a.activityId.toString().includes(q)
            );
        }
        
        if (State.filters.theme !== 'All') {
            filtered = filtered.filter(a => a.theme === State.filters.theme);
        }
        
        if (State.filters.month !== 'All') {
            filtered = filtered.filter(a => U.month(a.group) === State.filters.month);
        }
        
        return filtered;
    },
    
    filter(key, value) {
        State.filters[key] = value;
        this.render();
    },
    
    searchProblem(value) {
        if (!value) return;
        const [theme, idx] = value.split(':');
        const problems = {
            Vision: [
                { activities: ["21st Birthday", "Roadmap", "Personal Compass", "Perfect Day"] },
                { activities: ["Motivation Diamond", "Five Roads", "Mission"] }
            ],
            Effort: [
                { activities: ["Weekly Planner", "25min", "Priority Matrix"] },
                { activities: ["Will vs Skill", "Thermometer", "Kill Your Critic"] }
            ],
            Systems: [
                { activities: ["Weekly Planner", "Priority", "STQR"] },
                { activities: ["Leitner", "Revision", "Spaced"] }
            ],
            Practice: [
                { activities: ["Test Yourself", "Spaced Practice", "Leitner"] },
                { activities: ["Time to Teach", "9 Box", "Practice"] }
            ],
            Attitude: [
                { activities: ["Growth Mindset", "Battery", "Managing"] },
                { activities: ["Failing", "Benefit", "Change Curve"] }
            ]
        };
        
        const p = problems[theme]?.[parseInt(idx)];
        if (p) {
            State.filters.search = p.activities.join('|');
            State.filters.theme = theme;
            this.render();
            U.toast(`Showing ${theme} activities`);
        }
    },
    
    getProblemOptions() {
        const problems = {
            Vision: ['Unsure about future goals', 'Not feeling motivated', 'Can\'t see connection to future'],
            Effort: ['Struggles to complete homework', 'Gives up when difficult', 'Gets distracted easily'],
            Systems: ['Not organized', 'No revision plan', 'Forgets homework'],
            Practice: ['Doesn\'t review regularly', 'Crams before tests', 'Avoids hard topics'],
            Attitude: ['Worries not smart enough', 'Gets discouraged', 'Compares to others']
        };
        
        let html = '';
        Object.keys(problems).forEach(theme => {
            html += `<optgroup label="${theme}">`;
            problems[theme].forEach((p, i) => {
                html += `<option value="${theme}:${i}">Student ${p.toLowerCase()}</option>`;
            });
            html += '</optgroup>';
        });
        return html;
    }
};

console.log('[Curriculum SPA v2b] Page 2 loaded');

/**
 * Page 3: Wide Activity Viewer - Desktop-optimized with side-by-side layout
 */

const P3 = {
    async show(api, activityId) {
        State.page = 'viewer';
        document.querySelectorAll('.curriculum-page').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-page="viewer"]').classList.add('active');
        
        const c = document.getElementById('page-viewer');
        c.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
        
        try {
            const activity = State.activities.find(a => a.id === activityId);
            if (!activity) throw new Error('Activity not found');
            
            State.activity = activity;
            
            const [discussions, completions] = await Promise.all([
                api.getDiscussions(activityId),
                api.getUserCompletions()
            ]);
            
            const isCompleted = (completions[0]?.completed[State.book] || []).includes(activityId);
            
            this.render(activity, discussions, isCompleted, api);
        } catch (e) {
            c.innerHTML = '<div class="error-state"><h3>Failed to load activity</h3></div>';
        }
    },
    
    render(activity, discussions, isCompleted, api) {
        const c = document.getElementById('page-viewer');
        const iframe = U.iframe(activity.content);
        const pdf = U.pdf(activity.content);
        
        c.innerHTML = `
            <div class="viewer-container">
                <div class="viewer-top">
                    <div class="breadcrumbs">
                        <a href="#" onclick="P1.show(window.api); return false;">📚 Books</a> › 
                        <a href="#" onclick="P2.show(window.api, '${State.book}'); return false;">${State.book}</a> › 
                        <span>${activity.name}</span>
                    </div>
                    
                    <div class="activity-header-info">
                        <span class="badge badge-id">#${activity.activityId}</span>
                        <span class="badge badge-theme" style="background: ${U.getColor(activity.theme)}">${activity.theme}</span>
                        ${isCompleted ? '<span class="badge badge-completed">✓ Completed</span>' : ''}
                    </div>
                    
                    <h1 class="activity-title-large">${activity.name}</h1>
                </div>
                
                <div class="viewer-main">
                    <div class="content-column">
                        ${iframe ? `<div class="activity-iframe-container">${iframe}</div>` : '<p style="text-align:center;color:#999;">No content available</p>'}
                        
                        <div class="action-buttons">
                            ${isCompleted 
                                ? '<div class="completed-banner">✓ You completed this activity</div>'
                                : '<button class="btn-complete" onclick="P3.complete()">✓ Complete and Continue</button>'}
                            ${pdf ? `<a href="${pdf}" target="_blank" class="btn-pdf">📄 Download PDF</a>` : ''}
                        </div>
                    </div>
                    
                    <div class="discussions-column">
                        <div class="discussions-header">Discussion (${discussions.length})</div>
                        
                        <div class="comment-form">
                            <textarea id="new-comment" class="comment-textarea" placeholder="Share your thoughts..."></textarea>
                            <button class="btn-post" onclick="P3.addComment()">Post Comment</button>
                        </div>
                        
                        <div id="discussions-list">
                            ${discussions.length === 0 
                                ? '<div class="no-comments">No comments yet!</div>'
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
                </div>
                
                <div class="viewer-nav">
                    <button class="btn-nav" onclick="P2.show(window.api, '${State.book}')">← Back to Activities</button>
                    <button class="btn-nav" onclick="P1.show(window.api)">📚 Back to Books</button>
                </div>
            </div>
        `;
    },
    
    async complete() {
        try {
            await window.api.completeActivity(State.activity.id, State.book);
            U.toast('Activity completed! 🎉');
            await this.show(window.api, State.activity.id);
        } catch (e) {
            alert('Failed to complete. Try again.');
        }
    },
    
    async addComment() {
        const textarea = document.getElementById('new-comment');
        const comment = textarea?.value?.trim();
        if (!comment) return;
        
        try {
            await window.api.addDiscussion(State.activity.id, comment);
            U.toast('Comment posted!');
            await this.show(window.api, State.activity.id);
        } catch (e) {
            alert('Failed to post comment.');
        }
    }
};

console.log('[Curriculum SPA v2b] Page 3 loaded');

// ===== INITIALIZATION =====
window.initializeCurriculumSPA = async function() {
    console.log('[Curriculum SPA v2b] Initializing...');
    
    const config = window.CURRICULUM_RESOURCES_CONFIG;
    if (!config) {
        console.error('[SPA] No config');
        return;
    }
    
    // Wait for view
    let attempts = 0;
    const wait = setInterval(() => {
        const view = document.querySelector('#' + config.viewKey);
        if (view || attempts++ > 50) {
            clearInterval(wait);
            if (view) init();
        }
    }, 100);
    
    function init() {
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
        
        window.api = new CurriculumAPI({
            knackAppId: config.knackAppId,
            knackApiKey: config.knackApiKey
        });
        
        P1.show(window.api);
        
        console.log('[Curriculum SPA v2b] ✅ Ready! Desktop-optimized, information-dense!');
    }
};

// Expose globally
window.P1 = P1;
window.P2 = P2;
window.P3 = P3;

console.log('[Curriculum SPA v2b] All loaded - Ready to go!');

