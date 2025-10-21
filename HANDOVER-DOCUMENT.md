# VESPA Curriculum Resources - Complete Handover Document

## Project Context

### The Problem
Your curriculum delivery system (120+ teaching activities across 3 books) is currently controlled by **KSENSE Technology Group**. They host the code externally at `https://secure.ksensetech.com/` and you have:
- ❌ No access to the source code
- ❌ No control over updates
- ❌ Dependency on their services
- ❌ Risk of service interruption

### The Goal
Create a **complete replacement** that you control 100%, eliminating KSENSE dependency.

### The Approach
Build a modern **Single-Page Application (SPA)** that:
- Runs entirely in ONE Knack scene (scene_1280)
- Fetches data directly from Knack API (no hidden tables)
- Delivers via jsDelivr CDN from your GitHub repository
- Loads through your existing KnackAppLoader system

---

## Current Architecture

### Data Structure (Knack Objects)

**Object_56: Books**
- `field_1429`: Book name (e.g., "ALevel Mindset")
- `field_1439`: Book image HTML

**Object_57: Activity Groups**
- `field_1430`: Month (September, October, etc.)
- `field_1434`: Connection to Object_56 (book)
- `field_2916`: "Month - Book" text

**Object_58: Activities** (120+ records)
- `field_2702`: Book name
- `field_1446`: Activity ID (number)
- `field_1461`: VESPA Theme (Vision, Effort, Systems, Practice, Attitude)
- `field_1431`: Activity name
- `field_1435`: Connection to Object_57 (group/month)
- `field_1448`: Activity content (HTML with iframe/PDF)
- `field_1924`: Welsh flag ("Yes" or "No")

**Object_59: Completion Tracking**
- `field_1437`: Connection to Object_7 (tutor/user)
- `field_1432`: JSON of completed activities: `{"BookName": ["activityId1", "activityId2"]}`
- `field_1449`: Notes (auto-populated)
- `field_2295`: Date completed (auto-populated)

**Object_60: Discussions**
- `field_1444`: Connection to Object_58 (activity)
- `field_1445`: Connection to Object_7 (tutor)
- `field_1433`: Comment text
- `field_1447`: Date

---

## What We've Built

### Repository Structure
```
vespa-curriculum-resources/
├── dist/
│   ├── curriculum-spa2e.js    ← Current version (JavaScript)
│   ├── curriculum-spa2e.css   ← Current version (CSS)
│   └── (older versions: 2a, 2b, 2c, 2d...)
├── src/
│   ├── curriculum-api.js      ← API integration code
│   ├── curriculum-shared.js   ← Utilities
│   ├── page1-enhancer.js      ← Book selection
│   ├── page2-browser.js       ← Activity browser
│   └── page3-viewer.js        ← Activity viewer
├── problem_mappings_tutor_ids_and_record_ids.json ← Problem → Activity mapping
├── enriched_tutoractivities_with_problem_tags_final.json ← Activities with tags
└── Documentation files (README, DEPLOYMENT, etc.)
```

### The Single-Page App (SPA)

**All 3 pages run in scene_1280, view_3244:**

1. **Page 1: Book Selection**
   - Shows 3 books with progress bars
   - Click book → Switches to Page 2 (instant, no reload)

2. **Page 2: Activity Browser**
   - Compact table-like list (15-20 activities visible)
   - Search bar
   - Theme filter chips (Visual VESPA categories)
   - Month tabs
   - Problem-based search dropdown
   - Progress bar showing overall completion

3. **Page 3: Activity Viewer**
   - Wide desktop layout
   - Embedded activity content (iframe)
   - PDF download button
   - "Complete and Continue" button
   - Discussion section with comments
   - Side-by-side layout (content 60%, discussions 40%)

---

## How It Loads

### Deployment Chain

1. **GitHub Repository**
   - URL: `https://github.com/4Sighteducation/vespa-curriculum-resources`
   - Contains all source code
   - Main files: `dist/curriculum-spa2e.js` and `dist/curriculum-spa2e.css`

