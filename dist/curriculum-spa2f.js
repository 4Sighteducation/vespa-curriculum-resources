/**
 * VESPA Curriculum SPA v2f - FIXED: Completion saving + Problem search with dynamic mapping
 */

console.log('[Curriculum SPA v2f] Loading...');

// ===== API CLASS =====
class CurriculumAPI {
    constructor(config) {
        this.config = config;
        this.allActivitiesCache = null;
        this.problemMappingsCache = null; // Cache for problem mappings
    }
    
    // NEW: Load problem mappings dynamically from GitHub
    async loadProblemMappings() {
        if (this.problemMappingsCache) return this.problemMappingsCache;
        
        const mappingUrl = 'https://cdn.jsdelivr.net/gh/4Sighteducation/vespa-curriculum-resources@main/problem_mappings_tutor_ids_and_record_ids.json';
        
        try {
            console.log('[API] Loading problem mappings from:', mappingUrl);
            const response = await fetch(mappingUrl);
            if (!response.ok) throw new Error(`Failed to load mappings: ${response.status}`);
            
            const data = await response.json();
            this.problemMappingsCache = data.problem_to_tutor || {};
            console.log('[API] Problem mappings loaded:', Object.keys(this.problemMappingsCache).length, 'problems');
            return this.problemMappingsCache;
        } catch (error) {
            console.error('[API] Error loading problem mappings:', error);
            return {};
        }
    }
    
