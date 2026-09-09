import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import type { LogEvent } from "@tixrouter/db";
import { AddEventClient } from "@/services/events.js";
import { Ok } from "@/utils/response.js";

export class EventsController {
    public static Stream(c: Context): Response {
        return streamSSE(c, async (stream) => {
            const close = AddEventClient((event: LogEvent) => {
                void stream.writeSSE({
                    event: event.type,
                    data: JSON.stringify(event.log)
                });
            });

            await stream.writeSSE({
                event: "connected",
                data: JSON.stringify({ service: "TixRouter", at: new Date().toISOString() })
            });

            const heartbeat = setInterval(() => {
                void stream.writeSSE({ event: "ping", data: new Date().toISOString() });
            }, 30_000);

            try {
                while (!c.req.raw.signal.aborted) {
                    await stream.sleep(5_000);
                }
            } finally {
                clearInterval(heartbeat);
                close();
            }
        });
    }

    public static Info(c: Context): Response {
        return Ok(c, {
            event: "request.completed",
            transport: "text/event-stream",
            path: "/v1/events/stream"
        });
    }
}
