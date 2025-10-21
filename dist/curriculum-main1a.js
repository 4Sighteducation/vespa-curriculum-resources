/**
 * VESPA Curriculum Resources - Combined Distribution File
 * Version 1.0.0
 * 
 * Complete replacement for KSENSE curriculum system
 * Includes: API, Shared utilities, and all 3 page components
 */

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
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
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
        if (filters) {
            params.append('filters', JSON.stringify(filters));
        }
        if (sort) {
            params.append('sort_field', sort.field);
            params.append('sort_order', sort.order || 'asc');
        }
        params.append('rows_per_page', '1000');

        const queryString = params.toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;

        try {
            const response = await fetch(fullUrl, { headers });
            if (!response.ok) {
                throw new Error(`Knack API error: ${response.status}`);
            }
            const data = await response.json();
            return data.records || [];
        } catch (error) {
            console.error('[Curriculum API] Fetch error:', error);
            throw error;
        }
    }

    async getBooks() {
        if (this.isCacheValid('books')) {
            console.log('[Curriculum API] Returning cached books:', this.cache.books);
            return this.cache.books;
        }

        try {
            console.log('[Curriculum API] Fetching books from object_56...');
            const records = await this.fetchFromKnack('object_56');
            console.log('[Curriculum API] Raw book records:', records);
            console.log('[Curriculum API] Number of book records:', records.length);
            
            if (records.length > 0) {
                console.log('[Curriculum API] Sample book record:', records[0]);
                console.log('[Curriculum API] Available fields:', Object.keys(records[0]));
            }
            
            this.cache.books = records.map(record => {
                const book = {
                    id: record.id,
                    name: record.field_1429,
                    imageUrl: this.extractImageUrl(record.field_1439_raw || record.field_1439),
                    imageHtml: record.field_1439
                };
                console.log('[Curriculum API] Mapped book:', book);
                return book;
            });
            
            this.cache.lastFetch.books = Date.now();
            console.log('[Curriculum API] Books cached successfully:', this.cache.books);
            return this.cache.books;
        } catch (error) {
            console.error('[Curriculum API] Failed to fetch books:', error);
            console.error('[Curriculum API] Error details:', {
                message: error.message,
                stack: error.stack
            });
            return [];
        }
    }

    async getActivityGroups(bookName = null) {
        if (this.isCacheValid('groups') && !bookName) {
            return this.cache.groups;
        }

        try {
            let filters = null;
            if (bookName) {
                filters = {
                    match: 'and',
                    rules: [{
                        field: 'field_1434',
                        operator: 'contains',
                        value: bookName
                    }]
                };
            }

            const records = await this.fetchFromKnack('object_57', filters, {
                field: 'field_1440',
                order: 'asc'
            });

            const groups = records.map(record => ({
                id: record.id,
                month: record.field_1430,
                bookName: record.field_1434_raw?.[0]?.identifier || record.field_1434,
                summary: record.field_1436,
                dateAdded: record.field_1440,
                monthLevel: record.field_2916
            }));

            if (!bookName) {
                this.cache.groups = groups;
                this.cache.lastFetch.groups = Date.now();
            }

            return groups;
        } catch (error) {
            console.error('[Curriculum API] Failed to fetch groups:', error);
            return [];
        }
    }

    async getActivities(bookName = null, groupName = null) {
        if (this.isCacheValid('activities') && !bookName && !groupName) {
            return this.cache.activities;
        }

        try {
            let filters = null;
            
            if (bookName || groupName) {
                const rules = [];
                if (bookName) {
                    rules.push({
                        field: 'field_2702',
                        operator: 'is',
                        value: bookName
                    });
                }
                if (groupName) {
                    rules.push({
                        field: 'field_1435',
                        operator: 'contains',
                        value: groupName
                    });
                }
                filters = {
                    match: 'and',
                    rules: rules
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

            if (!bookName && !groupName) {
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
                rules: [{
                    field: 'field_1437',
                    operator: 'is',
                    value: user.id
                }]
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
                rules: [{
                    field: 'field_1444',
                    operator: 'is',
                    value: activityId
                }]
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
        if (!user) {
            throw new Error('User not logged in');
        }

        try {
            const existingCompletions = await this.getUserCompletions();
            
            let activitiesJson = {};
            if (existingCompletions.length > 0) {
                activitiesJson = existingCompletions[0].activitiesCompleted || {};
            }

            if (!activitiesJson[activityBook]) {
                activitiesJson[activityBook] = [];
            }
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
        if (!user) {
            throw new Error('User not logged in');
        }

        try {
            const recordData = {
                field_1444: [activityId],
                field_1445: [user.id],
                field_1433: comment,
                field_1447: new Date().toISOString()
            };

            const response = await this.createKnackRecord('object_60', recordData);
            return response;
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

        if (!response.ok) {
            throw new Error(`Knack API error: ${response.status}`);
        }

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

        if (!response.ok) {
            throw new Error(`Knack API error: ${response.status}`);
        }

        return await response.json();
    }

    extractImageUrl(htmlOrRaw) {
        if (!htmlOrRaw) return '';
        
        if (typeof htmlOrRaw === 'string' && htmlOrRaw.startsWith('http')) {
            return htmlOrRaw;
        }
        
        if (typeof htmlOrRaw === 'string' && htmlOrRaw.includes('<img')) {
            const match = htmlOrRaw.match(/src="([^"]+)"/);
            return match ? match[1] : '';
        }
        
        if (htmlOrRaw && htmlOrRaw.url) {
            return htmlOrRaw.url;
        }
        
        return '';
    }

    async calculateProgress(bookName = null) {
        try {
            const [activities, completions] = await Promise.all([
                this.getActivities(bookName),
                this.getUserCompletions()
            ]);

            if (completions.length === 0) {
                return {
                    total: activities.length,
                    completed: 0,
                    percentage: 0,
                    completedIds: []
                };
            }

            const completedActivities = completions[0].activitiesCompleted || {};
            let completedIds = [];
            
            if (bookName) {
                completedIds = completedActivities[bookName] || [];
            } else {
                completedIds = Object.values(completedActivities).flat();
            }

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

    clearCache() {
        this.cache = {
            books: null,
            groups: null,
            activities: null,
            completions: null,
            discussions: null,
            lastFetch: {}
        };
    }
}

window.CurriculumAPI = CurriculumAPI;

// ===== SHARED UTILITIES =====
const CurriculumShared = {
    themeColors: {
        Vision: '#FFA500',
        Effort: '#a4c2f4',
        Systems: '#aad950',
        Practice: '#a986ff',
        Attitude: '#ff769c',
        VISION: '#FFA500',
        EFFORT: '#a4c2f4',
        SYSTEMS: '#aad950',
        PRACTICE: '#a986ff',
        ATTITUDE: '#ff769c'
    },

    getThemeColor(theme) {
        if (!theme) return '#079baa';
        const normalizedTheme = theme.trim();
        return this.themeColors[normalizedTheme] || this.themeColors[normalizedTheme.toUpperCase()] || '#079baa';
    },

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    },

    extractIframe(htmlContent) {
        if (!htmlContent) return null;
        
        if (htmlContent.trim().startsWith('<iframe')) {
            return htmlContent;
        }
        
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
        const order = [
            'September', 'October', 'November', 'December',
            'January', 'Febuary', 'February',
            'March', 'April', 'May', 'June', 'July'
        ];
        
        return months.sort((a, b) => {
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            
            return indexA - indexB;
        });
    }
};

window.CurriculumShared = CurriculumShared;

// ===== PAGE 1: BOOK SELECTION ENHANCER =====
(function() {
    'use strict';
    
    const DEBUG = false;
    const log = (msg, data) => {
        if (DEBUG) console.log(`[Page 1 Enhancer] ${msg}`, data || '');
    };
    
    const CONFIG = window.CURRICULUM_RESOURCES_CONFIG || {};
    const SCENE_ID = CONFIG.sceneKey || 'scene_1280';
    const VIEW_ID = CONFIG.viewKey || 'view_3244';
    
    let api = null;
    
    function initAPI() {
        if (!window.CurriculumAPI) {
            console.error('[Page 1] CurriculumAPI not loaded');
            return null;
        }
        
        if (!api) {
            api = new window.CurriculumAPI({
                knackAppId: CONFIG.knackAppId,
                knackApiKey: CONFIG.knackApiKey
            });
        }
        
        return api;
    }
    
    async function createBookSelectionUI() {
        log('Creating book selection UI');
        
        const viewContainer = document.querySelector(`#${VIEW_ID}`);
        if (!viewContainer) {
            console.error('[Page 1] View container not found:', VIEW_ID);
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
            if (!curriculumAPI) {
                throw new Error('Failed to initialize API');
            }
            
            const books = await curriculumAPI.getBooks();
            log('Books fetched', books);
            
            if (books.length === 0) {
                mainContainer.innerHTML = `
                    <div class="curriculum-error">
                        <h3>No books found</h3>
                        <p>Please contact support if this issue persists.</p>
                    </div>
                `;
                return;
            }
            
            const progressPromises = books.map(book => 
                curriculumAPI.calculateProgress(book.name)
            );
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
                bookCard.setAttribute('data-book-name', book.name);
                
                bookCard.innerHTML = `
                    <img src="${book.imageUrl}" alt="${book.name}">
                    <h2>${book.name}</h2>
                    <div class="book-progress">
                        <div class="progress-percentage">${progress.percentage}%</div>
                        <div class="progress-label">Complete</div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${progress.percentage}%"></div>
                        </div>
                        <div class="progress-stats">
                            ${progress.completed} of ${progress.total} activities
                        </div>
                    </div>
                    <button class="btn-start">Explore Activities</button>
                `;
                
                bookCard.addEventListener('click', () => {
                    log('Book selected:', book.name);
                    sessionStorage.setItem('currentBook', book.name);
                    window.location.hash = '#tutor-activities/tutor-activity-level/';
                });
                
                grid.appendChild(bookCard);
            });
            
            log('Book selection UI created');
            
        } catch (error) {
            console.error('[Page 1] Error creating UI:', error);
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
        log('Initializing Page 1');
        setTimeout(() => {
            createBookSelectionUI();
        }, 300);
    }
    
    // MULTIPLE TRIGGER POINTS to ensure it loads
    $(document).on(`knack-scene-render.${SCENE_ID.replace('scene_', '')}`, function() {
        log('Scene render event triggered');
        init();
    });
    
    $(document).on(`knack-view-render.${VIEW_ID.replace('view_', '')}`, function() {
        log('View render event triggered');
        init();
    });
    
    // Also trigger on general header init completion
    $(document).on('general-header-ready', function() {
        log('General header ready event triggered');
        setTimeout(init, 200);
    });
    
    // Immediate check if we're already on the scene
    if (window.location.hash.includes('tutor-activities') || 
        window.location.hash.includes(SCENE_ID.replace('scene_', ''))) {
        log('Already on scene, triggering init immediately');
        setTimeout(init, 800); // Increased delay to let GeneralHeader finish
    }
    
    log('Page 1 Enhancer loaded with multiple triggers');
})();

// ===== INITIALIZE CURRICULUM RESOURCES =====
window.initializeCurriculumResources = function() {
    console.log('[Curriculum Resources] Initializing...');
    
    const config = window.CURRICULUM_RESOURCES_CONFIG;
    if (!config) {
        console.error('[Curriculum Resources] No config found');
        return;
    }
    
    console.log('[Curriculum Resources] Config loaded:', config);
    console.log('[Curriculum Resources] Ready for use on scene:', config.sceneKey);
    
    // TRIGGER PAGE 1 - Wait for GeneralHeader to finish first
    console.log('[Curriculum Resources] Waiting for GeneralHeader to complete...');
    
    // Function to check if GeneralHeader is done
    function waitForHeaderThenInit() {
        const header = document.getElementById('vespaGeneralHeader');
        
        if (header) {
            console.log('[Curriculum Resources] GeneralHeader found, waiting a bit more for stability');
            // Header exists, wait a moment for it to fully settle
            setTimeout(() => {
                console.log('[Curriculum Resources] Triggering Page 1 initialization...');
                $(document).trigger(`knack-scene-render.${config.sceneKey.replace('scene_', '')}`, { key: config.sceneKey });
            }, 500);
        } else {
            // Header not yet ready, check again
            console.log('[Curriculum Resources] GeneralHeader not ready yet, checking again...');
            setTimeout(waitForHeaderThenInit, 200);
        }
    }
    
    // Start the wait sequence
    setTimeout(waitForHeaderThenInit, 300);
};

