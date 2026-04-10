/** Resource Market page - Buy and sell resources with other players. */

import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Eye, EyeOff, Truck } from "lucide-react";
import { useState, useMemo } from "react";

import { IncomingShipmentsDialog } from "@/components/dashboard/incoming-shipments-dialog";
import { GameLayout } from "@/components/layout/game-layout";
import { CreateAskDialog } from "@/components/resource-market/create-ask-dialog";
import { PurchaseDialog } from "@/components/resource-market/purchase-dialog";
import { Button, CardContent, Money, PageCard } from "@/components/ui";
import { DualDuration } from "@/components/ui/duration";
import { useCurrentPlayer } from "@/hooks/use-current-player";
import { usePlayerResources } from "@/hooks/use-player-resources";
import { usePlayerMap } from "@/hooks/use-players";
import {
    useResourceMarketAsks,
    useDeleteAsk,
    useCalculateDeliveryTime,
} from "@/hooks/use-resource-market";
import { useShipments } from "@/hooks/use-shipments";
import { formatMass } from "@/lib/format-utils";
import { Player } from "@/types/players";
import {
    ResourceType,
    RESOURCE_TYPES,
    RESOURCE_LABELS,
} from "@/types/resource-market";

function ResourceMarketHelp() {
    return (
        <div className="space-y-3">
            <p>
                Here you can sell and buy natural resources to/from other
                players.
            </p>
            <p>
                For more information about the resource market, refer to the
                wiki.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/community/resource-market")({
    component: ResourceMarketPage,
    staticData: {
        title: "Resource Market",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) =>
                cap.has_warehouse
                    ? { unlocked: true }
                    : {
                          unlocked: false,
                          reason: "Build a Warehouse to unlock",
                      },
        },
        infoDialog: {
            contents: <ResourceMarketHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): {
        askId?: number;
        createAsk?: boolean;
        shipments?: boolean;
    } => ({
        askId: search.askId ? Number(search.askId) : undefined,
        createAsk:
            search.createAsk === "true" || search.createAsk === true
                ? true
                : undefined,
        shipments:
            search.shipments === "true" || search.shipments === true
                ? true
                : undefined,
    }),
});

type SortKey = "resource_type" | "seller" | "quantity" | "unit_price";
type SortDirection = "asc" | "desc";

function ResourceMarketPage() {
    return (
        <GameLayout>
            <ResourceMarketContent />
        </GameLayout>
    );
}