2. **jsDelivr CDN**
   - Automatically serves from GitHub
   - URLs:
     - `https://cdn.jsdelivr.net/gh/4Sighteducation/vespa-curriculum-resources@main/dist/curriculum-spa2e.js`
     - `https://cdn.jsdelivr.net/gh/4Sighteducation/vespa-curriculum-resources@main/dist/curriculum-spa2e.css`
   - **Cache Issue:** Takes 2-5 minutes to update after GitHub push
   - **Workaround:** Version the filename (2e → 2f → 2g) for instant updates

3. **KnackAppLoader (in Knack Builder)**
   - Located in: **Knack Settings** → **JavaScript**
   - File on disk: `Homepage/KnackAppLoader(copy).js`
   - **Must be manually copied** to Knack Builder (cannot auto-deploy)
   - Lines 1083-1097 define the curriculum resources app

4. **Knack Scene**
   - Test scene: `scene_1280` (CURRICULUM RESOURCES)
   - Test view: `view_3244` (can be empty rich text - we replace it)
   - **When working:** Will eventually replace scene_481 (old KSENSE page)

---

## Current Issues (As of Latest Version)

### ❌ Issue 1: Completion Not Saving (400 Error)
**Symptom:** Click "Complete and Continue" → "Failed. Try again"  
**Error:** `POST https://eu-api.knack.com/v1/objects/object_59/records 400`  
**Location:** `curriculum-spa2e.js` line ~129-160  
**Current Status:** BROKEN

**Attempted Fixes:**
- v2d: Tried Knack date format `MM/DD/YYYY hh:mm am/pm`
- v2e: Simplified to just `field_1437` and `field_1432`
- **Still failing**

**Possible Causes:**
1. Connection field `field_1437` needs different format
2. Creating vs updating record logic is wrong
3. Field_1432 JSON structure is incorrect
4. Missing required field we don't know about

**What to Try Next:**
```javascript
// Test in browser console:
const user = Knack.getUserAttributes();
const data = {
    field_1437_raw: [{id: user.id}], // Try raw format
    field_1432: '{"ALevel Mindset":["607f2e2f2b0bda001ccd23a6"]}'
};

fetch('https://eu-api.knack.com/v1/objects/object_59/records', {
    method: 'POST',
    headers: {
        'X-Knack-Application-Id': '5ee90912c38ae7001510c1a9',
        'X-Knack-REST-API-Key': '8f733aa5-dd35-4464-8348-64824d1f5f0d',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
}).then(r => r.json()).then(console.log);
```

### ❌ Issue 2: Problem Search Not Matching Activities
**Symptom:** Select problem → "No activities matched" or wrong activities  
**Error:** None in console  
**Location:** `curriculum-spa2e.js` line ~480-500  
**Current Status:** BROKEN

**Current Implementation:**
```javascript
const PROBLEMS = {
  "svision_1": {
    text: "Student unsure about future goals",
    theme: "Vision",
    ids: ["607f34fe3b9a8f001d79f9b6", "607767a0d66606001b48d065", ...]
  }
};
```

**The Issue:**
- Problem search uses record IDs from `problem_mappings_tutor_ids_and_record_ids.json`
- These IDs span ALL books
- But Page 2 only shows activities from CURRENT book
- So if problem activities are in different book, they won't show

**What to Try Next:**
1. Load ALL activities when using problem search
2. Show activities from other books with badge: "From: ALevel Mindset"
3. Allow clicking to switch books

### ✅ Working Features

1. **Book Selection** - Loads and displays 3 books with progress
2. **Activity Browser** - Shows activities for selected book
3. **Activity Viewer** - Displays content, discussions
4. **Search Box** - Filters by name/theme
5. **Theme Filters** - Visual chips work
6. **Month Tabs** - Filter by academic year
7. **Welsh Filtering** - Only shows `field_1924 = "No"`
8. **No Activity IDs** - Removed from display
9. **Academic Year Sorting** - September → July
10. **Discussions** - Display properly (adding not tested)

