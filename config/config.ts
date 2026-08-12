import { defineConfig } from "@umijs/max";

import routes from "./routes";

export default defineConfig({
  antd: {
    configProvider: {
      theme: {
        cssVar: true,
        token: {
          borderRadius: 6,
          colorPrimary: "#1677ff",
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
        },
      },
    },
  },
  fastRefresh: true,
  hash: true,
  initialState: {},
  layout: {},
  locale: false,
  mako: {},
  model: {},
  presets: ["umi-presets-pro"],
  routes,
  title: "EK AIoT 2D Editor",
});
