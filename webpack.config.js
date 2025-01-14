const path = require('path');

module.exports = {

  resolve: {
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "os": require.resolve("os-browserify/browser")
    }
  },

  devServer: {
    watchFiles: {
      paths: ['src/**/*'],
      options: {
        usePolling: true, 
        interval: 1000, 
      },
    },
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      return middlewares;
    },
  },

};
