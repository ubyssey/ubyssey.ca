require('babel-register'); // Pass require()s through babel (for running jasmine)

const {series, parallel, src, dest, watch} = require('gulp');
const log = require('fancy-log');
const PluginError = require('plugin-error');
const jasmine = require('gulp-jasmine');
const clean = require('gulp-clean');
const rename = require('gulp-rename');

const webpack = require('webpack');
const webpackProdConfig = require('./webpack.prod.js');
const webpackDevConfig = require('./webpack.dev.js');

const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');

const fs = require('fs');
const version = JSON.parse(fs.readFileSync('./package.json')).version;

function cleanJsTask() {
  return src('./dist/js/', {read: false, allowEmpty: true})
    .pipe(clean());
}

function cleanCssTask() {
  return src('./dist/css/', {read: false, allowEmpty: true})
    .pipe(clean());
}

function cleanImagesTask() {
  return src('./dist/images/', {read: false, allowEmpty: true})
    .pipe(clean());
}

function cleanVideosTask() {
  return src('./dist/videos/', {read: false, allowEmpty: true})
    .pipe(clean());
}

function cleanFontsTask() {
  return src('./dist/fonts/', {read: false, allowEmpty: true})
    .pipe(clean());
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

function renameFunc(path) {
  path.basename += '-' + version;
}

function sassBuildTask() {
  return src('./src/styles/**/*.scss')
      .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
      .pipe(rename(renameFunc))
      .pipe(dest('./dist/css/'));
}

function sassBuildDevTask(){
  return src('./src/styles/**/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(rename(renameFunc))
    .pipe(sourcemaps.write())
    .pipe(dest('./dist/css/'));
}

function copyImagesTask() {
  return src('./src/images/**/*')
    .pipe(dest('./dist/images/'));
}

function copyVideosTask() {
  return src('./src/videos/**/*')
    .pipe(dest('./dist/videos/'));
}

function copyFontsTask() {
  return src('./src/fonts/**/*')
    .pipe(dest('./dist/fonts/'));
}

function watchTask() { 
  watch('./src/js/**/*', series(cleanJsTask, webpackBuildDevTask));
  watch('./src/styles/**/*', series(cleanCssTask, sassBuildDevTask));
  watch('./src/images/**/*', series(cleanImagesTask, copyImagesTask));
  watch('./src/videos/**/*', series(cleanVideosTask, copyVideosTask));
  watch('./src/fonts/**/*',  series(cleanFontsTask, copyFontsTask));
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

