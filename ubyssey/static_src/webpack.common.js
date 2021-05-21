const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: {
    main: './src/js/main.js',
    dfp: './src/js/dfp.js',
    article: './src/js/article.jsx',
    vendors: './src/js/vendors.js',
    a: './src/js/advertise.js',
    a_new: './src/js/advertise_new.js',
    'one-year-later': './src/js/one-year-later.js',
    'sport-series': './src/js/sport-series.js',
    'food-insecurity': './src/js/food-insecurity.jsx',
    'guide-2020': './src/js/guide-2020.js',
    'magazine-2019': './src/js/magazine-2019.js',
    'magazine-2020': './src/js/magazine-2020.js',
    'magazine-2021': './src/js/magazine-2021.js',
    'infinite-min': './src/js/infinite.min.js',
    'jquery-waypoints-min': './src/js/jquery.waypoints.min.js',
    'ajax_homepage': './src/js/ajax_homepage.js',
    '404': './src/js/404.js',
    blockadblock: './src/js/blockadblock.js'
  },
  output: {
    path: path.join(__dirname, '..', 'static/ubyssey/js'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.(png|jpe?g|gif|mp4)$/i,
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
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
