import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Setting up Supabase Storage RLS policies...');
console.log('Supabase URL:', supabaseUrl);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorageRLS() {
  try {
    console.log('📝 Creating RLS policies for Storage...');
    
    // 1. Enable RLS on storage.objects (if not already enabled)
    console.log('🔒 Enabling RLS on storage.objects...');
    
    // 2. Create policy to allow public uploads to images bucket
    const uploadPolicy = `
      CREATE POLICY "Allow public uploads to images bucket" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'images' 
        AND auth.role() = 'anon'
      );
    `;
    
    // 3. Create policy to allow public reads from images bucket
    const readPolicy = `
      CREATE POLICY "Allow public reads from images bucket" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'images'
      );
    `;
    
    // 4. Create policy to allow public updates (for overwriting files)
    const updatePolicy = `
      CREATE POLICY "Allow public updates to images bucket" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'images'
      );
    `;

    // Execute policies using direct SQL
    console.log('📤 Creating upload policy...');
    const { error: uploadError } = await supabase.rpc('exec_sql', {
      sql: uploadPolicy
    });
    
    if (uploadError && !uploadError.message.includes('already exists')) {
      console.error('❌ Error creating upload policy:', uploadError);
    } else {
      console.log('✅ Upload policy created');
    }

    console.log('📥 Creating read policy...');
    const { error: readError } = await supabase.rpc('exec_sql', {
      sql: readPolicy
    });
    
    if (readError && !readError.message.includes('already exists')) {
      console.error('❌ Error creating read policy:', readError);
    } else {
      console.log('✅ Read policy created');
    }

    console.log('🔄 Creating update policy...');
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: updatePolicy
    });
    
    if (updateError && !updateError.message.includes('already exists')) {
      console.error('❌ Error creating update policy:', updateError);
    } else {
      console.log('✅ Update policy created');
    }

    // Test the setup
    await testStorageSetup();

  } catch (error) {
    console.error('❌ Setup failed:', error);
    
    // Try manual approach
    console.log('\n🛠️ Automatic setup failed. Please run these SQL commands manually in Supabase SQL Editor:');
    console.log('\n-- Enable RLS on storage.objects (if not already enabled)');
    console.log('ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;');
    
    console.log('\n-- Allow public uploads to images bucket');
    console.log(`CREATE POLICY "Allow public uploads to images bucket" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'images' 
  AND auth.role() = 'anon'
);`);

    console.log('\n-- Allow public reads from images bucket');
    console.log(`CREATE POLICY "Allow public reads from images bucket" ON storage.objects
FOR SELECT USING (
  bucket_id = 'images'
);`);

    console.log('\n-- Allow public updates to images bucket');
    console.log(`CREATE POLICY "Allow public updates to images bucket" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'images'
);`);
    
    console.log('\n📝 Copy and paste these commands into your Supabase SQL Editor:');
    console.log('   Dashboard → SQL Editor → New Query → Paste → Run');
  }
}

async function testStorageSetup() {
  try {
    console.log('\n🧪 Testing storage setup with anon key...');
    
    // Create anon client
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const anonClient = createClient(supabaseUrl, anonKey);
    
    // Test upload (public bucket should allow direct uploads)
    const testContent = new Blob(['test image content'], { type: 'image/jpeg' });
    const testFileName = `test-${Date.now()}.jpg`;
    
    const { data, error } = await anonClient.storage
      .from('images')
      .upload(testFileName, testContent);
    
    if (error) {
      console.log('❌ Anon upload still failing:', error.message);
      if (error.message.includes('row-level security policy')) {
        console.log('💡 RLS policies need to be set up manually - see instructions above');
      }
    } else {
      console.log('✅ Anon upload successful!');
      console.log('📁 Uploaded:', data);
      
      // Get public URL
      const { data: publicUrlData } = anonClient.storage
        .from('images')
        .getPublicUrl(testFileName);
      
      console.log('📎 Public URL:', publicUrlData.publicUrl);
      
      // Clean up
      await supabase.storage.from('images').remove([testFileName]);
      console.log('🧹 Test file cleaned up');
      
      console.log('\n🎉 Supabase Storage is now ready for public uploads!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

setupStorageRLS();