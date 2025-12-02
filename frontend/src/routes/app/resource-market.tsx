/** Resource Market page - Buy and sell resources with other players. */

import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { HelpCircle, Plus, Trash2, Eye, EyeOff } from "lucide-react";

import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { Modal, Card, Money } from "@components/ui";
import {
    useResourceMarketAsks,
    useDeleteAsk,
    useCalculateDeliveryTime,
} from "@hooks/useResourceMarket";
import { usePlayerResources } from "@hooks/usePlayerResources";
import { useCurrentPlayer } from "@hooks/useCurrentPlayer";
import { formatMass } from "@lib/format-utils";
import { PurchaseModal } from "@components/resource-market/PurchaseModal";
import {
    ResourceType,
    RESOURCE_TYPES,
    RESOURCE_LABELS,
} from "@app-types/resource-market";
import { CreateAskModal } from "@components/resource-market/CreateAskModal";

export const Route = createFileRoute("/app/resource-market")({
    component: ResourceMarketPage,
    staticData: {
        title: "Resource Market",
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): {
        askId?: number;
        createAsk?: boolean;
    } => ({
        askId: search.askId ? Number(search.askId) : undefined,
        createAsk:
            search.createAsk === "true" || search.createAsk === true
                ? true
                : undefined,
    }),
});

type SortKey = "resource_type" | "quantity" | "unit_price" | "total_price";
type SortDirection = "asc" | "desc";

function ResourceMarketPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <ResourceMarketContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function ResourceMarketContent() {
    const navigate = useNavigate({ from: "/app/resource-market" });
    const { askId, createAsk } = useSearch({ from: "/app/resource-market" });
    const [showInfoPopup, setShowInfoPopup] = useState(false);
    const [hideOwnAsks, setHideOwnAsks] = useState(false);
    const [filterResource, setFilterResource] = useState<ResourceType | "all">(
        "all",
    );
    const [sortKey, setSortKey] = useState<SortKey>("resource_type");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    const { data: asksData, isLoading: asksLoading } = useResourceMarketAsks();
    const { data: resources } = usePlayerResources();
    const { playerId: currentPlayerId } = useCurrentPlayer();

    // Find the selected ask from the current asks
    const selectedAskForPurchase = useMemo(
        () => asksData?.asks.find((ask) => ask.id === askId) || null,
        [asksData?.asks, askId],
    );

    const asks = asksData?.asks || [];

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
                case "quantity":
                    aVal = a.quantity;
                    bVal = b.quantity;
                    break;
                case "unit_price":
                    aVal = a.unit_price;
                    bVal = b.unit_price;
                    break;
                case "total_price":
                    aVal = a.quantity * a.unit_price;
                    bVal = b.quantity * b.unit_price;
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
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Resource Market
                </h1>
                <button
                    onClick={() => setShowInfoPopup(true)}
                    className="text-primary hover:opacity-80 transition-opacity"
                    aria-label="Show help"
                >
                    <HelpCircle className="w-8 h-8" />
                </button>
            </div>

            {/* Info modal */}
            <Modal
                isOpen={showInfoPopup}
                onClose={() => setShowInfoPopup(false)}
                title="Help : Resource Market"
            >
                <div className="space-y-3">
                    <p>
                        Here you can sell and buy natural resources to/from
                        other players.
                    </p>
                    <p>
                        For more information about the resource market, refer to
                        the wiki.
                    </p>
                </div>
            </Modal>

            {/* Put on sale modal */}
            <CreateAskModal
                isOpen={createAsk === true}
                onClose={() => navigate({ search: {} })}
                resources={resources}
            />

            {/* Action bar */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <button
                    onClick={() =>
                        navigate({
                            search: { createAsk: true },
                        })
                    }
                    className="bg-brand-green hover:bg-brand-green/80 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Put on Sale
                </button>

                {/* Toggle hide own asks */}
                <button
                    onClick={() => setHideOwnAsks(!hideOwnAsks)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        hideOwnAsks
                            ? "bg-brand-green text-white"
                            : "bg-tan-green dark:bg-dark-bg-tertiary hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary"
                    }`}
                    title={
                        hideOwnAsks
                            ? "Showing others' asks"
                            : "Showing all asks"
                    }
                >
                    {hideOwnAsks ? (
                        <EyeOff className="w-4 h-4" />
                    ) : (
                        <Eye className="w-4 h-4" />
                    )}
                    {hideOwnAsks ? "Hide Own" : "Show All"}
                </button>

                {/* Resource filter */}
                <div className="flex gap-2 flex-wrap justify-center">
                    <button
                        onClick={() => setFilterResource("all")}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            filterResource === "all"
                                ? "bg-brand-green text-white"
                                : "bg-tan-green dark:bg-dark-bg-tertiary hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary"
                        }`}
                    >
                        All Resources
                    </button>
                    {RESOURCE_TYPES.map((resource) => (
                        <button
                            key={resource}
                            onClick={() => setFilterResource(resource)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                filterResource === resource
                                    ? "bg-brand-green text-white"
                                    : "bg-tan-green dark:bg-dark-bg-tertiary hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary"
                            }`}
                        >
                            {RESOURCE_LABELS[resource]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Market table */}
            <Card>
                <div className="overflow-x-auto">
                    {filteredAndSortedAsks.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {filterResource === "all"
                                ? "No resources currently on the market"
                                : `No ${RESOURCE_LABELS[filterResource]} currently on the market`}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-tan-green dark:bg-dark-bg-tertiary">
                                    <th
                                        className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                        onClick={() =>
                                            handleSort("resource_type")
                                        }
                                    >
                                        Resource
                                        {getSortIndicator("resource_type")}
                                    </th>
                                    <th
                                        className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                        onClick={() => handleSort("quantity")}
                                    >
                                        Quantity{getSortIndicator("quantity")}
                                    </th>
                                    <th
                                        className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                        onClick={() => handleSort("unit_price")}
                                    >
                                        Price per kg
                                        {getSortIndicator("unit_price")}
                                    </th>
                                    <th
                                        className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                        onClick={() =>
                                            handleSort("total_price")
                                        }
                                    >
                                        Total Price
                                        {getSortIndicator("total_price")}
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
                                {filteredAndSortedAsks.map((ask) => (
                                    <AskRow
                                        key={ask.id}
                                        ask={ask}
                                        currentPlayerId={currentPlayerId}
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
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>

            {/* Purchase modal - rendered outside the table to avoid nesting violations */}
            {selectedAskForPurchase && (
                <PurchaseModal
                    isOpen={selectedAskForPurchase !== null}
                    onClose={() => navigate({ search: {} })}
                    ask={selectedAskForPurchase}
                />
            )}
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
    onPurchaseClick: (ask: {
        id: number;
        resource_type: string;
        quantity: number;
        unit_price: number;
    }) => void;
}

function AskRow({ ask, currentPlayerId, onPurchaseClick }: AskRowProps) {
    const deleteMutation = useDeleteAsk();
    const { data: deliveryData } = useCalculateDeliveryTime(ask.id);

    const totalPrice = ask.quantity * ask.unit_price;
    const isOwnAsk = currentPlayerId === ask.seller_id;
    const shippingTime = deliveryData?.shipment_time;

    return (
        <tr className="border-b border-pine/10 dark:border-dark-border/30 hover:bg-tan-green/20 dark:hover:bg-dark-bg-tertiary/30 transition-colors">
            <td className="py-3 px-4 font-medium capitalize">
                {RESOURCE_LABELS[ask.resource_type as ResourceType] ||
                    ask.resource_type}
            </td>
            <td className="py-3 px-4 text-right font-mono">
                {formatMass(ask.quantity)}
            </td>
            <td className="py-3 px-4 text-right">
                <Money amount={ask.unit_price * 1000} />
                /t
            </td>
            <td className="py-3 px-4 text-right">
                <Money amount={totalPrice} />
            </td>
            <td className="py-3 px-4 text-right font-mono text-sm">
                {isOwnAsk ? (
                    <span className="text-gray-400">Your listing</span>
                ) : shippingTime !== undefined ? (
                    <>{Math.ceil(shippingTime)} ticks</>
                ) : (
                    "—"
                )}
            </td>
            <td className="py-3 px-4 text-center">
                <div className="flex gap-2 justify-center">
                    {!isOwnAsk && (
                        <button
                            onClick={() =>
                                onPurchaseClick({
                                    id: ask.id,
                                    resource_type: ask.resource_type,
                                    quantity: ask.quantity,
                                    unit_price: ask.unit_price,
                                })
                            }
                            className="bg-brand-green hover:bg-brand-green/80 text-white px-4 py-1 rounded text-xs font-medium transition-colors"
                            title="Purchase this resource"
                        >
                            Buy
                        </button>
                    )}
                    {isOwnAsk && (
                        <button
                            onClick={() => deleteMutation.mutate(ask.id)}
                            disabled={deleteMutation.isPending}
                            className="bg-alert-red hover:bg-alert-red/80 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                            title="Remove your listing"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}
