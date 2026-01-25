// src/lib/twitter-worker.ts

interface PublishPayload {
    userId: string;
    cookies: string;
    text: string;
    mediaUrls?: string[];
    proxyUrl?: string;
    userAgent?: string;
}

interface ThreadPayload {
    userId: string;
    cookies: string;
    tweets: Array<{ text: string; mediaUrls?: string[] }>;
    proxyUrl?: string;
    userAgent?: string;
}

interface LoginPayload {
    userId: string;
    username: string;
    password: string;
    proxyUrl?: string;
    userAgent?: string;
}

interface CookieSyncPayload {
    userId: string;
    cookies: any[];
    userAgent?: string;
}

export class TwitterWorkerClient {
    private baseUrl: string;
    private secret: string;

    constructor() {
        // Twitter API is in xhs-worker, use VITE_XHS_WORKER_URL (not VITE_XHS_API_URL which is AI service)
        const url = import.meta.env.VITE_XHS_WORKER_URL || "";
        this.baseUrl = url.replace(/\/$/, ""); // Remove trailing slash
        this.secret = import.meta.env.VITE_XHS_WORKER_SECRET || "";

        console.log("[TwitterWorkerClient] baseUrl:", this.baseUrl);
        console.log("[TwitterWorkerClient] secret set:", !!this.secret);

        if (!this.baseUrl) console.warn("⚠️ VITE_XHS_WORKER_URL not set!");
    }

    private get headers() {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.secret}`,
        };
    }

    /**
     * Publish a single tweet
     */
    async publish(payload: PublishPayload) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/twitter/publish`, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({
                    user_id: payload.userId,
                    cookies: payload.cookies,
                    text: payload.text,
                    media_urls: payload.mediaUrls,
                    proxy_url: payload.proxyUrl,
                    user_agent: payload.userAgent,
                }),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json();
        } catch (error) {
            console.error("Failed to call Twitter Worker:", error);
            throw error;
        }
    }

    /**
     * Publish a Twitter thread (multiple tweets)
     */
    async publishThread(payload: ThreadPayload) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/twitter/publish/thread`, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({
                    user_id: payload.userId,
                    cookies: payload.cookies,
                    tweets: payload.tweets.map(t => ({
                        text: t.text,
                        media_urls: t.mediaUrls,
                    })),
                    proxy_url: payload.proxyUrl,
                    user_agent: payload.userAgent,
                }),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json();
        } catch (error) {
            console.error("Failed to publish thread:", error);
            throw error;
        }
    }

    /**
     * Login with username and password
     */
    async login(payload: LoginPayload) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/twitter/login`, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({
                    user_id: payload.userId,
                    username: payload.username,
                    password: payload.password,
                    proxy_url: payload.proxyUrl,
                    user_agent: payload.userAgent,
                }),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json();
        } catch (error) {
            console.error("Failed to login:", error);
            throw error;
        }
    }

    /**
     * Sync cookies from browser extension
     */
    async syncCookies(payload: CookieSyncPayload) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/twitter/login/sync`, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({
                    user_id: payload.userId,
                    cookies: payload.cookies,
                    user_agent: payload.userAgent,
                }),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json();
        } catch (error) {
            console.error("Failed to sync cookies:", error);
            throw error;
        }
    }

    /**
     * Check login status
     */
    async checkLoginStatus(userId: string) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/twitter/login/status/${userId}`, {
                method: "GET",
                headers: this.headers,
            });

            if (res.status === 404) {
                return {
                    status: "not_found",
                    logged_in: false,
                    message: "Session 已过期或不存在"
                };
            }

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json();
        } catch (error) {
            console.error("Failed to check login status:", error);
            throw error;
        }
    }

    /**
     * Check login status from web frontend
     */
    async checkWebLogin(userId: string) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/twitter/login/check-web/${userId}`, {
                method: "GET",
                headers: this.headers,
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json();
        } catch (error) {
            console.error("Failed to check web login:", error);
            throw error;
        }
    }

    /**
     * Get publish task status
     */
    async getPublishStatus(taskId: string) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/twitter/publish/status/${taskId}`, {
                method: "GET",
                headers: this.headers,
            });

            if (res.status === 404) {
                return { status: "not_found" };
            }

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json();
        } catch (error) {
            console.error("Failed to get publish status:", error);
            throw error;
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const res = await fetch(`${this.baseUrl}/health`, {
                method: "GET",
                headers: this.headers,
            });

            if (!res.ok) {
                return { status: "unhealthy", error: `HTTP ${res.status}` };
            }

            return await res.json();
        } catch (error) {
            return { status: "unhealthy", error: String(error) };
        }
    }
}

export const twitterClient = new TwitterWorkerClient();
