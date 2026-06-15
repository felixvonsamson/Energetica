import { useEffect, useState } from "react";

import { fetchInstances, type InstanceFragment } from "@/lib/instances";

type AdvertisedInstances = {
    /**
     * Advertised instances, most recent first (the manifest is already sorted
     * by the backend).
     */
    instances: InstanceFragment[];
    loading: boolean;
};

/**
 * Fetch the advertised instances from the public manifest.
 *
 * Plain `fetch` rather than React Query: the landing bundle runs with light
 * providers (Theme only) and has no QueryClient. Errors degrade silently to an
 * empty list — during the interim, before Apache serves `/instances.json`, the
 * fetch 404s and the landing simply shows no run list.
 */
export function useAdvertisedInstances(): AdvertisedInstances {
    const [instances, setInstances] = useState<InstanceFragment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        fetchInstances(controller.signal)
            .then((all) =>
                setInstances(all.filter((instance) => instance.advertised)),
            )
            .catch(() => {
                // No manifest yet (interim) or a transient error — render nothing extra.
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, []);

    return { instances, loading };
}
