import {
    Calendar,
    Cloud,
    CloudSun,
    Droplets,
    Moon,
    Sun,
    Sunrise,
    Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useWeather } from "@/hooks/use-weather";

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
] as const;

function getShortMonthName(monthNumber: number): string {
    return MONTH_NAMES[monthNumber - 1] ?? "???";
}

function getSkyIcon(clearSkyValue: number, csi: number): LucideIcon {
    if (clearSkyValue < 10) return Moon;
    if (csi < 0.4) return Cloud;
    if (csi <= 0.8) return CloudSun;
    if (clearSkyValue <= 250) return Sunrise;
    return Sun;
}

function getWindLabel(windSpeed: number): string {
    if (windSpeed < 20) return "Low";
    if (windSpeed < 50) return "Medium";
    if (windSpeed < 80) return "High";
    return "Storm";
}

function getRiverLabel(riverSpeed: number): string {
    if (riverSpeed < 1) return "Low";
    if (riverSpeed < 2) return "Medium";
    return "High";
}

interface WeatherItemProps {
    icon: LucideIcon;
    label: string;
    value: string;
    sub?: string;
}

function WeatherItem({ icon: Icon, label, value, sub }: WeatherItemProps) {
    return (
        <div className="flex items-center gap-3">
            <Icon className="w-8 h-8 shrink-0 text-foreground" />
            <div className="leading-tight">
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className="font-semibold text-base">
                    {value}
                    {sub && (
                        <span className="font-normal text-muted-foreground ml-1.5">
                            {sub}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export function WeatherSection() {
    const { data: weatherData, isLoading, isError } = useWeather();

    if (isLoading) {
        return (
            <div className="text-center text-muted-foreground text-sm py-1">
                Loading weather…
            </div>
        );
    }

    if (isError || !weatherData) {
        return (
            <div className="text-center text-destructive text-sm py-1">
                Failed to load weather data
            </div>
        );
    }

    const SkyIcon = getSkyIcon(
        weatherData.clear_sky_value,
        weatherData.clear_sky_index,
    );
    const windLabel = getWindLabel(weatherData.wind_speed);
    const riverLabel = getRiverLabel(weatherData.river_flow_speed);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 justify-around items-center gap-y-3 px-1">
            {/* Month */}
            <WeatherItem
                icon={Calendar}
                label="Month"
                value={getShortMonthName(weatherData.month_number)}
            />

            {/* Solar irradiance + sky condition */}
            <WeatherItem
                icon={SkyIcon}
                label="Irradiance"
                value={`${Math.round(weatherData.solar_irradiance)} W/m²`}
            />

            {/* Wind */}
            <WeatherItem
                icon={Wind}
                label="Wind"
                value={windLabel}
                sub={`${Math.round(weatherData.wind_speed)} km/h`}
            />

            {/* River flow */}
            <WeatherItem
                icon={Droplets}
                label="River flow"
                value={riverLabel}
                sub={`${weatherData.river_flow_speed.toFixed(1)} m/s`}
            />
        </div>
    );
}
