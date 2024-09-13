import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
    }),
    dts({
      entryRoot: "src",
      insertTypesEntry: true, // 插入类型声明文件
      outDir: "dist/types", // 指定类型声明文件的输出目录
    }),
  ],
  resolve: {
    alias: {
      // @ 替代为 src
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:9001",
        changeOrigin: true,
      },
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "IndexedDBVideo",
      fileName: `indexeddb-video`,
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: ["react"],
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {
          react: "React",
        },
        // manualChunks(id: string) {
        //   if (id.includes("/node_modules/")) return "vendor";
        // },
      },
    },
  },
});
