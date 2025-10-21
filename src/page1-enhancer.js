/**
 * VESPA Curriculum Resources - Page 1: Book Selection Enhancer
 * Enhanced version of resourcesFix_v6.js for scene_1280
 * 
 * This page displays the 3 curriculum books with progress tracking
 * Users click a book to navigate to the activity browser (Page 2)
 */

(function() {
    'use strict';
    
    const DEBUG = false;
    const log = (msg, data) => {
        if (DEBUG) console.log(`[Page 1 Enhancer] ${msg}`, data || '');
    };
    
    // Configuration
    const CONFIG = window.CURRICULUM_RESOURCES_CONFIG || {};
    const SCENE_ID = CONFIG.sceneKey || 'scene_1280';
    const VIEW_ID = CONFIG.viewKey || 'view_3244';
    
    log('Initializing Page 1 Enhancer', { scene: SCENE_ID, view: VIEW_ID });
    
    let stylesApplied = false;
    let api = null;
    
    /**
     * Initialize the API
     */
    function initAPI() {
        if (!window.CurriculumAPI) {
            log('ERROR: CurriculumAPI not loaded');
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
    
    /**
     * Apply enhanced CSS styles (building on resourcesFix_v6.js)
     */
    function applyStyles() {
        if (stylesApplied) return;
        
        const styleId = 'curriculum-page1-styles';
        
        // Remove existing if present
        const existing = document.getElementById(styleId);
        if (existing) existing.remove();
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Enhanced Book Selection Page - Building on resourcesFix_v6.js */
            
            /* Hide the original Knack view - we'll create our own */
            #${SCENE_ID} #${VIEW_ID} {
                display: none !important;
            }
            
            /* Main container for book selection */
            #curriculum-books-container {
                max-width: 1400px;
                margin: 100px auto 50px;
                padding: 40px 20px;
            }
            
            /* Page header */
            .curriculum-page-header {
                text-align: center;
                margin-bottom: 60px;
            }
            
            .curriculum-page-header h1 {
                color: #23356f;
                font-size: 42px;
                font-weight: 700;
                margin-bottom: 15px;
                letter-spacing: 0.5px;
            }
            
            .curriculum-page-header p {
                color: #5899a8;
                font-size: 18px;
                font-weight: 300;
                max-width: 600px;
                margin: 0 auto;
            }
            
            /* Books grid */
            #curriculum-books-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 50px;
                align-items: start;
                justify-items: center;
                padding: 20px 0;
            }
            
            /* Individual book card */
            .book-card {
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                border-radius: 20px;
                padding: 30px;
                text-align: center;
                transition: all 0.3s ease;
                cursor: pointer;
                position: relative;
                border: 2px solid rgba(35, 53, 111, 0.1);
                box-shadow: 0 10px 30px rgba(35, 53, 111, 0.1);
                max-width: 450px;
                width: 100%;
            }
            
            .book-card:hover {
                transform: translateY(-10px);
                box-shadow: 0 20px 50px rgba(35, 53, 111, 0.2);
                border-color: #079baa;
            }
            
            /* Book image styling (from resourcesFix_v6.js) */
            .book-card img {
                width: 100%;
                max-width: 350px;
                height: auto;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
                border: 2px solid rgba(95, 73, 122, 0.3);
                margin-bottom: 25px;
            }
            
            .book-card:hover img {
                transform: scale(1.05);
                box-shadow: 
                    0 0 30px rgba(7, 155, 170, 0.4),
                    0 20px 40px rgba(35, 53, 111, 0.2);
                border-color: #079baa;
            }
            
            /* Book title */
            .book-card h2 {
                color: #23356f;
                font-size: 28px;
                font-weight: 700;
                margin: 20px 0 15px;
            }
            
            /* Progress section */
            .book-progress {
                margin-top: 25px;
                padding-top: 20px;
                border-top: 2px solid rgba(35, 53, 111, 0.1);
            }
            
            .progress-percentage {
                font-size: 36px;
                font-weight: 700;
                color: #079baa;
                margin-bottom: 10px;
            }
            
            .progress-label {
                font-size: 16px;
                color: #5899a8;
                font-weight: 500;
                margin-bottom: 15px;
            }
            
            /* Progress bar */
            .progress-bar-container {
                width: 100%;
                height: 12px;
                background-color: #e0e0e0;
                border-radius: 6px;
                overflow: hidden;
                position: relative;
            }
            
            .progress-bar-fill {
                height: 100%;
                background: linear-gradient(90deg, #079baa 0%, #00e5db 100%);
                border-radius: 6px;
                transition: width 0.5s ease;
                position: relative;
            }
            
            .progress-bar-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                animation: shimmer 2s infinite;
            }
            
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            
            /* Start button */
            .book-card .btn-start {
                margin-top: 20px;
                background: linear-gradient(135deg, #079baa 0%, #00e5db 100%);
                color: white;
                border: none;
                border-radius: 10px;
                padding: 15px 40px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
                box-shadow: 0 4px 15px rgba(7, 155, 170, 0.3);
            }
            
            .book-card .btn-start:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(7, 155, 170, 0.4);
                background: linear-gradient(135deg, #00e5db 0%, #079baa 100%);
            }
            
            /* Loading state */
            .curriculum-loading {
                text-align: center;
                padding: 100px 20px;
            }
            
            .loading-spinner {
                width: 60px;
                height: 60px;
                border: 4px solid #e0e0e0;
                border-top-color: #079baa;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .curriculum-loading p {
                color: #5899a8;
                font-size: 18px;
            }
            
            /* Error state */
            .curriculum-error {
                text-align: center;
                padding: 100px 20px;
                color: #c00;
            }
            
            .curriculum-error h3 {
                font-size: 24px;
                margin: 20px 0;
            }
            
            /* Fade-in animation */
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .book-card {
                animation: fadeInUp 0.6s ease-out forwards;
            }
            
            .book-card:nth-child(1) { animation-delay: 0.1s; opacity: 0; }
            .book-card:nth-child(2) { animation-delay: 0.2s; opacity: 0; }
            .book-card:nth-child(3) { animation-delay: 0.3s; opacity: 0; }
            
            /* Responsive design */
            @media (max-width: 1200px) {
                #curriculum-books-grid {
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 40px;
                }
                
                .book-card img {
                    max-width: 300px;
                }
            }
            
            @media (max-width: 768px) {
                #curriculum-books-container {
                    margin-top: 50px;
                    padding: 20px 15px;
                }
                
                #curriculum-books-grid {
                    grid-template-columns: 1fr;
                    gap: 30px;
                }
                
                .curriculum-page-header h1 {
                    font-size: 32px;
                }
                
                .book-card {
                    padding: 25px 20px;
                }
                
                .book-card img {
                    max-width: 250px;
                }
            }
        `;
        
        document.head.appendChild(style);
        stylesApplied = true;
        log('Styles applied');
    }
    
    /**
     * Create the book selection UI
     */
    async function createBookSelectionUI() {
        log('Creating book selection UI');
        
        // Find the view container
        const viewContainer = document.querySelector(`#${VIEW_ID}`);
        if (!viewContainer) {
            log('ERROR: View container not found', VIEW_ID);
            return;
        }
        
        // Create main container
        let mainContainer = document.getElementById('curriculum-books-container');
        if (!mainContainer) {
            mainContainer = document.createElement('div');
            mainContainer.id = 'curriculum-books-container';
            viewContainer.appendChild(mainContainer);
        }
        
        // Show loading
        mainContainer.innerHTML = `
            <div class="curriculum-loading">
                <div class="loading-spinner"></div>
                <p>Loading curriculum books...</p>
            </div>
        `;
        
        try {
            // Initialize API
            const curriculumAPI = initAPI();
            if (!curriculumAPI) {
                throw new Error('Failed to initialize API');
            }
            
            // Fetch books and progress
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
            
            // Fetch progress for each book
            const progressPromises = books.map(book => 
                curriculumAPI.calculateProgress(book.name)
            );
            const progressData = await Promise.all(progressPromises);
            
            // Build UI
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
                        <div class="progress-stats" style="margin-top: 10px; font-size: 14px; color: #666;">
                            ${progress.completed} of ${progress.total} activities
                        </div>
                    </div>
                    <button class="btn-start">Explore Activities</button>
                `;
                
                // Add click handler
                bookCard.addEventListener('click', () => {
                    selectBook(book.name);
                });
                
                grid.appendChild(bookCard);
            });
            
            log('Book selection UI created');
            
        } catch (error) {
            console.error('[Page 1 Enhancer] Error creating UI:', error);
            mainContainer.innerHTML = `
                <div class="curriculum-error">
                    <h3>Failed to load books</h3>
                    <p>${error.message}</p>
                    <button class="btn-retry" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }
    
    /**
     * Handle book selection
     */
    function selectBook(bookName) {
        log('Book selected:', bookName);
        
        // Store in session storage
        sessionStorage.setItem('currentBook', bookName);
        
        // Navigate to activity browser (Page 2)
        // This will go to scene that shows the activity list
        window.location.hash = '#tutor-activities/tutor-activity-level/';
    }
    
    /**
     * Initialize the page
     */
    function init() {
        log('Initializing Page 1');
        
        // Apply styles
        applyStyles();
        
        // Wait for DOM and create UI
        setTimeout(() => {
            createBookSelectionUI();
        }, 300);
    }
    
    // Initialize on scene render
    $(document).on(`knack-scene-render.${SCENE_ID.replace('scene_', '')}`, function() {
        log('Scene rendered');
        init();
    });
    
    // Initialize on view render
    $(document).on(`knack-view-render.${VIEW_ID.replace('view_', '')}`, function() {
        log('View rendered');
        init();
    });
    
    // Initialize immediately if we're already on the right scene/view
    if (window.location.hash.includes('tutor-activities') || 
        window.location.hash.includes(SCENE_ID.replace('scene_', ''))) {
        setTimeout(init, 500);
    }
    
    log('Page 1 Enhancer loaded');
})();

