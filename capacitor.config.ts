import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.junglerush.game",
  appName: "Jungle Rush",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;