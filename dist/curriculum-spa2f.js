/**
 * VESPA Curriculum SPA v2f - FIXED: Completion saving + Problem search with dynamic mapping
 *
 * IMPORTANT:
 * This bundle is sometimes injected more than once by the host loader.
 * We wrap everything in an IIFE and guard against re-execution to avoid
 * "Identifier has already been declared" errors (e.g. `const U = ...`).
 */

(function () {
    try {
        // This bundle can be injected more than once. Older builds used a boolean guard
        // which accidentally blocks new versions if an older copy ran first.
        // Version the guard off the loader version so updates always apply.
        const build = String(window.__VESPA_LOADER_VERSION || 'unknown');
        if (window.__VESPA_CURRICULUM_SPA2F_LOADED_BUILD === build) {
            return;
        }
        window.__VESPA_CURRICULUM_SPA2F_LOADED_BUILD = build;
        window.__VESPA_CURRICULUM_SPA2F_LOADED = true;
    } catch (_) {}

    console.log('[Curriculum SPA v2f] Loading...');

// ===== API CLASS =====
class CurriculumAPI {
    constructor(config) {
        this.config = config;
        this.supabase = {
            url: config.supabaseUrl || window.VESPA_SUPABASE_URL || '',
            key: config.supabaseAnonKey || window.VESPA_SUPABASE_ANON_KEY || '',
            mode: (config.supabaseMode || window.VESPA_SUPABASE_MODE || 'auto').toString()
        };
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

    hasSupabase() {
        return Boolean(this.supabase.url && this.supabase.key);
    }

    getSupabaseMode() {
        return (this.supabase.mode || 'auto').toString().toLowerCase();
    }

    shouldUseSupabase() {
        const mode = this.getSupabaseMode();
        if (mode === 'off' || mode === 'knack' || mode === 'false') {
            return false;
        }
        if (!this.hasSupabase()) {
            return false;
        }
        return true;
    }

    // --- Canonical tutor resources overrides (used when Supabase is not configured) ---
    async loadTutorCanonicalOnce() {
        if (this._tutorCanonicalLoaded) return this._tutorCanonicalLoaded;
        this._tutorCanonicalLoaded = (async () => {
            const cacheBust = (typeof window !== 'undefined' && (window.__VESPA_LOADER_VERSION || window.__VESPA_CURRICULUM_VERSION))
                ? String(window.__VESPA_LOADER_VERSION || window.__VESPA_CURRICULUM_VERSION)
                : String(Date.now());
            const url = `https://cdn.jsdelivr.net/gh/4Sighteducation/vespa-curriculum-resources@main/tutoractivities_nested_from_csv.json?v=${encodeURIComponent(cacheBust)}`;
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const json = await resp.json();
                const byActivityId = {};
                const byRecordId = {};
                (Array.isArray(json) ? json : []).forEach((item) => {
                    const aid = String(item?.activity_id || '').trim();
                    const rid = String(item?.record_id || '').trim();
                    if (aid) byActivityId[aid] = item;
                    if (rid) byRecordId[rid] = item;
                });
                this._tutorCanonical = { byActivityId, byRecordId, url };
                console.log('[Curriculum SPA] Loaded canonical tutor resources:', Object.keys(byActivityId).length, 'items');
                return true;
            } catch (e) {
                console.warn('[Curriculum SPA] Failed to load canonical tutor resources. Using Knack content as-is.', e);
                this._tutorCanonical = null;
                return false;
            }
        })();
        return this._tutorCanonicalLoaded;
    }

    normalizeId(value) {
        return String(value ?? '').replace(/[^0-9]/g, '');
    }

    applyCanonicalOverrideIfPossible(activity) {
        const canon = this._tutorCanonical;
        if (!canon) return activity;
        const aid = this.normalizeId(activity?.activityId);
        const rid = String(activity?.id || '').trim();
        const item = (aid && canon.byActivityId[aid]) ? canon.byActivityId[aid] : (rid && canon.byRecordId[rid] ? canon.byRecordId[rid] : null);
        if (!item) return activity;

        const lang = (getCurrentLanguage() === 'cy') ? 'cy' : 'en';
        const title = item?.title?.[lang] || item?.title?.en || activity?.name || '';
        const book = item?.book || activity?.book || '';
        const month = item?.month || '';
        const theme = item?.vespa_category || activity?.theme || 'General';
        const rawHtml = item?.assets_raw?.slides?.[lang] || item?.assets_raw?.slides?.en || '';
        const slideUrl = item?.assets?.slides?.[lang] || item?.assets?.slides?.en || '';
        const pdfUrl = item?.assets?.pdf?.[lang] || item?.assets?.pdf?.en || '';

        let content = rawHtml;
        if (!content && slideUrl) {
            content = `<iframe src="${slideUrl}" width="576" height="420" allowfullscreen></iframe>`;
        }
        // If content has no PDF link but we have a PDF URL, append a simple button.
        if (pdfUrl && content && !content.includes('.pdf') && !content.toLowerCase().includes('download')) {
            content += `\n<p style="text-align:center"><a href="${pdfUrl}" target="_blank" rel="noopener noreferrer"><strong>DOWNLOAD PDF</strong></a></p>`;
        }

        return {
            ...activity,
            name: title,
            book,
            theme,
            group: month && book ? `${month} - ${book}` : (activity?.group || null),
            activityId: item?.activity_id || activity?.activityId,
            content: content || activity?.content || ''
        };
    }

    async fetchFromSupabase(path, params = {}) {
        if (!this.hasSupabase()) throw new Error('Supabase config missing');
        const url = new URL(`${this.supabase.url}/rest/v1/${path}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, value);
            }
        });
        const response = await fetch(url.toString(), {
            headers: {
                apikey: this.supabase.key,
                Authorization: `Bearer ${this.supabase.key}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        return response.json();
    }

    buildSupabaseActivity(record) {
        const book = record.content?.book || record.book || '';
        const month = record.content?.month || record.month || '';
        const theme = record.content?.theme || record.vespa_category || record.theme || 'General';

        // Stable "activityId" for display/search (not necessarily a numeric ID)
        const activityId =
            record.content?.activity_code ||
            record.content?.activity_id ||
            record.knack_activity_id ||
            record.knack_id ||
            record.id;

        const buildSlidesEmbedUrl = (url) => {
            if (!url) return '';
            try {
                const u = new URL(url);
                // slides.com needs /embed for iframe embeds
                if (u.hostname.includes('slides.com')) {
                    if (u.pathname.endsWith('/fullscreen')) {
                        u.pathname = u.pathname.replace(/\/fullscreen$/, '/embed');
                    } else if (!u.pathname.endsWith('/embed')) {
                        u.pathname = `${u.pathname.replace(/\/$/, '')}/embed`;
                    }
                    // Normalize token query (sometimes gets duplicated)
                    if (u.searchParams.has('token')) {
                        const rawToken = u.searchParams.get('token') || '';
                        const cleanToken = rawToken.split('?')[0].split('&')[0];
                        u.searchParams.set('token', cleanToken);
                    }
                    return u.toString();
                }
                return url;
            } catch (_) {
                return url;
            }
        };

        const slidesEmbedHtml =
            record.content?.slides_embed_en ||
            record.content?.slides_embed ||
            '';
        const slidesUrl =
            record.content?.slides_url_en ||
            record.content?.slides_url ||
            '';
        const slidesIframe = slidesEmbedHtml
            ? slidesEmbedHtml
            : (slidesUrl
                ? `<iframe src="${buildSlidesEmbedUrl(slidesUrl)}" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`
                : '');

        const pdfEmbedHtml = record.content?.pdf_embed || '';
        const pdfDownloadHtml = record.content?.pdf_download_html || '';
        const pdfUrl =
            record.content?.pdf_url_en ||
            record.content?.pdf_url ||
            '';

        // Build a single HTML blob that includes (in order):
        // slides (if available), pdf embed/download (if available), then any legacy html
        const parts = [];
        if (slidesIframe) parts.push(slidesIframe);
        if (pdfEmbedHtml) parts.push(pdfEmbedHtml);
        if (pdfDownloadHtml) parts.push(pdfDownloadHtml);
        if (!pdfEmbedHtml && !pdfDownloadHtml && pdfUrl) {
            parts.push(
                `<p style="text-align:center"><a href="${pdfUrl}" target="_blank" rel="noopener noreferrer"><strong>DOWNLOAD PDF</strong></a></p>`
            );
        }
        if (record.think_section_html) parts.push(record.think_section_html);

        return {
            id: record.id,
            book,
            activityId,
            theme,
            name: record.name,
            group: month && book ? `${month} - ${book}` : null,
            content: parts.filter(Boolean).join('\n')
        };
    }
    
    // Get ALL activities (all books) for problem search
    async getAllActivities() {
        if (this.shouldUseSupabase()) {
            try {
                return await this.getAllActivitiesFromSupabase();
            } catch (e) {
                // If Supabase isn't accessible (e.g. anon key invalid / RLS misconfigured), fall back to Knack.
                console.warn('[Curriculum SPA] Supabase unavailable for activities; falling back to Knack.', e);
            }
        }
        if (this.allActivitiesCache) return this.allActivitiesCache;
        await this.loadTutorCanonicalOnce();
        
        const isWelsh = getCurrentLanguage() === 'cy';
        const filters = isWelsh ? null : {
            match: 'and',
            rules: [{ field: 'field_1924', operator: 'is', value: 'No' }] // Only non-Welsh
        };
        
        const records = await this.fetch('object_58', filters);
        console.log('[API] Fetched', records.length, 'total activities (all books)');
        
        const mapped = records.map(r => ({
            id: r.id, 
            book: r.field_2702, 
            activityId: r.field_1446,
            theme: r.field_1461 || 'General', 
            name: r.field_1431,
            group: r.field_1435_raw || r.field_1435,
            content: r.field_1448_raw || r.field_1448
        }));
        this.allActivitiesCache = mapped.map(a => this.applyCanonicalOverrideIfPossible(a));
        
        return this.allActivitiesCache;
    }

    async getAllActivitiesFromSupabase() {
        if (this.allActivitiesCache) return this.allActivitiesCache;
        const params = {
            // Pull enough fields to render slides + pdf resources from `content`
            select: 'id,name,vespa_category,knack_id,knack_activity_id,book,month,theme,content,think_section_html'
        };
        // Always use English/base rows; Welsh assets are applied via overrides when cy is active.
        params.or = '(content->>is_welsh.is.null,content->>is_welsh.eq.false)';
        const records = await this.fetchFromSupabase('activities', params);
        const hasTutorAssets = (r) => {
            const c = r?.content || {};
            return Boolean(
                c.slides_url_en || c.slides_embed_en || c.slides_url || c.slides_embed ||
                c.pdf_url_en || c.pdf_url || c.pdf_embed || c.pdf_download_html
            );
        };
        this.allActivitiesCache = records
            .filter((r) => {
                const rt = String(r?.content?.resource_type || '').toLowerCase();
                // Many older "activity" (slides) rows were inserted without `resource_type`.
                // Keep them if they have any usable slides/pdf assets.
                if (rt === 'worksheet' || rt === 'activity') return true;
                return hasTutorAssets(r);
            })
            .map(r => this.buildSupabaseActivity(r));
        return this.allActivitiesCache;
    }

    getCurrentUser() {
        if (typeof Knack !== 'undefined' && Knack.getUserAttributes) {
            const user = Knack.getUserAttributes();
            // IMPORTANT:
            // - `user.id` is the Knack account id.
            // - Completion field_1437 connects to object_7 (Tutor records), so we must use the Tutor record id.
            //   Knack exposes this via `profile_keys` for the logged-in role/profile in many builds.
            const getTutorRecordId = () => {
                try {
                    const pk = user.profile_keys || user.profileKeys || {};
                    if (pk && typeof pk === 'object') {
                        // Common shapes seen in Knack payloads
                        if (pk.object_7) return pk.object_7;
                        if (pk.profile_7) return pk.profile_7;
                        if (pk.tutor) return pk.tutor;
                        // If there's only one profile key, it's usually the active profile record id
                        const vals = Object.values(pk).filter(v => typeof v === 'string' && v.length >= 16);
                        if (vals.length === 1) return vals[0];
                    }
                } catch (_) {}
                return '';
            };
            const tutorId = getTutorRecordId();
            return { id: user.id, tutorId, email: user.email, name: user.name || 'User' };
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
        if (this.shouldUseSupabase()) {
            try {
                return await this.getActivitiesFromSupabase(bookName);
            } catch (e) {
                // If Supabase isn't accessible (e.g. anon key invalid / RLS misconfigured), fall back to Knack.
                console.warn('[Curriculum SPA] Supabase unavailable for activities; falling back to Knack.', e);
            }
        }
        await this.loadTutorCanonicalOnce();
        const filters = {
            match: 'and',
            rules: [
                { field: 'field_2702', operator: 'is', value: bookName }
            ]
        };
        if (getCurrentLanguage() !== 'cy') {
            filters.rules.push({ field: 'field_1924', operator: 'is', value: 'No' }); // Filter out Welsh
        }
        
        const records = await this.fetch('object_58', filters);
        console.log('[API] Fetched', records.length, 'NON-Welsh activities');
        
        const mapped = records.map(r => ({
            id: r.id,
            book: r.field_2702,
            activityId: r.field_1446,
            theme: r.field_1461 || 'General',
            name: r.field_1431,
            group: r.field_1435_raw || r.field_1435,
            content: r.field_1448_raw || r.field_1448
        }));

        // If canonical exists, filter to canonical items for this book to avoid duplicates.
        if (this._tutorCanonical?.byActivityId) {
            const canon = this._tutorCanonical.byActivityId;
            const filtered = mapped.filter((a) => {
                const aid = this.normalizeId(a?.activityId);
                const item = aid ? canon[aid] : null;
                return Boolean(item && String(item.book || '') === String(bookName || ''));
            });
            return filtered.map(a => this.applyCanonicalOverrideIfPossible(a));
        }

        return mapped.map(a => this.applyCanonicalOverrideIfPossible(a));
    }

    async getActivitiesFromSupabase(bookName) {
        const params = {
            select: 'id,name,vespa_category,knack_id,knack_activity_id,book,month,theme,content,think_section_html'
        };
        // Always use English/base rows; Welsh assets are applied via overrides when cy is active.
        params.or = '(content->>is_welsh.is.null,content->>is_welsh.eq.false)';
        const records = await this.fetchFromSupabase('activities', params);
        const hasTutorAssets = (r) => {
            const c = r?.content || {};
            return Boolean(
                c.slides_url_en || c.slides_embed_en || c.slides_url || c.slides_embed ||
                c.pdf_url_en || c.pdf_url || c.pdf_embed || c.pdf_download_html
            );
        };
        const mapped = records
            .filter((r) => {
                const rt = String(r?.content?.resource_type || '').toLowerCase();
                if (rt === 'worksheet' || rt === 'activity') return true;
                return hasTutorAssets(r);
            })
            .map(r => this.buildSupabaseActivity(r));
        // IMPORTANT: many staff/handbook rows store `book`/`month` in real columns,
        // not in `content`, so we filter by the mapped value client-side.
        return bookName ? mapped.filter((a) => String(a.book || '') === String(bookName || '')) : mapped;
    }

    async getUserCompletions() {
        const user = this.getCurrentUser();
        if (!user) return [];

        // Local completion cache (used during migration to Supabase-first).
        const getLocal = () => {
            try {
                const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('vespaTutorCompletionLocal_v1') : null;
                const all = raw ? JSON.parse(raw) : {};
                const email = String(user.email || '').trim();
                return (email && all[email]) ? all[email] : {};
            } catch (_) {
                return {};
            }
        };

        // Primary: match Tutor connection (object_7 record id).
        // Back-compat: if older records were created using account id, fall back to that.
        const build = (val) => ({
            match: 'and',
            rules: [{ field: 'field_1437', operator: 'is', value: val }]
        });

        let records = [];
        try {
            if (user.tutorId) records = await this.fetch('object_59', build(user.tutorId));
        } catch (_) {}
        if (!records || records.length === 0) {
            records = await this.fetch('object_59', build(user.id));
        }

        const mapped = records.map(r => {
            let json = {};
            try {
                const raw = r.field_1432_raw || r.field_1432;
                json = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch (e) {}
            return { id: r.id, completed: json };
        });

        // Merge in local cache so progress can update even if Knack write/read lags.
        try {
            const local = getLocal();
            if (local && Object.keys(local).length) {
                if (mapped.length === 0) mapped.push({ id: 'local', completed: {} });
                const base = mapped[0].completed || {};
                for (const [book, ids] of Object.entries(local)) {
                    if (!Array.isArray(ids)) continue;
                    if (!base[book]) base[book] = [];
                    for (const id of ids) {
                        if (!base[book].includes(id)) base[book].push(id);
                    }
                }
                mapped[0].completed = base;
            }
        } catch (_) {}

        return mapped;
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
        const url = completions.length > 0
            ? `https://eu-api.knack.com/v1/objects/object_59/records/${completions[0].id}`
            : 'https://eu-api.knack.com/v1/objects/object_59/records';

        const headers = {
            'X-Knack-Application-Id': this.config.knackAppId,
            'X-Knack-REST-API-Key': this.config.knackApiKey,
            'Content-Type': 'application/json'
        };

        // If a completion record already exists, don't touch the connection field again.
        if (completions.length > 0) {
            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ field_1432: JSON.stringify(json) })
            });
            if (!response.ok) {
                const error = await response.text();
                console.error('[API] Completion failed:', error);
                throw new Error('Failed to save completion');
            }
            return response.json();
        }

        // Otherwise, create a new completion record.
        // Knack connection fields usually accept an array of record IDs.
        const tutorId = user.tutorId || '';
        const createAttempts = [
            // Some Knack builds allow creating without setting the connection (if not required)
            { field_1432: JSON.stringify(json) },
            // Preferred: connect to the Tutor (object_7) record id
            ...(tutorId ? [
                { field_1437: [tutorId], field_1432: JSON.stringify(json) },
                { field_1437: [{ id: tutorId }], field_1432: JSON.stringify(json) },
            ] : []),
            // Back-compat / last resort (may fail if field expects object_7 record id)
            { field_1437: [user.id], field_1432: JSON.stringify(json) },
            { field_1437: [{ id: user.id }], field_1432: JSON.stringify(json) }
        ];
        let lastErrorText = '';
        for (const data of createAttempts) {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (response.ok) return response.json();
            lastErrorText = await response.text();
        }
        console.error('[API] Completion failed:', lastErrorText);
        throw new Error('Failed to save completion');
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

// ===== MODE BADGE (debug-only; never show to end users) =====
function renderDataSourceBadge(_text) {
    // Intentionally disabled by default so users never see "Supabase OFF" (or any data-source messaging).
    // If you ever want to re-enable locally, set:
    //   localStorage.setItem('curriculumDebug', '1')
    try {
        const enabled =
            (typeof window !== 'undefined' && String(window.location?.href || '').includes('curriculumDebug=1')) ||
            (typeof localStorage !== 'undefined' && localStorage.getItem('curriculumDebug') === '1');
        if (!enabled) return;
        // (Badge UI removed; console logging is the supported diagnostic path.)
    } catch (_) {}
}

const loadWelshOverrides = async () => {
    if (welshOverrideCache) return welshOverrideCache;
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
        welshOverrideCache = {};
        return welshOverrideCache;
    }
    const baseUrl = url.replace(/\/$/, '');
    // Pull only rows that have *any* Welsh asset override fields.
    // Note: `pdf_url_cy` lives inside `content` JSON for many rows.
    const endpoint =
        `${baseUrl}/rest/v1/activities` +
        `?select=name,book,knack_id,knack_activity_id,name_cy,slides_url_cy,slides_embed_cy,content` +
        `&or=(name_cy.not.is.null,slides_url_cy.not.is.null,slides_embed_cy.not.is.null,content->>pdf_url_cy.not.is.null)`;
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
            const codeKey = normalizeText(item.content?.activity_code || item.content?.activity_id || '');
            const payload = {
                name_cy: item.name_cy || null,
                slides_url_cy: item.slides_url_cy || null,
                slides_embed_cy: item.slides_embed_cy || null,
                pdf_url_cy: item.content?.pdf_url_cy || null
            };
            if (codeKey) {
                map[`code:${codeKey}`] = payload;
            }
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
    const codeKey = normalizeText(activity?.activityId);
    const activityKey = normalizeId(activity?.activityId);
    const recordKey = normalizeText(activity?.id);
    const nameKey = normalizeText(activity?.name);
    const bookKey = normalizeText(activity?.book);
    if (codeKey && map[`code:${codeKey}`]) return map[`code:${codeKey}`];
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
    const pdf = override?.pdf_url_cy || U.pdf(activity?.content || '');
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
    if (embed) return pdf ? `${embed}<a href="${pdf}" target="_blank" rel="noopener noreferrer">PDF</a>` : embed;
    // If we only have a Welsh PDF override, append it so users still get the correct download.
    if (pdf && pdf !== U.pdf(activity?.content || '')) {
        return `${activity?.content || ''}\n<p style="text-align:center"><a href="${pdf}" target="_blank" rel="noopener noreferrer"><strong>LAWRLWYTHWCH PDF</strong></a></p>`;
    }
    return activity?.content || '';
};

// ===== UTILITIES =====
const U = {
    colors: { Vision: '#FFA500', Effort: '#a4c2f4', Systems: '#aad950', Practice: '#a986ff', Attitude: '#ff769c' },
    getColor(theme) { return this.colors[theme?.trim()] || this.colors[theme?.trim().toUpperCase()] || '#079baa'; },
    iframe(html) { 
        if (!html) return null;
        // Always extract ONLY the first iframe. Do NOT return the full HTML blob,
        // otherwise multiple iframes (slides + pdf + youtube, etc.) will stack.
        const m = html.match(/<iframe[^>]*>[\s\S]*?<\/iframe>/i);
        return m ? m[0] : null;
    },
    pdf(html) {
        if (!html) return null;
        const m = html.match(/(?:href|src|data)="([^"]*\.pdf[^"]*)"/i);
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
        // store for modal open
        State._pdfUrl = pdf || null;
        
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
                                ? '<button class="btn-complete is-completed" disabled>✓ Completed</button>'
                                : '<button class="btn-complete" onclick="P3.complete()">✓ Complete</button>'}
                            ${pdf ? `<button class="btn-pdf" onclick="P3.openPdfModal()">📄 View PDF</button>` : ''}
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

            ${pdf ? `
            <div id="vespaPdfModalOverlay" class="vespa-pdf-modal-overlay" style="display:none" onclick="P3.closePdfModal()"></div>
            <div id="vespaPdfModal" class="vespa-pdf-modal" style="display:none" role="dialog" aria-modal="true" aria-label="PDF viewer">
                <div class="vespa-pdf-modal-header">
                    <div class="vespa-pdf-modal-title">PDF</div>
                    <div style="display:flex;gap:10px;align-items:center">
                        <a id="vespaPdfModalOpenNewTab" href="#" target="_blank" rel="noopener noreferrer" style="font-weight:600;text-decoration:none">Open in new tab</a>
                        <button class="vespa-pdf-modal-close" onclick="P3.closePdfModal()">×</button>
                    </div>
                </div>
                <div class="vespa-pdf-modal-body">
                    <iframe id="vespaPdfModalFrame" src="" width="100%" height="100%" loading="lazy"></iframe>
                </div>
            </div>
            ` : ''}
        `;
    },

    openPdfModal() {
        const pdf = State._pdfUrl || null;
        if (!pdf) return;
        const overlay = document.getElementById('vespaPdfModalOverlay');
        const modal = document.getElementById('vespaPdfModal');
        const frame = document.getElementById('vespaPdfModalFrame');
        const body = modal ? modal.querySelector('.vespa-pdf-modal-body') : null;
        const openNewTab = document.getElementById('vespaPdfModalOpenNewTab');
        if (!overlay || !modal || !frame) return;
        // Prefer direct PDF embedding (your assets live on vespa.academy).
        // Important: the modal is initially display:none; Chrome's built-in PDF viewer can
        // "lock" its layout based on the iframe's initial tiny size if we set src too early.
        // So we show the modal first, then set src on the next frame.
        try { frame.src = ''; } catch (_) {}
        if (openNewTab) openNewTab.href = pdf;
        overlay.style.display = 'block';
        // IMPORTANT: modal has an inline `display:none`; setting it to `block` breaks our CSS flex layout.
        // Use `flex` so `.vespa-pdf-modal-body` can fill remaining height.
        modal.style.display = 'flex';

        const raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (fn) => setTimeout(fn, 0);
        // Wait a frame so layout is committed, then size + load.
        raf(() => {
            try {
                if (body && body.getBoundingClientRect) {
                    const h = Math.max(240, Math.floor(body.getBoundingClientRect().height || 0));
                    frame.style.height = `${h}px`;
                } else {
                    // Fallback to a sensible viewport-based height
                    frame.style.height = '75vh';
                }
            } catch (_) {}
            // Load after sizing (another frame is safest for Chrome PDF viewer)
            raf(() => {
                try { frame.src = pdf; } catch (_) {}
            });
        });
        // Escape closes
        try {
            this._onPdfEsc = (e) => {
                if (e.key === 'Escape') this.closePdfModal();
            };
            document.addEventListener('keydown', this._onPdfEsc);
        } catch (_) {}
    },

    closePdfModal() {
        const overlay = document.getElementById('vespaPdfModalOverlay');
        const modal = document.getElementById('vespaPdfModal');
        const frame = document.getElementById('vespaPdfModalFrame');
        if (overlay) overlay.style.display = 'none';
        if (modal) modal.style.display = 'none';
        if (frame) frame.src = '';
        try {
            if (this._onPdfEsc) document.removeEventListener('keydown', this._onPdfEsc);
            this._onPdfEsc = null;
        } catch (_) {}
    },

    async writeCompletionToSupabase(activityUuid, bookName) {
        try {
            const cfg = (typeof window !== 'undefined' && window.CURRICULUM_RESOURCES_CONFIG) ? window.CURRICULUM_RESOURCES_CONFIG : {};
            const sbUrlRaw = (cfg.supabaseUrl || window.VESPA_SUPABASE_URL || '').toString().trim();
            if (!sbUrlRaw) return { ok: false, reason: 'no_supabase_url' };
            const fnUrl = `${sbUrlRaw.replace(/\/$/, '')}/functions/v1/tutor-resource-complete`;

            const userAttrs = (typeof Knack !== 'undefined' && Knack.getUserAttributes) ? Knack.getUserAttributes() : {};
            const userEmail = (userAttrs.email || '').toString().trim();
            const knackUserId = (userAttrs.id || '').toString().trim();
            if (!userEmail || !activityUuid || !bookName) return { ok: false, reason: 'missing_payload' };

            // For testing, allow the secret to be set locally in the browser:
            //   localStorage.setItem('vespaEdgeSecret', '<secret>')
            const edgeSecret = (() => {
                try {
                    const fromLs = (typeof localStorage !== 'undefined') ? (localStorage.getItem('vespaEdgeSecret') || '') : '';
                    const fromSs = (typeof sessionStorage !== 'undefined') ? (sessionStorage.getItem('vespaEdgeSecret') || '') : '';
                    const fromCfg = (cfg.edgeSecret || cfg.vespaEdgeSecret || '');
                    const fromGlobal = (typeof window !== 'undefined' && window.VESPA_EDGE_SECRET) ? window.VESPA_EDGE_SECRET : '';
                    return String(fromLs || fromSs || fromCfg || fromGlobal || '').trim();
                } catch (_) {
                    return '';
                }
            })();

            const headers = { 'Content-Type': 'application/json' };
            if (edgeSecret) headers['x-vespa-edge-secret'] = edgeSecret;

            const resp = await fetch(fnUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    user_email: userEmail,
                    knack_user_id: knackUserId || null,
                    activity_id: String(activityUuid),
                    book: String(bookName)
                })
            });
            if (!resp.ok) {
                const t = await resp.text();
                console.warn('[Curriculum SPA] Supabase completion write failed:', resp.status, t);
                return { ok: false, status: resp.status, body: t };
            }
            let j = null;
            try { j = await resp.json(); } catch (_) {}
            return { ok: true, data: j };
        } catch (e) {
            console.warn('[Curriculum SPA] Supabase completion write error:', e);
            return { ok: false, error: String(e && e.message ? e.message : e) };
        }
    },

    _readLocalCompletionState() {
        try {
            const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('vespaTutorCompletionLocal_v1') : null;
            return raw ? JSON.parse(raw) : {};
        } catch (_) {
            return {};
        }
    },

    _writeLocalCompletionState(state) {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem('vespaTutorCompletionLocal_v1', JSON.stringify(state || {}));
        } catch (_) {}
    },

    _storeLocalCompletion(userEmail, bookName, activityUuid) {
        try {
            if (!userEmail || !bookName || !activityUuid) return;
            const state = this._readLocalCompletionState();
            if (!state[userEmail]) state[userEmail] = {};
            if (!state[userEmail][bookName]) state[userEmail][bookName] = [];
            const arr = state[userEmail][bookName];
            if (!arr.includes(activityUuid)) arr.push(activityUuid);
            this._writeLocalCompletionState(state);
        } catch (_) {}
    },
    
    async complete() {
        const btn = document.querySelector('.btn-complete');
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = 'Completing...';
        
        try {
            // Supabase-first: this is the future source of truth.
            const sbRes = await this.writeCompletionToSupabase(State.activity.id, State.book);
            try {
                const userAttrs = (typeof Knack !== 'undefined' && Knack.getUserAttributes) ? Knack.getUserAttributes() : {};
                const userEmail = (userAttrs.email || '').toString().trim();
                if (sbRes && sbRes.ok) this._storeLocalCompletion(userEmail, State.book, State.activity.id);
            } catch (_) {}

            // Knack is now best-effort (legacy progress UI still reads from it).
            // If it fails but Supabase succeeded, do not block the user.
            let knackOk = true;
            try {
                await window.api.completeActivity(State.activity.id, State.book);
                // Also mirror into local cache so progress can still reflect completion even if Knack read is flaky.
                try {
                    const userAttrs = (typeof Knack !== 'undefined' && Knack.getUserAttributes) ? Knack.getUserAttributes() : {};
                    const userEmail = (userAttrs.email || '').toString().trim();
                    this._storeLocalCompletion(userEmail, State.book, State.activity.id);
                } catch (_) {}
            } catch (e) {
                knackOk = false;
                console.warn('[P3] Knack completion failed (non-blocking if Supabase ok):', e);
            }

            const success = Boolean((sbRes && sbRes.ok) || knackOk);
            if (!success) {
                const detail = sbRes?.status ? `Supabase status ${sbRes.status}` : (sbRes?.reason || 'unknown');
                throw new Error(`Completion not saved (${detail}).`);
            }

            if (sbRes && sbRes.ok) {
                U.toast(knackOk ? 'Activity completed! 🎉' : 'Saved! (Progress syncing...)');
            } else {
                U.toast('Activity completed! 🎉');
            }
            await this.show(window.api, State.activity.id);
        } catch (e) {
            console.error('[P3] Completion error:', e);
            const msg = (e && e.message) ? e.message : 'Failed to save completion.';
            alert(`${msg}\n\nIf you are using Supabase completions, ensure the Edge secret is available (e.g. localStorage/sessionStorage 'vespaEdgeSecret', or window.VESPA_EDGE_SECRET).`);
            btn.disabled = false;
            btn.textContent = '✓ Complete';
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

    try {
        const mode = (config.supabaseMode || window.VESPA_SUPABASE_MODE || 'auto').toString().toLowerCase();
        const hasSb = Boolean((config.supabaseUrl || window.VESPA_SUPABASE_URL) && (config.supabaseAnonKey || window.VESPA_SUPABASE_ANON_KEY));
        if (mode === 'off' || mode === 'knack' || mode === 'false') {
            console.warn('[Curriculum SPA] Supabase OFF (mode): using Knack + canonical overrides from tutoractivities_nested_from_csv.json');
        } else if (hasSb) {
            console.info('[Curriculum SPA] Supabase ON: using Supabase data source');
        } else {
            console.warn('[Curriculum SPA] Supabase OFF: no supabaseUrl/supabaseAnonKey found. Using Knack + canonical overrides from tutoractivities_nested_from_csv.json');
        }
    } catch (_) {}
    
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
        
        window.api = new CurriculumAPI(config);

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
}());

