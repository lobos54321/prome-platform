// src/lib/xhs-worker.ts

interface PublishPayload {
    userId: string;
    cookie: string;
    videoUrl: string;
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
                    video_url: payload.videoUrl,
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
}

export const xhsClient = new XhsWorkerClient();
