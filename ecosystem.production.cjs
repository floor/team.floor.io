// PM2 Ecosystem Configuration — team.floor.io (production, on the floor.io server)
//
// Serves the built site. `scripts/deploy.sh` fetches the reference, builds the site and
// then reloads this process; nothing here builds anything.
//
// The server proxying team.floor.io to this port is the operator's (as md3.io's is); this
// file only says how the process runs.
module.exports = {
  apps: [
    {
      name: "team.floor.io",
      script: "bun",
      args: "server.ts",
      interpreter: "none",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 4310,
        HOST: "127.0.0.1",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
