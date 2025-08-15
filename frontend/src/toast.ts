export function showToast(message: string, type: "info" | "success" | "error" = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    console.log("Showing toast")
    container.appendChild(toast);

    // Remove after animation finishes
    setTimeout(() => {
        toast.remove();
    }, 3000);
}