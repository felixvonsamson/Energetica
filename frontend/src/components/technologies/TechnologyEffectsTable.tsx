import { ApiSchema } from "@/types/api-helpers";

type Technology = ApiSchema<"TechnologyCatalogOut">;

interface TechnologyEffectsTableProps {
    technology: Technology;
}

interface EffectRowProps {
    label: string;
    value: number | null | undefined;
    sign?: string;
    suffix?: string;
    hoverInfo?: string;
}

function EffectRow({
    label,
    value,
    sign = "+",
    suffix = "%",
    hoverInfo,
}: EffectRowProps) {
    if (value === null || value === undefined) {
        return null;
    }

    return (
        <tr className="border-b border-pine/10 dark:border-dark-border/30">
            <td className="py-2 px-4 font-semibold">{label}</td>
            <td
                className={`py-2 px-4 text-center font-mono ${
                    hoverInfo ? "hover_info" : ""
                }`}
            >
                {sign}
                {Math.round(value * 100) / 100}
                {suffix}
                {hoverInfo && (
                    <span className="text-xs text-gray-400 ml-2">
                        {hoverInfo}
                    </span>
                )}
            </td>
        </tr>
    );
}

export function TechnologyEffectsTable({
    technology,
}: TechnologyEffectsTableProps) {
    // Some technologies don't have effects (like mathematics in old Jinja version)
    const hasEffects = technology.name !== "mathematics";

    if (!hasEffects) {
        return null;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-tan-green/20 dark:bg-dark-bg-tertiary/30">
                        <th className="py-2 px-4 text-left font-semibold">
                            Effects:
                        </th>
                        <th className="py-2 px-4 text-center font-semibold">
                            lvl {technology.level - 1} → lvl {technology.level}
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-tan-green/20 dark:bg-dark-bg-tertiary/30">
                    {/* Mechanical Engineering & Physics & Aerodynamics & Nuclear Engineering */}
                    <EffectRow
                        label="Power generation"
                        value={technology.power_generation_bonus}
                    />

                    {/* Thermodynamics */}
                    <EffectRow
                        label="Extraction speed"
                        value={technology.extraction_speed_bonus}
                    />
                    <EffectRow
                        label="Fuel use"
                        value={technology.fuel_use_reduction_bonus}
                        sign="-"
                    />
                    <EffectRow
                        label="CO₂ emissions"
                        value={technology.co2_emissions_reduction_bonus}
                        sign="-"
                    />
                    <EffectRow
                        label="Effic. molten salt"
                        value={technology.molten_salt_efficiency_bonus}
                        suffix="pp"
                        hoverInfo="percentage point"
                    />

                    {/* Building Technology */}
                    <EffectRow
                        label="Construction time"
                        value={technology.construction_time_reduction_bonus}
                        sign="-"
                    />
                    {technology.construction_workers && (
                        <tr className="border-b border-pine/10 dark:border-dark-border/30">
                            <td className="py-2 px-4 font-semibold">
                                Construction workers
                            </td>
                            <td className="py-2 px-4 text-center font-mono">
                                {technology.construction_workers.current ?? 0} →{" "}
                                {technology.construction_workers.upgraded ?? 0}
                            </td>
                        </tr>
                    )}

                    {/* Transport Technology */}
                    <EffectRow
                        label="Shipment time"
                        value={technology.shipment_time_reduction_bonus}
                        sign="-"
                    />

                    {/* Mineral Extraction */}
                    <EffectRow
                        label="Power consumption"
                        value={technology.power_consumption_reduction_bonus}
                    />
                    <EffectRow
                        label="Power consumption"
                        value={technology.power_consumption_penalty}
                    />
                    <EffectRow
                        label="CO₂ emissions"
                        value={technology.co2_emissions_penalty}
                    />

                    {/* Civil Engineering */}
                    <EffectRow
                        label="Storage capacity"
                        value={technology.storage_capacity_bonus}
                    />

                    {/* Chemistry */}
                    <EffectRow
                        label="Efficiency hydrogen"
                        value={technology.hydrogen_efficiency_bonus}
                        suffix="pp"
                        hoverInfo="percentage point"
                    />
                    <EffectRow
                        label="Efficiency Li-ion"
                        value={technology.lithium_ion_efficiency_bonus}
                        suffix="pp"
                        hoverInfo="percentage point"
                    />
                    <EffectRow
                        label="Efficiency solid state"
                        value={technology.solid_state_efficiency_bonus}
                        suffix="pp"
                        hoverInfo="percentage point"
                    />

                    {/* Materials & Mechanical Engineering & Physics & Aerodynamics & Nuclear Engineering */}
                    <EffectRow label="Price" value={technology.price_penalty} />
                    <EffectRow
                        label="Price"
                        value={technology.price_reduction_bonus}
                        sign=""
                    />
                    <EffectRow
                        label="Construction power"
                        value={technology.construction_power_reduction_bonus}
                        sign="-"
                    />
                </tbody>
            </table>
        </div>
    );
}
