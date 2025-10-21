/**
 * VESPA Curriculum Resources - Knack API Integration
 * Handles all data fetching and caching for curriculum resources
 */

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

    /**
     * Get current logged-in user info
     */
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

    /**
     * Check if cache is still valid
     */
    isCacheValid(key) {
        if (!this.cache[key]) return false;
        if (!this.cache.lastFetch[key]) return false;
        
        const age = Date.now() - this.cache.lastFetch[key];
        return age < this.cacheExpiry;
    }

    /**
     * Fetch data from Knack API
     */
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
        params.append('rows_per_page', '1000'); // Get all records

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

    /**
     * Get all books (Object_56)
     */
    async getBooks() {
        if (this.isCacheValid('books')) {
            return this.cache.books;
        }

        try {
            const records = await this.fetchFromKnack('object_56');
            this.cache.books = records.map(record => ({
                id: record.id,
                name: record.field_1429, // Activity Level Name
                imageUrl: this.extractImageUrl(record.field_1439_raw || record.field_1439), // Extract from HTML
                imageHtml: record.field_1439
            }));
            this.cache.lastFetch.books = Date.now();
            return this.cache.books;
        } catch (error) {
            console.error('[Curriculum API] Failed to fetch books:', error);
            return [];
        }
    }

    /**
     * Get activity groups (Object_57) - Monthly curriculum
     */
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
                        field: 'field_1434', // Activity Level connection
                        operator: 'contains',
                        value: bookName
                    }]
                };
            }

            const records = await this.fetchFromKnack('object_57', filters, {
                field: 'field_1440', // Date Added
                order: 'asc'
            });

            const groups = records.map(record => ({
                id: record.id,
                month: record.field_1430, // Group Name (month)
                bookName: record.field_1434_raw?.[0]?.identifier || record.field_1434, // Activity Level
                summary: record.field_1436, // Activity Group Summary
                dateAdded: record.field_1440,
                monthLevel: record.field_2916 // Month - Level (text)
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

    /**
     * Get all activities (Object_58)
     */
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
                        field: 'field_2702', // Book
                        operator: 'is',
                        value: bookName
                    });
                }
                if (groupName) {
                    rules.push({
                        field: 'field_1435', // Tutor Activities Group connection
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
                field: 'field_1446', // Activity ID
                order: 'asc'
            });

            const activities = records.map(record => ({
                id: record.id,
                book: record.field_2702, // Book
                activityId: record.field_1446, // Activity ID
                theme: record.field_1461, // VESPA Theme
                name: record.field_1431, // Activity Name
                group: record.field_1435_raw || record.field_1435, // Tutor Activities Group
                dateAdded: record.field_1443,
                content: record.field_1448_raw || record.field_1448, // Activity Content (HTML/iframe)
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

    /**
     * Get user's completed activities (Object_59)
     */
    async getUserCompletions() {
        const user = this.getCurrentUser();
        if (!user) return [];

        try {
            const filters = {
                match: 'and',
                rules: [{
                    field: 'field_1437', // Completed By
                    operator: 'is',
                    value: user.id
                }]
            };

            const records = await this.fetchFromKnack('object_59', filters, {
                field: 'field_2295', // Date
                order: 'desc'
            });

            this.cache.completions = records.map(record => {
                // Parse the JSON from field_1432
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
                    activitiesCompleted: activitiesCompleted, // { "BookName": ["activityId1", "activityId2"] }
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

    /**
     * Get discussions for an activity (Object_60)
     */
    async getActivityDiscussions(activityId) {
        try {
            const filters = {
                match: 'and',
                rules: [{
                    field: 'field_1444', // Tutor Activity Connection
                    operator: 'is',
                    value: activityId
                }]
            };

            const records = await this.fetchFromKnack('object_60', filters, {
                field: 'field_1447', // Date
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

    /**
     * Mark activity as complete
     */
    async completeActivity(activityId, activityBook) {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not logged in');
        }

        try {
            // Get existing completions for this user
            const existingCompletions = await this.getUserCompletions();
            
            // Merge with new completion
            let activitiesJson = {};
            if (existingCompletions.length > 0) {
                activitiesJson = existingCompletions[0].activitiesCompleted || {};
            }

            // Add new activity to the book's array
            if (!activitiesJson[activityBook]) {
                activitiesJson[activityBook] = [];
            }
            if (!activitiesJson[activityBook].includes(activityId)) {
                activitiesJson[activityBook].push(activityId);
            }

            // Create/update record in Object_59
            const recordData = {
                field_1437: [user.id], // Completed By (connection)
                field_1432: JSON.stringify(activitiesJson), // Activities JSON
                field_1449: user.name, // Tutor name
                field_2295: new Date().toISOString() // Date completed
            };

            let response;
            if (existingCompletions.length > 0) {
                // Update existing record
                response = await this.updateKnackRecord('object_59', existingCompletions[0].id, recordData);
            } else {
                // Create new record
                response = await this.createKnackRecord('object_59', recordData);
            }

            // Invalidate cache
            this.cache.completions = null;
            this.cache.lastFetch.completions = null;

            return response;
        } catch (error) {
            console.error('[Curriculum API] Failed to mark activity complete:', error);
            throw error;
        }
    }

    /**
     * Add a discussion comment
     */
    async addDiscussion(activityId, comment) {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User not logged in');
        }

        try {
            const recordData = {
                field_1444: [activityId], // Tutor Activity Connection
                field_1445: [user.id], // Tutor Connection
                field_1433: comment, // Comment
                field_1447: new Date().toISOString() // Date
            };

            const response = await this.createKnackRecord('object_60', recordData);
            return response;
        } catch (error) {
            console.error('[Curriculum API] Failed to add discussion:', error);
            throw error;
        }
    }

    /**
     * Create a record in Knack
     */
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

    /**
     * Update a record in Knack
     */
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

    /**
     * Extract image URL from Knack HTML
     */
    extractImageUrl(htmlOrRaw) {
        if (!htmlOrRaw) return '';
        
        // If it's already a URL
        if (typeof htmlOrRaw === 'string' && htmlOrRaw.startsWith('http')) {
            return htmlOrRaw;
        }
        
        // If it's HTML with img tag
        if (typeof htmlOrRaw === 'string' && htmlOrRaw.includes('<img')) {
            const match = htmlOrRaw.match(/src="([^"]+)"/);
            return match ? match[1] : '';
        }
        
        // If it's a Knack raw object
        if (htmlOrRaw && htmlOrRaw.url) {
            return htmlOrRaw.url;
        }
        
        return '';
    }

    /**
     * Calculate progress statistics
     */
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

            // Get completed activity IDs for this book
            const completedActivities = completions[0].activitiesCompleted || {};
            let completedIds = [];
            
            if (bookName) {
                completedIds = completedActivities[bookName] || [];
            } else {
                // All books
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

    /**
     * Clear all caches
     */
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

// Export for use in other modules
window.CurriculumAPI = CurriculumAPI;

