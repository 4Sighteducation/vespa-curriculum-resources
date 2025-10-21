/**
 * Page 3: Wide Activity Viewer - Desktop-optimized with side-by-side layout
 */

const P3 = {
    async show(api, activityId) {
        State.page = 'viewer';
        document.querySelectorAll('.curriculum-page').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-page="viewer"]').classList.add('active');
        
        const c = document.getElementById('page-viewer');
        c.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
        
        try {
            const activity = State.activities.find(a => a.id === activityId);
            if (!activity) throw new Error('Activity not found');
            
            State.activity = activity;
            
            const [discussions, completions] = await Promise.all([
                api.getDiscussions(activityId),
                api.getUserCompletions()
            ]);
            
            const isCompleted = (completions[0]?.completed[State.book] || []).includes(activityId);
            
            this.render(activity, discussions, isCompleted, api);
        } catch (e) {
            c.innerHTML = '<div class="error-state"><h3>Failed to load activity</h3></div>';
        }
    },
    
    render(activity, discussions, isCompleted, api) {
        const c = document.getElementById('page-viewer');
        const iframe = U.iframe(activity.content);
        const pdf = U.pdf(activity.content);
        
        c.innerHTML = `
            <div class="viewer-container">
                <div class="viewer-top">
                    <div class="breadcrumbs">
                        <a href="#" onclick="P1.show(window.api); return false;">📚 Books</a> › 
                        <a href="#" onclick="P2.show(window.api, '${State.book}'); return false;">${State.book}</a> › 
                        <span>${activity.name}</span>
                    </div>
                    
                    <div class="activity-header-info">
                        <span class="badge badge-id">#${activity.activityId}</span>
                        <span class="badge badge-theme" style="background: ${U.getColor(activity.theme)}">${activity.theme}</span>
                        ${isCompleted ? '<span class="badge badge-completed">✓ Completed</span>' : ''}
                    </div>
                    
                    <h1 class="activity-title-large">${activity.name}</h1>
                </div>
                
                <div class="viewer-main">
                    <div class="content-column">
                        ${iframe ? `<div class="activity-iframe-container">${iframe}</div>` : '<p style="text-align:center;color:#999;">No content available</p>'}
                        
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
        try {
            await window.api.completeActivity(State.activity.id, State.book);
            U.toast('Activity completed! 🎉');
            await this.show(window.api, State.activity.id);
        } catch (e) {
            alert('Failed to complete. Try again.');
        }
    },
    
    async addComment() {
        const textarea = document.getElementById('new-comment');
        const comment = textarea?.value?.trim();
        if (!comment) return;
        
        try {
            await window.api.addDiscussion(State.activity.id, comment);
            U.toast('Comment posted!');
            await this.show(window.api, State.activity.id);
        } catch (e) {
            alert('Failed to post comment.');
        }
    }
};

console.log('[Curriculum SPA v2b] Page 3 loaded');

// ===== INITIALIZATION =====
window.initializeCurriculumSPA = async function() {
    console.log('[Curriculum SPA v2b] Initializing...');
    
    const config = window.CURRICULUM_RESOURCES_CONFIG;
    if (!config) {
        console.error('[SPA] No config');
        return;
    }
    
    // Wait for view
    let attempts = 0;
    const wait = setInterval(() => {
        const view = document.querySelector('#' + config.viewKey);
        if (view || attempts++ > 50) {
            clearInterval(wait);
            if (view) init();
        }
    }, 100);
    
    function init() {
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
        
        P1.show(window.api);
        
        console.log('[Curriculum SPA v2b] ✅ Ready! Desktop-optimized, information-dense!');
    }
};

// Expose globally
window.P1 = P1;
window.P2 = P2;
window.P3 = P3;

console.log('[Curriculum SPA v2b] All loaded - Ready to go!');

