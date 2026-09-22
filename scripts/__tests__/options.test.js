'use strict';

const fs = require('fs');
const path = require('path');

describe('Options Page Removal (Phase 9)', () => {
  const projectRoot = path.join(__dirname, '..', '..');

  it('options.html should not exist on disk (deleted)', () => {
    const exists = fs.existsSync(path.join(projectRoot, 'options.html'));
    expect(exists).toBe(false);
  });

  it('options.js should not exist on disk (deleted)', () => {
    const exists = fs.existsSync(path.join(projectRoot, 'options.js'));
    expect(exists).toBe(false);
  });
});
