import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const workflowRemoteUrl =
    env.VITE_WORKFLOW_REMOTE_URL ?? "http://localhost:5317/assets/remoteEntry.js";

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Module Federation HOST config. container-app owns the shell only —
      // every business remote it mounts is declared here.
      federation({
        name: "containerApp",
        remotes: {
          workflowApp: workflowRemoteUrl,
        },
        shared: {
          react: { singleton: true, requiredVersion: "^19.1.0" },
          "react-dom": { singleton: true, requiredVersion: "^19.1.0" },
          "react-router": { singleton: true, requiredVersion: "^7.6.0" },
          "react-router-dom": { singleton: true, requiredVersion: "^7.6.0" },
        },
      }),
    ],
    server: {
      port: 5000,
    },
    build: {
      // Required by @originjs/vite-plugin-federation on both host and remote.
      target: "esnext",
      modulePreload: false,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
