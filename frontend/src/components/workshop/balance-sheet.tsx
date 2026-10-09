/**
 * A player's balance sheet for a Round (#1008), drawn as a printed statement: a
 * white sheet with a waterfall chart of one period on top and a ledger of every
 * season below.
 *
 * The ledger has a column group per season and one for the Round. In the
 * detailed view, each season's group shows a volume and a rate beside each
 * amount, and the rows indented under a line break it down. The sheet fits its
 * page rather than scrolling sideways: where there is no room for every
 * season's volume and rate, only the season picked in the waterfall shows them.
 * A season not settled yet shows "–". As on the timeline, the season the grid
 * went down in is marked with a red zap-off icon, and the seasons it skipped
 * are struck through and read "skipped". The colours belong to the sheet, not
 * the theme, so it reads as paper in dark mode too.
 */

import { ZapOff } from "lucide-react";
import {
    type CSSProperties,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";

import Logo from "@/assets/simplified_logo.svg?react";
import { CoinIcon } from "@/components/ui/coin-icon";
import { cn } from "@/lib/utils";
import {
    type BalanceSheet,
    type Row,
    type RowUnit,
    type SeasonSheet,
    balanceSheetRows,
    formatAmount,
    formatRate,
    formatVolume,
    waterfallScale,
    waterfallSteps,
} from "@/lib/workshop-balance-sheet";
import { SEASON_LABELS, type Season } from "@/lib/workshop-timeline";

type Period = Season | "round";

const SHEET_COLORS = {
    "--bs-muted": "oklch(50% 0.07 145)",
    "--bs-light": "oklch(56% 0.035 145)",
    "--bs-level-2": "oklch(62% 0.03 145)",
    "--bs-positive": "oklch(60% 0.17 145)",
    "--bs-negative": "oklch(57.7% 0.245 27.325)",
    "--bs-bar-income": "oklch(62% 0.12 145)",
    "--bs-bar-cost": "oklch(68% 0.1 30)",
    "--bs-tint": "oklch(92% 0.03 91)",
    "--bs-subtotal": "oklch(96% 0.02 91.7)",
    "--bs-highlight": "oklch(60% 0.1 138 / 0.08)",
} as CSSProperties;

const FOCUS =
    "outline-none focus-visible:ring-[3px] focus-visible:ring-pine-500/50 rounded-sm";

export function BalanceSheetView({ sheet }: { sheet: BalanceSheet }) {
    const [period, setPeriod] = useState<Period>("round");
    const [detailed, setDetailed] = useState(true);
    const closed = sheet.seasons.every((s) => s.status !== "upcoming");

    return (
        <div className="flex justify-center pb-4">
            <div
                className="flex w-full min-w-0 flex-col gap-7 rounded-[2px] bg-white px-6 py-8 text-pine-700 shadow-[0_12px_32px_rgba(40,84,48,.18)] xl:px-12 xl:py-11"
                style={{ maxWidth: detailed ? 1480 : 1060, ...SHEET_COLORS }}
            >
                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-12">
                    <div className="flex flex-col gap-[18px]">
                        <Logo className="size-16" aria-hidden />
                        <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-[13px] font-normal tracking-[.1em] text-(--bs-muted) uppercase">
                                Energetica · Statement
                            </span>
                            <h2 className="font-titles text-[34px] leading-[1.1] font-semibold text-pine-800">
                                Round {sheet.round}
                            </h2>
                            <span className="font-titles text-xl font-medium">
                                Balance sheet
                                {!closed && (
                                    <span className="text-(--bs-muted)">
                                        {" "}
                                        · so far
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="flex items-baseline justify-between border-t-[3px] border-double border-pine-700 pt-3">
                            <span className="text-[17px] font-semibold">
                                Net profit
                            </span>
                            <span className="flex items-center gap-1.5 font-mono text-2xl font-medium text-pine-800">
                                {formatAmount(sheet.net_profit)}
                                <CoinIcon className="size-5" />
                            </span>
                        </div>
                        <DetailedToggle
                            on={detailed}
                            onChange={() => setDetailed((on) => !on)}
                        />
                    </div>
                    <Waterfall
                        sheet={sheet}
                        period={period}
                        onPeriodChange={setPeriod}
                    />
                </div>
                <Ledger sheet={sheet} detailed={detailed} period={period} />
            </div>
        </div>
    );
}

function DetailedToggle({
    on,
    onChange,
}: {
    on: boolean;
    onChange: () => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={onChange}
            className={cn(
                "flex cursor-pointer items-center gap-2 self-start text-[15px] font-semibold",
                FOCUS,
            )}
        >
            <span
                className={cn(
                    "relative h-[22px] w-10 rounded-full transition-colors",
                    on ? "bg-pine-700" : "bg-bone-300",
                )}
            >
                <span
                    className="absolute top-0.5 size-[18px] rounded-full bg-white transition-[left]"
                    style={{ left: on ? 20 : 2 }}
                />
            </span>
            Detailed view
        </button>
    );
}

// --- Waterfall ------------------------------------------------------------

function Waterfall({
    sheet,
    period,
    onPeriodChange,
}: {
    sheet: BalanceSheet;
    period: Period;
    onPeriodChange: (period: Period) => void;
}) {
    const season = sheet.seasons.find((s) => s.season === period);
    const figures = period === "round" ? sheet.total : season?.sheet;
    const steps = figures
        ? waterfallSteps(figures, period === "round" ? sheet : undefined)
        : [];
    const at = waterfallScale(steps);

    return (
        <div className="flex flex-col gap-2.5">
            <div
                role="tablist"
                className="flex gap-[18px] border-b border-bone-300"
            >
                {sheet.seasons.map((s) => (
                    <PeriodTab
                        key={s.season}
                        active={period === s.season}
                        disabled={s.status !== "settled"}
                        onClick={() => onPeriodChange(s.season)}
                    >
                        {SEASON_LABELS[s.season]}
                        {s.blackout && <BlackoutMark />}
                    </PeriodTab>
                ))}
                <PeriodTab
                    active={period === "round"}
                    onClick={() => onPeriodChange("round")}
                >
                    Round {sheet.round}
                </PeriodTab>
            </div>
            {steps.length === 0 ? (
                <p className="py-6 text-[15px] text-(--bs-muted)">
                    The chart fills in once the first season is settled.
                </p>
            ) : (
                steps.map((step) => (
                    <div
                        key={step.label}
                        className={cn(
                            "grid grid-cols-[170px_minmax(0,1fr)_100px] items-center gap-3.5 py-[3px]",
                            step.kind === "subtotal" &&
                                "border-t border-bone-300",
                        )}
                    >
                        <span
                            className={cn(
                                "text-[15px]",
                                step.kind === "subtotal"
                                    ? "font-bold"
                                    : "font-medium",
                            )}
                        >
                            {step.label}
                        </span>
                        <div className="relative h-4">
                            <div
                                className={cn(
                                    "absolute top-0.5 h-3 rounded-[3px]",
                                    step.kind === "subtotal"
                                        ? "bg-pine-800"
                                        : step.kind === "pending"
                                          ? "bg-pine-500"
                                          : step.value! >= 0
                                            ? "bg-(--bs-bar-income)"
                                            : "bg-(--bs-bar-cost)",
                                )}
                                style={{
                                    left: `${at(Math.min(step.from, step.to))}%`,
                                    width:
                                        step.kind === "pending"
                                            ? "0.3%"
                                            : `${Math.abs(at(step.to) - at(step.from))}%`,
                                }}
                            />
                        </div>
                        <span
                            className={cn(
                                "text-right font-mono text-sm font-normal",
                                step.value === null
                                    ? "text-(--bs-muted) italic"
                                    : step.value < 0
                                      ? "text-(--bs-negative)"
                                      : "text-pine-800",
                            )}
                        >
                            {step.value === null
                                ? "pending"
                                : formatAmount(step.value)}
                        </span>
                    </div>
                ))
            )}
        </div>
    );
}

function PeriodTab({
    active,
    disabled = false,
    onClick,
    children,
}: {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "-mb-px flex items-center gap-1 border-b-[3px] px-0.5 pt-1 pb-2 text-base font-semibold",
                active
                    ? "border-pine-700 text-pine-800"
                    : "border-transparent text-(--bs-muted)",
                disabled ? "cursor-default opacity-50" : "cursor-pointer",
                FOCUS,
            )}
        >
            {children}
        </button>
    );
}

/** The season the grid went down in, marked as on the timeline. */
function BlackoutMark() {
    return (
        <ZapOff
            className="size-3.5 text-(--bs-negative)"
            aria-label="Blackout"
            role="img"
        />
    );
}

// --- Ledger ---------------------------------------------------------------

type Field = "volume" | "rate" | "amount";

interface Column {
    period: Period;
    field: Field;
    /** A rule before the column: the start of a season group or the Round. */
    rule?: "season" | "round";
}

/**
 * How narrow the ledger can get in the detailed view before it drops columns,
 * so the sheet never needs to scroll sideways. Below the first width, only the
 * season picked in the waterfall shows its volume and rate. Below the second,
 * no season does, and the unit column goes too: the breakdown rows keep their
 * amounts. Below about 540px, phone width, even the amounts get cramped: phones
 * are not catered for yet.
 */
const ALL_SEASONS_DETAILED_WIDTH = 1300;
const SELECTED_SEASON_DETAILED_WIDTH = 860;

/** The width of the element `ref` is attached to, kept up to date. */
function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState<number | null>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry) setWidth(entry.contentRect.width);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