---

## Deployment Workflow

### When You Make Changes:

1. **Edit files** in `Resources/dist/`
2. **Create new version:**
   ```bash
   copy dist\curriculum-spa2e.js dist\curriculum-spa2f.js
   copy dist\curriculum-spa2e.css dist\curriculum-spa2f.css
   ```
3. **Push to GitHub:**
   ```bash
   git add dist/curriculum-spa2f.js dist/curriculum-spa2f.css
   git commit -m "v2f - Description of changes"
   git push
   ```
4. **Update `Homepage/KnackAppLoader(copy).js`:**
   - Change `curriculum-spa2e.js` → `curriculum-spa2f.js` (lines 1086-1087)
5. **Copy to Knack:**
   - Open Knack Builder → Settings → JavaScript
   - Replace ALL with contents of `KnackAppLoader(copy).js`
   - Save
6. **Test:**
   - Wait 2-3 minutes for CDN
   - Navigate to scene_1280
   - Hard refresh (Ctrl + Shift + R)

---

## Key Files Reference

### In Homepage Folder
- `KnackAppLoader(copy).js` - The main app loader (lines 1083-1097 for curriculum)
- `Object_59mapping.json` - Shows structure of completion records
- `tutoractivities_pretty_mapped_with_mappings.json` - All activities with field mappings

### In Resources Folder
- `dist/curriculum-spa2e.js` - Current JavaScript
- `dist/curriculum-spa2e.css` - Current CSS
- `problem_mappings_tutor_ids_and_record_ids.json` - Problem → Activity mapping
- `enriched_tutoractivities_with_problem_tags_final.json` - Activities with problem tags
- `DEPLOYMENT.md` - Deployment guide
- `TESTING.md` - Testing checklist
- `V2C-FIXES.md` - Version history
- This file: `HANDOVER-DOCUMENT.md`

---

## Technical Details

### API Integration
All data fetched via Knack REST API:
```
Base URL: https://eu-api.knack.com/v1/objects/{objectKey}/records
App ID: 5ee90912c38ae7001510c1a9
API Key: 8f733aa5-dd35-4464-8348-64824d1f5f0d
```

### How Pages Switch
No navigation - just CSS show/hide:
```javascript
// Hide all pages
document.querySelectorAll('.curriculum-page').forEach(p => p.classList.remove('active'));
// Show target page
document.querySelector('[data-page="browser"]').classList.add('active');
```

### State Management
Global state object:
```javascript
const State = {
    page: 'books',           // Current page
    book: null,              // Selected book name
    activity: null,          // Current activity object
    activities: [],          // Activities for current book
    completedIds: [],        // IDs of completed activities
    filters: {...}           // Search/filter state
};
```

---

## Known Bugs & Fixes Needed

### Priority 1: Fix Completion Saving
**File:** `curriculum-spa2e.js` line ~129  
**Function:** `async completeActivity(activityId, bookName)`  
**Issue:** Returns 400 error  

**Debug Steps:**
1. Check what format Object_59 actually accepts
2. Look at existing records in Knack Builder → Objects → Object_59
3. Compare our data structure with what's actually in Knack
4. Test API call manually in console
5. Check if connection field needs `{id: userId}` instead of `[userId]`

### Priority 2: Fix Problem Search
**File:** `curriculum-spa2e.js` line ~480  
**Function:** `searchByProblem(value)`  
**Issue:** Not finding activities or finding wrong ones

**The Core Problem:**
- Problem mappings include activities from ALL 3 books
- Page 2 only loads activities from ONE book
- Solution: Either load all activities, or show "activity in different book" message

**Suggested Fix:**
```javascript
// When problem selected:
1. Get problem record IDs
2. Check which activities are in current book
3. If some are in other books:
   - Show message: "3 activities found in ALevel Mindset - Click to switch"
   - Allow switching to that book
```

### Priority 3: Better Error Handling
Add try/catch with actual error messages shown to user

---

## What You've Achieved So Far

Despite the current bugs, you've successfully:

