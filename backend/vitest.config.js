const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['server.js']
    }
  }
});
