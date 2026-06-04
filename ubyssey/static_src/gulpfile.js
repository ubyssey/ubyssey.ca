require('@babel/register'); // Pass require()s through babel (for running jasmine)

const {series, parallel, src, dest, watch} = require('gulp');
const log = require('fancy-log');
const PluginError = require('plugin-error');
const jasmine = require('gulp-jasmine');
const clean = require('gulp-clean');
const rename = require('gulp-rename');

const webpack = require('webpack');
const webpackProdConfig = require('./webpack.prod.js');
const webpackDevConfig = require('./webpack.dev.js');

const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');

const fs = require('fs');
//const data = fs.readFileSync('./../../version.txt', 'utf8');
//const version = data.toString();
const version = JSON.parse(fs.readFileSync('./package.json')).version;

function cleanJsTask() {
  return src('../static/ubyssey/js/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}));
}

function cleanCssTask() {
  return src('../static/ubyssey/css/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}));
}

function cleanImagesTask() {
  return src('../static/ubyssey/images/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}));
}

function cleanVideosTask() {
  return src('../static/ubyssey/videos/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}));
}

function cleanFontsTask() {
  return src('../static/ubyssey/fonts/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}));
}

function webpackBuildTask(callback) {
  webpack(webpackProdConfig, function(err, stats) {
    if (err) {
      throw new PluginError('webpackBuildTask', err);
    }

    log('[webpackBuildTask]', stats.toString({ colors: true }));

    callback();
  });
}

function webpackBuildDevTask(callback) {
  webpack(webpackDevConfig, function(err, stats) {
    if (err) {
      throw new PluginError('webpackBuildDevTask', err);
    }

    log('[webpackBuildDevTask]', stats.toString({ colors: true }));
    
    callback();
  });
}

function jasmineTask() {
  return src('./src/**/*.spec.js')
    .pipe(jasmine({verbose: true}));
}

function sassStylesBuildTask() {
  return src('./src/styles/**/*.scss')
      .pipe(sass({ style: 'compressed' }).on('error', sass.logError))
      .pipe(dest('../static/ubyssey/css/'));
}

function sassNewCmsBuildTask() {
  return src('./src/new_cms/*.scss')
      .pipe(sass({ style: 'compressed' }).on('error', sass.logError))
      .pipe(dest('../static/ubyssey/css/new_cms/'));
}

const sassBuildTask = parallel(sassStylesBuildTask, sassNewCmsBuildTask);

function sassStylesBuildDevTask(){
  return src('./src/styles/**/*.scss')
    .pipe(sourcemaps.init())
    .on('end', function(){ log('Almost there...'); })
    .pipe(sass().on('error', sass.logError))
    .on('end', function(){ log('Almost there...'); })
    .pipe(sourcemaps.write())
    .pipe(dest('../static/ubyssey/css/'))
    .on('end', function(){ log('Done!'); });
}

function sassNewCmsBuildDevTask(){
  return src('./src/new_cms/*.scss')
    .pipe(sourcemaps.init())
    .on('end', function(){ log('Almost there...'); })
    .pipe(sass().on('error', sass.logError))
    .on('end', function(){ log('Almost there...'); })
    .pipe(sourcemaps.write())
    .pipe(dest('../static/ubyssey/css/new_cms/'))
    .on('end', function(){ log('Done!'); });
}

const sassBuildDevTask = parallel(sassStylesBuildDevTask, sassNewCmsBuildDevTask);

function copyImagesTask() {
  return src('./src/images/**/*')
    .pipe(dest('../static/ubyssey/images/'));
}

function copyVideosTask() {
  return src('./src/videos/**/*')
    .pipe(dest('../static/ubyssey/videos/'));
}

function copyFontsTask() {
  return src('./src/fonts/**/*')
    .pipe(dest('../static/ubyssey/fonts/'));
}

function watchTask() { 
  watch('./src/js/**/*', series(cleanJsTask, webpackBuildDevTask));
  watch('./src/styles/**/*', series(cleanCssTask, sassBuildDevTask));
  watch('./src/images/**/*', series(cleanImagesTask, copyImagesTask));
  watch('./src/videos/**/*', series(cleanVideosTask, copyVideosTask));
  watch('./src/fonts/**/*',  series(cleanFontsTask, copyFontsTask));
  watch('./src/new_cms/*.scss', series(cleanCssTask, sassBuildDevTask));  
  watch('./src/new_cms/**/*.js', series(cleanJsTask, webpackBuildDevTask));
}

exports.jasmine = jasmineTask
exports.webpackBuild = series(cleanJsTask, webpackBuildTask)
exports.webpackBuildDev = series(cleanJsTask, webpackBuildDevTask)
exports.sassBuild = series(cleanCssTask, sassBuildTask)
exports.sassBuildDev = series(cleanCssTask, sassBuildDevTask)
exports.copyImages = series(cleanImagesTask, copyImagesTask)
exports.copyVideos = series(cleanVideosTask, copyVideosTask)
exports.copyFonts = series(cleanFontsTask, copyFontsTask)
exports.build = series(
  parallel(cleanJsTask, cleanCssTask, cleanImagesTask, cleanVideosTask, cleanFontsTask),
  parallel(webpackBuildTask, sassBuildTask, copyImagesTask, copyVideosTask, copyFontsTask))
exports.buildDev = series(
  parallel(cleanJsTask, cleanCssTask, cleanImagesTask, cleanVideosTask, cleanFontsTask),
  parallel(webpackBuildDevTask, sassBuildDevTask, copyImagesTask, copyVideosTask, copyFontsTask))
exports.watch = series(
  parallel(cleanJsTask, cleanCssTask, cleanImagesTask, cleanVideosTask, cleanFontsTask),
  parallel(webpackBuildDevTask, sassBuildDevTask, copyImagesTask, copyVideosTask, copyFontsTask),
  watchTask)
exports.default = series(
  parallel(cleanJsTask, cleanCssTask, cleanImagesTask, cleanVideosTask, cleanFontsTask),
  parallel(webpackBuildDevTask, sassBuildDevTask, copyImagesTask, copyVideosTask, copyFontsTask),
  watchTask)
