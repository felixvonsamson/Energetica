// PROTOTYPE (#1469), throwaway: asset visual direction gallery. Not for merging.
import { createFileRoute } from "@tanstack/react-router";

import { AssetDirectionPrototype } from "@/components/asset-direction-prototype/asset-direction-prototype";

export const Route = createFileRoute("/prototype/asset-direction")({
    component: AssetDirectionPrototype,
    staticData: { title: "Asset direction (prototype)" },
});
