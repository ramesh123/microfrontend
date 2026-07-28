import { defineConfig } from 'vite'
import fs from "fs";
//import bodyParser from "body-parser";
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({ 
  // base: '/', // Change to '/your-subdirectory/' if deployed to a subdirectory
  plugins: [react(), tailwindcss()],
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
