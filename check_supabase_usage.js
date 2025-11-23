
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfjslsygnitdgdnfboiy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmanNsc3lnbml0ZGdkbmZib2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODI5NjksImV4cCI6MjA2ODc1ODk2OX0.VpgSYmwW6mJ0iSaART16Ptb96zACJVJIdlskwBmIRsM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
    console.log('🔍 Checking Supabase Storage Usage...');

    try {
        // 1. List all buckets
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

        if (bucketsError) {
            console.error('❌ Error listing buckets:', bucketsError);
        } else {
            console.log(`Found ${buckets.length} buckets.`);

            let totalSize = 0;
            let totalFiles = 0;

            for (const bucket of buckets) {
                console.log(`\n📂 Bucket: ${bucket.name} (Public: ${bucket.public})`);

                // List files in bucket (limit 100 for now)
                const { data: files, error: filesError } = await supabase.storage
                    .from(bucket.name)
                    .list('', { limit: 100, offset: 0 });

                if (filesError) {
                    console.error(`  ❌ Error listing files in ${bucket.name}:`, filesError);
                    continue;
                }

                if (!files || files.length === 0) {
                    console.log('  (Empty)');
                    continue;
                }

                let bucketSize = 0;
                files.forEach(file => {
                    // Skip folders (placeholders)
                    if (!file.id) return;

                    const size = file.metadata ? file.metadata.size : 0;
                    bucketSize += size;
                    console.log(`  - ${file.name}: ${(size / 1024 / 1024).toFixed(2)} MB`);
                });

                console.log(`  📊 Bucket Total: ${(bucketSize / 1024 / 1024).toFixed(2)} MB`);
                totalSize += bucketSize;
                totalFiles += files.length;
            }

            console.log('\n==========================================');
            console.log(`📉 Total Storage Usage: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`📄 Total Files: ${totalFiles}`);
            console.log('==========================================');
        }

        console.log('\n🔍 Checking Database Row Counts (Estimate)...');
        const tables = ['users', 'chat_messages', 'chat_conversations', 'xhs_activity_logs', 'xhs_content_strategies', 'digital_human_videos'];

        for (const table of tables) {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (error) {
                console.log(`  ❌ ${table}: Error (${error.message}) - Likely RLS restricted`);
            } else {
                console.log(`  📊 ${table}: ${count} rows`);
            }
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkStorage();
