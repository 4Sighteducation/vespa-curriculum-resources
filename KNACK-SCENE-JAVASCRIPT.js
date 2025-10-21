/**
 * ========================================
 * PASTE THIS ENTIRE FILE INTO KNACK SCENE_1280 JAVASCRIPT TAB
 * ========================================
 * 
 * This is a standalone version for testing directly in Knack
 * Once tested and working, push to GitHub and use CDN URLs instead
 */

// ===== CONFIGURATION =====
window.CURRICULUM_RESOURCES_CONFIG = {
    knackAppId: '5ee90912c38ae7001510c1a9',
    knackApiKey: '8f733aa5-dd35-4464-8348-64824d1f5f0d',
    sceneKey: 'scene_1280',
    viewKey: 'view_3244',
    appType: 'curriculumResources',
    debugMode: true // Set to false after testing
};

console.log('[Curriculum Resources] Config initialized');

// ===== CURRICULUM API =====
class CurriculumAPI {
    constructor(config) {
        this.config = config;
        this.cache = {
            books: null,
            groups: null,
            activities: null,
            completions: null,
            discussions: null,
            lastFetch: {}
        };
        this.cacheExpiry = 5 * 60 * 1000;
    }

    getCurrentUser() {
        if (typeof Knack !== 'undefined' && Knack.getUserAttributes) {
            const user = Knack.getUserAttributes();
            return {
                id: user.id,
                email: user.email,
                name: user.name || user.values?.field_85 || 'User',
                ...user
            };
        }
        return null;
    }

    isCacheValid(key) {
        if (!this.cache[key]) return false;
        if (!this.cache.lastFetch[key]) return false;
        const age = Date.now() - this.cache.lastFetch[key];
        return age < this.cacheExpiry;
    }

    async fetchFromKnack(objectKey, filters = null, sort = null) {
        const url = `https://eu-api.knack.com/v1/objects/${objectKey}/records`;
        const headers = {
            'X-Knack-Application-Id': this.config.knackAppId,
            'X-Knack-REST-API-Key': this.config.knackApiKey,
            'Content-Type': 'application/json'
        };

        let params = new URLSearchParams();
        if (filters) params.append('filters', JSON.stringify(filters));
        if (sort) {
            params.append('sort_field', sort.field);
            params.append('sort_order', sort.order || 'asc');
        }
        params.append('rows_per_page', '1000');

        const queryString = params.toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;

        try {
            const response = await fetch(fullUrl, { headers });
            if (!response.ok) throw new Error(`Knack API error: ${response.status}`);
            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.error('[Curriculum API] Fetch error:', error);
            throw error;
        }
    }

    async getBooks() {
        if (this.isCacheValid('books')) return this.cache.books;

        try {
            const records = await this.fetchFromKnack('object_56');
            this.cache.books = records.map(record => ({
                id: record.id,
                name: record.field_1429,
                imageUrl: this.extractImageUrl(record.field_1439_raw || record.field_1439),
                imageHtml: record.field_1439
            }));
            this.cache.lastFetch.books = Date.now();
            return this.cache.books;
        } catch (error) {
            console.error('[Curriculum API] Failed to fetch books:', error);
            return [];
        }
    }

    async getActivities(bookName = null) {
        if (this.isCacheValid('activities') && !bookName) return this.cache.activities;

        try {
            let filters = null;
            if (bookName) {
                filters = {
                    match: 'and',
                    rules: [{ field: 'field_2702', operator: 'is', value: bookName }]
                };
            }

            const records = await this.fetchFromKnack('object_58', filters, {
                field: 'field_1446',
                order: 'asc'
            });

            const activities = records.map(record => ({
                id: record.id,
                book: record.field_2702,
                activityId: record.field_1446,
                theme: record.field_1461,
                name: record.field_1431,
                group: record.field_1435_raw || record.field_1435,
                dateAdded: record.field_1443,
                content: record.field_1448_raw || record.field_1448,
                isWelsh: record.field_1924 === 'Yes',
                otherLanguage: record.field_2918
            }));

            if (!bookName) {
                this.cache.activities = activities;
                this.cache.lastFetch.activities = Date.now();
            }
            return activities;
        } catch (error) {
            console.error('[Curriculum API] Failed to fetch activities:', error);
            return [];
        }
    }

    async getUserCompletions() {
        const user = this.getCurrentUser();
        if (!user) return [];

        try {
            const filters = {
                match: 'and',
                rules: [{ field: 'field_1437', operator: 'is', value: user.id }]
            };

            const records = await this.fetchFromKnack('object_59', filters, {
                field: 'field_2295',
                order: 'desc'
            });

            this.cache.completions = records.map(record => {
                let activitiesCompleted = {};
                try {
                    const rawData = record.field_1432_raw || record.field_1432;
                    if (typeof rawData === 'string') {
                        activitiesCompleted = JSON.parse(rawData);
                    } else if (typeof rawData === 'object') {
                        activitiesCompleted = rawData;
                    }
                } catch (e) {
                    console.warn('[Curriculum API] Failed to parse completion JSON:', e);
                }

                return {
                    id: record.id,
                    completedBy: record.field_1437,
                    activitiesCompleted: activitiesCompleted,
                    notes: record.field_1449,
                    dateCompleted: record.field_2295_raw?.iso_timestamp || record.field_2295
                };
            });

            this.cache.lastFetch.completions = Date.now();
            return this.cache.completions;
        } catch (error) {
            console.error('[Curriculum API] Failed to fetch completions:', error);
            return [];
        }
    }

