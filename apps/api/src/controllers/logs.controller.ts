import type { Context } from "hono";
import { setLogFeedbackDB } from "@tixrouter/db";
import { LogsLogic } from "@/logic/logs.logic.js";
import { Err, Ok } from "@/utils/response.js";

export class LogsController {
    public static ListLogs(c: Context): Response {
        const limit = Number(c.req.query("limit")) || 50;
        return Ok(c, {
            object: "list",
            data: LogsLogic.getRecentLogs(limit)
        });
    }

    public static GetStats(c: Context): Response {
        return Ok(c, LogsLogic.getUsageStats());
    }

    public static GetAnalytics(c: Context): Response {
        const days = Math.min(90, Math.max(1, Number(c.req.query("days")) || 14));
        return Ok(c, LogsLogic.getAnalytics(days));
    }

    public static GetRoutingStats(c: Context): Response {
        return Ok(c, LogsLogic.getRoutingStats());
    }

    public static async PostFeedback(c: Context): Promise<Response> {
        const logId = c.req.param("id");
        const body = await c.req.json().catch(() => null) as { feedback?: unknown } | null;
        const feedback = typeof body?.feedback === "string" ? body.feedback.trim() : "";
        if (!feedback) return Err(c, "Field 'feedback' is required", 400);
        setLogFeedbackDB(logId, feedback.slice(0, 200));
        return Ok(c, { message: "Feedback recorded" });
    }
}
