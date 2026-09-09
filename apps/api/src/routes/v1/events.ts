import { Hono } from "hono";
import { EventsController } from "@/controllers/events.controller.js";
import { RequireAdmin } from "@/middleware/AdminAuth.js";

export const EventsRouter = new Hono();

EventsRouter.get("/events", RequireAdmin, EventsController.Info);
EventsRouter.get("/events/stream", RequireAdmin, EventsController.Stream);
