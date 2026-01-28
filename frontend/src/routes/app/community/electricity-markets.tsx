import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useCallback, useMemo } from "react";

import { CreateMarketModal } from "@/components/electricity-markets/create-market-modal";
import { JoinMarketModal } from "@/components/electricity-markets/join-market-modal";
import { LeaveMarketModal } from "@/components/electricity-markets/leave-market-modal";
import { MarketDetailModal } from "@/components/electricity-markets/market-detail-modal";
import { MarketItem } from "@/components/electricity-markets/market-item";
import { GameLayout } from "@/components/layout/game-layout";
import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CatalogGrid,
} from "@/components/ui";
import { CardAction, CardContent } from "@/components/ui/card";
import { useLatestChartDataSlice } from "@/hooks/useCharts";
import {
    useElectricityMarketForPlayer,
    useElectricityMarkets,
} from "@/hooks/useElectricityMarkets";
import { useMe, usePlayerMap } from "@/hooks/usePlayers";

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
        market?: number;
        joinMarket?: number;
        leaveMarket?: "";
        createMarket?: "";
    } => ({
        market: search.market ? Number(search.market) : undefined,
        joinMarket: search.joinMarket ? Number(search.joinMarket) : undefined,
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

function ElectricityMarketsContent() {
    const navigate = useNavigate({
        from: "/app/community/electricity-markets",
    });
    const {
        market: marketId,
        joinMarket: joinMarketId,
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

    const markets = useMemo(
        () => data?.electricity_markets ?? [],
        [data?.electricity_markets],
    );

    // Find selected market from URL param
    const selectedMarket = useMemo(
        () => markets.find((m) => m.id === marketId) || null,
        [markets, marketId],
    );

    // Fetch market data for selected market
    const { data: selectedMarketData } = useLatestChartDataSlice({
        chartType: "market-clearing",
        marketId: selectedMarket?.id ?? 0,
    });

    const handleCloseModal = useCallback(() => {
        navigate({ search: {}, replace: true });
    }, [navigate]);

    return (
        <div className="p-4 md:p-8">
            {/* Title */}
            {markets && markets.length !== 0 && (
                <div className="flex items-center justify-between mb-6">
                    <Button
                        variant="default"
                        onClick={() => {
                            navigate({
                                search: { createMarket: "" },
                                replace: true,
                            });
                        }}
                        className="flex items-center gap-2 ml-auto"
                    >
                        <Plus className="w-5 h-5" />
                        Create Market
                    </Button>
                </div>
            )}

            {/* Loading state */}
            {isLoading || currentMarket === undefined || !playerMap ? (
                <div className="text-center py-8 text-muted-foreground">
                    Loading electricity markets...
                </div>
            ) : isError ? (
                <div className="text-center py-8 text-alert-red">
                    Failed to load electricity markets
                </div>
            ) : markets.length === 0 ? (
                <EmptyState />
            ) : (
                <>
                    <CatalogGrid>
                        {markets.map((market) => {
                            const isCurrentMarket =
                                currentMarket?.id === market.id;

                            return (
                                <MarketItem
                                    key={market.id}
                                    marketName={market.name}
                                    memberCount={market.member_ids.length}
                                    isCurrentMarket={isCurrentMarket}
                                    onClick={() =>
                                        navigate({
                                            search: { market: market.id },
                                        })
                                    }
                                />
                            );
                        })}
                    </CatalogGrid>

                    {/* Detail Modal */}
                    {selectedMarket && playerMap && (
                        <MarketDetailModal
                            isOpen={selectedMarket !== null}
                            onClose={() => navigate({ search: {} })}
                            market={selectedMarket}
                            playerMap={playerMap}
                            price={selectedMarketData?.price}
                            volume={selectedMarketData?.quantity}
                            isCurrentMarket={
                                currentMarket?.id === selectedMarket.id
                            }
                            onJoin={() => {
                                // Open the join confirmation modal
                                navigate({
                                    search: { joinMarket: selectedMarket.id },
                                    replace: true,
                                });
                            }}
                            onLeave={() => {
                                navigate({
                                    search: { leaveMarket: "" },
                                    replace: true,
                                });
                            }}
                        />
                    )}
                </>
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
                    isOpen={joinMarketId !== undefined}
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
            <CardHeader>
                <CardTitle>No Electricity Markets Yet</CardTitle>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    There are currently no electricity markets. Be the first to
                    create one!
                </p>
            </CardHeader>
            <CardContent>
                <CardAction>
                    <button
                        className="inline-flex items-center gap-2 px-6 py-2 bg-pine dark:bg-brand-green text-white rounded-lg hover:opacity-80 transition-opacity"
                        onClick={() => {
                            navigate({ search: { createMarket: "" } });
                        }}
                    >
                        <Plus className="w-5 h-5" />
                        Create Market
                    </button>
                </CardAction>
            </CardContent>
        </Card>
    );
}
