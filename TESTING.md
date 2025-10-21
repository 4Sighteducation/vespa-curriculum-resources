# VESPA Curriculum Resources - Testing Guide

## Pre-Deployment Checklist

### ✅ Repository Setup
- [ ] Code pushed to GitHub: `vespa-curriculum-resources`
- [ ] All files in `src/` and `dist/` folders
- [ ] README.md is complete
- [ ] No sensitive data in repository

### ✅ Knack Configuration
- [ ] Scene_1280 exists with view_3244
- [ ] View_3244 is accessible (can be blank rich text)
- [ ] All objects (56, 57, 58, 59, 60) have proper permissions
- [ ] API credentials are correct in KnackAppLoader

### ✅ KnackAppLoader Updated
- [ ] `curriculumResources` section added
- [ ] Scene and view IDs correct
- [ ] CDN URLs point to correct repository
- [ ] Config includes all field mappings
- [ ] Saved in Knack Builder JavaScript section

## Test Scenarios

### Test 1: Book Selection Page (Page 1)

**URL**: `https://vespaacademy.knack.com/vespa-academy#tutor-activities/`

**Expected Behavior:**
1. ✅ Page loads within 3 seconds
2. ✅ Three books displayed with images:
   - ALevel Mindset
   - GCSE Mindset
   - VESPA Handbook
3. ✅ Progress percentages shown for each book
4. ✅ Progress bars animate smoothly
5. ✅ Hover effects work on book cards
6. ✅ "Explore Activities" button visible

**Test Actions:**
- [ ] Click on "ALevel Mindset" → Should navigate to activity browser
- [ ] Click on "GCSE Mindset" → Should navigate to activity browser
- [ ] Click on "VESPA Handbook" → Should navigate to activity browser
- [ ] Resize browser window → Books should stack vertically on mobile
- [ ] Check console for errors → No JavaScript errors

**Debug Commands:**
```javascript
// Check API
const api = new CurriculumAPI(window.CURRICULUM_RESOURCES_CONFIG);
const books = await api.getBooks();
console.log('Books:', books);

// Check progress
const progress = await api.calculateProgress('ALevel Mindset');
console.log('Progress:', progress);
```

---

### Test 2: Activity Browser Page (Page 2)

**URL**: After clicking a book from Page 1

**Expected Behavior:**
1. ✅ Activities load and display
2. ✅ Grouped by month (September, October, etc.)
3. ✅ Filters work:
   - Search box filters by name
   - Theme dropdown filters by VESPA category
   - Month dropdown filters by month
4. ✅ "Back to Books" button works
5. ✅ Completed activities show checkmark badge
6. ✅ Activity count updates with filters

**Test Actions:**
- [ ] Type in search box → Activities filter in real-time
- [ ] Select "Vision" theme → Only Vision activities show
- [ ] Select "September" month → Only September activities show
- [ ] Clear all filters → All activities return
- [ ] Click an activity card → Navigate to detail page
- [ ] Click "Back to Books" → Return to book selection
- [ ] Check mobile view → Filters stack vertically

**Debug Commands:**
```javascript
// Check activities loaded
const api = new CurriculumAPI(window.CURRICULUM_RESOURCES_CONFIG);
const activities = await api.getActivities('ALevel Mindset');
console.log('Activities:', activities);
console.log('Count:', activities.length);

// Check session storage
console.log('Current book:', sessionStorage.getItem('currentBook'));
```

---

### Test 3: Activity Viewer Page (Page 3)

**URL**: After clicking an activity from Page 2

**Expected Behavior:**
1. ✅ Activity details load
2. ✅ Breadcrumbs show: Books › BookName › ActivityName
3. ✅ Activity content (iframe) displays
4. ✅ PDF download link appears (if activity has PDF)
5. ✅ "Complete and Continue" button visible (if not completed)
6. ✅ Discussions section loads below
7. ✅ Can add new comment

**Test Actions:**
- [ ] Verify iframe loads correctly
- [ ] Click PDF download → Opens PDF in new tab
- [ ] Click "Complete and Continue" → Activity marked complete
- [ ] Verify completion badge appears
- [ ] Go back to Page 1 → Progress percentage increased
- [ ] Add a discussion comment → Comment appears in list
- [ ] Click "Back to Activities" → Return to browser
- [ ] Click breadcrumb link → Navigate correctly

**Debug Commands:**
```javascript
// Check activity data
const activityId = sessionStorage.getItem('currentActivityId');
console.log('Current activity:', activityId);

const api = new CurriculumAPI(window.CURRICULUM_RESOURCES_CONFIG);
const activities = await api.getActivities();
const current = activities.find(a => a.id === activityId);
console.log('Activity details:', current);

// Check discussions
const discussions = await api.getActivityDiscussions(activityId);
console.log('Discussions:', discussions);
```

---

### Test 4: Completion Tracking (End-to-End)

**Scenario**: Complete an activity and verify progress updates

**Steps:**
1. [ ] Start on Page 1 (Book Selection)
2. [ ] Note the percentage for "ALevel Mindset" (e.g., 5%)
3. [ ] Click "ALevel Mindset"
4. [ ] Select an incomplete activity (no checkmark)
5. [ ] View the activity content
6. [ ] Click "Complete and Continue"
7. [ ] Return to Page 1 (Books)
8. [ ] Verify percentage increased (e.g., 6%)
9. [ ] Return to activity browser
10. [ ] Verify activity now shows checkmark badge

