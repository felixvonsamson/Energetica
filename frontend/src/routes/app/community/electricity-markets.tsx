import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { Plus, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useCallback, useState } from "react";

import { CreateMarketModal } from "@/components/electricity-markets/CreateMarketModal";
import { JoinMarketModal } from "@/components/electricity-markets/JoinMarketModal";
import { LeaveMarketModal } from "@/components/electricity-markets/LeaveMarketModal";
import { GameLayout } from "@/components/layout/GameLayout";
import { Button, Card, CardTitle } from "@/components/ui";
import { Money } from "@/components/ui/Money";
import { useLatestChartData } from "@/hooks/useCharts";
import {
    useElectricityMarketForPlayer,
    useElectricityMarkets,
} from "@/hooks/useElectricityMarkets";
import { useMe, usePlayerMap } from "@/hooks/usePlayers";
import { formatPower } from "@/lib/format-utils";

export const Route = createFileRoute("/app/community/electricity-markets")({
    component: ElectricityMarketsPage,
    staticData: {
        title: "Electricity Markets",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_network,
        },
        infoModal: {
            contents: <ElectricityMarketsHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): {
        joinMarketId?: number;
        leaveMarket?: "";
        createMarket?: "";
    } => ({
        joinMarketId: search.joinMarketId
            ? Number(search.joinMarketId)
            : undefined,
        leaveMarket: search.leaveMarket === "" ? "" : undefined,
        createMarket: search.createMarket === "" ? "" : undefined,
    }),
});

function ElectricityMarketsHelp() {
    return (
        <div className="space-y-3">
            <p>
                Electricity markets allow players to trade electricity with each
                other, creating a competitive marketplace for electric power.
            </p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Join a Market:</b> Click "Join" to participate in an
                        existing market and trade with its members
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Create a Market:</b> Start your own market
                        {/* and invite other players to join */}
                    </span>
                </li>
            </ul>
            <p>
                You can only be a member of one market at a time. Click on a
                market to expand and see its members.
            </p>
        </div>
    );
}

function ElectricityMarketsPage() {
    return (
        <GameLayout>
            <ElectricityMarketsContent />
        </GameLayout>
    );
}

interface MarketRowProps {
    market: { id: number; name: string; member_ids: number[] };
    isCurrentMarket: boolean;
    isExpanded: boolean;
    onToggleExpanded: () => void;
    onJoin: () => void;
    onLeave: () => void;
    playerMap: Record<number, { username: string }>;
}

function MarketRow({
    market,
    isCurrentMarket,
    isExpanded,
    onToggleExpanded,
    onJoin,
    onLeave,
    playerMap,
}: MarketRowProps) {
    // Fetch latest market data (price and quantity)
    const { data: marketData } = useLatestChartData({
        chartType: "network-data",
        networkId: market.id,
    });

    const price = marketData?.price;
    const quantity = marketData?.quantity;

    const marketRow = (
        <tr
            key={market.id}
            onClick={onToggleExpanded}
            className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
        >
            <td className="py-3 px-4 font-medium text-primary">
                {market.name}
            </td>
            <td className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">
                        {market.member_ids.length}
                    </span>
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    )}
                </div>
            </td>
            <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                {price !== undefined && price > 0 ? (
                    <Money amount={price} />
                ) : (
                    <span className="text-gray-400 dark:text-gray-600">
                        N/A
                    </span>
                )}
            </td>
            <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                {quantity !== undefined && quantity > 0 ? (
                    formatPower(quantity)
                ) : (
                    <span className="text-gray-400 dark:text-gray-600">
                        N/A
                    </span>
                )}
            </td>
            <td
                className="py-3 px-4 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                {isCurrentMarket ? (
                    <Button variant="destructive" size="sm" onClick={onLeave}>
                        Leave
                    </Button>
                ) : (
                    <Button variant="primary" size="sm" onClick={onJoin}>
                        Join
                    </Button>
                )}
            </td>
        </tr>
    );

    const expandedRow = isExpanded ? (
        <tr
            key={`expanded-${market.id}`}
            className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30"
        >
            <td colSpan={5} className="py-4 px-4">
                <div className="ml-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Members ({market.member_ids.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {market.member_ids.map((memberId) => (
                            <div
                                key={memberId}
                                className="text-sm text-gray-600 dark:text-gray-400"
                            >
                                {playerMap[memberId].username}
                            </div>
                        ))}
                    </div>
                </div>
            </td>
        </tr>
    ) : null;

    return (
        <>
            {marketRow}
            {expandedRow}
        </>
    );
}

