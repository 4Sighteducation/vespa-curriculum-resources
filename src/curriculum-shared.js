/**
 * VESPA Curriculum Resources - Shared Utilities
 * Common functions used across all curriculum pages
 */

const CurriculumShared = {
    /**
     * Theme colors matching VESPA palette
     */
    themeColors: {
        Vision: '#FFA500',      // Orange
        Effort: '#a4c2f4',      // Blue
        Systems: '#aad950',     // Green
        Practice: '#a986ff',    // Purple
        Attitude: '#ff769c',    // Pink
        VISION: '#FFA500',
        EFFORT: '#a4c2f4',
        SYSTEMS: '#aad950',
        PRACTICE: '#a986ff',
        ATTITUDE: '#ff769c'
    },

    /**
     * Get theme color for activity
     */
    getThemeColor(theme) {
        if (!theme) return '#079baa'; // Default VESPA blue
        const normalizedTheme = theme.trim();
        return this.themeColors[normalizedTheme] || this.themeColors[normalizedTheme.toUpperCase()] || '#079baa';
    },

    /**
     * Format date consistently
     */
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

    /**
     * Extract iframe from activity content
     */
    extractIframe(htmlContent) {
        if (!htmlContent) return null;
        
        // Check if it's already an iframe
        if (htmlContent.trim().startsWith('<iframe')) {
            return htmlContent;
        }
        
        // Extract iframe from HTML
        const match = htmlContent.match(/<iframe[^>]*>[\s\S]*?<\/iframe>/i);
        return match ? match[0] : null;
    },

    /**
     * Extract PDF link from activity content
     */
    extractPdfLink(htmlContent) {
        if (!htmlContent) return null;
        
        const match = htmlContent.match(/href="([^"]*\.pdf[^"]*)"/i);
        return match ? match[1] : null;
    },

    /**
     * Create activity card HTML
     */
    createActivityCard(activity, isCompleted = false) {
        const themeColor = this.getThemeColor(activity.theme);
        const completedBadge = isCompleted ? 
            '<span class="completed-badge">✓ Completed</span>' : '';
        
        return `
            <div class="activity-card ${isCompleted ? 'completed' : ''}" 
                 data-activity-id="${activity.id}"
                 data-theme="${activity.theme}">
                <div class="activity-card-header" style="border-left: 4px solid ${themeColor}">
                    <div class="activity-theme-badge" style="background-color: ${themeColor}">
                        ${activity.theme}
                    </div>
                    <div class="activity-id">#${activity.activityId}</div>
                </div>
                <div class="activity-card-body">
                    <h3 class="activity-name">${activity.name}</h3>
                    ${completedBadge}
                </div>
                <div class="activity-card-footer">
                    <button class="btn-start-activity" data-activity-id="${activity.id}">
                        ${isCompleted ? 'View Again' : 'Start Activity'}
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Show loading spinner
     */
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="curriculum-loading">
                <div class="loading-spinner"></div>
                <p>Loading curriculum resources...</p>
            </div>
        `;
    },

    /**
     * Show error message
     */
    showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="curriculum-error">
                <svg class="error-icon" width="48" height="48" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <h3>Oops! Something went wrong</h3>
                <p>${message}</p>
                <button class="btn-retry" onclick="location.reload()">Retry</button>
            </div>
        `;
    },

    /**
     * Debounce function for search
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Navigate to activity detail
     */
    navigateToActivity(activityId, bookName) {
        // Store in sessionStorage for the next page
        sessionStorage.setItem('currentActivityId', activityId);
        sessionStorage.setItem('currentBook', bookName);
        
        // Navigate using Knack's routing
        // Scene_495 would be the activity detail page (or your new scene)
        window.location.hash = `#tutor-activities/view-tutor-activity-level-details/${activityId}/`;
    },

    /**
     * Navigate back to activity list
     */
    navigateToActivityList(bookName) {
        sessionStorage.setItem('currentBook', bookName);
        window.location.hash = '#tutor-activities/tutor-activity-level/';
    },

    /**
     * Navigate back to book selection
     */
    navigateToBooks() {
        sessionStorage.removeItem('currentBook');
        sessionStorage.removeItem('currentActivityId');
        window.location.hash = '#tutor-activities/';
    },

    /**
     * Get book name from URL or session
     */
    getCurrentBook() {
        // Try URL hash first
        const hash = window.location.hash;
        const match = hash.match(/tutor-activity-level-details\/([^/]+)/);
        if (match) {
            // Activity detail view - get from session
            return sessionStorage.getItem('currentBook');
        }
        
        // Try session storage
        return sessionStorage.getItem('currentBook');
    },

    /**
     * Get activity ID from URL
     */
    getCurrentActivityId() {
        const hash = window.location.hash;
        const match = hash.match(/view-tutor-activity-level-details\/([^/]+)/);
        return match ? match[1] : sessionStorage.getItem('currentActivityId');
    },

    /**
     * Sanitize HTML to prevent XSS
     */
    sanitizeHtml(html) {
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    },

    /**
     * Create breadcrumb navigation
     */
    createBreadcrumbs(currentPage, bookName = null, activityName = null) {
        const parts = [];
        
        parts.push(`<a href="#tutor-activities/" class="breadcrumb-link">📚 Books</a>`);
        
        if (bookName) {
            parts.push(`<a href="#tutor-activities/tutor-activity-level/" class="breadcrumb-link">${bookName}</a>`);
        }
        
        if (activityName) {
            parts.push(`<span class="breadcrumb-current">${activityName}</span>`);
        }
        
        return `<div class="curriculum-breadcrumbs">${parts.join(' <span class="breadcrumb-separator">›</span> ')}</div>`;
    },

    /**
     * Group activities by month
     */
    groupActivitiesByMonth(activities) {
        const grouped = {};
        
        activities.forEach(activity => {
            // Extract month from group name (e.g., "September - ALevel Mindset" -> "September")
            const groupNames = Array.isArray(activity.group) ? activity.group : [activity.group];
            
            groupNames.forEach(groupName => {
                if (typeof groupName === 'string') {
                    const month = groupName.split(' - ')[0] || 'Other';
                    if (!grouped[month]) {
                        grouped[month] = [];
                    }
                    grouped[month].push(activity);
                } else if (groupName && groupName.identifier) {
                    const month = groupName.identifier.split(' - ')[0] || 'Other';
                    if (!grouped[month]) {
                        grouped[month] = [];
                    }
                    grouped[month].push(activity);
                }
            });
        });
        
        return grouped;
    },

    /**
     * Sort months in academic year order
     */
    sortMonths(months) {
        const order = [
            'September', 'October', 'November', 'December',
            'January', 'Febuary', 'February', // Handle typo in data
            'March', 'April', 'May', 'June', 'July'
        ];
        
        return months.sort((a, b) => {
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            
            // Put unknown months at the end
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            
            return indexA - indexB;
        });
    },

    /**
     * Initialize global state
     */
    initState() {
        if (!window.VESPA_CURRICULUM_STATE) {
            window.VESPA_CURRICULUM_STATE = {
                currentBook: null,
                currentActivity: null,
                api: null,
                initialized: false
            };
        }
        return window.VESPA_CURRICULUM_STATE;
    }
};

// Export to window
window.CurriculumShared = CurriculumShared;