    async getActivityDiscussions(activityId) {
        try {
            const filters = {
                match: 'and',
                rules: [{ field: 'field_1444', operator: 'is', value: activityId }]
            };

            const records = await this.fetchFromKnack('object_60', filters, {
                field: 'field_1447',
                order: 'desc'
            });

            return records.map(record => ({
                id: record.id,
                activityId: record.field_1444,
                tutorId: record.field_1445,
                tutorName: record.field_1445_raw?.[0]?.identifier || 'Unknown',
                comment: record.field_1433,
                date: record.field_1447_raw?.date_formatted || record.field_1447
            }));
        } catch (error) {
            console.error('[Curriculum API] Failed to fetch discussions:', error);
            return [];
        }
    }

    async completeActivity(activityId, activityBook) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('User not logged in');

        try {
            const existingCompletions = await this.getUserCompletions();
            let activitiesJson = {};
            
            if (existingCompletions.length > 0) {
                activitiesJson = existingCompletions[0].activitiesCompleted || {};
            }

            if (!activitiesJson[activityBook]) activitiesJson[activityBook] = [];
            if (!activitiesJson[activityBook].includes(activityId)) {
                activitiesJson[activityBook].push(activityId);
            }

            const recordData = {
                field_1437: [user.id],
                field_1432: JSON.stringify(activitiesJson),
                field_1449: user.name,
                field_2295: new Date().toISOString()
            };

            let response;
            if (existingCompletions.length > 0) {
                response = await this.updateKnackRecord('object_59', existingCompletions[0].id, recordData);
            } else {
                response = await this.createKnackRecord('object_59', recordData);
            }

            this.cache.completions = null;
            this.cache.lastFetch.completions = null;
            return response;
        } catch (error) {
            console.error('[Curriculum API] Failed to mark activity complete:', error);
            throw error;
        }
    }

    async addDiscussion(activityId, comment) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('User not logged in');

        try {
            const recordData = {
                field_1444: [activityId],
                field_1445: [user.id],
                field_1433: comment,
                field_1447: new Date().toISOString()
            };

            return await this.createKnackRecord('object_60', recordData);
        } catch (error) {
            console.error('[Curriculum API] Failed to add discussion:', error);
            throw error;
        }
    }

    async createKnackRecord(objectKey, data) {
        const url = `https://eu-api.knack.com/v1/objects/${objectKey}/records`;
        const headers = {
            'X-Knack-Application-Id': this.config.knackAppId,
            'X-Knack-REST-API-Key': this.config.knackApiKey,
            'Content-Type': 'application/json'
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error(`Knack API error: ${response.status}`);
        return await response.json();
    }

    async updateKnackRecord(objectKey, recordId, data) {
        const url = `https://eu-api.knack.com/v1/objects/${objectKey}/records/${recordId}`;
        const headers = {
            'X-Knack-Application-Id': this.config.knackAppId,
            'X-Knack-REST-API-Key': this.config.knackApiKey,
            'Content-Type': 'application/json'
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error(`Knack API error: ${response.status}`);
        return await response.json();
    }

    extractImageUrl(htmlOrRaw) {
        if (!htmlOrRaw) return '';
        if (typeof htmlOrRaw === 'string' && htmlOrRaw.startsWith('http')) return htmlOrRaw;
        if (typeof htmlOrRaw === 'string' && htmlOrRaw.includes('<img')) {
            const match = htmlOrRaw.match(/src="([^"]+)"/);
            return match ? match[1] : '';
        }
        if (htmlOrRaw && htmlOrRaw.url) return htmlOrRaw.url;
        return '';
    }

    async calculateProgress(bookName = null) {
        try {
            const [activities, completions] = await Promise.all([
                this.getActivities(bookName),
                this.getUserCompletions()
            ]);

            if (completions.length === 0) {
                return { total: activities.length, completed: 0, percentage: 0, completedIds: [] };
            }

            const completedActivities = completions[0].activitiesCompleted || {};
            let completedIds = bookName ? (completedActivities[bookName] || []) : Object.values(completedActivities).flat();

            return {
                total: activities.length,
                completed: completedIds.length,
                percentage: Math.round((completedIds.length / activities.length) * 100),
                completedIds: completedIds
            };
        } catch (error) {
            console.error('[Curriculum API] Failed to calculate progress:', error);
            return { total: 0, completed: 0, percentage: 0, completedIds: [] };
        }
    }
}

window.CurriculumAPI = CurriculumAPI;
console.log('[Curriculum] API loaded');

