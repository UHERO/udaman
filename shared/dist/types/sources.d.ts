import { Universe } from "./shared";
export interface Source {
    id: number;
    universe: Universe;
    description: string | null;
    link: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface CreateLoaderFormData {
    code: string;
    priority: number;
    scale: number;
    presaveHook: string;
    clearBeforeLoad: boolean;
    pseudoHistory: boolean;
}
export interface CreateLoaderPayload extends CreateLoaderFormData {
    universe: Universe;
    seriesId: number;
}
//# sourceMappingURL=sources.d.ts.map