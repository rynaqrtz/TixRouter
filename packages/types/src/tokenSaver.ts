import { z } from "zod";

export interface CompressToolOutputSettings {
    enabled: boolean;
    compressGit: boolean;
    compressGrep: boolean;
    compressFileLists: boolean;
    compressLogs: boolean;
    stripAnsiAndWhitespace: boolean;
    minCharacterThreshold: number;
}

export interface LazySeniorDevSettings {
    enabled: boolean;
    mode: "balanced" | "strict";
    customInstructions?: string;
}

export interface CompressLlmOutputSettings {
    enabled: boolean;
    mode: "terse" | "ultra_terse";
    stripPleasantries: boolean;
    customPrompt?: string;
}

export interface TrimMessagesSettings {
    enabled: boolean;
    maxInputTokens: number;
    preserveTailMessages: number;
}

export interface TokenSaverSettings {
    enabled: boolean;
    compressToolOutput: CompressToolOutputSettings;
    lazySeniorDev: LazySeniorDevSettings;
    compressLlmOutput: CompressLlmOutputSettings;
    trimMessages: TrimMessagesSettings;
}

export const CompressToolOutputSchema = z.object({
    enabled: z.boolean(),
    compressGit: z.boolean(),
    compressGrep: z.boolean(),
    compressFileLists: z.boolean(),
    compressLogs: z.boolean(),
    stripAnsiAndWhitespace: z.boolean(),
    minCharacterThreshold: z.number().min(0).default(50)
});

export const LazySeniorDevSchema = z.object({
    enabled: z.boolean(),
    mode: z.enum(["balanced", "strict"]),
    customInstructions: z.string().optional()
});

export const CompressLlmOutputSchema = z.object({
    enabled: z.boolean(),
    mode: z.enum(["terse", "ultra_terse"]),
    stripPleasantries: z.boolean(),
    customPrompt: z.string().optional()
});

export const TrimMessagesSchema = z.object({
    enabled: z.boolean(),
    maxInputTokens: z.number().int().min(256).default(8192),
    preserveTailMessages: z.number().int().min(1).max(20).default(4)
});

export const TokenSaverSettingsSchema = z.object({
    enabled: z.boolean(),
    compressToolOutput: CompressToolOutputSchema,
    lazySeniorDev: LazySeniorDevSchema,
    compressLlmOutput: CompressLlmOutputSchema,
    trimMessages: TrimMessagesSchema
});

export interface TokenSaverPreviewRequest {
    type: "tool_output" | "prompt";
    text: string;
    settings?: Partial<TokenSaverSettings>;
}

export interface TokenSaverPreviewResponse {
    originalText: string;
    transformedText: string;
    originalTokensEstimate: number;
    transformedTokensEstimate: number;
    tokensSavedEstimate: number;
    percentageSaved: number;
}