    // Get ALL activities (all books) for problem search
    async getAllActivities() {
        if (this.allActivitiesCache) return this.allActivitiesCache;
        
        const filters = {
            match: 'and',
            rules: [{ field: 'field_1924', operator: 'is', value: 'No' }] // Only non-Welsh
        };
        
        const records = await this.fetch('object_58', filters);
        console.log('[API] Fetched', records.length, 'total activities (all books)');
        
        this.allActivitiesCache = records.map(r => ({
            id: r.id, 
            book: r.field_2702, 
            activityId: r.field_1446,
            theme: r.field_1461 || 'General', 
            name: r.field_1431,
            group: r.field_1435_raw || r.field_1435,
            content: r.field_1448_raw || r.field_1448
        }));
        
        return this.allActivitiesCache;
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
        const filters = {
            match: 'and',
            rules: [
                { field: 'field_2702', operator: 'is', value: bookName },
                { field: 'field_1924', operator: 'is', value: 'No' } // Filter out Welsh
            ]
        };
        
        const records = await this.fetch('object_58', filters);
        console.log('[API] Fetched', records.length, 'NON-Welsh activities');
        
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
        
        // FIXED: Connection field needs array of objects with id property
        const data = {
            field_1437: [{id: user.id}], // ✅ CORRECT FORMAT
            field_1432: JSON.stringify(json)
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
        
        if (!response.ok) {
            const error = await response.text();
            console.error('[API] Completion failed:', error);
            throw new Error('Failed to save completion');
        }
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

// ===== WELSH ACTIVITY OVERRIDES (Supabase) =====
let welshOverrideCache = null;

const getSupabaseConfig = () => {
    const cfg = window.CURRICULUM_RESOURCES_CONFIG || {};
    return {
        url: cfg.supabaseUrl || window.VESPA_SUPABASE_URL || '',
        key: cfg.supabaseAnonKey || window.VESPA_SUPABASE_ANON_KEY || ''
    };
};

const loadWelshOverrides = async () => {
    if (welshOverrideCache) return welshOverrideCache;
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
        welshOverrideCache = {};
        return welshOverrideCache;
    }
    const baseUrl = url.replace(/\/$/, '');
    const endpoint = `${baseUrl}/rest/v1/activities?select=name,book,knack_id,knack_activity_id,name_cy,slides_url_cy,slides_embed_cy&or=(name_cy.not.is.null,slides_url_cy.not.is.null,slides_embed_cy.not.is.null)`;
    try {
        const normalizeId = (value) => String(value || '').toLowerCase().replace(/[^0-9]/g, '');
        const normalizeText = (value) => String(value || '').toLowerCase().trim();
        const response = await fetch(endpoint, {
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`
            }
        });
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        const data = await response.json();
        console.log('[Curriculum SPA] Welsh overrides rows:', Array.isArray(data) ? data.length : 0);
        const map = {};
        data.forEach(item => {
            const nameKey = normalizeText(item.name);
            const bookKey = normalizeText(item.book);
            const activityKey = normalizeId(item.knack_activity_id);
            const recordKey = normalizeText(item.knack_id);
            const payload = {
                name_cy: item.name_cy || null,
                slides_url_cy: item.slides_url_cy || null,
                slides_embed_cy: item.slides_embed_cy || null
            };
            if (nameKey) {
                map[`${nameKey}|${bookKey}`] = payload;
            }
            if (activityKey) {
                map[`id:${activityKey}`] = payload;
            }
            if (recordKey) {
                map[`knack:${recordKey}`] = payload;
            }
        });
        console.log('[Curriculum SPA] Welsh override keys:', Object.keys(map).length);
        welshOverrideCache = map;
        return map;
    } catch (error) {
        console.warn('[Curriculum SPA] Failed to load Welsh overrides from Supabase:', error);
        welshOverrideCache = {};
        return welshOverrideCache;
    }
};

const getGoogleTranslateLanguage = () => {
    try {
        const cookieMatch = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
        if (cookieMatch) {
            const value = decodeURIComponent(cookieMatch[1]);
            if (value.includes('/cy')) return 'cy';
            if (value.includes('/en')) return 'en';
        }
        const selector = document.querySelector('.goog-te-combo');
        if (selector && selector.value) {
            if (selector.value === 'cy') return 'cy';
            if (selector.value === 'en') return 'en';
        }
        const htmlLang = document.documentElement?.lang || '';
        if (htmlLang.toLowerCase().startsWith('cy')) return 'cy';
        if (htmlLang.toLowerCase().startsWith('en')) return 'en';
    } catch (_) {}
    return '';
};

const getCurrentLanguage = () => {
    if (typeof window !== 'undefined' && window.Weglot && typeof window.Weglot.getCurrentLang === 'function') {
        return window.Weglot.getCurrentLang() || 'en';
    }
    const stored = localStorage.getItem('vespaPreferredLanguage');
    if (stored) return stored;
    const gtLang = getGoogleTranslateLanguage();
    return gtLang || 'en';
};

const getWelshOverride = (activity) => {
    const map = welshOverrideCache || {};
    const normalizeId = (value) => String(value || '').toLowerCase().replace(/[^0-9]/g, '');
    const normalizeText = (value) => String(value || '').toLowerCase().trim();
    const activityKey = normalizeId(activity?.activityId);
    const recordKey = normalizeText(activity?.id);
    const nameKey = normalizeText(activity?.name);
    const bookKey = normalizeText(activity?.book);
    if (activityKey && map[`id:${activityKey}`]) return map[`id:${activityKey}`];
    if (recordKey && map[`knack:${recordKey}`]) return map[`knack:${recordKey}`];
    if (!nameKey) return null;
    return map[`${nameKey}|${bookKey}`] || map[`${nameKey}|`] || null;
};

const getActivityDisplayName = (activity) => {
    const baseName = activity?.name || '';
    if (getCurrentLanguage() !== 'cy') return baseName;
    if (activity?.name_cy) return activity.name_cy;
    const override = getWelshOverride(activity);
    return override?.name_cy || baseName;
};

const getActivityDisplayContent = (activity) => {
    if (getCurrentLanguage() !== 'cy') return activity?.content || '';
    const override = getWelshOverride(activity);
    const pdf = U.pdf(activity?.content || '');
    const buildEmbedUrl = (url) => {
        if (!url) return '';
        try {
            const u = new URL(url);
            if (!u.hostname.includes('slides.com')) return url;
            if (u.pathname.endsWith('/fullscreen')) {
                u.pathname = u.pathname.replace(/\/fullscreen$/, '/embed');
            } else if (!u.pathname.endsWith('/embed')) {
                u.pathname = `${u.pathname.replace(/\/$/, '')}/embed`;
            }
            if (u.searchParams.has('token')) {
                const rawToken = u.searchParams.get('token') || '';
                const cleanToken = rawToken.split('?')[0].split('&')[0];
                u.searchParams.set('token', cleanToken);
            }
            u.searchParams.delete('mouseWheel');
            if (!u.searchParams.has('byline')) u.searchParams.set('byline', 'hidden');
            if (!u.searchParams.has('share')) u.searchParams.set('share', 'hidden');
            return u.toString();
        } catch (_) {
            return url;
        }
    };
    const embedUrl = override?.slides_url_cy ? buildEmbedUrl(override.slides_url_cy) : '';
    const embed = override?.slides_embed_cy
        || (embedUrl ? `<iframe src="${embedUrl}" width="100%" height="500" frameborder="0" allowfullscreen></iframe>` : null);
    if (embed) return pdf ? `${embed}<a href="${pdf}">PDF</a>` : embed;
    return activity?.content || '';
};

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
    // ACADEMIC YEAR SORT ORDER
    monthOrder: ['September', 'October', 'November', 'December', 'January', 'Febuary', 'February', 
                 'March', 'April', 'May', 'June', 'July'],
    sortByMonth(activities) {
        return activities.sort((a, b) => {
            const monthA = this.month(a.group);
            const monthB = this.month(b.group);
            const idxA = this.monthOrder.indexOf(monthA);
            const idxB = this.monthOrder.indexOf(monthB);
            return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });
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

console.log('[Curriculum SPA v2f] Core loaded');

// ===== PAGE 1: BOOKS =====
const P1 = {
    async show(api) {
        State.page = 'books';
        document.querySelectorAll('.curriculum-page').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-page="books"]').classList.add('active');
        
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

// ===== PAGE 2: ACTIVITY BROWSER (FIXED PROBLEM SEARCH) =====
const P2 = {
    async show(api, bookName, highlightActivityIds = null) {
        State.book = bookName;
        State.page = 'browser';
        State.filters = { search: '', theme: 'All', month: 'All' };
        State.highlightIds = highlightActivityIds;
        
        document.querySelectorAll('.curriculum-page').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-page="browser"]').classList.add('active');
        
        const c = document.getElementById('page-browser');
        c.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
        
        try {
            const [activities, completions] = await Promise.all([
                api.getActivities(bookName),
                api.getUserCompletions()
            ]);
            
            // SORT BY ACADEMIC YEAR (September → July)
            State.activities = U.sortByMonth(activities);
            State.completedIds = completions[0]?.completed[bookName] || [];
            
            console.log('[P2] Loaded & sorted', State.activities.length, 'activities');
            
            this.render(api);
        } catch (e) {
            console.error('[P2] Error:', e);
            c.innerHTML = '<div class="error-state"><h3>Failed to load</h3></div>';
        }
    },
    
    render(api) {
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
                    <input type="text" id="search-input" class="search-input" placeholder="🔍 Search by name or theme..." 
                           value="${State.filters.search}">
                    
                    <div class="problem-search">
                        <label>🎯 Or search by student problem:</label>
                        <select id="problem-select" class="problem-select">
                            <option value="">Select challenge...</option>
                            ${this.getProblemOptions()}
                        </select>
                    </div>
                </div>
                
                <div class="theme-filters">
                    ${themes.map(t => `
                        <button class="theme-chip ${State.filters.theme === t ? 'active' : ''}" 
                                data-theme="${t}"
                                onclick="P2.setTheme('${t}')">
                            ${t} ${t !== 'All' ? '(' + State.activities.filter(a => a.theme === t).length + ')' : ''}
                        </button>
                    `).join('')}
                </div>
                
                <div class="month-tabs">
                    <button class="month-tab ${State.filters.month === 'All' ? 'active' : ''}" 
                            onclick="P2.setMonth('All')">All Months</button>
                    ${U.monthOrder.filter(m => months.includes(m)).map(m => `
                        <button class="month-tab ${State.filters.month === m ? 'active' : ''}" 
                                onclick="P2.setMonth('${m}')">${m}</button>
                    `).join('')}
                </div>
            </div>
            
            <div class="activities-container" id="activities-list"></div>
        `;
        
        // Add event listeners AFTER render
        setTimeout(() => {
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    State.filters.search = e.target.value;
                    this.updateActivitiesList();
                });
            }
            
            const problemSelect = document.getElementById('problem-select');
            if (problemSelect) {
                problemSelect.addEventListener('change', (e) => {
                    this.searchByProblem(api, e.target.value);
                });
            }
        }, 0);
        
        this.renderActivities(filtered);
    },
    
    updateActivitiesList() {
        const filtered = this.getFiltered();
        this.renderActivities(filtered);
        
        const countEl = document.querySelector('.activity-count');
        if (countEl) {
            countEl.textContent = `${filtered.length} of ${State.activities.length} activities`;
        }
    },
    
    setTheme(theme) {
        State.filters.theme = theme;
        this.render(window.api);
    },
    
    setMonth(month) {
        State.filters.month = month;
        this.render(window.api);
    },
    
    // FIXED: Use actual problem mappings from GitHub
    async searchByProblem(api, value) {
        if (!value) {
            State.filters.search = '';
            this.updateActivitiesList();
            return;
        }
        
        try {
            // Load problem mappings dynamically
            const mappings = await api.loadProblemMappings();
            const problemData = mappings[value];
            
            if (!problemData || !problemData.tutor_record_ids) {
                U.toast('No activities found for this problem');
                return;
            }
            
            console.log('[P2] Problem search:', problemData.problem_text);
            console.log('[P2] Looking for record IDs:', problemData.tutor_record_ids);
            
            // Get all activities to search across books
            const allActivities = await api.getAllActivities();
            
            // Find activities that match the record IDs
            const matched = allActivities.filter(a => problemData.tutor_record_ids.includes(a.id));
            
            console.log('[P2] Matched', matched.length, 'activities');
            
            if (matched.length === 0) {
                U.toast('No activities found for this problem');
                return;
            }
            
            // Check if activities are in current book or other books
            const inCurrentBook = matched.filter(a => a.book === State.book);
            const inOtherBooks = matched.filter(a => a.book !== State.book);
            
            if (inCurrentBook.length > 0) {
                // Show activities in current book
                this.renderActivities(inCurrentBook);
                U.toast(`Found ${inCurrentBook.length} matching activities in ${State.book}`);
                
                if (inOtherBooks.length > 0) {
                    // Also notify about activities in other books
                    const otherBookNames = [...new Set(inOtherBooks.map(a => a.book))];
                    console.log(`[P2] Also found ${inOtherBooks.length} activities in: ${otherBookNames.join(', ')}`);
                }
            } else if (inOtherBooks.length > 0) {
                // All activities are in other books
                const bookGroups = inOtherBooks.reduce((acc, a) => {
                    if (!acc[a.book]) acc[a.book] = [];
                    acc[a.book].push(a);
                    return acc;
                }, {});
                
                const bookNames = Object.keys(bookGroups);
                const message = `Found ${inOtherBooks.length} activities in: ${bookNames.join(', ')}. Switch books to view them.`;
                U.toast(message);
                
                // Show empty state with helpful message
                const list = document.getElementById('activities-list');
                list.innerHTML = `
                    <div class="no-results">
                        <h3>Activities found in other books</h3>
                        <p>${message}</p>
                        ${bookNames.map(book => `
                            <button class="btn-view-activity" onclick="P2.show(window.api, '${book}')" 
                                    style="margin: 5px;">
                                View ${bookGroups[book].length} in ${book}
                            </button>
                        `).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error('[P2] Problem search error:', error);
            U.toast('Error loading problem mappings');
        }
    },
    
    getProblemOptions() {
        // Simplified problem categories for dropdown
        const problems = {
            Vision: [
                { id: 'svision_1', text: 'Unsure about future goals' },
                { id: 'svision_2', text: 'Not feeling motivated' },
                { id: 'svision_3', text: 'Can\'t see connection to future' }
            ],
            Effort: [
                { id: 'seffort_1', text: 'Struggles with homework' },
                { id: 'seffort_2', text: 'Gives up when difficult' },
                { id: 'seffort_3', text: 'Gets distracted easily' }
            ],
            Systems: [
                { id: 'ssystems_1', text: 'Not organized' },
                { id: 'ssystems_2', text: 'No revision plan' },
                { id: 'ssystems_3', text: 'Forgets homework' }
            ],
            Practice: [
                { id: 'spractice_1', text: 'Doesn\'t review regularly' },
                { id: 'spractice_2', text: 'Crams before tests' },
                { id: 'spractice_3', text: 'Avoids hard topics' }
            ],
            Attitude: [
                { id: 'sattitude_1', text: 'Worries not smart enough' },
                { id: 'sattitude_2', text: 'Gets discouraged' },
                { id: 'sattitude_3', text: 'Compares to others' }
            ]
        };
        
        let html = '';
        Object.keys(problems).forEach(theme => {
            html += `<optgroup label="${theme}">`;
            problems[theme].forEach(p => {
                html += `<option value="${p.id}">Student ${p.text.toLowerCase()}</option>`;
            });
            html += '</optgroup>';
        });
        return html;
    },
    
    getFiltered() {
        let filtered = State.activities;
        
        if (State.filters.search) {
            const q = State.filters.search.toLowerCase();
            filtered = filtered.filter(a => 
                getActivityDisplayName(a).toLowerCase().includes(q) ||
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
    
    renderActivities(activities) {
        const list = document.getElementById('activities-list');
        
        if (activities.length === 0) {
            list.innerHTML = '<div class="no-results"><h3>No activities found</h3><p>Try different filters</p></div>';
            return;
        }
        
        list.innerHTML = activities.map(a => {
            const isCompleted = State.completedIds.includes(a.id);
            const month = U.month(a.group);
            
            return `
                <div class="activity-row ${isCompleted ? 'completed' : ''}" onclick="P3.show(window.api, '${a.id}')">
                    <div class="row-theme" style="background: ${U.getColor(a.theme)}">${a.theme}</div>
                    <div class="row-name">${getActivityDisplayName(a)}</div>
                    <div class="row-month">${month}</div>
                    <div class="row-status">
                        ${isCompleted 
                            ? '<span class="status-completed">✓ Done</span>' 
                            : '<button class="btn-view-activity">View</button>'}
                    </div>
                </div>
            `;
        }).join('');
    }
};

// ===== PAGE 3: WIDE VIEWER =====
const P3 = {
    async show(api, activityId) {
        State.page = 'viewer';
        document.querySelectorAll('.curriculum-page').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-page="viewer"]').classList.add('active');
        
        const c = document.getElementById('page-viewer');
        c.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
        
        try {
            const activity = State.activities.find(a => a.id === activityId);
            if (!activity) throw new Error('Not found');
            
            State.activity = activity;
            
            const [discussions, completions] = await Promise.all([
                api.getDiscussions(activityId),
                api.getUserCompletions()
            ]);
            
            const isCompleted = (completions[0]?.completed[State.book] || []).includes(activityId);
            
            this.render(activity, discussions, isCompleted);
        } catch (e) {
            c.innerHTML = '<div class="error-state"><h3>Failed to load</h3></div>';
        }
    },
    
    render(activity, discussions, isCompleted) {
        const c = document.getElementById('page-viewer');
        const activityName = getActivityDisplayName(activity);
        const activityContent = getActivityDisplayContent(activity);
        const iframe = U.iframe(activityContent);
        const pdf = U.pdf(activityContent);
        
        c.innerHTML = `
            <div class="viewer-container">
                <div class="viewer-top">
                    <div class="breadcrumbs">
                        <a href="#" onclick="P1.show(window.api); return false;">📚 Books</a> › 
                        <a href="#" onclick="P2.show(window.api, '${State.book}'); return false;">${State.book}</a> › 
                        <span>${activityName}</span>
                    </div>
                    
                    <div class="activity-header-info">
                        <span class="badge badge-id">#${activity.activityId}</span>
                        <span class="badge badge-theme" style="background: ${U.getColor(activity.theme)}">${activity.theme}</span>
                        ${isCompleted ? '<span class="badge badge-completed">✓ Completed</span>' : ''}
                    </div>
                    
                    <h1 class="activity-title-large">${activityName}</h1>
                </div>
                
                <div class="viewer-main">
                    <div class="content-column">
                        ${iframe ? `<div class="activity-iframe-container">${iframe}</div>` : '<p style="text-align:center;color:#999;">No content</p>'}
                        
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
        const btn = document.querySelector('.btn-complete');
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = 'Completing...';
        
        try {
            await window.api.completeActivity(State.activity.id, State.book);
            U.toast('Activity completed! 🎉');
            await this.show(window.api, State.activity.id);
        } catch (e) {
            console.error('[P3] Completion error:', e);
            alert('Failed to save completion. Please try again.');
            btn.disabled = false;
            btn.textContent = '✓ Complete and Continue';
        }
    },
    
    async addComment() {
        const textarea = document.getElementById('new-comment');
        const comment = textarea?.value?.trim();
        if (!comment) return;
        
        const btn = document.querySelector('.btn-post');
        btn.disabled = true;
        btn.textContent = 'Posting...';
        
        try {
            await window.api.addDiscussion(State.activity.id, comment);
            U.toast('Comment posted!');
            await this.show(window.api, State.activity.id);
        } catch (e) {
            alert('Failed to post.');
            btn.disabled = false;
            btn.textContent = 'Post Comment';
        }
    }
};

// ===== INIT =====
window.initializeCurriculumSPA = async function() {
    console.log('[SPA v2f] Initializing...');
    
    const config = window.CURRICULUM_RESOURCES_CONFIG;
    if (!config) return;
    
    let attempts = 0;
    const wait = setInterval(() => {
        const view = document.querySelector('#' + config.viewKey);
        if (view || attempts++ > 50) {
            clearInterval(wait);
            if (view) init();
        }
    }, 100);
    
    let lastLanguage = null;

    const refreshForLanguage = (lang) => {
        if (!lang || lang === lastLanguage) return;
        lastLanguage = lang;
        try {
            if (State.page === 'viewer' && State.activity?.id) {
                P3.show(window.api, State.activity.id);
                return;
            }
            if (State.page === 'browser') {
                P2.render(window.api);
                return;
            }
            if (State.page === 'books') {
                P1.show(window.api);
            }
        } catch (e) {
            console.warn('[SPA v2f] Language refresh failed:', e);
        }
    };

    async function init() {
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

        await loadWelshOverrides();
        lastLanguage = getCurrentLanguage();
        setInterval(() => refreshForLanguage(getCurrentLanguage()), 800);
        P1.show(window.api);
        
        console.log('[SPA v2f] ✅ Ready! Fixed completion saving + problem search!');
    }
};

window.P1 = P1;
window.P2 = P2;
window.P3 = P3;

console.log('[Curriculum SPA v2f] All loaded!');

