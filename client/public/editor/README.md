# Grudge Engine - Puter.js Deployment

This folder contains all files needed to deploy Grudge Engine to Puter.js hosting.

## Files Included

- `index.html` - Main entry point with Puter.js CDN
- `favicon.png` - Application icon
- `assets/` - Bundled JavaScript and CSS files
- `deploy-to-puter.html` - One-click deployment helper

## Deployment Options

### Option 1: Manual Upload to Puter.com (Recommended)

1. Go to [puter.com](https://puter.com)
2. Create an account or sign in
3. Upload the entire `Dist` folder
4. Right-click the folder and select "Publish as Website"
5. Your site will be live at `https://yoursite.puter.site`

### Option 2: Use the Deployment Helper

1. Open `deploy-to-puter.html` in your browser
2. Click "Deploy Now"
3. The script will automatically upload all files and create hosting
4. Your live URL will be displayed when complete

### Option 3: Programmatic Deployment

```javascript
// Include Puter.js
<script src="https://js.puter.com/v2/"></script>

// Deploy
const dirName = 'grudge-engine';
await puter.fs.mkdir(dirName);
// Upload all files...
const site = await puter.hosting.create('my-grudge-engine', dirName);
console.log('Live at:', 'https://' + site.subdomain + '.puter.site');
```

## Features

- 3D viewport with Babylon.js
- Transform tools (move, rotate, scale)
- Scene hierarchy management
- Asset browser with folder organization
- Monaco-based script editor
- AI-powered tools via Puter.js
- Cloud storage integration
- Post-processing effects
- Babylon.js Inspector for debugging

## Requirements

- Modern browser with WebGL2 support
- Internet connection for Puter.js CDN and cloud features

## Size

Total bundle size: ~13MB (gzipped: ~3MB)
