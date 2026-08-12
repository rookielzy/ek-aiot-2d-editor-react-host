const identityOrigin = process.env.IDENTITY_ORIGIN ?? "http://59.36.5.137:1888";

export default {
  "/api/auth/login": {
    target: identityOrigin,
    changeOrigin: true,
    pathRewrite: { "^/api/auth/login$": "/oauth/login" },
  },
  "/api/auth/userinfo": {
    target: identityOrigin,
    changeOrigin: true,
    pathRewrite: {
      "^/api/auth/userinfo$": "/ek/auth/oauth/userinfo",
    },
  },
  "/api/auth/logout": {
    target: identityOrigin,
    changeOrigin: true,
    pathRewrite: { "^/api/auth/logout$": "/oauth/logout" },
  },
};
