/**
 * The scrubber of a Trading period's review (#1007): it picks the settlement
 * point the merit order shows, and the charts mark. It steps through one
 * simulated day at a time, one settlement point per step, and can play through
 * them on its own.
 *
 * Each viewer scrubs at their own pace. Pausing stops on the point shown, so
 * the moderator can talk the room through it.
 */

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { Slider } from "@/components/ui/slider";
import { timeOfDay } from "@/lib/workshop-review";

/** How many times faster than the base pace playing can go. */
const SPEEDS = ["1", "2", "4"] as const;
type Speed = (typeof SPEEDS)[number];

/** At the base pace, playing through a whole day takes this long. */
const SECONDS_PER_DAY_AT_BASE_PACE = 24;

interface PeriodScrubberProps {
    /** The period's point the day starts at. */
    first: number;
    /** The points in the day. */
    count: number;
    /** The last point that can be shown, such as the one the grid went down at. */
    last: number;
    clearingsPerDay: number;
    point: number;
    onPointChange: (point: number) => void;
}

export function PeriodScrubber({
    first,
    count,
    last,
    clearingsPerDay,
    point,
    onPointChange,
}: PeriodScrubberProps) {
    const end = Math.min(first + count - 1, last);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState<Speed>("1");

    // Playing moves on one point at a time, and stops on the day's last.
    useEffect(() => {
        if (!playing || point >= end) return;
        const delay =
            (SECONDS_PER_DAY_AT_BASE_PACE * 1000) /
            clearingsPerDay /
            Number(speed);
        const timer = setTimeout(() => {
            onPointChange(point + 1);
            if (point + 1 >= end) setPlaying(false);
        }, delay);
        return () => clearTimeout(timer);
    }, [playing, point, end, speed, clearingsPerDay, onPointChange]);

    const step = (by: number) => {
        setPlaying(false);
        onPointChange(Math.max(first, Math.min(end, point + by)));
    };

    const togglePlaying = () => {
        // Playing from the day's end starts it again.
        if (!playing && point >= end) onPointChange(first);
        setPlaying(!playing);
    };

    const disabled = end < first;

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => step(-1)}
                    disabled={disabled || point <= first}
                    aria-label="Previous settlement point"
                >
                    <SkipBack />
                </Button>
                <Button
                    size="icon"
                    onClick={togglePlaying}
                    disabled={disabled}
                    aria-label={playing ? "Pause" : "Play"}
                >
                    {playing ? <Pause /> : <Play />}
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => step(1)}
                    disabled={disabled || point >= end}
                    aria-label="Next settlement point"
                >
                    <SkipForward />
                </Button>
            </div>
            <span className="w-12 font-mono text-sm tabular-nums">
                {timeOfDay(point, clearingsPerDay)}
            </span>
            <Slider
                className="min-w-40 flex-1"
                min={first}
                max={Math.max(first, end)}
                step={1}
                value={[point]}
                onValueChange={(values) => {
                    setPlaying(false);
                    onPointChange(values[0] ?? first);
                }}
                disabled={disabled}
                aria-label="Settlement point"
            />
            <SegmentedPicker
                value={speed}
                onValueChange={(value) => setSpeed(value as Speed)}
            >
                {SPEEDS.map((option) => (
                    <SegmentedPickerOption key={option} value={option}>
                        {option}×
                    </SegmentedPickerOption>
                ))}
            </SegmentedPicker>
        </div>
    );
}
