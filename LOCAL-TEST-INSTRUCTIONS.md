# LOCAL TESTING (Before GitHub Push)

## Problem
The CDN URLs in KnackAppLoader won't work until files are pushed to GitHub.

## Solution: Test Locally First

### Option 1: Manual Script Injection (Fastest - 2 minutes)

1. Navigate to scene_1280 in your Knack app
2. Open browser console (F12)
3. Copy and paste these commands:

```javascript
// Load the main JavaScript
const script = document.createElement('script');
script.src = 'file:///C:/Users/tonyd/OneDrive%20-%204Sight%20Education%20Ltd/Apps/Resources/dist/curriculum-main.js';
// OR use the content directly:
fetch('file:///C:/Users/tonyd/OneDrive%20-%204Sight%20Education%20Ltd/Apps/Resources/dist/curriculum-main.js')
    .then(r => r.text())
    .then(code => {
        eval(code);
        console.log('Curriculum loaded locally');
    });

// Load the CSS
const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = 'file:///C:/Users/tonyd/OneDrive%20-%204Sight%20Education%20Ltd/Apps/Resources/dist/curriculum-main.css';
document.head.appendChild(css);
```

**NOTE**: File:// URLs may be blocked by browser. Use Option 2 instead.

### Option 2: Temporary Knack Page (Recommended - 5 minutes)

1. Go to Knack Builder → Pages → scene_1280
2. Click **JavaScript** tab
3. Paste the ENTIRE contents of `dist/curriculum-main.js`
4. Click **CSS** tab  
5. Paste the ENTIRE contents of `dist/curriculum-main.css`
6. Save

This lets you test without GitHub! Once working, move to GitHub.

### Option 3: GitHub Pages Hosting (10 minutes)

Create a test HTML file to serve locally:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Curriculum Test</title>
    <link rel="stylesheet" href="./dist/curriculum-main.css">
</head>
<body>
    <div id="test-container"></div>
    <script src="./dist/curriculum-main.js"></script>
    <script>
        // Test initialization
        window.CURRICULUM_RESOURCES_CONFIG = {
            knackAppId: '5ee90912c38ae7001510c1a9',
            knackApiKey: '8f733aa5-dd35-4464-8348-64824d1f5f0d',
            sceneKey: 'scene_1280',
            viewKey: 'view_3244'
        };
        
        setTimeout(() => {
            if (typeof initializeCurriculumResources === 'function') {
                initializeCurriculumResources();
            }
        }, 1000);
    </script>
</body>
</html>
```

Save as `test-local.html` and open in browser.


