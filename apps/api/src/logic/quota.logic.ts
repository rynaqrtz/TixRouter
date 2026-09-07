import { getQuotaSummaryDB } from "@tixrouter/db";
import type { QuotaResponse } from "@tixrouter/types";

export class QuotaLogic {
    public static async getQuotaInfo(): Promise<QuotaResponse> {
        return await getQuotaSummaryDB();
    }
}