**Expected Result:**
- ✅ Completion saves to Object_59
- ✅ Progress updates immediately
- ✅ Checkmark appears on activity card
- ✅ "Complete" button changes to "You completed this activity"

**Verify in Knack:**
1. Go to Object_59 in Knack Builder
2. Find record for current user
3. Check field_1432 (should contain activity ID in JSON)

---

### Test 5: Discussion System

**Scenario**: Add comments and verify they save/display

**Steps:**
1. [ ] Navigate to any activity detail page
2. [ ] Scroll to "Discussion" section
3. [ ] Type a test comment: "Testing discussion system"
4. [ ] Click "Post Comment"
5. [ ] Verify comment appears in list
6. [ ] Refresh page
7. [ ] Verify comment persists
8. [ ] Log in as different user
9. [ ] Verify comment shows original author name

**Expected Result:**
- ✅ Comment saves to Object_60
- ✅ Author name displays correctly
- ✅ Date displays correctly
- ✅ Comments persist across page refreshes

**Verify in Knack:**
1. Go to Object_60 in Knack Builder
2. Find record with your comment
3. Verify field_1444 (activity connection) is correct
4. Verify field_1445 (tutor connection) is correct

---

### Test 6: Navigation Flow

**Scenario**: Complete navigation journey

**Steps:**
1. [ ] Start: `#tutor-activities/` (Book Selection)
2. [ ] Click book → Goes to `#tutor-activities/tutor-activity-level/`
3. [ ] Click activity → Goes to `#tutor-activities/view-tutor-activity-level-details/[ID]/`
4. [ ] Click "Back to Activities" → Returns to activity list
5. [ ] Click "Back to Books" → Returns to book selection
6. [ ] Use breadcrumbs → Navigation works
7. [ ] Use browser back button → Navigation works
8. [ ] Use browser forward button → Navigation works

**Expected Result:**
- ✅ All navigation is smooth
- ✅ No page reloads
- ✅ Session storage maintains state
- ✅ URLs update correctly

---

### Test 7: Mobile Responsiveness

**Devices to Test:**
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

**Expected Behavior:**
- ✅ All pages stack correctly on mobile
- ✅ Touch targets are large enough
- ✅ Text is readable
- ✅ No horizontal scrolling
- ✅ Images scale appropriately
- ✅ Buttons are thumb-friendly

**Use Chrome DevTools:**
1. Press F12
2. Click device toolbar icon
3. Test each breakpoint

---

### Test 8: Error Handling

**Scenario 1: No Internet**
1. Disable network in DevTools
2. Try loading a page
3. **Expected**: Error message with retry button

**Scenario 2: Invalid Activity ID**
1. Navigate to: `#tutor-activities/view-tutor-activity-level-details/INVALID/`
2. **Expected**: Error message, redirect to book selection

**Scenario 3: Not Logged In**
1. Log out
2. Try accessing curriculum
3. **Expected**: Redirect to login

---

## Performance Benchmarks

| Page | Target Load Time | Acceptable |
|------|-----------------|------------|
| Book Selection | < 2 seconds | < 3 seconds |
| Activity Browser | < 2 seconds | < 4 seconds |
| Activity Viewer | < 3 seconds | < 5 seconds |

**Measure with:**
```javascript
// In browser console
performance.mark('start');
// ... wait for page load ...
performance.mark('end');
performance.measure('pageLoad', 'start', 'end');
console.log(performance.getEntriesByName('pageLoad')[0].duration);
```

---

## Common Issues & Fixes

### Issue: "CurriculumAPI is not defined"
**Cause**: Script loaded before API definition  
**Fix**: Ensure `curriculum-main.js` loads completely before initializing

### Issue: Progress shows 0% but activities are completed
**Cause**: Book name mismatch in Object_59  
**Fix**: Check field_1432 JSON - book names must match exactly (case-sensitive)

### Issue: Activities not filtering by book
**Cause**: field_2702 values don't match book names  
**Fix**: Verify Object_58 records have correct book names in field_2702

### Issue: Discussions not appearing
**Cause**: Object_60 connection fields not set correctly  
**Fix**: Ensure field_1444 connects to Object_58 and field_1445 connects to Object_7

---

## Post-Deployment Verification

### 24 Hours After Launch
- [ ] Check Knack activity logs for errors
- [ ] Review completion rates (Object_59 record count)
- [ ] Check discussion engagement (Object_60 record count)
- [ ] Monitor page load times
- [ ] Gather user feedback

### 1 Week After Launch
- [ ] Compare usage vs. old KSENSE system
- [ ] Identify most popular activities
- [ ] Note any performance issues
- [ ] Plan improvements

---

## Emergency Rollback

If critical issues occur:

### Quick Rollback (5 minutes)
1. Open Knack Builder JavaScript settings
2. Find `curriculumResources` section in KnackAppLoader
3. Comment it out:
```javascript
/*
'curriculumResources': {
    ...
}
*/
```
4. Save
5. KSENSE system takes over immediately

### Full Rollback
1. Revert KnackAppLoader to previous version
2. Keep scene_1280 for continued development
3. Fix issues
4. Redeploy when ready

---

## Success Criteria

System is ready for production when:
- ✅ All 8 test scenarios pass
- ✅ No console errors during normal use
- ✅ Performance meets benchmarks
- ✅ Mobile experience is smooth
- ✅ Completion tracking works 100%
- ✅ Discussions save and display correctly
- ✅ Navigation is intuitive
- ✅ You feel confident it's better than KSENSE!

---

## Questions or Issues?

Check console logs and use debug commands above. The system is designed to be self-sufficient and fully under your control.

