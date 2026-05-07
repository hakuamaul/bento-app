import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "expo-file-system/legacy": path.resolve(__dirname, "tests/__mocks__/expo-file-system.ts"),
      "expo-sharing": path.resolve(__dirname, "tests/__mocks__/expo-sharing.ts"),
      "react-native": path.resolve(__dirname, "tests/__mocks__/react-native.ts"),
      "@react-native-async-storage/async-storage": path.resolve(__dirname, "tests/__mocks__/@react-native-async-storage/async-storage.ts"),
    },
  },
});