function columns(
    expanded: (season: Season) => boolean,
    detailed: boolean,
    seasons: SeasonSheet[],
): Column[] {
    const result: Column[] = [];
    for (const { season } of seasons) {
        if (expanded(season)) {
            result.push(
                { period: season, field: "volume", rule: "season" },
                { period: season, field: "rate" },
                { period: season, field: "amount" },
            );
        } else {
            result.push({ period: season, field: "amount", rule: "season" });
        }
    }
    result.push({
        period: "round",
        field: "amount",
        rule: detailed ? "season" : "round",
    });
    return result;
}

function gridTemplate(unit: boolean, cols: Column[]): string {
    const lead = unit ? "minmax(220px,1.6fr) 120px" : "minmax(180px,2fr)";
    // The Round's single column is kept wide enough for its "Round n" heading.
    const rest = cols.map((c) =>
        c.period === "round"
            ? "minmax(6rem,.95fr)"
            : c.field === "amount"
              ? "minmax(0,.95fr)"
              : "minmax(0,.85fr)",
    );
    return [lead, ...rest].join(" ");
}

function ruleClass(column: Column): string | undefined {
    if (column.rule === "season") return "border-l border-(--bs-tint)";
    if (column.rule === "round") return "border-l-[1.5px] border-bone-300";
    return undefined;
}

