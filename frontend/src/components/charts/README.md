# The persistent world's charts

The charts the persistent world shares with the Workshop live in `@energetica/charts` (`frontend/packages/charts`): the time-series chart, the power chart, the storage chart and the merit-order view. They only display what they are given. This folder holds the persistent world's side:

- `echarts-time-series.tsx`: `EChartsTimeSeries`, the shared `TimeSeriesChart` on the persistent world's time axis (`useGameTimeAxis`), which counts back from the current game tick. It also has `chartTypeConfig`, which gives a chart type's series order, and the facility labels the persistent world's charts show in their tooltips.
- The charts only the persistent world has, such as the emissions, cash flow and market charts. They fetch their data through the hooks in `@/hooks/use-charts`.
- The overview tables below the power and storage charts, which read the player's facilities.

## Example

```tsx
import {
  EChartsTimeSeries,
  chartTypeConfig,
} from "@/components/charts/echarts-time-series";
import type { EChartsTimeSeriesConfig } from "@energetica/charts/components/time-series-chart";
import { useAssetColorGetter } from "@energetica/ui/hooks/use-asset-color-getter";

function MyChart({ chartData, isLoading, isError }) {
  const getColor = useAssetColorGetter();
  const config: EChartsTimeSeriesConfig = useMemo(
    () => ({
      ...chartTypeConfig("emissions"),
      chartVariant: "area",
      stacked: true,
      getColor,
      formatValue: formatEmissions,
    }),
    [getColor],
  );
  return (
    <EChartsTimeSeries
      data={chartData}
      config={config}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
```

See `frontend/src/routes/app/overviews/power.tsx` for a page that uses a shared chart, the power chart, with the persistent world's time axis.
