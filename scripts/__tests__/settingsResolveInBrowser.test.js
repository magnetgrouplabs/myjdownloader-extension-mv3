'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

const storage = read('scripts', 'services', 'StorageService.js');
const settings = read('scripts', 'controllers', 'SettingsController.js');
const templates = read('partials', 'templateCache.js');
const locale = JSON.parse(read('_locales', 'en', 'messages.json'));

describe('Resolve in Browser setting', () => {
  it('StorageService defines the key with default true', () => {
    expect(storage).toMatch(/SETTINGS_RESOLVE_IN_BROWSER\s*=\s*"RESOLVE_IN_BROWSER"/);
    expect(storage).toMatch(/RESOLVE_IN_BROWSER:\s*\{\s*key:\s*StorageService\.SETTINGS_RESOLVE_IN_BROWSER,\s*defaultValue:\s*true\s*\}/);
  });

  it('SettingsController seeds, watches and persists it', () => {
    expect(settings).toMatch(/\$scope\.settings\[\$scope\.settingsKeys\.RESOLVE_IN_BROWSER\.key\]\s*=\s*\$scope\.settingsKeys\[\$scope\.settingsKeys\.RESOLVE_IN_BROWSER\.key\]\.defaultValue/);
    expect(settings).toMatch(/"settings\."\s*\+\s*\$scope\.settingsKeys\.RESOLVE_IN_BROWSER\.key/);
    expect(settings).toMatch(/key:\s*\$scope\.settingsKeys\.RESOLVE_IN_BROWSER\.key,\s*value:\s*scope\.settings\[\$scope\.settingsKeys\.RESOLVE_IN_BROWSER\.key\]/);
  });

  it('the settings template binds the checkbox', () => {
    expect(templates).toMatch(/id=\\"resolve_in_browser\\"/);
    expect(templates).toMatch(/ng-model=\\"settings\[settingsKeys\.RESOLVE_IN_BROWSER\.key\]\\"/);
    expect(templates).toMatch(/ui_settings_resolve_in_browser_description/);
  });

  it('defines the locale keys, with placeholders for the dynamic strings', () => {
    expect(locale.ui_settings_resolve_in_browser.message).toBe('Resolve in Browser');
    expect(locale.ui_settings_resolve_in_browser_description.message).toMatch(/^For file hosts the extension knows/);
    expect(locale.ui_add_links_resolving.message).toContain('$COUNT$');
    expect(locale.ui_add_links_resolve_failed.message).toContain('$URL$');
    expect(locale.ui_add_links_resolve_failed.message).toContain('$REASON$');
    expect(locale.ui_add_links_resolve_close.message).toBe('Close');
  });

  it('new strings contain no dashes', () => {
    ['ui_settings_resolve_in_browser', 'ui_settings_resolve_in_browser_description',
      'ui_add_links_resolving', 'ui_add_links_resolve_failed', 'ui_add_links_resolve_close']
      .forEach((k) => expect(locale[k].message).not.toMatch(/[\u2013\u2014]|--/));
  });

  it.each(['popup.html', 'toolbar.html'])('%s loads the resolver scripts in order, before services', (file) => {
    const html = read(file);
    const a = html.indexOf('scripts/resolvers/hostResolvers.js');
    const b = html.indexOf('scripts/resolvers/hosts/fileditch.js');
    const c = html.indexOf('scripts/services/');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});
