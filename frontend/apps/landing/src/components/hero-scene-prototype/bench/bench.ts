// Standalone Bun script, not app code: declare just the Bun and process APIs it uses.
declare const Bun: {
    spawn(cmd: string[], opts: object): { kill(): void };
    sleep(ms: number): Promise<void>;
};
declare const process: { argv: string[] };
export {};

/**
 * PROTOTYPE (issue #1440): scroll-performance benchmark for the hero variants.
 *
 * Launches headless Chrome, opens each variant with `?bench`, waits for the
 * page's own measurement (see the `?bench` effect in hero-scene-prototype.tsx)
 * and prints it. Headless numbers are only comparable with each other, not with
 * a real browser window.
 *
 * Bun bench.ts http://localhost:5199 projected raster-depth
 */
const [base = "http://localhost:5175", ...variants] = process.argv.slice(2);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;

const chrome = Bun.spawn(
    [
        CHROME,
        "--headless=new",
        `--remote-debugging-port=${PORT}`,
        "--user-data-dir=/tmp/hero1440-bench-profile",
        "--window-size=1300,1500",
        "--force-device-scale-factor=2",
        "--hide-scrollbars",
        "about:blank",
    ],
    { stdout: "ignore", stderr: "ignore" },
);

async function cdpTarget(url: string): Promise<string> {
    for (let i = 0; i < 50; i++) {
        try {
            const r = await fetch(
                `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,
                { method: "PUT" },
            );
            const t = (await r.json()) as { webSocketDebuggerUrl: string };
            return t.webSocketDebuggerUrl;
        } catch {
            await Bun.sleep(200);
        }
    }
    throw new Error("Chrome did not start");
}

/**
 * Runs the expression, and reports main-thread time spent while it ran
 * (Chrome's Performance domain: script, style recalculation, layout, all
 * tasks), in ms.
 */
async function evaluate(ws: string, expression: string): Promise<unknown> {
    const sock = new WebSocket(ws);
    await new Promise((r) => sock.addEventListener("open", r, { once: true }));
    let next = 0;
    const call = (method: string, params: object = {}) =>
        new Promise<{
            result?: { value?: unknown };
            metrics?: { name: string; value: number }[];
        }>((resolve) => {
            const id = ++next;
            const on = (e: MessageEvent) => {
                const msg = JSON.parse(String(e.data));
                if (msg.id !== id) return;
                sock.removeEventListener("message", on);
                resolve(msg.result ?? msg);
            };
            sock.addEventListener("message", on);
            sock.send(JSON.stringify({ id, method, params }));
        });
    const metrics = async () => {
        const r = await call("Performance.getMetrics");
        return Object.fromEntries(
            (
                (r as { metrics: { name: string; value: number }[] }).metrics ??
                []
            ).map((m) => [m.name, m.value]),
        );
    };
    await call("Performance.enable");
    const before = await metrics();
    const res = await call("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
    });
    const after = await metrics();
    sock.close();
    const ms = (k: string) =>
        Math.round(((after[k] ?? 0) - (before[k] ?? 0)) * 1000);
    return {
        ...((res.result?.value as object) ?? {}),
        mainThreadMs: {
            task: ms("TaskDuration"),
            style: ms("RecalcStyleDuration"),
            layout: ms("LayoutDuration"),
            script: ms("ScriptDuration"),
        },
    };
}

try {
    for (const v of variants.length ? variants : ["projected"]) {
        const ws = await cdpTarget(`${base}/?variant=${v}&amp=80&bench`);
        await Bun.sleep(1500);
        const res = await evaluate(
            ws,
            "new Promise(r => { const w = () => window.__heroBench ? window.__heroBench.then(r) : setTimeout(w, 100); w(); })",
        );
        console.log(v.padEnd(14), JSON.stringify(res));
    }
} finally {
    chrome.kill();
}
