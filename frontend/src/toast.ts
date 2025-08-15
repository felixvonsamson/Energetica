export function showToast(
    message: string,
    type: "info" | "success" | "error" = "info",
    duration = 3000
) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;

    // Start hidden (opacity 0 / translateY(-10px))
    container.appendChild(el);

    // Let it render so we can measure height
    requestAnimationFrame(() => {
        // Measure natural height and lock it so we can animate to 0 later
        const h = el.scrollHeight;
        el.style.height = h + "px";

        // Now trigger the enter transition
        el.classList.add("show");
    });

    // Schedule close
    const close = () => {
        // Add closing class to animate opacity/transform/margins/padding
        el.classList.add("closing");

        // From locked height -> 0 for smooth collapse
        // Force reflow to ensure the browser registers the starting height
        // @ts-ignore – accessing offsetHeight just to force layout
        void el.offsetHeight;
        el.style.height = "0px";

        // Remove after the height transition completes
        const onEnd = (e: TransitionEvent) => {
            if (e.propertyName === "height") {
                el.removeEventListener("transitionend", onEnd);
                el.remove();
            }
        };
        el.addEventListener("transitionend", onEnd);
    };

    const timer = window.setTimeout(close, duration);

    // Optional: click to dismiss early
    el.addEventListener("click", () => {
        window.clearTimeout(timer);
        close();
    });
}