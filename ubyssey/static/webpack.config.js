var webpack = require('webpack');
var version = require('./package.json').version;

module.exports = {
    entry: {
        main:             './src/js/main.js',
        dfp:              './src/js/dfp.js',
        article:          './src/js/article.jsx',
        vendors:          './src/js/vendors.js',
        a:                './src/js/advertise.js',
        a_new:            './src/js/advertise_new.js',
        'one-year-later': './src/js/one-year-later.js',
        about:            './src/js/about.js',
        blockadblock:     './src/js/blockadblock.js'
    },
    output: {
        path: __dirname + '/dist/js',
        filename: '[name]-' + version + '.js'
    },
    module: {
      loaders: [
        {
          test: /\.jsx?$/,
          loader: 'babel',
          exclude: /node_modules/
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env': {
          'NODE_ENV': JSON.stringify('production')
        }
      }),
      new webpack.optimize.DedupePlugin(),
      new webpack.optimize.UglifyJsPlugin()
    ]
};
