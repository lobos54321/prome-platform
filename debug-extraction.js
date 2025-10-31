// Debug script for image extraction
// Using built-in fetch in Node.js 22+

async function testImageExtraction(url) {
  console.log('🔍 Testing image extraction from:', url);

  try {
    const response = await fetch('http://localhost:8080/api/extract-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url })
    });

    const result = await response.json();
    console.log('📊 Extraction result:', JSON.stringify(result, null, 2));

    if (result.success && result.images && result.images.length > 0) {
      console.log(`✅ Found ${result.images.length} images`);
      result.images.forEach((img, i) => {
        console.log(`  ${i + 1}. ${img}`);
      });
    } else {
      console.log('❌ No images found');
      console.log('Strategy used:', result.strategy);
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test with the problematic eBay URL
const testUrl = 'https://www.ebay.com/itm/144996619784';
testImageExtraction(testUrl);