'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'partials', 'templateCache.js'), 'utf8'
);

const css = fs.readFileSync(
  path.join(__dirname, '..', '..', 'styles', 'main.css'), 'utf8'
);

describe('templateCache - Directory History UI (DIR-01, DIR-04)', () => {

  it('saveto datalist should have ng-if="directoryHistoryEnabled"', () => {
    // The datalist or a wrapping element near savetoHistory must be conditionally rendered
    expect(source).toMatch(/ng-if=.*directoryHistoryEnabled[\s\S]{0,200}savetoHistory|savetoHistory[\s\S]{0,200}ng-if=.*directoryHistoryEnabled/);
  });

  it('should contain a clear-saveto-btn element', () => {
    expect(source).toMatch(/clear-saveto-btn/);
  });

  it('clear button should call clearSavetoHistory()', () => {
    expect(source).toMatch(/ng-click=.*clearSavetoHistory\(\)/);
  });

  it('clear button should be conditionally visible (directoryHistoryEnabled and history)', () => {
    expect(source).toMatch(/ng-if=.*directoryHistoryEnabled.*history\.saveto\.length/);
  });

  it('clear button should use fa-times icon', () => {
    expect(source).toMatch(/clear-saveto-btn[\s\S]{0,200}fa-times/);
  });
});

describe('main.css - Clear Button Styling (DIR-04)', () => {

  it('main.css should contain .clear-saveto-btn styling', () => {
    expect(css).toMatch(/\.clear-saveto-btn/);
  });
});