function ResourceMarketContent() {
    const navigate = useNavigate({
        from: "/app/community/resource-market",
    });
    const { askId, createAsk, shipments } = useSearch({
        from: "/app/community/resource-market",
    });
    const [hideOwnAsks, setHideOwnAsks] = useState(false);
    const [filterResource, setFilterResource] = useState<ResourceType | "all">(
        "all",
    );
    const [sortKey, setSortKey] = useState<SortKey>("resource_type");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    const { data: asksData, isLoading: asksLoading } = useResourceMarketAsks();
    const { data: resources } = usePlayerResources();
    const { playerId: currentPlayerId } = useCurrentPlayer();
    const { data: shipmentsData } = useShipments();
    const playerMap = usePlayerMap();

    // Find the selected ask from the current asks
    const selectedAskForPurchase = useMemo(
        () => asksData?.asks.find((ask) => ask.id === askId) || null,
        [asksData?.asks, askId],
    );

    const asks = useMemo(() => asksData?.asks || [], [asksData]);

    // Check if there are any shipments
    const hasShipments = (shipmentsData?.shipments.length ?? 0) > 0;

    // Filter and sort asks
    const filteredAndSortedAsks = useMemo(() => {
        let filtered = asks;

        // Hide own asks if enabled
        if (hideOwnAsks && currentPlayerId) {
            filtered = filtered.filter(
                (ask) => ask.seller_id !== currentPlayerId,
            );
        }

        // Apply resource filter
        if (filterResource !== "all") {
            filtered = filtered.filter(
                (ask) => ask.resource_type === filterResource,
            );
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: number | string;
            let bVal: number | string;

            switch (sortKey) {
                case "resource_type":
                    aVal = a.resource_type;
                    bVal = b.resource_type;
                    break;
                case "seller":
                    aVal = playerMap?.[a.seller_id]?.username ?? "";
                    bVal = playerMap?.[b.seller_id]?.username ?? "";
                    break;
                case "quantity":
                    aVal = a.quantity;
                    bVal = b.quantity;
                    break;
                case "unit_price":
                    aVal = a.unit_price;
                    bVal = b.unit_price;
                    break;
            }

            if (typeof aVal === "string" && typeof bVal === "string") {
                const comparison = aVal.localeCompare(bVal);
                return sortDirection === "asc" ? comparison : -comparison;
            }

            const comparison = (aVal as number) - (bVal as number);
            return sortDirection === "asc" ? comparison : -comparison;
        });

        return sorted;
    }, [
        asks,
        filterResource,
        sortKey,
        sortDirection,
        hideOwnAsks,
        currentPlayerId,
        playerMap,
    ]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

    const getSortIndicator = (key: SortKey) => {
        if (sortKey !== key) return null;
        return sortDirection === "asc" ? " ▲" : " ▼";
    };

    if (asksLoading) {
        return (
            <div className="p-4 md:p-8 text-center">
                <p className="text-lg">Loading market...</p>
            </div>
        );
    }

    return (
        <div className="py-4 md:p-8">
            {/* Put on sale dialog */}
            <CreateAskDialog
                isOpen={createAsk === true}
                onClose={() => navigate({ search: {} })}
                resources={resources}
            />

            {/* Incoming shipments button - only shown if there are ongoing shipments */}
            {hasShipments && (
                <div className="mb-6 flex justify-center">
                    <Button
                        variant="outline"
                        onClick={() =>
                            navigate({
                                search: (prev) => ({
                                    ...prev,
                                    shipments: true,
                                }),
                            })
                        }
                        className="flex items-center gap-2"
                    >
                        <Truck className="w-5 h-5" />
                        View Incoming Shipments
                    </Button>
                </div>
            )}

            {/* Action bar */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <Button
                    variant="default"
                    onClick={() =>
                        navigate({
                            search: { createAsk: true },
                        })
                    }
                    className="flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Put on Sale
                </Button>

                {/* Toggle hide own asks */}
                <Button
                    variant={hideOwnAsks ? "default" : "outline"}
                    onClick={() => setHideOwnAsks(!hideOwnAsks)}
                    className="flex items-center gap-2"
                >
                    {hideOwnAsks ? (
                        <Eye className="w-4 h-4" />
                    ) : (
                        <EyeOff className="w-4 h-4" />
                    )}
                    {hideOwnAsks ? "Show mine" : "Hide mine"}
                </Button>

                {/* Resource filter */}
                <div className="flex gap-2 flex-wrap justify-center">
                    <Button
                        variant={
                            filterResource === "all" ? "default" : "outline"
                        }
                        onClick={() => setFilterResource("all")}
                    >
                        All Resources
                    </Button>
                    {RESOURCE_TYPES.map((resource) => (
                        <Button
                            key={resource}
                            variant={
                                filterResource === resource
                                    ? "default"
                                    : "outline"
                            }
                            onClick={() => setFilterResource(resource)}
                        >
                            {RESOURCE_LABELS[resource]}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Market table */}
            <PageCard>
                <CardContent className="overflow-x-auto">
                    {filteredAndSortedAsks.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {filterResource === "all"
                                ? "No resources currently on the market"
                                : `No ${RESOURCE_LABELS[filterResource]} currently on the market`}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-secondary">
                                    <th
                                        className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                                        onClick={() =>
                                            handleSort("resource_type")
                                        }
                                    >
                                        Resource
                                        {getSortIndicator("resource_type")}
                                    </th>
                                    <th
                                        className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                                        onClick={() => handleSort("seller")}
                                    >
                                        Seller
                                        {getSortIndicator("seller")}
                                    </th>
                                    <th
                                        className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                                        onClick={() => handleSort("quantity")}
                                    >
                                        Quantity{getSortIndicator("quantity")}
                                    </th>
                                    <th
                                        className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                                        onClick={() => handleSort("unit_price")}
                                    >
                                        Price per kg
                                        {getSortIndicator("unit_price")}
                                    </th>
                                    <th className="py-3 px-4 text-right font-semibold">
                                        Shipping Time
                                    </th>
                                    <th className="py-3 px-4 text-center font-semibold">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {filteredAndSortedAsks.map((ask) => (
                                        <AskRow
                                            key={ask.id}
                                            ask={ask}
                                            currentPlayerId={currentPlayerId}
                                            playerMap={playerMap}
                                            onPurchaseClick={(ask) =>
                                                navigate({
                                                    search: {
                                                        askId: ask.id,
                                                        createAsk: undefined,
                                                    },
                                                })
                                            }
                                        />
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </PageCard>

            {/* Purchase dialog - rendered outside the table to avoid nesting violations */}
            <PurchaseDialog
                isOpen={selectedAskForPurchase !== null}
                onClose={() => navigate({ search: {} })}
                ask={selectedAskForPurchase}
            />

            {/* Incoming Shipments Dialog */}
            <IncomingShipmentsDialog
                isOpen={shipments === true}
                onClose={() =>
                    navigate({
                        search: (prev) => ({ ...prev, shipments: undefined }),
                    })
                }
            />
        </div>
    );
}

interface AskRowProps {
    ask: {
        id: number;
        resource_type: string;
        quantity: number;
        unit_price: number;
        seller_id: number;
    };
    currentPlayerId?: number;
    playerMap?: Record<number, Player>;
    onPurchaseClick: (ask: {
        id: number;
        resource_type: string;
        quantity: number;
        unit_price: number;
    }) => void;
}

function AskRow({
    ask,
    currentPlayerId,
    playerMap,
    onPurchaseClick,
}: AskRowProps) {
    const deleteMutation = useDeleteAsk();
    const { data: deliveryData } = useCalculateDeliveryTime(ask.id);

    const isOwnAsk = currentPlayerId === ask.seller_id;
    const shippingTime = deliveryData?.shipment_time;

    return (
        <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-border/30 hover:bg-tan-green/20 dark:hover:bg-muted/30 transition-colors"
        >
            <td className="py-3 px-4 font-medium capitalize">
                {RESOURCE_LABELS[ask.resource_type as ResourceType] ||
                    ask.resource_type}
            </td>
            <td className="py-3 px-4 text-left">
                {playerMap?.[ask.seller_id]?.username ?? "—"}
            </td>
            <td className="py-3 px-4 text-right font-mono">
                {formatMass(ask.quantity)}
            </td>
            <td className="py-3 px-4 text-right">
                <Money amount={ask.unit_price * 1000} />
                /t
            </td>
            <td className="py-3 px-4 text-right">
                {isOwnAsk ? (
                    <span className="pr-10">—</span>
                ) : shippingTime !== undefined ? (
                    <DualDuration ticks={Math.ceil(shippingTime)} compact />
                ) : (
                    "—"
                )}
            </td>
            <td className="py-3 px-4 text-center">
                <div className="flex gap-2 justify-center">
                    {!isOwnAsk && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                                onPurchaseClick({
                                    id: ask.id,
                                    resource_type: ask.resource_type,
                                    quantity: ask.quantity,
                                    unit_price: ask.unit_price,
                                })
                            }
                            className="text-xs"
                            title="Purchase this resource"
                        >
                            Buy
                        </Button>
                    )}
                    {isOwnAsk && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMutation.mutate(ask.id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs px-3"
                            title="Remove your listing"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </td>
        </motion.tr>
    );
}
