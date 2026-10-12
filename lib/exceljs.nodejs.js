const Workbook = require('./doc/workbook');
const ModelContainer = require('./doc/modelcontainer');
const WorkbookWriter = require('./stream/xlsx/workbook-writer');
const WorkbookReader = require('./stream/xlsx/workbook-reader');

const stream = {
  xlsx: {
    WorkbookWriter,
    WorkbookReader,
  },
};

// Shorthand properties and the enums spread keep these exports detectable by
// Node's CommonJS lexer, which is what gives `import {Workbook} from 'exceljs'`
// its named exports.
module.exports = {
  Workbook,
  ModelContainer,
  stream,
  ...require('./doc/enums'),
};
