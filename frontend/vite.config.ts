import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => ({
    plugins: [
        // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
        }),
        tailwindcss(),
        react(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@components": path.resolve(__dirname, "./src/components"),
            "@hooks": path.resolve(__dirname, "./src/hooks"),
            "@lib": path.resolve(__dirname, "./src/lib"),
            "@contexts": path.resolve(__dirname, "./src/contexts"),
            "@types": path.resolve(__dirname, "./src/types"),
            "@styles": path.resolve(__dirname, "./src/styles"),
        },
    },
    base: mode === "development" ? "/" : "/static/react/",
    server: {
        proxy: {
            "^/landing$": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            "/home": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            "/sign-up": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            "/location_choice": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            "/login": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            "/logout": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            "/static": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            "/api": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            "/socket.io": {
                target: "http://localhost:5001",
                changeOrigin: true,
                ws: true,
            },
        },
    },
    build: {
        outDir: "../energetica/static/react",
        emptyOutDir: true,
    },
}));
