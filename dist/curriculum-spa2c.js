/**
 * VESPA Curriculum SPA v2c - FIXES: Search input, problem matching, academic sort
 */

console.log('[Curriculum SPA v2c] Loading...');

// ===== API CLASS =====
class CurriculumAPI {
    constructor(config) {
        this.config = config;
        this.allActivitiesCache = null; // For cross-book problem search
    }
    
    // NEW: Get ALL activities (all books) for problem search
    async getAllActivities() {
        if (this.allActivitiesCache) return this.allActivitiesCache;
        
        const filters = {
            match: 'and',
            rules: [{ field: 'field_1924', operator: 'is', value: 'No' }] // Only non-Welsh
        };
        
        const records = await this.fetch('object_58', filters);
        console.log('[API] Fetched', records.length, 'total activities (all books)');
        
        this.allActivitiesCache = records.map(r => ({
            id: r.id, book: r.field_2702, activityId: r.field_1446,
            theme: r.field_1461 || 'General', name: r.field_1431,
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
    },
    // FUZZY MATCH for problem search
    fuzzyMatch(activityName, searchTerms) {
        const name = activityName.toLowerCase();
        // Try each search term
        for (const term of searchTerms) {
            const t = term.toLowerCase();
            // Exact match
            if (name.includes(t)) return true;
            // Partial word match
            const words = t.split(' ');
            if (words.every(w => name.includes(w))) return true;
            // Number match (for activities like "20 Questions", "25min", etc.)
            const numbers = t.match(/\d+/g);
            if (numbers && numbers.some(n => name.includes(n))) {
                const baseWords = t.replace(/\d+/g, '').trim().split(' ');
                if (baseWords.some(w => w && name.includes(w.toLowerCase()))) return true;
            }
        }
        return false;
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

console.log('[Curriculum SPA v2c] Core loaded');

