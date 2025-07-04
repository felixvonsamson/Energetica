import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: "/static/react/",
    build: {
        outDir: '../energetica/static/react',
        emptyOutDir: true
    }
});