/**
 * Copyright (c) 2014-2019 Guyon Roche
 * LICENCE: MIT - please refer to LICENSE file included with this module
 * or https://github.com/exceljs/exceljs/blob/master/LICENSE
 */

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  throw new Error('Please upgrade Node.js to version 20.19.0 or later (or 22.12.0+).');
}

module.exports = require('./lib/exceljs.nodejs.js');
