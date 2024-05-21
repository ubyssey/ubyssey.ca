const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: {
    main: './src/js/main.js',
    dfp: './src/js/dfp.js',
    home: './src/js/home.js',
    infinitefeed: './src/js/infinitefeed.js',
    article: './src/js/article.jsx',
    vendors: './src/js/vendors.js',
    a_new: './src/js/advertise_new.js',
    'visual-essay': './src/js/visual-essay.js',
    'scrollTop': './src/js/scrollTop.js',
    'one-year-later': './src/js/one-year-later.js',
    'sport-series': './src/js/sport-series.js',
    'food-insecurity': './src/js/food-insecurity.jsx',
    'guide-2020': './src/js/guide-2020.js',
    'guide-2021': './src/js/guide-2021.js',
    'magazine-2019': './src/js/magazine-2019.js',
    'magazine-2020': './src/js/magazine-2020.js',
    'magazine-2021': './src/js/magazine-2021.js',
    'infinite': './src/js/infinite.js',
    'soccer_nationals': './src/js/soccer_nationals.js',
    'timeline': './src/js/timeline.js',
    blockadblock: './src/js/blockadblock.js',
    darkmode: './src/js/darkmode.js',
    youtube: './src/js/modules/Youtube.js',
    error_page: './src/js/error_page.js'
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
