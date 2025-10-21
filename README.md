# VESPA Curriculum Resources

A complete replacement for KSENSE's curriculum delivery system. This provides staff with access to 120+ VESPA activities across 3 books.

## Architecture

### Data Sources (Knack Objects)
- **Object_56**: Books (3 books with images)
- **Object_57**: Activity Groups (monthly curriculum)
- **Object_58**: Activities (120+ resources)
- **Object_59**: Completion Tracking
- **Object_60**: Discussions/Comments

### Pages
1. **Book Selection** (`page1-enhancer.js`) - Choose from 3 books
2. **Activity Browser** (`page2-browser.js`) - Browse activities with filters
3. **Activity Viewer** (`page3-viewer.js`) - View activity + complete + discuss

## Deployment

### Test Environment
- Scene: `scene_1280`
- View: `view_3244`

### Production (After Testing)
- Scene: `scene_481` (replaces KSENSE)

## Files

### Source Files (`src/`)
- `page1-enhancer.js` - Enhanced book selection (builds on resourcesFix_v6.js)
- `page2-browser.js` - Vue 3 activity browser
- `page3-viewer.js` - Vue 3 activity viewer with discussions
- `curriculum-shared.js` - Shared utilities
- `curriculum-api.js` - Knack API integration
- `styles/*.css` - Styling for all pages

### Distribution (`dist/`)
Built files ready for CDN deployment via jsDelivr.

## Usage

Add to KnackAppLoader:
```javascript
'curriculumResources': {
    scenes: ['scene_1280'], // Test scene
    views: ['view_3244'],
    scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/vespa-curriculum-resources@main/dist/curriculum-main.js',
    cssUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/vespa-curriculum-resources@main/dist/curriculum-main.css',
    ...
}
```

## Development Status
- [x] Repository structure
- [ ] Shared utilities
- [ ] Page 1 enhancer
- [ ] Page 2 browser
- [ ] Page 3 viewer
- [ ] CSS styling
- [ ] KnackAppLoader integration
- [ ] Testing & deployment docs

