/**
 * PM2 process definitions for Orbit.
 * Runs the Discord bot and the website as two managed processes with
 * crash-restart, log files and memory guards.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup
 */

module.exports = {
    apps: [
        {
            name: "orbit",
            script: "index.js",
            instances: 1,
            autorestart: true,
            max_restarts: 15,
            restart_delay: 3000,
            max_memory_restart: "400M",
            time: true, // prefix logs with timestamps
            env: { NODE_ENV: "production" },
            error_file: "logs/pm2-orbit-error.log",
            out_file: "logs/pm2-orbit-out.log"
        },
        {
            name: "orbit-web",
            script: "web/server.js",
            instances: 1,
            autorestart: true,
            max_restarts: 15,
            restart_delay: 3000,
            max_memory_restart: "300M",
            time: true,
            env: { NODE_ENV: "production" },
            error_file: "logs/pm2-web-error.log",
            out_file: "logs/pm2-web-out.log"
        }
    ]
};
