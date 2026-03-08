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

const settingsSource = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'SettingsController.js'), 'utf8'
);

describe('Settings Toggles (SET-01, SET-02)', () => {

  it('templateCache contains CAPTCHA_PRIVACY_MODE checkbox with correct ng-model', () => {
    expect(source).toMatch(/id=.*captcha_privacy_mode/);
    expect(source).toMatch(/ng-model=.*settingsKeys\.CAPTCHA_PRIVACY_MODE\.key/);
  });

  it('templateCache contains DIRECTORY_HISTORY_ENABLED checkbox with correct ng-model', () => {
    expect(source).toMatch(/id=.*directory_history_enabled/);
    expect(source).toMatch(/ng-model=.*settingsKeys\.DIRECTORY_HISTORY_ENABLED\.key/);
  });

  it('SettingsController initializes CAPTCHA_PRIVACY_MODE in $scope.settings', () => {
    expect(settingsSource).toMatch(/\$scope\.settings\[\$scope\.settingsKeys\.CAPTCHA_PRIVACY_MODE\.key\]\s*=\s*\$scope\.settingsKeys\[\$scope\.settingsKeys\.CAPTCHA_PRIVACY_MODE\.key\]\.defaultValue/);
  });

  it('SettingsController initializes DIRECTORY_HISTORY_ENABLED in $scope.settings', () => {
    expect(settingsSource).toMatch(/\$scope\.settings\[\$scope\.settingsKeys\.DIRECTORY_HISTORY_ENABLED\.key\]\s*=\s*\$scope\.settingsKeys\[\$scope\.settingsKeys\.DIRECTORY_HISTORY_ENABLED\.key\]\.defaultValue/);
  });

  it('SettingsController has DIRECTORY_HISTORY_ENABLED in $watchGroup', () => {
    expect(settingsSource).toMatch(/settingsKeys\.DIRECTORY_HISTORY_ENABLED\.key/);
  });
});

describe('main.css - Clear Button Styling (DIR-04)', () => {

  it('main.css should contain .clear-saveto-btn styling', () => {
    expect(css).toMatch(/\.clear-saveto-btn/);
  });
});
