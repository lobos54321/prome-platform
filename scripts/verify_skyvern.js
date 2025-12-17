import 'dotenv/config';

async function verifySkyvern() {
    const apiKey = process.env.SKYVERN_API_KEY;
    // Default to the user's likely Zeabur URL, but prefer env var
    const baseUrl = process.env.SKYVERN_URL || 'https://skyvern-service.zeabur.app';

    console.log(`\n🚀 Starting Skyvern Verification...`);
    console.log(`Target URL: ${baseUrl}`);

    if (!apiKey) {
        console.warn("⚠️  Warning: SKYVERN_API_KEY not found in process.env.");
        console.warn("   Some endpoints (like creating tasks) require authentication.");
    } else {
        console.log("🔑 API Key found (ends with ...", apiKey.slice(-4), ")");
    }

    try {
        // 1. Health Check
        const pathsToCheck = ['/health', '/api/v1/health', '/api/health', '/'];
        let connected = false;

        for (const path of pathsToCheck) {
            const fullUrl = `${baseUrl}${path}`;
            console.log(`\n1️⃣  Pinging ${fullUrl}...`);

            try {
                const res = await fetch(fullUrl);
                if (res.ok) {
                    console.log(`✅ Success! Found Skyvern at ${path}`);
                    connected = true;
                    const text = await res.text();
                    console.log("   Response:", text.slice(0, 100).replace(/\n/g, ' '));
                    break;
                } else {
                    console.log(`   Returns ${res.status} ${res.statusText}`);
                }
            } catch (e) {
                console.log(`   Connection failed: ${e.message}`);
            }
        }

        if (!connected) {
            console.error(`\n❌ Service Unreachable on all attempted paths.`);
            console.error("   Please check your SKYVERN_URL in .env and ensure the Zeabur service is running.");
            return;
        }

        // 2. API Key Verification (List Tasks)
        if (apiKey) {
            const tasksUrl = `${baseUrl}/api/v1/tasks`;
            console.log(`\n2️⃣  Verifying API Key via POST /api/v1/tasks (Dry Run)...`);

            // Use a simple task listing or a dummy create to check auth.
            // Usually, GET /api/v1/tasks works to list tasks.
            const taskRes = await fetch(tasksUrl, {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey
                }
            });

            if (taskRes.ok) {
                console.log("✅ API Key is Valid! Successfully accessed Task API.");
                const data = await taskRes.json();
                console.log(`   Found ${Array.isArray(data) ? data.length : '?'} existing tasks.`);
            } else {
                console.error(`❌ API Key Verification Failed: ${taskRes.status} ${taskRes.statusText}`);
                const err = await taskRes.text();
                console.error("   Error details:", err);
                console.error("   Double check your SKYVERN_API_KEY in .env.");
            }
        } else {
            console.log("ℹ️  Skipping API Key verification.");
        }

    } catch (error) {
        console.error(`❌ Network/Script Error: ${error.message}`);
        if (error.cause) console.error(error.cause);
    }
}

verifySkyvern();
