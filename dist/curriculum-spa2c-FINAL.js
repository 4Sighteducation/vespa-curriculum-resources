/**
 * VESPA Curriculum SPA v2c FINAL - With EXACT problem matching using record IDs
 * Uses your improved JSON mappings for precise problem-based search
 */

console.log('[Curriculum SPA v2c FINAL] Loading with problem-based search...');

// ===== PROBLEM MAPPINGS (Using tutor_record_ids for exact matching) =====
const PROBLEM_MAPPINGS = {
  "svision_1": { text: "Student is unsure about future goals", theme: "Vision", ids: ["607f34fe3b9a8f001d79f9b6","607767a0d66606001b48d065","6077674ef1b3ad001b5309f9","607f3b19e913fa001c6aca83"] },
  "svision_2": { text: "Student not feeling motivated", theme: "Vision", ids: ["607766eed66606001b48d001","607aded8f8ed44001c7b37f1","60776765a41503001b5a558e","607ae37c067d36001b5fca2d"] },
  "svision_3": { text: "Student can't see how school connects to future", theme: "Vision", ids: ["607adccdb9af42001b0d5885","607f3f8f2e418a0021b82a33","607f2e2f2b0bda001ccd23a6","607f3b563b9a8f001d79fea3"] },
  "svision_4": { text: "Student doesn't know what success looks like", theme: "Vision", ids: ["607f3b19e913fa001c6aca83","607f39df2e418a0021b825ba","607f2e4e0f0db5001c462847","6077674ef1b3ad001b5309f9"] },
  "svision_5": { text: "Student hasn't thought about achievements this year", theme: "Vision", ids: ["607f3b563b9a8f001d79fea3","607767a0d66606001b48d065","607f3e1b34c775001bf719b0","607f34fe3b9a8f001d79f9b6"] },
  "svision_6": { text: "Student finds it hard to picture doing well", theme: "Vision", ids: ["607f3d0f34c775001bf7184a","607f3b19e913fa001c6aca83","607f3a0f99ff4b001b9b33c8","607f37edc95d72001ecc1667"] },
  "svision_7": { text: "Student rarely thinks about where heading", theme: "Vision", ids: ["6077674ef1b3ad001b5309f9","607aded8f8ed44001c7b37f1","607f2e922b0bda001ccd240a","607f2e2f2b0bda001ccd23a6"] },
  
  "seffort_1": { text: "Student struggles to complete homework on time", theme: "Effort", ids: ["607767d4a41503001b5a55cb","607ae12bb9af42001b0d5c9c","607ae4b9585f77001bc1b468","607ae480f8ed44001c7b3cc5"] },
  "seffort_2": { text: "Student finds it hard to keep trying when difficult", theme: "Effort", ids: ["607ae195067d36001b5fc89b","607ae0cc76f731001b3b2d90","607ada68585f77001bc1aa47","607f31810f0db5001c462b24"] },
  "seffort_3": { text: "Student gives up if doesn't get things right", theme: "Effort", ids: ["607f3bce508623001e2f50a3","60776785f1b3ad001b530a15","607f3f48e913fa001c6acde1","607f3a42e913fa001c6ac9ed"] },
  "seffort_4": { text: "Student does bare minimum to get by", theme: "Effort", ids: ["607ae0cc76f731001b3b2d90","60776765a41503001b5a558e","607f3d230f0db5001c463714","607adfb477a5c5001bd41a42"] },
  "seffort_5": { text: "Student gets distracted easily", theme: "Effort", ids: ["607ae44bb9af42001b0d5f19","607ada05585f77001bc1a9e1","607ae5e876f731001b3b31de","607acfdb841fde001b9dfffc"] },
  "seffort_6": { text: "Student avoids topics that feel too hard", theme: "Effort", ids: ["607ae195067d36001b5fc89b","607ada68585f77001bc1aa47","607f3f48e913fa001c6acde1","607f3d563b9a8f001d7a0032"] },
  "seffort_7": { text: "Student puts things off until under pressure", theme: "Effort", ids: ["607f39f9e913fa001c6ac9b6","607f35fc0f0db5001c463087","607ae480f8ed44001c7b3cc5","607ae12bb9af42001b0d5c9c"] },
  
  "ssystems_1": { text: "Student not organized with notes and deadlines", theme: "Systems", ids: ["607767d4a41503001b5a55cb","607ae4b9585f77001bc1b468","607f3baa3b9a8f001d79fedf","607f3d6c0f0db5001c46374f"] },
  "ssystems_2": { text: "Student doesn't have a good revision plan", theme: "Systems", ids: ["607f3f31c95d72001ecc1c3f","607f31b32e418a0021b81dff","607adbce76f731001b3b2805","607ae31e76f731001b3b2f82","607f3a2999ff4b001b9b33e1"] },
  "ssystems_3": { text: "Student keeps forgetting homework", theme: "Systems", ids: ["607767d4a41503001b5a55cb","607767e7ef7b4f001cd281ab","607f3ef9c95d72001ecc1c15","607ae0f6585f77001bc1b122"] },
  "ssystems_4": { text: "Student leaves everything to last minute", theme: "Systems", ids: ["607f3f1a99ff4b001b9b37e1","607ae4b9585f77001bc1b468","607f3d563b9a8f001d7a0032","607f39f9e913fa001c6ac9b6"] },
  "ssystems_5": { text: "Student doesn't use planner or calendar", theme: "Systems", ids: ["607767d4a41503001b5a55cb","607f3ef9c95d72001ecc1c15","607f3d230f0db5001c463714","607767e7ef7b4f001cd281ab"] },
  "ssystems_6": { text: "Student's notes are all over the place", theme: "Systems", ids: ["607f3d6c0f0db5001c46374f","607f3baa3b9a8f001d79fedf","607f3bf40f0db5001c463537","607acfdb841fde001b9dfffc"] },
  "ssystems_7": { text: "Student struggles to prioritise", theme: "Systems", ids: ["607ae4b9585f77001bc1b468","607f3f1a99ff4b001b9b37e1","607f3d563b9a8f001d7a0032","607ae480f8ed44001c7b3cc5"] },
  
  "spractice_1": { text: "Student doesn't review work regularly", theme: "Practice", ids: ["607ae352585f77001bc1b318","607ae31e76f731001b3b2f82","607f3f31c95d72001ecc1c3f","607f3a2999ff4b001b9b33e1"] },
  "spractice_2": { text: "Student tends to cram before tests", theme: "Practice", ids: ["607f31b32e418a0021b81dff","607adbce76f731001b3b2805","607ae31e76f731001b3b2f82","607f37bf0f0db5001c4631ed","607f3a2999ff4b001b9b33e1"] },
  "spractice_3": { text: "Student avoids practising hard topics", theme: "Practice", ids: ["607ae195067d36001b5fc89b","607f3f48e913fa001c6acde1","607ada68585f77001bc1aa47","607adfb477a5c5001bd41a42"] },
  "spractice_4": { text: "Student not sure how to revise", theme: "Practice", ids: ["607adc49067d36001b5fc2d5","607ae157067d36001b5fc860","607f31b32e418a0021b81dff","607adbce76f731001b3b2805","607ae352585f77001bc1b318"] },
  "spractice_5": { text: "Student doesn't practise exam questions enough", theme: "Practice", ids: ["607ae352585f77001bc1b318","607f3e2fe913fa001c6accf2","607f3e5c3b9a8f001d7a0106","607f3bf40f0db5001c463537"] },
  "spractice_6": { text: "Student doesn't learn from mistakes", theme: "Practice", ids: ["607f3bce508623001e2f50a3","607f3a42e913fa001c6ac9ed","607f3bf40f0db5001c463537","607ae2dd585f77001bc1b2c1"] },
  "spractice_7": { text: "Student rarely checks understanding", theme: "Practice", ids: ["607ae352585f77001bc1b318","607ad9ad067d36001b5fc030","607ae157067d36001b5fc860","607adc49067d36001b5fc2d5"] },
  
  "sattitude_1": { text: "Student worries not smart enough", theme: "Attitude", ids: ["60776785f1b3ad001b530a15","607adf83f8ed44001c7b3887","607ae00b76f731001b3b2ced","607f3e432e418a0021b82929"] },
  "sattitude_2": { text: "Student gets discouraged by setbacks", theme: "Attitude", ids: ["607f3bce508623001e2f50a3","607ae4f2b9af42001b0d5fc2","607f2ec434c775001bf70a12","607ae59a067d36001b5fcc19"] },
  "sattitude_3": { text: "Student compares to others and feels behind", theme: "Attitude", ids: ["607adf83f8ed44001c7b3887","607ada3f76f731001b3b2683","607f2f0434c775001bf70a4d","607f2e922b0bda001ccd240a"] },
  "sattitude_4": { text: "Student doesn't believe effort makes difference", theme: "Attitude", ids: ["60776785f1b3ad001b530a15","607ae0cc76f731001b3b2d90","607f37edc95d72001ecc1667","607ae195067d36001b5fc89b"] },
  "sattitude_5": { text: "Student feels overwhelmed when doesn't get something", theme: "Attitude", ids: ["607ae59a067d36001b5fcc19","607f3fa899ff4b001b9b3846","607ae00b76f731001b3b2ced","607f3d38e913fa001c6acc10"] },
  "sattitude_6": { text: "Student tells themself not good at subjects", theme: "Attitude", ids: ["60776785f1b3ad001b530a15","607f3e432e418a0021b82929","607f31810f0db5001c462b24","607f3d0f34c775001bf7184a"] },
  "sattitude_7": { text: "Student finds it hard to stay positive", theme: "Attitude", ids: ["607ada3f76f731001b3b2683","607adf83f8ed44001c7b3887","607f2f0434c775001bf70a4d","607ae4f2b9af42001b0d5fc2"] }
};

console.log('[Problem Mappings] Loaded', Object.keys(PROBLEM_MAPPINGS).length, 'problems with exact record IDs');

// ===== API CLASS (Same as before) =====
class CurriculumAPI {
    constructor(config) {
        this.config = config;
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
            rules: [{ field: 'field_2702', operator: 'is', value: bookName }]
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
    filters: { search: '', theme: 'All', month: 'All', problemFilter: null }
};

console.log('[Curriculum SPA v2c FINAL] Core loaded - Building pages...');

