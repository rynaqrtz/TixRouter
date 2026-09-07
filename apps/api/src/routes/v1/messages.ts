import { Hono } from "hono";
import { AnthropicMessageRequestSchema } from "@rynarouter/types";
import { MessagesController } from "@/controllers/messages.controller.js";
import { ApiKeyAuth } from "@/middleware/ApiKeyAuth.js";
import { EnforceRateLimit } from "@/middleware/RateLimit.js";
import { ValidateJson } from "@/middleware/Validation.js";
import { EnforceModelAccess } from "@/middleware/ModelAccess.js";

export const MessagesRouter = new Hono();

MessagesRouter.post(
    "/messages",
    ApiKeyAuth,
    EnforceRateLimit,
    ValidateJson(AnthropicMessageRequestSchema),
    EnforceModelAccess(),
    MessagesController.CreateMessage
);
