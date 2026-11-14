// Standalone Bun script, not app code: declare just the Bun and process APIs it uses.
declare const Bun: {
    spawn(cmd: string[], opts: object): { kill(): void };
    sleep(ms: number): Promise<void>;
};
declare const process: { argv: string[] };
export {};

/**
 * PROTOTYPE (issue #1440): evaluate a JS expression in a page under headless
 * Chrome.
 *
 * Bun probe.ts "http://localhost:5199/?variant=projected" "document.title"
 * [waitMs]
 */
const [url = "", expression = "document.title", wait = "3000"] =
    process.argv.slice(2);
const PORT = 9334;
const chrome = Bun.spawn(
    [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless=new",
        `--remote-debugging-port=${PORT}`,
        "--user-data-dir=/tmp/hero1440-probe-profile",
        "--window-size=1300,1100",
        "about:blank",
    ],
    { stdout: "ignore", stderr: "ignore" },
);
try {
    let ws = "";
    for (let i = 0; i < 50 && !ws; i++) {
        try {
            const r = await fetch(
                `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,
                { method: "PUT" },
            );
            ws = ((await r.json()) as { webSocketDebuggerUrl: string })
                .webSocketDebuggerUrl;
        } catch {
            await Bun.sleep(200);
        }
    }
    await Bun.sleep(Number(wait));
    const sock = new WebSocket(ws);
    await new Promise((r) => sock.addEventListener("open", r, { once: true }));
    const value = await new Promise((resolve) => {
        sock.addEventListener("message", (e) => {
            const msg = JSON.parse(String(e.data));
            if (msg.id === 1) resolve(msg.result?.result?.value ?? msg);
        });
        sock.send(
            JSON.stringify({
                id: 1,
                method: "Runtime.evaluate",
                params: { expression, awaitPromise: true, returnByValue: true },
            }),
        );
    });
    console.log(JSON.stringify(value, null, 1));
    sock.close();
} finally {
    chrome.kill();
}
