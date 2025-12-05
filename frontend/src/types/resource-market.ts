// Resource types available in the market
import { ApiSchema } from "@app-types/api-helpers";

export type ResourceType = ApiSchema<"Fuel">;
export const RESOURCE_TYPES: ResourceType[] = ["coal", "gas", "uranium"];
export const RESOURCE_LABELS: Record<ResourceType, string> = {
    coal: "Coal",
    gas: "Gas",
    uranium: "Uranium",
};
