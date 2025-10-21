/**
 * VESPA Curriculum Resources - Page 2: Activity Browser
 * Vue 3 component for browsing activities with filters and search
 * 
 * Displays activities organized by month with filtering by theme
 * Replaces the old scene_493 curriculum list
 */

(function() {
    'use strict';
    
    const DEBUG = false;
    const log = (msg, data) => {
        if (DEBUG) console.log(`[Page 2 Browser] ${msg}`, data || '');
    };
    
    const CONFIG = window.CURRICULUM_RESOURCES_CONFIG || {};
    
    /**
     * Initialize Vue 3 Activity Browser
     */
    window.initializeActivityBrowser = async function() {
        log('Initializing Activity Browser');
        
        // Get the book name from session storage
        const currentBook = sessionStorage.getItem('currentBook');
        if (!currentBook) {
            console.error('[Page 2 Browser] No book selected');
            window.location.hash = '#tutor-activities/';
            return;
        }
        
        log('Current book:', currentBook);
        
        // Find or create container
        const sceneElement = document.querySelector('#kn-scene_1280') || 
                            document.querySelector('.kn-scene');
        if (!sceneElement) {
            console.error('[Page 2 Browser] Scene element not found');
            return;
        }
        
        let container = document.getElementById('activity-browser-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'activity-browser-container';
            sceneElement.appendChild(container);
        }
        
        // Check if Vue 3 is loaded
        if (typeof Vue === 'undefined') {
            console.error('[Page 2 Browser] Vue 3 not loaded');
            container.innerHTML = '<div class="curriculum-error"><h3>Vue 3 not loaded</h3><p>Please refresh the page.</p></div>';
            return;
        }
        
        // Create Vue app
        const { createApp } = Vue;
        
        const app = createApp({
            data() {
                return {
                    bookName: currentBook,
                    activities: [],
                    groupedActivities: {},
                    completedIds: [],
                    loading: true,
                    error: null,
                    searchQuery: '',
                    selectedTheme: 'All',
                    selectedMonth: 'All',
                    themes: ['All', 'Vision', 'Effort', 'Systems', 'Practice', 'Attitude'],
                    months: []
                };
            },
            
            computed: {
                filteredActivities() {
                    let filtered = this.activities;
                    
                    // Filter by search
                    if (this.searchQuery) {
                        const query = this.searchQuery.toLowerCase();
                        filtered = filtered.filter(act => 
                            act.name.toLowerCase().includes(query) ||
                            act.theme.toLowerCase().includes(query) ||
                            act.activityId.toString().includes(query)
                        );
                    }
                    
                    // Filter by theme
                    if (this.selectedTheme !== 'All') {
                        filtered = filtered.filter(act => 
                            act.theme.toLowerCase() === this.selectedTheme.toLowerCase()
                        );
                    }
                    
                    // Filter by month
                    if (this.selectedMonth !== 'All') {
                        filtered = filtered.filter(act => {
                            const groups = Array.isArray(act.group) ? act.group : [act.group];
                            return groups.some(g => {
                                const groupStr = typeof g === 'string' ? g : g?.identifier || '';
                                return groupStr.startsWith(this.selectedMonth);
                            });
                        });
                    }
                    
                    return filtered;
                },
                
                groupedFilteredActivities() {
                    const grouped = {};
                    this.filteredActivities.forEach(activity => {
                        const groups = Array.isArray(activity.group) ? activity.group : [activity.group];
                        groups.forEach(g => {
                            const groupStr = typeof g === 'string' ? g : g?.identifier || 'Other';
                            const month = groupStr.split(' - ')[0] || 'Other';
                            if (!grouped[month]) {
                                grouped[month] = [];
                            }
                            grouped[month].push(activity);
                        });
                    });
                    return grouped;
                }
            },
            
            methods: {
                async loadData() {
                    this.loading = true;
                    this.error = null;
                    
                    try {
                        const api = new window.CurriculumAPI({
                            knackAppId: CONFIG.knackAppId,
                            knackApiKey: CONFIG.knackApiKey
                        });
                        
                        // Fetch activities for this book
                        const [activities, completions] = await Promise.all([
                            api.getActivities(this.bookName),
                            api.getUserCompletions()
                        ]);
                        
                        this.activities = activities;
                        
                        // Extract completed IDs
                        if (completions.length > 0) {
                            const bookCompletions = completions[0].activitiesCompleted[this.bookName] || [];
                            this.completedIds = bookCompletions;
                        }
                        
                        // Extract unique months
                        const monthSet = new Set();
                        activities.forEach(act => {
                            const groups = Array.isArray(act.group) ? act.group : [act.group];
                            groups.forEach(g => {
                                const groupStr = typeof g === 'string' ? g : g?.identifier || '';
                                const month = groupStr.split(' - ')[0];
                                if (month) monthSet.add(month);
                            });
                        });
                        
                        this.months = ['All', ...window.CurriculumShared.sortMonths([...monthSet])];
                        
                        this.loading = false;
                        
                    } catch (error) {
                        console.error('[Page 2 Browser] Load error:', error);
                        this.error = error.message;
                        this.loading = false;
                    }
                },
                
                isCompleted(activityId) {
                    return this.completedIds.includes(activityId);
                },
                
                getThemeColor(theme) {
                    return window.CurriculumShared.getThemeColor(theme);
                },
                
                selectActivity(activityId) {
                    log('Activity selected:', activityId);
                    sessionStorage.setItem('currentActivityId', activityId);
                    sessionStorage.setItem('currentBook', this.bookName);
                    
                    // Navigate to activity detail page
                    window.location.hash = `#tutor-activities/view-tutor-activity-level-details/${activityId}/`;
                },
                
                goBack() {
                    sessionStorage.removeItem('currentBook');
                    window.location.hash = '#tutor-activities/';
                },
                
                getSortedMonths(months) {
                    return window.CurriculumShared.sortMonths(months);
                }
            },
            
            async mounted() {
                log('Component mounted');
                await this.loadData();
            },
            
            template: `
                <div class="activity-browser">
                    <!-- Header -->
                    <div class="browser-header">
                        <button class="btn-back" @click="goBack">
                            ← Back to Books
                        </button>
                        <h1>{{ bookName }}</h1>
                        <p class="browser-subtitle">
                            {{ filteredActivities.length }} {{ filteredActivities.length === 1 ? 'activity' : 'activities' }}
                        </p>
                    </div>
                    
                    <!-- Loading State -->
                    <div v-if="loading" class="curriculum-loading">
                        <div class="loading-spinner"></div>
                        <p>Loading activities...</p>
                    </div>
                    
                    <!-- Error State -->
                    <div v-else-if="error" class="curriculum-error">
                        <h3>Failed to load activities</h3>
                        <p>{{ error }}</p>
                        <button class="btn-retry" @click="loadData">Retry</button>
                    </div>
                    
                    <!-- Main Content -->
                    <div v-else class="browser-content">
                        <!-- Filters -->
                        <div class="browser-filters">
                            <div class="filter-group">
                                <input 
                                    type="text" 
                                    v-model="searchQuery" 
                                    placeholder="🔍 Search activities..."
                                    class="search-input"
                                >
                            </div>
                            
                            <div class="filter-group">
                                <label>Theme:</label>
                                <select v-model="selectedTheme" class="filter-select">
                                    <option v-for="theme in themes" :key="theme" :value="theme">
                                        {{ theme }}
                                    </option>
                                </select>
                            </div>
                            
                            <div class="filter-group">
                                <label>Month:</label>
                                <select v-model="selectedMonth" class="filter-select">
                                    <option v-for="month in months" :key="month" :value="month">
                                        {{ month }}
                                    </option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Activities by Month -->
                        <div v-if="Object.keys(groupedFilteredActivities).length === 0" class="no-results">
                            <h3>No activities found</h3>
                            <p>Try adjusting your filters</p>
                        </div>
                        
                        <div v-else>
                            <div 
                                v-for="month in getSortedMonths(Object.keys(groupedFilteredActivities))" 
                                :key="month"
                                class="month-group"
                            >
                                <h2 class="month-header">{{ month }}</h2>
                                
                                <div class="activities-grid">
                                    <div 
                                        v-for="activity in groupedFilteredActivities[month]" 
                                        :key="activity.id"
                                        class="activity-card"
                                        :class="{ completed: isCompleted(activity.id) }"
                                        @click="selectActivity(activity.id)"
                                    >
                                        <div class="activity-card-header" 
                                             :style="{ borderLeftColor: getThemeColor(activity.theme) }">
                                            <div class="activity-theme-badge" 
                                                 :style="{ backgroundColor: getThemeColor(activity.theme) }">
                                                {{ activity.theme }}
                                            </div>
                                            <div class="activity-id">#{{ activity.activityId }}</div>
                                        </div>
                                        
                                        <div class="activity-card-body">
                                            <h3 class="activity-name">{{ activity.name }}</h3>
                                            <span v-if="isCompleted(activity.id)" class="completed-badge">
                                                ✓ Completed
                                            </span>
                                        </div>
                                        
                                        <div class="activity-card-footer">
                                            <button class="btn-view-activity">
                                                {{ isCompleted(activity.id) ? 'View Again' : 'Start Activity' }}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        });
        
        app.mount(container);
        log('Vue app mounted');
    };
    
    log('Page 2 Browser script loaded');
})();

