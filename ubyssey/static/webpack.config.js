var webpack = require('webpack');

module.exports = {
    entry: {
        main:    './src/js/main.js',
        dfp:     './src/js/dfp.js',
        article: './src/js/article.jsx',
        section: './src/js/section.jsx'
    },
    output: {
        path: __dirname + '/dist/js',
        filename: '[name].js'
    },
    module: {
      loaders: [
        {test: /\.jsx$/, include: __dirname + '/src/js', loader: 'babel-loader'}
      ]
    }
};
