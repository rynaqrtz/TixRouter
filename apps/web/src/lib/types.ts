import type { CreateAPIKeyZod, CreateProviderZod } from "@tixrouter/types";

// Response envelopes used by the API
export interface ListResponse<T> {
    object: "list";
    data: T[];
}

export type { CreateAPIKeyZod, CreateProviderZod };