function Ledger({
    sheet,
    detailed,
    period,
}: {
    sheet: BalanceSheet;
    detailed: boolean;
    period: Period;
}) {
    const [ref, width] = useWidth<HTMLDivElement>();
    const fits = (needed: number) => width === null || width >= needed;
    const unit = detailed && fits(SELECTED_SEASON_DETAILED_WIDTH);
    const expanded = (season: Season) =>
        unit && (fits(ALL_SEASONS_DETAILED_WIDTH) || season === period);
    const cols = columns(expanded, detailed, sheet.seasons);
    const template = { gridTemplateColumns: gridTemplate(unit, cols) };
    const rows = balanceSheetRows(sheet).filter(
        (row) => detailed || row.level === 0,
    );
    const groups: { period: Period; label: ReactNode; span: number }[] = [
        ...sheet.seasons.map((s) => ({
            period: s.season,
            label: (
                <span
                    className={cn(
                        "inline-flex items-center gap-1",
                        s.status === "skipped" &&
                            "text-(--bs-muted) line-through",
                    )}
                    title={
                        s.status === "skipped"
                            ? "Not played: a blackout ended the Round"
                            : undefined
                    }
                >
                    {SEASON_LABELS[s.season]}
                    {s.blackout && <BlackoutMark />}
                </span>
            ),
            span: expanded(s.season) ? 3 : 1,
        })),
        { period: "round", label: `Round ${sheet.round}`, span: 1 },
    ];

    return (
        <div
            ref={ref}
            role="table"
            aria-label={`Round ${sheet.round} balance sheet`}
        >
            <div className="grid" style={template}>
                <div style={{ gridColumn: `span ${unit ? 2 : 1}` }} />
                {groups.map((group) => (
                    <div
                        key={group.period}
                        className={cn(
                            "mx-1.5 rounded-t-md border-b-[1.5px] border-pine-700 px-2 py-1.5 text-base font-bold whitespace-nowrap text-pine-800",
                            group.span === 3 ? "text-center" : "text-right",
                            group.period === period && "bg-(--bs-highlight)",
                        )}
                        style={{ gridColumn: `span ${group.span}` }}
                    >
                        {group.label}
                    </div>
                ))}
            </div>
            <div
                role="row"
                className="grid border-b-[3px] border-double border-pine-700 font-mono text-xs font-normal text-(--bs-muted)"
                style={template}
            >
                <div role="columnheader" className="px-2.5 py-1.5">
                    ITEM
                </div>
                {unit && (
                    <div role="columnheader" className="px-2 py-1.5">
                        UNIT
                    </div>
                )}
                {cols.map((col) => (
                    <div
                        key={`${col.period}-${col.field}`}
                        role="columnheader"
                        className={cn(
                            "px-2 py-1.5 text-right",
                            ruleClass(col),
                            col.period === period && "bg-(--bs-highlight)",
                        )}
                    >
                        {col.field === "volume"
                            ? "VOL"
                            : col.field === "rate"
                              ? "RATE"
                              : "AMOUNT"}
                    </div>
                ))}
            </div>
            {rows.map((row, i) => (
                <LedgerRow
                    key={row.id}
                    row={row}
                    previous={rows[i - 1]}
                    next={rows[i + 1]}
                    sheet={sheet}
                    cols={cols}
                    template={template}
                    unit={unit}
                    period={period}
                />
            ))}
        </div>
    );
}

