import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useCallback } from "react";

import { CreateMarketDialog } from "@/components/electricity-markets/create-market-dialog";
import { JoinMarketDialog } from "@/components/electricity-markets/join-market-dialog";
import { LeaveMarketDialog } from "@/components/electricity-markets/leave-market-dialog";
import { MarketDetailDialog } from "@/components/electricity-markets/market-detail-dialog";
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
import {
    useElectricityMarket,
    useElectricityMarkets,
} from "@/hooks/use-electricity-markets";

type ElectricityMarketsSearch = {
    market?: number;
    joinMarket?: number;
    leaveMarket?: "";
    createMarket?: "";
};

export const Route = createFileRoute("/app/community/electricity-markets")({
    component: ElectricityMarketsPage,
    staticData: {
        title: "Electricity Markets",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) =>
                cap.has_network
                    ? { unlocked: true }
                    : {
                          unlocked: false,
                          reason: "Unlock the Network achievement to access",
                      },
        },
        infoDialog: {
            contents: <ElectricityMarketsHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): ElectricityMarketsSearch => ({
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
        market: searchMarket,
        joinMarket: joinMarketId,
        leaveMarket: leaveMarketSearch,
        createMarket: createMarketSearch,
    } = useSearch({
        from: "/app/community/electricity-markets",
    });
    const {
        data: electricity_markets,
        isLoading,
        isError,
    } = useElectricityMarkets();
    const selectedMarket = useElectricityMarket(searchMarket ?? null);
    const handleCloseDialog = useCallback(() => {
        navigate({ search: {}, replace: true });
    }, [navigate]);

    const isShowingLeaveMarket = leaveMarketSearch === "";
    const isShowingCreateMarket = createMarketSearch === "";
    const markets = electricity_markets?.electricity_markets;

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
            {isLoading ||
            markets === undefined ||
            selectedMarket === undefined ? (
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
                            return (
                                <MarketItem
                                    key={market.id}
                                    market={market}
                                    onClick={() =>
                                        navigate({
                                            search: { market: market.id },
                                        })
                                    }
                                />
                            );
                        })}
                    </CatalogGrid>

                    {/* Detail Dialog */}
                    <MarketDetailDialog
                        isOpen={selectedMarket !== null}
                        onClose={() => navigate({ search: {} })}
                        market={selectedMarket}
                        onJoin={(market) => {
                            // Open the join confirmation dialog
                            navigate({
                                search: { joinMarket: market.id },
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
                </>
            )}

            {/* Create Market Dialog */}
            {isShowingCreateMarket && (
                <CreateMarketDialog
                    isOpen={isShowingCreateMarket}
                    onClose={handleCloseDialog}
                />
            )}

            {/* Leave Market Dialog */}
            <LeaveMarketDialog
                isOpen={isShowingLeaveMarket}
                onClose={handleCloseDialog}
            />

            {/* Join Market Dialog */}
            <JoinMarketDialog
                isOpen={joinMarketId !== undefined}
                onClose={handleCloseDialog}
                marketId={joinMarketId ?? null}
            />
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
                        className="inline-flex items-center gap-2 px-6 py-2 bg-pine dark:bg-brand text-white rounded-lg hover:opacity-80 transition-opacity"
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
