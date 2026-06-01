// this module resolves source paths for specs

/* eslint-disable import/no-dynamic-require */

const libs = {};

libs.exceljs = require('../../lib/exceljs.nodejs');

module.exports = function verquire(path) {
  if (!libs[path]) {
    libs[path] = require(`../../lib/${path}`);
  }
  return libs[path];
};