// ===== SHARED UTILITIES =====
window.CurriculumShared = {
    themeColors: {
        Vision: '#FFA500', Effort: '#a4c2f4', Systems: '#aad950',
        Practice: '#a986ff', Attitude: '#ff769c',
        VISION: '#FFA500', EFFORT: '#a4c2f4', SYSTEMS: '#aad950',
        PRACTICE: '#a986ff', ATTITUDE: '#ff769c'
    },

    getThemeColor(theme) {
        if (!theme) return '#079baa';
        const normalized = theme.trim();
        return this.themeColors[normalized] || this.themeColors[normalized.toUpperCase()] || '#079baa';
    },

    extractIframe(htmlContent) {
        if (!htmlContent) return null;
        if (htmlContent.trim().startsWith('<iframe')) return htmlContent;
        const match = htmlContent.match(/<iframe[^>]*>[\s\S]*?<\/iframe>/i);
        return match ? match[0] : null;
    },

    extractPdfLink(htmlContent) {
        if (!htmlContent) return null;
        const match = htmlContent.match(/href="([^"]*\.pdf[^"]*)"/i);
        return match ? match[1] : null;
    },

    getCurrentActivityId() {
        const hash = window.location.hash;
        const match = hash.match(/view-tutor-activity-level-details\/([^/]+)/);
        return match ? match[1] : sessionStorage.getItem('currentActivityId');
    },

    sortMonths(months) {
        const order = ['September', 'October', 'November', 'December',
                      'January', 'Febuary', 'February', 'March', 'April', 'May', 'June', 'July'];
        return months.sort((a, b) => {
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }
};

console.log('[Curriculum] Shared utilities loaded');

// ===== PAGE 1: BOOK SELECTION =====
(function() {
    const DEBUG = window.CURRICULUM_RESOURCES_CONFIG.debugMode;
    const log = (msg, data) => {
        if (DEBUG) console.log(`[Page 1] ${msg}`, data || '');
    };
    
    const CONFIG = window.CURRICULUM_RESOURCES_CONFIG;
    let api = null;
    
    function initAPI() {
        if (!api) api = new CurriculumAPI(CONFIG);
        return api;
    }
    
    async function createBookSelectionUI() {
        log('Creating book selection UI');
        
        const viewContainer = document.querySelector(`#${CONFIG.viewKey}`);
        if (!viewContainer) {
            console.error('[Page 1] View container not found');
            return;
        }
        
        let mainContainer = document.getElementById('curriculum-books-container');
        if (!mainContainer) {
            mainContainer = document.createElement('div');
            mainContainer.id = 'curriculum-books-container';
            viewContainer.appendChild(mainContainer);
        }
        
        mainContainer.innerHTML = `
            <div class="curriculum-loading">
                <div class="loading-spinner"></div>
                <p>Loading curriculum books...</p>
            </div>
        `;
        
        try {
            const curriculumAPI = initAPI();
            const books = await curriculumAPI.getBooks();
            log('Books fetched:', books);
            
            if (books.length === 0) {
                mainContainer.innerHTML = `<div class="curriculum-error"><h3>No books found</h3></div>`;
                return;
            }
            
            const progressPromises = books.map(book => curriculumAPI.calculateProgress(book.name));
            const progressData = await Promise.all(progressPromises);
            
            mainContainer.innerHTML = `
                <div class="curriculum-page-header">
                    <h1>Choose Your Curriculum</h1>
                    <p>Select a book to explore activities and resources</p>
                </div>
                <div id="curriculum-books-grid"></div>
            `;
            
            const grid = mainContainer.querySelector('#curriculum-books-grid');
            
            books.forEach((book, index) => {
                const progress = progressData[index] || { percentage: 0, completed: 0, total: 0 };
                
                const bookCard = document.createElement('div');
                bookCard.className = 'book-card';
                bookCard.innerHTML = `
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
                    <button class="btn-start">Explore Activities</button>
                `;
                
                bookCard.addEventListener('click', () => {
                    log('Book selected:', book.name);
                    sessionStorage.setItem('currentBook', book.name);
                    alert(`Book selected: ${book.name}\n\nNOTE: Activity browser (Page 2) needs to be built in a separate scene.\n\nFor now, this demonstrates the book selection works!`);
                    // TODO: Navigate to activity browser scene when ready
                    // window.location.hash = '#tutor-activities/tutor-activity-level/';
                });
                
                grid.appendChild(bookCard);
            });
            
            log('Book selection UI created successfully');
            
        } catch (error) {
            console.error('[Page 1] Error:', error);
            mainContainer.innerHTML = `
                <div class="curriculum-error">
                    <h3>Failed to load books</h3>
                    <p>${error.message}</p>
                    <button class="btn-retry" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }
    
    function init() {
        log('Initializing');
        setTimeout(createBookSelectionUI, 300);
    }
    
    $(document).on('knack-scene-render.1280', init);
    $(document).on('knack-view-render.3244', init);
    
    if (window.location.hash.includes('tutor-activities') || window.location.hash.includes('1280')) {
        setTimeout(init, 500);
    }
    
    console.log('[Curriculum] Page 1 loaded');
})();

// Initialize
console.log('[Curriculum Resources] All components loaded - Ready!');

