import { getQuotaSummaryDB } from "@rynarouter/db";
import type { QuotaResponse } from "@rynarouter/types";

export class QuotaLogic {
    public static async getQuotaInfo(): Promise<QuotaResponse> {
        return await getQuotaSummaryDB();
    }
}
