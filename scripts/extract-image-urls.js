/**
 * Image URL Extractor
 * Extract all image URLs from your existing college website
 * Usage: node scripts/extract-image-urls.js https://your-old-website.com
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

async function extractImageUrls(websiteUrl) {
  return new Promise((resolve, reject) => {
    const protocol = websiteUrl.startsWith('https') ? https : http;
    
    console.log(`🔍 Extracting images from: ${websiteUrl}`);
    
    protocol.get(websiteUrl, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        // Extract image URLs using regex
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        const bgRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
        
        const imgUrls = [];
        let match;
        
        // Extract <img> src attributes
        while ((match = imgRegex.exec(data)) !== null) {
          let url = match[1];
          // Convert relative URLs to absolute
          if (url.startsWith('/')) {
            const urlObj = new URL(websiteUrl);
            url = `${urlObj.protocol}//${urlObj.host}${url}`;
          } else if (!url.startsWith('http')) {
            const urlObj = new URL(websiteUrl);
            url = `${urlObj.protocol}//${urlObj.host}/${url}`;
          }
          imgUrls.push(url);
        }
        
        // Extract background images
        while ((match = bgRegex.exec(data)) !== null) {
          let url = match[1];
          if (url.startsWith('/')) {
            const urlObj = new URL(websiteUrl);
            url = `${urlObj.protocol}//${urlObj.host}${url}`;
          } else if (!url.startsWith('http')) {
            const urlObj = new URL(websiteUrl);
            url = `${urlObj.protocol}//${urlObj.host}/${url}`;
          }
          imgUrls.push(url);
        }
        
        // Remove duplicates
        const uniqueUrls = [...new Set(imgUrls)];
        
        console.log(`✅ Found ${uniqueUrls.length} unique image URLs`);
        
        // Save to file
        const outputFile = 'image-urls.txt';
        fs.writeFileSync(outputFile, uniqueUrls.join('\n'));
        console.log(`📝 Saved URLs to: ${outputFile}`);
        
        resolve(uniqueUrls);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Get URL from command line argument
const websiteUrl = process.argv[2];
if (!websiteUrl) {
  console.error('❌ Please provide a website URL');
  console.log('Usage: node scripts/extract-image-urls.js https://your-website.com');
  process.exit(1);
}

extractImageUrls(websiteUrl)
  .then(urls => {
    console.log('\n🔗 Image URLs:');
    urls.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });