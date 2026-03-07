'use strict';

const fs = require('fs');
const path = require('path');

// Read the source file for structural verification
const source = fs.readFileSync(
  path.join(__dirname, '..', 'StorageService.js'), 'utf8'
);

describe('StorageService - Directory History Setting (DIR-01)', () => {

  it('should contain SETTINGS_DIRECTORY_HISTORY_ENABLED constant with value "DIRECTORY_HISTORY_ENABLED"', () => {
    expect(source).toMatch(/SETTINGS_DIRECTORY_HISTORY_ENABLED\s*=\s*["']DIRECTORY_HISTORY_ENABLED["']/);
  });

  it('settingsKeys should contain DIRECTORY_HISTORY_ENABLED entry with defaultValue true', () => {
    expect(source).toMatch(/DIRECTORY_HISTORY_ENABLED\s*:\s*\{[^}]*defaultValue\s*:\s*true/);
  });
});