function LedgerRow({
    row,
    previous,
    next,
    sheet,
    cols,
    template,
    unit,
    period,
}: {
    row: Row;
    previous: Row | undefined;
    next: Row | undefined;
    sheet: BalanceSheet;
    cols: Column[];
    template: CSSProperties;
    unit: boolean;
    period: Period;
}) {
    const sum = row.kind === "subtotal" || row.kind === "total";
    const padding =
        row.level === 0 ? "py-[7px]" : row.level === 1 ? "py-[3px]" : "py-0.5";

    return (
        <div
            role="row"
            className={cn(
                "grid",
                row.level === 0 &&
                    (sum
                        ? "border-t-[1.5px] border-pine-700 bg-(--bs-subtotal)"
                        : "border-t border-bone-300"),
                row.kind === "total" &&
                    "border-b-[3px] border-double border-pine-700",
            )}
            style={template}
        >
            <div role="rowheader" className="flex">
                <RowLabel
                    row={row}
                    padding={padding}
                    first={previous?.level !== 2}
                    last={next?.level !== 2}
                />
            </div>
            {unit && (
                <div
                    className={cn(
                        "flex items-center gap-1 px-2 font-mono text-xs font-normal whitespace-nowrap text-(--bs-muted)",
                        padding,
                    )}
                >
                    {row.unit && <UnitLabel unit={row.unit} />}
                </div>
            )}
            {cols.map((col) => (
                <div
                    key={`${col.period}-${col.field}`}
                    role="cell"
                    className={cn(
                        "px-2 text-right font-mono",
                        padding,
                        ruleClass(col),
                        col.period === period && "bg-(--bs-highlight)",
                    )}
                >
                    <CellValue row={row} col={col} sheet={sheet} />
                </div>
            ))}
        </div>
    );
}

/**
 * A row's label, indented by level. A breakdown hangs off a guide line under
 * its parent; a sub-breakdown keeps that line and adds a shorter one of its
 * own.
 */
