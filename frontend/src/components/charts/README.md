# Chart Components

Generic, reusable chart components for creating time-series visualizations.

## Components

### TimeSeriesChart

A flexible chart component that supports multiple chart types (area, line, bar) with consistent configuration.

### ResolutionPicker

A resolution selector that shows only time ranges with sufficient data.

### ChartLoadingState

Standard loading indicator for charts.

## Usage Example

```ts
import { TimeSeriesChart, ResolutionPicker, filterNonZeroSeries } from "@/components/charts";
import { useCurrentChartData } from "@/hooks/useCharts";
import { getAssetColor } from "@/lib/asset-colors";

function MyChart({ currentTick, dataPoints, resolution }) {
    const { chartData, isLoading, isError } = useCurrentChartData({
        chartType: "my-chart-type",
        currentTick,
        resolution,
        maxDatapoints: dataPoints,
    });

    const chartConfig = {
        chartVariant: "area", // or "line" or "bar"
        stacked: true,
        height: 400,
        showBrush: true,
        getColor: getAssetColor,
        filterDataKeys: filterNonZeroSeries,
    };

    return (
        <TimeSeriesChart
            data={chartData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}
```

## Chart Configuration Options

| Option           | Type                                                | Description                                       |
| ---------------- | --------------------------------------------------- | ------------------------------------------------- |
| `chartVariant`   | `"area" \| "line" \| "bar"`                         | Type of chart to render                           |
| `stacked`        | `boolean`                                           | Whether to stack multiple series (default: false) |
| `height`         | `number`                                            | Chart height in pixels (default: 400)             |
| `showBrush`      | `boolean`                                           | Show zoom/pan brush control (default: true)       |
| `getColor`       | `(key: string) => string`                           | Function to get color for each data series        |
| `filterDataKeys` | `(key: string, data: any[]) => boolean`             | Function to filter which series to display        |
| `formatYAxis`    | `(value: number) => string`                         | Custom Y-axis formatter                           |
| `formatTooltip`  | `(value: number, name: string) => [string, string]` | Custom tooltip formatter                          |

## Data Filtering Utilities

### filterNonZeroSeries

Excludes series where all values are zero.

### includeAllSeries

Includes all series (no filtering).

### createExcludeKeysFilter(keys)

Creates a filter that excludes specific keys.

### createIncludeKeysFilter(keys)

Creates a filter that only includes specific keys.

## Creating New Chart Types

1. Add your chart type to the backend API
2. Create a component that fetches data using `useCurrentChartData`
3. Configure `TimeSeriesChart` with appropriate settings
4. Use `ResolutionPicker` for time range selection

See `frontend/src/routes/app/overviews/power.tsx` for a complete example.
