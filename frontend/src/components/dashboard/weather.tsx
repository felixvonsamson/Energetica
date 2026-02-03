import { Card, CardTitle } from "@/components/ui/card";
import { useWeather } from "@/hooks/useWeather";
import { getMonthName } from "@/lib/date-utils";

export function WeatherSection() {
    const {
        data: weatherData,
        isLoading: isWeatherLoading,
        isError: isWeatherError,
    } = useWeather();

    return (
        <Card>
            <CardTitle className="text-center mb-4">
                Current weather conditions
            </CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                {isWeatherLoading ? (
                    <div className="col-span-full text-center text-gray-500">
                        Loading...
                    </div>
                ) : isWeatherError ? (
                    <div className="col-span-full text-center text-alert-red">
                        Failed to load weather data
                    </div>
                ) : weatherData ? (
                    <>
                        {/* Month with year progress indicator */}
                        <div className="px-2">
                            <div className="mb-2 whitespace-nowrap">
                                Month:{" "}
                                <b>{getMonthName(weatherData.month_number)}</b>
                            </div>
                            <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full">
                                {/* Full-width padded container defines the travel range */}
                                <div className="absolute inset-0 mx-3 flex items-center">
                                    {/* Positioned wrapper moves within the padded space */}
                                    <div
                                        className="absolute"
                                        style={{
                                            left: `${weatherData.year_progress * 100}%`,
                                        }}
                                    >
                                        {/* Dot centred on position */}
                                        <div className="w-3 h-3 bg-pine dark:bg-brand-green rounded-full -translate-x-1/2" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Solar Irradiance with visual bar */}
                        <div className="px-2">
                            <div className="mb-2 whitespace-nowrap">
                                Irradiance:{" "}
                                <b>
                                    {Math.round(weatherData.solar_irradiance)}{" "}
                                    W/m²
                                </b>
                            </div>
                            <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-yellow-500 dark:bg-yellow-400 transition-all duration-300"
                                    style={{
                                        width: `${Math.min(100, (weatherData.solar_irradiance / 1000) * 100)}%`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Wind Speed with visual bar */}
                        <div className="px-2">
                            <div className="mb-2 whitespace-nowrap">
                                Wind speed:{" "}
                                <b>{Math.round(weatherData.wind_speed)} km/h</b>
                            </div>
                            <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 dark:bg-cyan-400 transition-all duration-300"
                                    style={{
                                        width: `${Math.min(100, (weatherData.wind_speed / 60) * 100)}%`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* River Discharge with visual bar */}
                        <div className="px-2">
                            <div className="mb-2 whitespace-nowrap">
                                River discharge:{" "}
                                <b>
                                    {Math.round(weatherData.river_discharge)}{" "}
                                    m³/s
                                </b>
                            </div>
                            <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300"
                                    style={{
                                        width: `${Math.min(100, (weatherData.river_discharge / 150) * 100)}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </Card>
    );
}