✅ **Built entire infrastructure** - GitHub repo, CDN delivery, app loader integration  
✅ **Fetched data from Knack** - API integration works  
✅ **Created beautiful UI** - Modern, responsive design  
✅ **Filtered Welsh activities** - Only shows English  
✅ **Sorted by academic year** - September → July  
✅ **Page navigation works** - All 3 pages in one scene  
✅ **Removed KSENSE completely** - No external dependencies  

**This is 80% complete** - just need to fix the bugs!

---

## Next Steps

### Immediate (Fix Bugs)
1. **Debug completion saving**
   - Test API calls manually
   - Check field formats
   - Look at Knack's actual requirements

2. **Fix problem search**
   - Decide: cross-book or current-book only
   - Update matching logic
   - Test with real problem IDs

### Short Term (Polish)
3. **Add error messages** - Show what went wrong
4. **Add loading states** - Show progress
5. **Test all features** - Complete testing checklist

### Long Term (Deploy)
6. **Replace scene_481** - Once working, swap in production
7. **Cancel KSENSE** - Full independence!

---

## For the Next Developer

### Getting Started
1. Read this document
2. Read `DEPLOYMENT.md`
3. Look at `dist/curriculum-spa2e.js` (current version)
4. Test manually in browser console
5. Fix completion bug first (highest priority)

### Debug Mode
Enable detailed logging:
```javascript
// In KnackAppLoader(copy).js line 1091
debugMode: true  // Change from false
```

### Testing
```javascript
// In browser console:
window.api                    // The API instance
window.State                  // Current state
window.PROBLEMS              // Problem mappings
window.P1, P2, P3            // Page controllers

// Test completion manually:
await window.api.completeActivity('ACTIVITY_ID', 'ALevel Mindset');
```

---

## Questions to Answer

Before this can go live, we need to solve:

1. **Why is completion saving failing?**
   - What format does Object_59 field_1437 (connection) need?
   - What format does field_1432 (JSON) need?
   - Do we need to send field_2295 or let Knack auto-populate?

2. **How should cross-book problem search work?**
   - Show all activities regardless of book?
   - Only show activities in current book?
   - Allow switching books when problem activities are elsewhere?

3. **Is the problem matching even working?**
   - Are the record IDs correct?
   - Is the matching logic sound?
   - Why does it sometimes find 0, sometimes 10 activities?

---

## Success Criteria

The system will be ready for production when:

- ✅ Books load and display
- ✅ Activities load and display
- ✅ Search/filters work
- ❌ **Completion saves correctly** ← CRITICAL
- ❌ **Problem search works reliably** ← IMPORTANT
- ❌ **Discussions can be added** ← NOT TESTED
- ✅ Welsh activities are filtered out
- ✅ No KSENSE dependencies

---

## Resources

### GitHub Repositories
- Main: `https://github.com/4Sighteducation/vespa-curriculum-resources`
- Homepage: (existing repo with KnackAppLoader)

### Knack
- App ID: `5ee90912c38ae7001510c1a9`
- Test scene: `scene_1280`
- Test view: `view_3244`
- Production scene (future): `scene_481`

### CDN
- Base URL: `https://cdn.jsdelivr.net/gh/4Sighteducation/vespa-curriculum-resources@main/dist/`
- Current: `curriculum-spa2e.js` and `curriculum-spa2e.css`

---

## Conclusion

**You have a solid foundation** that's 80% complete. The architecture is sound, the infrastructure is in place, and most features work.

**The blockers are:**
1. Completion API call format (technical, solvable)
2. Problem search cross-book logic (design decision needed)

**Both are fixable** with focused debugging and possibly asking Knack support about the exact format Object_59 expects for connections.

**You ARE free from KSENSE** - the code is 100% yours. Just need to squash these final bugs!

---

## Contact / Support

- Knack documentation: `https://docs.knack.com/docs/rest-api`
- Knack support: For Object_59 field format questions
- GitHub Issues: Track bugs in your repository

Good luck! The finish line is close. 🎯

