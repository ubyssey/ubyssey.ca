var gulp = require('gulp');
var gutil = require('gulp-util');
var clean = require('gulp-clean');

var webpack = require('webpack');
//var WebpackDevServer = require('webpack-dev-server');
var webpackConfig = require('./webpack.config.js');

var sass = require('gulp-sass');

var argv = require('minimist')(process.argv.slice(2));

var dev = typeof argv.d !== 'undefined';

gulp.task('sass', function () {
  return gulp.src('./src/styles/**/*.scss')
    .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
    .pipe(gulp.dest('./dist/css/'));
});

gulp.task('webpack', function() {
  return gulp.src('./src/js/**/*.jsx')
    .pipe(webpack( require('./webpack.config.js') ))
    .pipe(gulp.dest('./dist/js/'));
});

gulp.task('copy-images', function() {
  return gulp.src('./src/images/**/*')
    .pipe(gulp.dest('./dist/images/'));
});

gulp.task('copy-fonts', function() {
  return gulp.src('./src/fonts/**/*')
    .pipe(gulp.dest('./dist/fonts/'));
});

gulp.task('clean', function() {
	return gulp.src('./dist/js/', {read: false})
		.pipe(clean());
});

gulp.task('default', ['webpack:build-dev', 'sass', 'copy-images', 'copy-fonts']);

gulp.task('build', ['webpack:build', 'sass', 'copy-images', 'copy-fonts']);

gulp.task('prod-env', function() {
    return process.env.NODE_ENV = 'development';
});

gulp.task('dev-env', function() {
    return process.env.NODE_ENV = 'production';
});

// The development server (the recommended option for development)
// gulp.task('default', ['webpack-dev-server']);

// Build and watch cycle (another option for development)
// Advantage: No server required, can run app from filesystem
// Disadvantage: Requests are not blocked until bundle is available,
//               can serve an old app on refresh
// gulp.task('build-dev', ['webpack:build-dev'], function() {
// 	gulp.watch(["app/**/*"], ["webpack:build-dev"]);
// });

gulp.task('webpack:build', ['clean'], function(callback) {
	var prodConfig = Object.create(webpackConfig);
	prodConfig.plugins = [
		new webpack.DefinePlugin({
			'process.env': {
				'NODE_ENV': JSON.stringify('production')
			}
		}),
		new webpack.optimize.DedupePlugin(),
		new webpack.optimize.UglifyJsPlugin()
	];

	// run webpack
	webpack(prodConfig, function(err, stats) {
		if (err) {
      throw new gutil.PluginError('webpack:build', err);
    }

		gutil.log('[webpack:build]', stats.toString({ colors: true }));

		callback();
	});
});

// modify some webpack config options
var devConfig = Object.create(webpackConfig);
devConfig.devtool = 'sourcemap';
devConfig.debug = true;

devConfig.plugins = [
  new webpack.DefinePlugin({
    'process.env': {
      'NODE_ENV': JSON.stringify('development')
    }
  })
];

// create a single instance of the compiler to allow caching
var devCompiler = webpack(devConfig);

gulp.task('webpack:build-dev', ['clean'], function(callback) {
	devCompiler.run(function(err, stats) {
		if (err) {
      throw new gutil.PluginError('webpack:build-dev', err);
    }

		gutil.log('[webpack:build-dev]', stats.toString({ colors: true }));

		callback();
	});
});

// gulp.task('webpack-dev-server', function(callback) {
// 	// modify some webpack config options
// 	var devServerConfig = Object.create(webpackConfig);
// 	myConfig.devtool = 'eval';
// 	myConfig.debug = true;
//
// 	// Start a webpack-dev-server
// 	new WebpackDevServer(webpack(myConfig), {
// 		publicPath: '/' + myConfig.output.publicPath,
// 		stats: { colors: true }
// 	}).listen(8080, 'localhost', function(err) {
// 		if (err) {
//       throw new gutil.PluginError("webpack-dev-server", err);
//     }
// 		gutil.log('[webpack-dev-server]', 'http://localhost:8080/webpack-dev-server/index.html');
// 	});
// });
