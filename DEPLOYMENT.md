# VESPA Curriculum Resources - Deployment Guide

## Overview
This system completely replaces KSENSE's curriculum delivery system with a modern, Vue 3-based solution that you control 100%.

## Prerequisites
- GitHub account with access to `4Sighteducation/vespa-curriculum-resources`
- Access to Knack Builder for scene_1280
- KnackAppLoader already deployed in your app

## Phase 1: Testing (scene_1280)

### Step 1: Push Code to GitHub

```bash
cd "C:\Users\tonyd\OneDrive - 4Sight Education Ltd\Apps\Resources"
git init
git add .
git commit -m "Initial commit - Curriculum Resources v1.0"
git remote add origin https://github.com/4Sighteducation/vespa-curriculum-resources.git
git branch -M main
git push -u origin main
```

### Step 2: Set Up Knack Scene_1280

In Knack Builder:
1. Navigate to `scene_1280` (CURRICULUM RESOURCES)
2. Ensure `view_3244` exists (can be a simple rich text view)
3. **Important**: The view content doesn't matter - our JavaScript will replace it
4. Save the scene

### Step 3: Update KnackAppLoader in Knack

1. Go to **Settings** → **JavaScript** in Knack Builder
2. Find your KnackAppLoader code
3. Replace it with the updated version from `Homepage/KnackAppLoader(copy).js`
4. **Verify** the `curriculumResources` section is present (lines 1083-1136)
5. Click **Save**

### Step 4: Test on scene_1280

1. Navigate to: `https://vespaacademy.knack.com/vespa-academy#tutor-activities/`
   - This should load the book selection page
2. Click a book (e.g., "ALevel Mindset")
   - Should navigate to activity browser
3. Click an activity
   - Should load activity detail page
4. Test completion tracking:
   - Click "Complete and Continue"
   - Verify progress updates on book selection page
5. Test discussions:
   - Add a comment
   - Verify it appears in the list

## Phase 2: Production Deployment (Replace scene_481)

### Option A: Swap Scene IDs (Recommended)

Once tested, simply update KnackAppLoader:

```javascript
'curriculumResources': {
    scenes: ['scene_481'], // Changed from scene_1280
    views: ['view_3244'], // Or whatever view exists in scene_481
    // ... rest stays the same
}
```

### Option B: Migrate scene_481 Content

1. In Knack Builder, go to scene_481
2. Remove all KSENSE-dependent views
3. Add a single rich text view (will be replaced by our JavaScript)
4. Update KnackAppLoader to use scene_481

## Troubleshooting

### Books Not Loading
**Check:**
- Console for errors
- Knack API credentials in KnackAppLoader
- Object_56 has records with field_1429 (book name) and field_1439 (image)

**Fix:**
```javascript
// In browser console:
const api = new CurriculumAPI({
    knackAppId: '5ee90912c38ae7001510c1a9',
    knackApiKey: '8f733aa5-dd35-4464-8348-64824d1f5f0d'
});
await api.getBooks(); // Should return 3 books
```

### Activities Not Showing
**Check:**
- sessionStorage has 'currentBook' set
- Object_58 has activities for that book name
- Field mappings are correct

**Fix:**
```javascript
// Check session storage
console.log(sessionStorage.getItem('currentBook'));

// Test API
const api = new CurriculumAPI({...});
await api.getActivities('ALevel Mindset'); // Should return activities
```

### Completion Not Saving
**Check:**
- User is logged in
- User ID is available via `Knack.getUserAttributes()`
- Object_59 accepts records from this user

**Fix:**
```javascript
// Check user
console.log(Knack.getUserAttributes());

// Test completion
const api = new CurriculumAPI({...});
await api.completeActivity('ACTIVITY_ID', 'ALevel Mindset');
```

### Discussions Not Loading
**Check:**
- Object_60 exists and is accessible
- Field_1444 (activity connection) is a connection field
- Field_1445 (tutor connection) is a connection field

## Performance Optimization

### Caching
The system caches data for 5 minutes. To clear cache:
```javascript
const api = new CurriculumAPI({...});
api.clearCache();
```

### Preloading
For faster navigation, the system preloads:
- All activities for selected book (Page 2)
- User's completion status (Page 1)

## Updating the System

### Update JavaScript/CSS
1. Make changes in `src/` folder
2. Copy changes to `dist/` folder
3. Commit and push to GitHub
4. jsDelivr CDN auto-updates within 12 hours
5. For immediate update, use purge: `https://purge.jsdelivr.net/gh/4Sighteducation/vespa-curriculum-resources@main/dist/curriculum-main.js`

### Update KnackAppLoader
Changes to configuration require manual update in Knack Builder JavaScript settings.

## Rollback Plan

If issues occur:

### Emergency Rollback
1. In KnackAppLoader, comment out the `curriculumResources` section
2. KSENSE system will take over again
3. Investigate issues, fix, redeploy

### Gradual Rollback
1. Change scene from `scene_481` back to `scene_1280`
2. Keep test environment active while fixing
3. Redeploy when ready

## Support

### Debug Mode
Enable debug logging:
```javascript
// In curriculum-main.js, change:
const DEBUG = true; // Line ~308
```

### Console Commands
```javascript
// Check what's loaded
console.log(window.CURRICULUM_RESOURCES_CONFIG);
console.log(window.CurriculumAPI);
console.log(window.CurriculumShared);

// Test API calls
const api = new CurriculumAPI(window.CURRICULUM_RESOURCES_CONFIG);
await api.getBooks();
await api.getActivities('ALevel Mindset');
await api.getUserCompletions();
```

## Next Steps After Deployment

1. **Monitor usage**: Check Knack activity logs
2. **Gather feedback**: Ask staff about new interface
3. **Iterate**: Make improvements based on feedback
4. **Add features**: 
   - Activity ratings
   - Favorite activities
   - Advanced search
   - Export progress reports

