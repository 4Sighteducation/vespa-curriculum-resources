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

