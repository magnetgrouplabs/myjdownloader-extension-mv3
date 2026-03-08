'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'partials', 'templateCache.js'), 'utf8'
);

const settingsSource = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'SettingsController.js'), 'utf8'
);

describe('Settings Toggles (SET-01, SET-02)', () => {

  it('templateCache contains CAPTCHA_PRIVACY_MODE checkbox with correct ng-model', () => {
    expect(source).toMatch(/id=.*captcha_privacy_mode/);
    expect(source).toMatch(/ng-model=.*settingsKeys\.CAPTCHA_PRIVACY_MODE\.key/);
  });

  it('SettingsController initializes CAPTCHA_PRIVACY_MODE in $scope.settings', () => {
    expect(settingsSource).toMatch(/\$scope\.settings\[\$scope\.settingsKeys\.CAPTCHA_PRIVACY_MODE\.key\]\s*=\s*\$scope\.settingsKeys\[\$scope\.settingsKeys\.CAPTCHA_PRIVACY_MODE\.key\]\.defaultValue/);
  });

});
