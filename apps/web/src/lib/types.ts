import type { CreateAPIKeyZod, CreateProviderZod } from "@rynarouter/types";

// Response envelopes used by the API
export interface ListResponse<T> {
    object: "list";
    data: T[];
}

export type { CreateAPIKeyZod, CreateProviderZod };
