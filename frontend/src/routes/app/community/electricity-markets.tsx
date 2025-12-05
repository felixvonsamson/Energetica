import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";

import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { Card, CardTitle } from "@components/ui";
import {
    useElectricityMarketForPlayer,
    useElectricityMarkets,
} from "@hooks/useElectricityMarkets";
import { useMe, usePlayerMap } from "@hooks/usePlayers";
import { Money } from "@components/ui/Money";
import { LeaveMarketModal } from "@components/electricity-markets/LeaveMarketModal";
import { JoinMarketModal } from "@components/electricity-markets/JoinMarketModal";
import { CreateMarketModal } from "@components/electricity-markets/CreateMarketModal";

export const Route = createFileRoute("/app/community/electricity-markets")({
    component: ElectricityMarketsPage,
    staticData: {
        title: "Electricity Markets",
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): {
        joinMarketId?: number;
        leaveMarket?: boolean;
        createMarket?: boolean;
    } => ({
        joinMarketId: search.joinMarketId
            ? Number(search.joinMarketId)
            : undefined,
        leaveMarket:
            search.leaveMarket === "true" || search.leaveMarket === true
                ? true
                : undefined,
        createMarket:
            search.createMarket === "true" || search.createMarket === true
                ? true
                : undefined,
    }),
});

function ElectricityMarketsPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <ElectricityMarketsContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function ElectricityMarketsContent() {
    const navigate = useNavigate({
        from: "/app/community/electricity-markets",
    });
    const { joinMarketId, leaveMarket, createMarket } = useSearch({
        from: "/app/community/electricity-markets",
    });

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
        navigate({ search: {} });
    }, [navigate]);

    return (
        <div className="p-4 md:p-8">
            {/* Title */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-4xl md:text-5xl font-bold">
                    Electricity Markets
                </h1>
                {markets && markets?.length !== 0 && (
                    <button
                        className="flex items-center gap-2 px-4 py-2 bg-pine dark:bg-brand-green text-white rounded-lg hover:opacity-80 transition-opacity"
                        onClick={() => {
                            navigate({ search: { createMarket: true } });
                        }}
                    >
                        <Plus className="w-5 h-5" />
                        Create Market
                    </button>
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
                            {markets.flatMap((market) => {
                                const isCurrentMarket =
                                    currentMarket &&
                                    market.id === currentMarket.id;
                                const isExpanded =
                                    expandedMarketId === market.id;

                                const marketRow = (
                                    <tr
                                        key={market.id}
                                        onClick={() =>
                                            toggleExpanded(market.id)
                                        }
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
                                            <Money amount={45.67} />
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                                            {(
                                                1200 +
                                                market.id * 100
                                            ).toLocaleString()}{" "}
                                            MWh
                                        </td>
                                        <td
                                            className="py-3 px-4 text-center"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {isCurrentMarket ? (
                                                <button
                                                    className="px-4 py-1 bg-alert-red text-white rounded hover:opacity-80 transition-opacity"
                                                    onClick={() => {
                                                        navigate({
                                                            search: {
                                                                leaveMarket: true,
                                                            },
                                                        });
                                                    }}
                                                >
                                                    Leave
                                                </button>
                                            ) : (
                                                <button
                                                    className="px-4 py-1 bg-pine dark:bg-brand-green text-white rounded hover:opacity-80 transition-opacity"
                                                    onClick={() => {
                                                        navigate({
                                                            search: {
                                                                joinMarketId:
                                                                    market.id,
                                                            },
                                                        });
                                                    }}
                                                >
                                                    Join
                                                </button>
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
                                                    Members (
                                                    {market.member_ids.length})
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                    {market.member_ids.map(
                                                        (memberId) => (
                                                            <div
                                                                key={memberId}
                                                                className="text-sm text-gray-600 dark:text-gray-400"
                                                            >
                                                                {
                                                                    playerMap[
                                                                        memberId
                                                                    ].username
                                                                }
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : null;

                                return [marketRow, expandedRow].filter(Boolean);
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Market Modal */}
            {createMarket && (
                <CreateMarketModal
                    isOpen={createMarket !== null}
                    onClose={handleCloseModal}
                />
            )}

            {/* Leave Market Modal */}
            {leaveMarket && (
                <LeaveMarketModal
                    isOpen={leaveMarket !== null}
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
                    navigate({ search: { createMarket: true } });
                }}
            >
                <Plus className="w-5 h-5" />
                Create Market
            </button>
        </Card>
    );
}