function RowLabel({
    row,
    padding,
    first,
    last,
}: {
    row: Row;
    padding: string;
    first: boolean;
    last: boolean;
}) {
    const label = (
        <span>
            {(row.kind === "subtotal" || row.kind === "total") && (
                <span className="font-mono text-[13px] font-normal text-bone-300">
                    ={" "}
                </span>
            )}
            {row.label}
        </span>
    );
    if (row.level === 0) {
        return (
            <div
                className={cn(
                    "flex-1 px-2.5 text-base font-bold text-pine-800",
                    padding,
                )}
            >
                {label}
            </div>
        );
    }
    if (row.level === 1) {
        return (
            <div className="flex flex-1 pl-3.5">
                <div
                    className={cn(
                        "flex-1 border-l-2 border-bone-300 pr-2.5 pl-3 text-[15px] text-(--bs-muted)",
                        padding,
                    )}
                >
                    {label}
                </div>
            </div>
        );
    }
    return (
        <div className="flex flex-1 pl-3.5">
            <div className="flex flex-1 border-l-2 border-bone-300 pl-[22px]">
                <div
                    className={cn(
                        "flex-1 border-l-2 border-bone-300 pr-2.5 pl-3 text-[13px] text-(--bs-level-2)",
                        padding,
                        first && "mt-1",
                        last && "mb-1",
                    )}
                >
                    {label}
                </div>
            </div>
        </div>
    );
}

function UnitLabel({ unit }: { unit: RowUnit }) {
    const coin = <CoinIcon className="size-[13px]" />;
    const times = <span className="opacity-60">×</span>;
    return unit === "energy" ? (
        <>
            MWh {times} {coin}/MWh
        </>
    ) : (
        <>
            % {times} {coin}
        </>
    );
}

function CellValue({
    row,
    col,
    sheet,
}: {
    row: Row;
    col: Column;
    sheet: BalanceSheet;
}) {
    if (row.kind === "pending") {
        return col.field === "amount" ? (
            <span className="text-sm text-(--bs-muted) italic">pending</span>
        ) : null;
    }

    let cell;
    if (col.period === "round") {
        if (row.roundAmount !== undefined) {
            cell = { amount: row.roundAmount };
        } else if (sheet.total) {
            cell = row.cell(sheet.total);
        } else {
            return <Dash />;
        }
    } else {
        // Investments and net profit belong to the Round as a whole.
        if (row.roundAmount !== undefined) return null;
        const season = sheet.seasons.find((s) => s.season === col.period)!;
        if (season.status === "upcoming") {
            return col.field === "amount" ? <Dash /> : null;
        }
        if (season.status === "skipped" || !season.sheet) {
            return col.field === "amount" && row.level === 0 ? (
                <span
                    className="text-sm text-(--bs-muted) italic"
                    title="Not played: a blackout ended the Round"
                >
                    skipped
                </span>
            ) : null;
        }
        cell = row.cell(season.sheet);
    }

    if (col.field !== "amount") {
        const value = col.field === "volume" ? cell.volume : cell.rate;
        if (value === undefined) return null;
        return (
            <span className="text-[12.5px] font-normal text-(--bs-light)">
                {col.field === "volume"
                    ? formatVolume(value)
                    : formatRate(value)}
            </span>
        );
    }
    if (cell.amount === null) return null;
    return (
        <span className={amountClass(row, cell.amount)}>
            {formatAmount(cell.amount)}
        </span>
    );
}

function amountClass(row: Row, amount: number): string {
    if (row.level === 2) return "text-xs font-normal text-(--bs-light)";
    if (row.level === 1) return "text-[13px] font-normal text-pine-700";
    return cn(
        row.kind === "total" ? "text-[15.5px]" : "text-sm",
        row.kind === "line" ? "font-medium" : "font-bold",
        amount < 0 ? "text-(--bs-negative)" : "text-(--bs-positive)",
    );
}

function Dash() {
    return <span className="text-(--bs-muted)">–</span>;
}
