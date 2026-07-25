import { defineConfig } from 'vite'
import fs from "fs";
//import bodyParser from "body-parser";
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  // base: '/', // Change to '/your-subdirectory/' if deployed to a subdirectory
  plugins: [
    react(),
    tailwindcss(),
    // Module Federation REMOTE config — workflow-app is consumed by container-app
    // as a single "whole-app" remote (see micro-frontend/shared for the documented
    // contract of remote name / exposed module paths). Nothing else in this file,
    // and no file under src/, changes because of federation.
    federation({
      name: 'workflowApp',
      filename: 'remoteEntry.js',
      exposes: {
        // Primary export: the entire app (BrowserRouter + all providers + RoutesApp)
        // exactly as it renders standalone today. This is what container-app mounts.
        './WorkflowApp': './src/App.tsx',
        // Bonus fine-grained exposes for future, more targeted federation use.
        './WorkflowRoutes': './src/router.tsx',
        './WorkflowHomePage': './src/pages/HomePage/index.tsx',
        './WorkflowDashboard': './src/pages/HomePage/components/dashboard/index.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.1.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
        'react-router': { singleton: true, requiredVersion: '^7.6.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^7.6.0' },
      },
    }),
  ],
  build: {
    // Required by @originjs/vite-plugin-federation: the remote entry format
    // relies on top-level await / native ESM features only available at esnext.
    target: 'esnext',
    modulePreload: false,
    cssCodeSplit: false,
  },
  server: {
    port: 5317,
    // setupMiddlewares(middlewares, server) {
    //   server.middlewares.use(bodyParser.json({ limit: "100mb" }));
    //   server.middlewares.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
    //   return middlewares;
    // },
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
    watch: {
      usePolling: false, // if true, can cause unnecessary reloads
    },
    proxy: {
      "/api/v2": {
        target: "https://test.datafusion.algofusiontech.com",
        changeOrigin: true,
        ws: true, // WebSocket support
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            console.error("DataFusion API proxy error:", err.message);
            console.error("Req : ", req.url)
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "text/html" });
              const fallback = "/usr/share/nginx/html/custom_502.html";
              if (fs.existsSync(fallback)) {
                fs.createReadStream(fallback).pipe(res);
              } else {
                res.end("<h1>502 Bad Gateway</h1>");
              }
            }
          });
        },
      },
      "/api": {
        target: "https://demo.datafusion.algofusiontech.com",
        changeOrigin: true,
        ws: true, // WebSocket support
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            console.error("API proxy error:", err.message);
            console.error("Req : ", req.url)
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "text/html" });
              const fallback = "/usr/share/nginx/html/custom_502.html";
              if (fs.existsSync(fallback)) {
                fs.createReadStream(fallback).pipe(res);
              } else {
                res.end("<h1>502 Bad Gateway</h1>");
              }
            }
          });
        },
      },
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  }
})
