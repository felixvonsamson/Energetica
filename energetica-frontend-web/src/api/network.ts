export interface Network {
    "id": number;
    "name": string;
    "member_ids": number[];
}

export interface FetchNetworks {
    "networks": Network[];
}

export async function fetchNetworks (): Promise<FetchNetworks> {
    const response = await fetch("/api/v1/networks");
    if (!response.ok || response.status != 200) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as FetchNetworks;
    return data;
}
