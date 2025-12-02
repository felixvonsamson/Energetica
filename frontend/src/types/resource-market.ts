// Resource types available in the market

export type ResourceType = "coal" | "gas" | "uranium";
export const RESOURCE_TYPES: ResourceType[] = ["coal", "gas", "uranium"];
export const RESOURCE_LABELS: Record<ResourceType, string> = {
    coal: "Coal",
    gas: "Gas",
    uranium: "Uranium",
};
