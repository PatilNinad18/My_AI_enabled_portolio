const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Build-time adapter for the portfolio content only. FastAPI reads the exported JSON.
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
const load = Module._load;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, ...args);
};
Module._load = function (request, ...args) {
  return request === 'server-only' ? {} : load.call(this, request, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const { documents } = require('../src/lib/assistant/knowledge.ts');
const approved = documents.filter(({ id }) => !id.startsWith('reviewed-')).map(
  ({ id, title, aliases, topics, facts, sources, entities, project, limitations }) =>
    ({ id, title, aliases, topics, facts, sources, entities, project, limitations }),
);
const target = path.join(root, 'data', 'knowledge', 'portfolio.json');
const output = JSON.stringify(approved, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) {
    console.error('Portfolio evidence export is stale.');
    process.exitCode = 1;
  } else {
    console.log(`Portfolio evidence is current (${approved.length} records).`);
  }
} else {
  fs.writeFileSync(target, output);
}
