const webpack = require('webpack');
const version = require('./package.json').version;

module.exports = {
  entry: {
      main:               './src/js/main.js',
      dfp:                './src/js/dfp.js',
      article:            './src/js/article.jsx',
      vendors:            './src/js/vendors.js',
      a:                  './src/js/advertise.js',
      a_new:              './src/js/advertise_new.js',
      'one-year-later':   './src/js/one-year-later.js',
      'food-insecurity':  './src/js/food-insecurity.jsx',
      'guide-2020':       './src/js/guide-2020.js',
      'magazine-2019':    './src/js/magazine-2019.js',
      'magazine-2020':    './src/js/magazine-2020.js',
      blockadblock:       './src/js/blockadblock.js'
  },
  output: {
      path: __dirname + '/dist/js',
      filename: '[name]-' + version + '.js'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.traceDeprecation': true
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  ]
};