function ElectricityMarketsContent() {
    const navigate = useNavigate({
        from: "/app/community/electricity-markets",
    });
    const {
        joinMarketId,
        leaveMarket: leaveMarketSearch,
        createMarket: createMarketSearch,
    } = useSearch({
        from: "/app/community/electricity-markets",
    });
    const isShowingLeaveMarket = leaveMarketSearch === "";
    const isShowingCreateMarket = createMarketSearch === "";

    const { data, isLoading, isError } = useElectricityMarkets();
    const player = useMe();
    const playerMap = usePlayerMap();
    const currentMarket = useElectricityMarketForPlayer(player?.id);

    const [expandedMarketId, setExpandedMarketId] = useState<number | null>(
        null,
    );

    const markets = data?.electricity_markets;

    const toggleExpanded = (marketId: number) => {
        setExpandedMarketId(expandedMarketId === marketId ? null : marketId);
    };

    const handleCloseModal = useCallback(() => {
        navigate({ search: {}, replace: true });
    }, [navigate]);

    return (
        <div className="p-4 md:p-8">
            {/* Title */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-4xl md:text-5xl font-bold">
                    Electricity Markets
                </h1>
                {markets && markets?.length !== 0 && (
                    <Button
                        variant="primary"
                        onClick={() => {
                            navigate({
                                search: { createMarket: "" },
                                replace: true,
                            });
                        }}
                        className="flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Create Market
                    </Button>
                )}
            </div>

            {/* Loading state */}
            {isLoading ||
            !markets ||
            currentMarket === undefined ||
            !playerMap ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                    Loading electricity markets...
                </div>
            ) : isError ? (
                <div className="text-center py-8 text-alert-red">
                    Failed to load electricity markets
                </div>
            ) : markets.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-300 dark:border-gray-600">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                                    Market Name
                                </th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                                    Members
                                </th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                                    Last Price
                                </th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                                    Volume
                                </th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {markets.map((market) => {
                                const isCurrentMarket =
                                    currentMarket?.id === market.id;
                                const isExpanded =
                                    expandedMarketId === market.id;

                                return (
                                    <MarketRow
                                        key={market.id}
                                        market={market}
                                        isCurrentMarket={isCurrentMarket}
                                        isExpanded={isExpanded}
                                        onToggleExpanded={() =>
                                            toggleExpanded(market.id)
                                        }
                                        onJoin={() => {
                                            navigate({
                                                search: {
                                                    joinMarketId: market.id,
                                                },
                                                replace: true,
                                            });
                                        }}
                                        onLeave={() => {
                                            navigate({
                                                search: {
                                                    leaveMarket: "",
                                                },
                                                replace: true,
                                            });
                                        }}
                                        playerMap={playerMap}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Market Modal */}
            {isShowingCreateMarket && (
                <CreateMarketModal
                    isOpen={isShowingCreateMarket}
                    onClose={handleCloseModal}
                />
            )}

            {/* Leave Market Modal */}
            {isShowingLeaveMarket && (
                <LeaveMarketModal
                    isOpen={isShowingLeaveMarket}
                    onClose={handleCloseModal}
                />
            )}

            {/* Join Market Modal */}
            {joinMarketId && (
                <JoinMarketModal
                    isOpen={joinMarketId !== null}
                    onClose={handleCloseModal}
                    marketId={joinMarketId}
                />
            )}
        </div>
    );
}

function EmptyState() {
    const navigate = useNavigate({
        from: "/app/community/electricity-markets",
    });

    return (
        <Card className="text-center py-12">
            <CardTitle className="mb-4">No Electricity Markets Yet</CardTitle>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
                There are currently no electricity markets. Be the first to
                create one!
            </p>
            <button
                className="inline-flex items-center gap-2 px-6 py-2 bg-pine dark:bg-brand-green text-white rounded-lg hover:opacity-80 transition-opacity"
                onClick={() => {
                    navigate({ search: { createMarket: "" } });
                }}
            >
                <Plus className="w-5 h-5" />
                Create Market
            </button>
        </Card>
    );
}
