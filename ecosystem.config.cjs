// PM2 Ecosystem Configuration — team.floor.io (local dev)
//
// `bun run dev` (scripts/dev.ts) keeps its own two watchers: one rebuilds the assets,
// the other restarts the server, and only after a build succeeded. It also fetches the
// reference it is built against first, so nothing here has to.
//
// This file is for a local pm2, and nothing else: production runs ecosystem.production.cjs,
// and neither is started by hand — scripts/deploy.sh starts or reloads the production one.
module.exports = {
  apps: [
    {
      name: "team.floor.io",
      script: "bun",
      args: "run dev",
      interpreter: "none",
      cwd: __dirname,
      env: {
        PORT: 4310,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
