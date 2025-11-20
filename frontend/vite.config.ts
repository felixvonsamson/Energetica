import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => ({
    plugins: [
        // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
        tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
        }),
        tailwindcss(),
        react()
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/components'),
            '@hooks': path.resolve(__dirname, './src/hooks'),
            '@lib': path.resolve(__dirname, './src/lib'),
            '@contexts': path.resolve(__dirname, './src/contexts'),
            '@types': path.resolve(__dirname, './src/types'),
            '@styles': path.resolve(__dirname, './src/styles'),
        },
    },
    base: mode === 'development' ? '/' : '/static/react/',
    server: {
        proxy: {
            '^/landing$': {
                target: 'http://localhost:5001/landing',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/landing/, '')
            },
            '/sign-up': {
                target: 'http://localhost:5001/sign-up',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/sign-up/, '')
            },
            '/login': {
                target: 'http://localhost:5001/login',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/login/, '')
            },
            '/static': {
                target: 'http://localhost:5001/static',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/static/, '')
            },
            '/api': {
                target: 'http://localhost:5001/api',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            }
        }
    },
    build: {
        outDir: '../energetica/static/react',
        emptyOutDir: true
    }
}));