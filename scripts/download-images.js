/**
 * Image Downloader Script
 * Run this script to download images from your existing college website
 * Usage: node scripts/download-images.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration - UPDATE THESE URLs
const IMAGE_URLS = [
  // Add your existing college website image URLs here
  'https://your-old-website.com/images/campus-building.jpg',
  'https://your-old-website.com/images/library.jpg',
  'https://your-old-website.com/events/graduation.jpg',
  // Add more URLs as needed
];

const OUTPUT_DIR = path.join(__dirname, '../src/assets/gallery');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Download function
function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded: ${path.basename(outputPath)}`);
          resolve();
        });
      } else {
        fs.unlink(outputPath, () => {}); // Delete partial file
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

// Main download function
async function downloadAllImages() {
  console.log('🚀 Starting image download...');
  
  for (const url of IMAGE_URLS) {
    try {
      const fileName = path.basename(url);
      const outputPath = path.join(OUTPUT_DIR, fileName);
      
      // Skip if file already exists
      if (fs.existsSync(outputPath)) {
        console.log(`⏭️  Skipping existing: ${fileName}`);
        continue;
      }
      
      await downloadImage(url, outputPath);
    } catch (error) {
      console.error(`❌ Error downloading ${url}:`, error.message);
    }
  }
  
  console.log('✨ Download complete!');
}

// Run the script
downloadAllImages().catch(console.error);