'use strict';

const fs = require('fs');
const path = require('path');

const optionsJs = fs.readFileSync(
  path.join(__dirname, '..', '..', 'options.js'), 'utf8'
);

const optionsHtml = fs.readFileSync(
  path.join(__dirname, '..', '..', 'options.html'), 'utf8'
);

describe('Options Page - Directory History Toggle (DIR-01)', () => {

  it('options.html should contain directory_history_enabled checkbox', () => {
    expect(optionsHtml).toMatch(/id=["']directory_history_enabled["']/);
  });

  it('options.js STORAGE_KEYS should contain DIRECTORY_HISTORY_ENABLED', () => {
    expect(optionsJs).toMatch(/DIRECTORY_HISTORY_ENABLED/);
  });

  it('options.js DIRECTORY_HISTORY_ENABLED key value must be "DIRECTORY_HISTORY_ENABLED" (must match StorageService)', () => {
    // CRITICAL: This key must be the exact string "DIRECTORY_HISTORY_ENABLED" to match StorageService
    expect(optionsJs).toMatch(/DIRECTORY_HISTORY_ENABLED:\s*['"]DIRECTORY_HISTORY_ENABLED['"]/);
  });

  it('options.js should have change listener on directory_history_enabled', () => {
    expect(optionsJs).toMatch(/directory_history_enabled.*addEventListener.*change/s);
  });
});
