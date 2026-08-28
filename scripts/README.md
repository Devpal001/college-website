# Image Migration Scripts

These scripts help you migrate images from your existing college website to the new React application.

## 🚀 Quick Start

### Step 1: Extract Image URLs
```bash
node scripts/extract-image-urls.js https://your-old-college-website.com
```
This will:
- Scan your old website for all image URLs
- Save them to `image-urls.txt`
- Display all found URLs in the console

### Step 2: Review and Filter URLs
Open `image-urls.txt` and:
- Remove URLs you don't need
- Keep only the images you want to migrate
- Organize them by category if needed

### Step 3: Download Images
```bash
node scripts/download-images.js
```
This will:
- Download all images from the URLs
- Save them to `src/assets/gallery/`
- Skip already downloaded files

## 📁 File Organization

After downloading, organize your images:
```
src/assets/gallery/
├── campus/
├── events/
├── labs/
├── sports/
└── cultural/
```

## ⚠️ Important Notes

1. **Copyright**: Ensure you have rights to use these images
2. **File Size**: Large images may slow down your site
3. **Optimization**: Consider compressing images after download
4. **Testing**: Test images after migration for quality

## 🔧 Customization

### Modify Download Script
Edit `scripts/download-images.js` to:
- Change output directory
- Add image optimization
- Filter by file type
- Add progress indicators

### Modify Extract Script
Edit `scripts/extract-image-urls.js` to:
- Filter by image size
- Extract from multiple pages
- Parse different HTML structures
- Add authentication if needed

## 🛠️ Alternative Tools

For more complex migrations, consider:
- **Puppeteer**: For JavaScript-heavy websites
- **Selenium**: For interactive elements
- **wget**: Command-line downloading
- **curl**: Simple URL fetching

## 📋 Example Workflow

```bash
# 1. Extract URLs from old website
node scripts/extract-image-urls.js https://old-mbscet.edu

# 2. Review and edit image-urls.txt
# Remove unwanted URLs, organize by category

# 3. Download images
node scripts/download-images.js

# 4. Organize images into folders
# Move images to appropriate category folders

# 5. Update gallery data
# Edit src/data/gallery.js with correct paths

# 6. Test the gallery
# Navigate to /gallery in your app
```