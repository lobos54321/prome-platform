// src/lib/xhs-worker.ts

interface PublishPayload {
    userId: string;
    cookie: string;
    publishType: "video" | "image";
    videoUrl?: string; // Backward compatibility
    files?: string[]; // List of URLs
    title: string;
    desc: string;
    proxyUrl?: string;
    userAgent?: string;
}

interface LoginPayload {
    userId: string;
    proxyUrl?: string;
    userAgent?: string;
}

export class XhsWorkerClient {
    private baseUrl: string;
    private secret: string;

    constructor() {
        const url = import.meta.env.VITE_XHS_WORKER_URL || "";
        this.baseUrl = url.replace(/\/$/, ""); // Remove trailing slash
        this.secret = import.meta.env.VITE_XHS_WORKER_SECRET || "";

        if (!this.baseUrl) console.warn("⚠️ XHS_WORKER_URL not set!");
    }

    private get headers() {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.secret}`,
        };
    }

    async publish(payload: PublishPayload) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/publish`, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({
                    user_id: payload.userId,
                    cookies: payload.cookie,
                    publish_type: payload.publishType,
                    video_url: payload.videoUrl,
                    files: payload.files,
                    title: payload.title,
                    desc: payload.desc,
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
            console.error("Failed to call XHS Worker:", error);
            throw error;
        }
    }

    async getLoginQRCode(payload: LoginPayload) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/login/qrcode`, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({
                    user_id: payload.userId,
                    proxy_url: payload.proxyUrl,
                    user_agent: payload.userAgent,
                }),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json(); // Returns { status: "waiting_scan", qr_image: "base64..." }
        } catch (error) {
            console.error("Failed to get QR Code:", error);
            throw error;
        }
    }

    async checkLoginStatus(userId: string) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/login/status/${userId}`, {
                method: "GET",
                headers: this.headers,
            });

            // Handle 404 - session not found (expired or doesn't exist)
            if (res.status === 404) {
                console.log(`⚠️ Session ${userId} not found on worker (404)`);
                return {
                    status: "not_found",
                    message: "Session 已过期或不存在"
                };
            }

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json(); // Returns { status: "success" | "waiting" }
        } catch (error) {
            console.error("Failed to check login status:", error);
            throw error;
        }
    }

    async closeSession(userId: string) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/login/close/${userId}`, {
                method: "POST",
                headers: this.headers,
            });

            // Ignore 404 - session might already be closed
            if (res.status === 404) {
                console.log(`⚠️ Session ${userId} already closed or not found`);
                return { status: "not_found" };
            }

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Worker Error (${res.status}): ${err}`);
            }

            return await res.json();
        } catch (error) {
            console.error("Failed to close session:", error);
            throw error;
        }
    }

    async syncCookies(userId: string, cookies: any[], ua: string) {
        try {
            const res = await fetch(`${this.baseUrl}/api/v1/login/sync`, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify({
                    user_id: userId,
                    cookies: cookies,
                    ua: ua
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
}

export const xhsClient = new XhsWorkerClient();
