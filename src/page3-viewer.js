/**
 * VESPA Curriculum Resources - Page 3: Activity Viewer
 * Vue 3 component for viewing activity details with completion tracking and discussions
 * 
 * Displays the activity content (iframe), allows completion, and shows discussions
 * Replaces the old scene_495 activity detail page
 */

(function() {
    'use strict';
    
    const DEBUG = false;
    const log = (msg, data) => {
        if (DEBUG) console.log(`[Page 3 Viewer] ${msg}`, data || '');
    };
    
    const CONFIG = window.CURRICULUM_RESOURCES_CONFIG || {};
    
    /**
     * Initialize Vue 3 Activity Viewer
     */
    window.initializeActivityViewer = async function() {
        log('Initializing Activity Viewer');
        
        // Get activity ID from URL or session
        const activityId = window.CurriculumShared.getCurrentActivityId();
        const currentBook = sessionStorage.getItem('currentBook');
        
        if (!activityId) {
            console.error('[Page 3 Viewer] No activity ID found');
            window.location.hash = '#tutor-activities/';
            return;
        }
        
        log('Viewing activity:', activityId);
        
        // Find or create container
        const sceneElement = document.querySelector('#kn-scene_1280') || 
                            document.querySelector('.kn-scene');
        if (!sceneElement) {
            console.error('[Page 3 Viewer] Scene element not found');
            return;
        }
        
        let container = document.getElementById('activity-viewer-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'activity-viewer-container';
            sceneElement.appendChild(container);
        }
        
        // Check if Vue 3 is loaded
        if (typeof Vue === 'undefined') {
            console.error('[Page 3 Viewer] Vue 3 not loaded');
            container.innerHTML = '<div class="curriculum-error"><h3>Vue 3 not loaded</h3></div>';
            return;
        }
        
        // Create Vue app
        const { createApp } = Vue;
        
        const app = createApp({
            data() {
                return {
                    activityId: activityId,
                    bookName: currentBook,
                    activity: null,
                    discussions: [],
                    isCompleted: false,
                    loading: true,
                    error: null,
                    completing: false,
                    newComment: '',
                    addingComment: false,
                    showDiscussions: true,
                    pdfLink: null,
                    iframeContent: null
                };
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
                        
                        // Fetch activity details
                        const allActivities = await api.getActivities();
                        this.activity = allActivities.find(a => a.id === this.activityId);
                        
                        if (!this.activity) {
                            throw new Error('Activity not found');
                        }
                        
                        // Extract iframe and PDF
                        this.iframeContent = window.CurriculumShared.extractIframe(this.activity.content);
                        this.pdfLink = window.CurriculumShared.extractPdfLink(this.activity.content);
                        
                        // Check if completed
                        const completions = await api.getUserCompletions();
                        if (completions.length > 0) {
                            const bookCompletions = completions[0].activitiesCompleted[this.bookName] || [];
                            this.isCompleted = bookCompletions.includes(this.activityId);
                        }
                        
                        // Load discussions
                        this.discussions = await api.getActivityDiscussions(this.activityId);
                        
                        this.loading = false;
                        
                    } catch (error) {
                        console.error('[Page 3 Viewer] Load error:', error);
                        this.error = error.message;
                        this.loading = false;
                    }
                },
                
                async completeActivity() {
                    if (this.completing || this.isCompleted) return;
                    
                    this.completing = true;
                    
                    try {
                        const api = new window.CurriculumAPI({
                            knackAppId: CONFIG.knackAppId,
                            knackApiKey: CONFIG.knackApiKey
                        });
                        
                        await api.completeActivity(this.activityId, this.bookName);
                        
                        this.isCompleted = true;
                        this.completing = false;
                        
                        // Show success message
                        this.showSuccessMessage('Activity completed! 🎉');
                        
                    } catch (error) {
                        console.error('[Page 3 Viewer] Complete error:', error);
                        alert('Failed to mark activity as complete. Please try again.');
                        this.completing = false;
                    }
                },
                
                async addComment() {
                    if (!this.newComment.trim() || this.addingComment) return;
                    
                    this.addingComment = true;
                    
                    try {
                        const api = new window.CurriculumAPI({
                            knackAppId: CONFIG.knackAppId,
                            knackApiKey: CONFIG.knackApiKey
                        });
                        
                        await api.addDiscussion(this.activityId, this.newComment);
                        
                        // Reload discussions
                        this.discussions = await api.getActivityDiscussions(this.activityId);
                        
                        this.newComment = '';
                        this.addingComment = false;
                        
                        this.showSuccessMessage('Comment added!');
                        
                    } catch (error) {
                        console.error('[Page 3 Viewer] Comment error:', error);
                        alert('Failed to add comment. Please try again.');
                        this.addingComment = false;
                    }
                },
                
                showSuccessMessage(message) {
                    const toast = document.createElement('div');
                    toast.className = 'success-toast';
                    toast.textContent = message;
                    document.body.appendChild(toast);
                    
                    setTimeout(() => {
                        toast.classList.add('show');
                    }, 10);
                    
                    setTimeout(() => {
                        toast.classList.remove('show');
                        setTimeout(() => toast.remove(), 300);
                    }, 3000);
                },
                
                goBack() {
                    window.location.hash = '#tutor-activities/tutor-activity-level/';
                },
                
                goToBooks() {
                    sessionStorage.removeItem('currentBook');
                    sessionStorage.removeItem('currentActivityId');
                    window.location.hash = '#tutor-activities/';
                },
                
                getThemeColor(theme) {
                    return window.CurriculumShared.getThemeColor(theme);
                }
            },
            
            async mounted() {
                log('Viewer component mounted');
                await this.loadData();
            },
            
            template: `
                <div class="activity-viewer">
                    <!-- Loading State -->
                    <div v-if="loading" class="curriculum-loading">
                        <div class="loading-spinner"></div>
                        <p>Loading activity...</p>
                    </div>
                    
                    <!-- Error State -->
                    <div v-else-if="error" class="curriculum-error">
                        <h3>Failed to load activity</h3>
                        <p>{{ error }}</p>
                        <button class="btn-retry" @click="loadData">Retry</button>
                    </div>
                    
                    <!-- Main Content -->
                    <div v-else class="viewer-content">
                        <!-- Breadcrumbs -->
                        <div class="viewer-breadcrumbs">
                            <a href="#tutor-activities/" @click.prevent="goToBooks">📚 Books</a>
                            <span class="separator">›</span>
                            <a href="#tutor-activities/tutor-activity-level/" @click.prevent="goBack">
                                {{ bookName }}
                            </a>
                            <span class="separator">›</span>
                            <span class="current">{{ activity.name }}</span>
                        </div>
                        
                        <!-- Activity Header -->
                        <div class="activity-header">
                            <div class="activity-meta">
                                <span class="activity-id">#{{ activity.activityId }}</span>
                                <span class="activity-theme-badge" 
                                      :style="{ backgroundColor: getThemeColor(activity.theme) }">
                                    {{ activity.theme }}
                                </span>
                                <span v-if="isCompleted" class="completed-badge-large">
                                    ✓ Completed
                                </span>
                            </div>
                            <h1 class="activity-title">{{ activity.name }}</h1>
                        </div>
                        
                        <!-- Activity Content -->
                        <div class="activity-content-section">
                            <!-- Iframe Embed -->
                            <div v-if="iframeContent" class="activity-iframe-wrapper" v-html="iframeContent"></div>
                            <div v-else class="activity-no-content">
                                <p>No embedded content available</p>
                            </div>
                            
                            <!-- PDF Download -->
                            <div v-if="pdfLink" class="activity-pdf-download">
                                <a :href="pdfLink" target="_blank" class="btn-download-pdf">
                                    📄 Download PDF Worksheet
                                </a>
                            </div>
                        </div>
                        
                        <!-- Completion Section -->
                        <div class="activity-completion-section">
                            <button 
                                v-if="!isCompleted"
                                @click="completeActivity" 
                                :disabled="completing"
                                class="btn-complete"
                            >
                                {{ completing ? 'Completing...' : '✓ Complete and Continue' }}
                            </button>
                            
                            <div v-else class="completion-message">
                                <span class="completion-icon">✓</span>
                                You completed this activity
                            </div>
                        </div>
                        
                        <!-- Discussions Section -->
                        <div class="activity-discussions-section">
                            <div class="discussions-header">
                                <h2>
                                    Discussion
                                    <span class="discussion-count">({{ discussions.length }})</span>
                                </h2>
                                <button 
                                    @click="showDiscussions = !showDiscussions"
                                    class="btn-toggle-discussions"
                                >
                                    {{ showDiscussions ? 'Hide' : 'Show' }}
                                </button>
                            </div>
                            
                            <div v-show="showDiscussions" class="discussions-content">
                                <!-- Add Comment Form -->
                                <div class="add-comment-form">
                                    <textarea 
                                        v-model="newComment"
                                        placeholder="Join the discussion..."
                                        rows="3"
                                        class="comment-textarea"
                                    ></textarea>
                                    <button 
                                        @click="addComment"
                                        :disabled="!newComment.trim() || addingComment"
                                        class="btn-add-comment"
                                    >
                                        {{ addingComment ? 'Posting...' : 'Post Comment' }}
                                    </button>
                                </div>
                                
                                <!-- Comments List -->
                                <div v-if="discussions.length === 0" class="no-discussions">
                                    <p>No comments yet. Be the first to share your thoughts!</p>
                                </div>
                                
                                <div v-else class="discussions-list">
                                    <div 
                                        v-for="discussion in discussions" 
                                        :key="discussion.id"
                                        class="discussion-item"
                                    >
                                        <div class="discussion-header">
                                            <span class="discussion-author">{{ discussion.tutorName }}</span>
                                            <span class="discussion-date">{{ discussion.date }}</span>
                                        </div>
                                        <div class="discussion-body">
                                            {{ discussion.comment }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Navigation -->
                        <div class="activity-navigation">
                            <button @click="goBack" class="btn-back-to-list">
                                ← Back to Activities
                            </button>
                        </div>
                    </div>
                </div>
            `
        });
        
        app.mount(container);
        log('Vue app mounted');
    };
    
    log('Page 3 Viewer script loaded');
})();

