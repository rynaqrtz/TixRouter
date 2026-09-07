import type { ModelObject } from "@tixrouter/types";
import { getAllCustomModelsDB, getAllFallbackRulesDB } from "@tixrouter/db";
import { providerAlias, providerBaseId } from "@tixrouter/constants";
import { getModelLimits } from "@tixrouter/pricing";
import { registry } from "@/services/registry.js";

export class ModelsLogic {
    public static async GetAllModels(
        Provider?: string,
        ForceRefresh = false
    ): Promise<ModelObject[]> {
        const Models = await registry.listAllModels(Provider, ForceRefresh);
        const Enriched = Models.map((M) => ({ ...M, ...getModelLimits(M.id) }));
        return this.MergeComboModels(this.MergeCustomModels(Enriched, Provider));
    }

    private static MergeComboModels(Models: ModelObject[]): ModelObject[] {
        const Rules = getAllFallbackRulesDB().filter((Rule) => Rule.enabled);
        if (Rules.length === 0) return Models;

        const Merged = new Map<string, ModelObject>();

        for (const Model of Models) {
            Merged.set(Model.id.toLowerCase(), Model);
        }

        const ComboModels = new Set<string>();

        for (const Rule of Rules) {
            const SourceModel = Rule.sourceModel.trim();

            if (!SourceModel || SourceModel === "*" || SourceModel.endsWith("/*")) {
                continue;
            }

            ComboModels.add(SourceModel);
        }

        for (const ComboModel of ComboModels) {
            const VirtualModelId = ComboModel.startsWith("tixrouter/")
                ? ComboModel
                : `tixrouter/${ComboModel}`;

            Merged.set(ComboModel.toLowerCase(), {
                id: VirtualModelId,
                object: "model",
                owned_by: "tixrouter",
                custom: true
            });
        }

        return Array.from(Merged.values());
    }

    private static MergeCustomModels(
        Models: ModelObject[],
        ProviderFilter?: string
    ): ModelObject[] {
        const Rows = getAllCustomModelsDB();
        if (Rows.length === 0) return Models;

        const Merged = new Map<string, ModelObject>();
        for (const M of Models) {
            Merged.set(M.id.toLowerCase(), M);
        }
        for (const Row of Rows) {
            const Alias = providerAlias(providerBaseId(Row.providerId));
            const Id = `${Alias}/${Row.modelId}`;
            if (ProviderFilter && !Alias.toLowerCase().startsWith(ProviderFilter.toLowerCase())) {
                continue;
            }
            Merged.set(Id.toLowerCase(), {
                id: Id,
                object: "model",
                owned_by: Alias,
                custom: true
            });
        }
        return Array.from(Merged.values());
    }

    public static async GetModelById(
        ModelId: string,
        ForceRefresh = false
    ): Promise<ModelObject | undefined> {
        if (!ModelId) return undefined;
        const Models = await registry.listAllModels(undefined, ForceRefresh);
        const CleanId = ModelId.replace(/^tixrouter\//, "");

        return Models.find(
            (M) =>
                M.id.replace(/^tixrouter\//, "") === CleanId ||
                M.id.endsWith(`/${CleanId}`) ||
                CleanId.endsWith(`/${M.id}`)
        );
    }

    public static RefreshModels(ForceRefresh = false): Promise<ModelObject[]> {
        return registry.refreshModels(ForceRefresh);
    }

    public static ClearCache(ProviderId?: string): void {
        registry.clearModelsCache(ProviderId);
    }
}
