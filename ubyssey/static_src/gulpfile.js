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
var browserSync = require('browser-sync').create();

const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');

var exec = require('child_process').exec;
const fs = require('fs');
const gulpClean = require('gulp-clean');
//const data = fs.readFileSync('./../../version.txt', 'utf8');
//const version = data.toString();
const version = JSON.parse(fs.readFileSync('./package.json')).version;

function cleanJsTask() {
  return src('../static/ubyssey/js/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}))
    .pipe(browserSync.stream());
}

function cleanCssTask() {
  return src('../static/ubyssey/css/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}))
    .pipe(browserSync.stream());
}

function cleanImagesTask() {
  return src('../static/ubyssey/images/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}))
    .pipe(browserSync.stream());
}

function cleanVideosTask() {
  return src('../static/ubyssey/videos/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}))
    .pipe(browserSync.stream());
}

function cleanFontsTask() {
  return src('../static/ubyssey/fonts/', {read: false, allowEmpty: true})
    .pipe(clean({force: true}))
    .pipe(browserSync.stream());
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
    .pipe(jasmine({verbose: true}))
    .pipe(browserSync.stream());
}

function sassBuildTask() {
  return src('./src/styles/**/*.scss')
      .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
      .pipe(dest('../static/ubyssey/css/'))
      .pipe(browserSync.stream());
}

function sassBuildDevTask(){
  return src('./src/styles/**/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(sourcemaps.write())
    .pipe(dest('../static/ubyssey/css/'))
    .pipe(browserSync.stream());
}

function copyImagesTask() {
  return src('./src/images/**/*')
    .pipe(dest('../static/ubyssey/images/'))
    .pipe(browserSync.stream());
}

function copyVideosTask() {
  return src('./src/videos/**/*')
    .pipe(dest('../static/ubyssey/videos/'))
    .pipe(browserSync.stream());
}

function copyFontsTask() {
  return src('./src/fonts/**/*')
    .pipe(dest('../static/ubyssey/fonts/'))
    .pipe(browserSync.stream());
}

function watchTask() { 
  watch('./src/js/**/*', series(cleanJsTask, webpackBuildDevTask));
  watch('./src/styles/**/*', series(cleanCssTask, sassBuildDevTask));
  watch('./src/images/**/*', series(cleanImagesTask, copyImagesTask));
  watch('./src/videos/**/*', series(cleanVideosTask, copyVideosTask));
  watch('./src/fonts/**/*',  series(cleanFontsTask, copyFontsTask));
}

function browserSyncReload() {
  browserSync.reload();
}

function watchDev() {
  browserSync.init({
    open:false,
    notify: false,
    port: 8000,
    proxy: 'http://127.0.0.1:8000/'
  });

  watch('./src/styles/**/*', series(cleanCssTask, sassBuildTask, browserSyncReload));
  watch('./js/', cleanJsTask).on('change', browserSync.reload);
  watch('./images/', series(cleanImagesTask, copyImagesTask, browserSyncReload));
  watch('./videos/', series(cleanVideosTask, copyVideosTask, browserSyncReload));
  watch('./fonts/', series(cleanFontsTask, copyFontsTask, browserSyncReload));

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
exports.default = series(
  parallel(cleanJsTask, cleanCssTask, cleanImagesTask, cleanVideosTask, cleanFontsTask), 
  parallel(webpackBuildDevTask, sassBuildDevTask, copyImagesTask, copyVideosTask, copyFontsTask), 
  watchTask)
exports.watch = series(watchDev);