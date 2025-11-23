// src/tools/xhs-publish.ts
import { xhsClient } from "@/lib/xhs-worker";

export const xhsPublishTool = {
    name: "publish_to_xiaohongshu",
    description: "Automated publishing to Xiaohongshu. Use this to post generated videos.",
    parameters: {
        type: "object",
        properties: {
            title: { type: "string" },
            description: { type: "string" },
            video_url: { type: "string" }
        },
        required: ["title", "description", "video_url"]
    },
    // The execute function will be called by the Agent
    execute: async (args: any, context: any) => {
        // 1. Get current user ID from context
        const userId = context.userId || "default_user";

        // 2. Get user's Cookie from context or database
        // Simulation: Assuming Cookie is already in context
        const cookie = context.userConfig?.xhs_cookie;

        if (!cookie) {
            return { success: false, message: "User has not configured Xiaohongshu Cookie." };
        }

        // 3. Call Worker
        try {
            const result = await xhsClient.publish({
                userId: userId,
                cookie: cookie,
                videoUrl: args.video_url,
                title: args.title,
                desc: args.description
            });
            return { success: true, data: result };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }
};
