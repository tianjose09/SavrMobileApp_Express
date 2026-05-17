module.exports = {
  apps: [
    {
      name: 'savr-api',
      script: 'src/app.js',
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 2000,
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
