/**
 * Copyright (c) 2014-2019 Guyon Roche
 * LICENCE: MIT - please refer to LICENSE file included with this module
 * or https://github.com/exceljs/exceljs/blob/master/LICENSE
 */

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19) || major === 21 || (major === 22 && minor < 12)) {
  throw new Error('ExcelJS requires Node.js ^20.19.0 or >=22.12.0.');
}

module.exports = require('./lib/exceljs.nodejs.js');
