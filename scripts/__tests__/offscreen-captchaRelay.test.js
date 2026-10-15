'use strict';

const fs = require('fs');
const path = require('path');

const offscreen = fs.readFileSync(path.join(__dirname, '..', '..', 'offscreen.js'), 'utf8');

/**
 * The captcha calls' fallback from a dead Direct Connection to the
 * api.jdownloader.org relay. offscreen.js only runs under RequireJS, so the
 * function is lifted out of the source and driven with a fake jdapi.
 */
describe('offscreen captcha calls: Direct Connection -> relay fallback', () => {
  const source = offscreen.match(/var NETWORK_ERROR_TYPES[\s\S]*?\nfunction sendCaptchaDeviceCall[\s\S]*?\n\}/)[0];

  // Just enough of jQuery's Deferred for done/fail
  function Deferred() {
    let state = null, value;
    const cbs = { done: [], fail: [] };
    const d = {
      resolve(v) { if (!state) { state = 'done'; value = v; cbs.done.forEach(f => f(v)); } return d; },
      reject(v) { if (!state) { state = 'fail'; value = v; cbs.fail.forEach(f => f(v)); } return d; },
      done(f) { if (state === 'done') f(value); else cbs.done.push(f); return d; },
      fail(f) { if (state === 'fail') f(value); else cbs.fail.push(f); return d; }
    };
    return d;
  }

  // A NAS in Direct Connection mode; `answers` decides each call by the mode it went out in
  function setup(answers) {
    const device = {
      localURL: 'http://192.168.1.5:3128',
      setLocalURL(url) { this.localURL = url; },
      isInLocalMode() { return !!this.localURL; }
    };
    const modes = [];
    const api = {
      jdAPICore: { options: { sessiontoken: 's' } },
      apiDeviceController: { devices: { nas: device } },
      setActiveDevice: jest.fn(),
      send() {
        const local = device.isInLocalMode();
        modes.push(local ? 'local' : 'relay');
        const [ok, value] = answers(local);
        return ok ? Deferred().resolve(value) : Deferred().reject(value);
      }
    };
    const call = new Function('$', 'api', source + '\nreturn sendCaptchaDeviceCall;')({ Deferred }, api);
    return { call, device, modes };
  }

  function outcome(d) {
    let result;
    d.done(v => { result = ['ok', v]; }).fail(e => { result = ['fail', e]; });
    return result;
  }

  it('retries through the relay when the LAN address is unreachable', () => {
    const { call, device, modes } = setup(local => local ? [false, { type: 'CONNECTION_REFUSED' }] : [true, 'data']);

    expect(outcome(call('nas', '/captcha/list', []))).toEqual(['ok', 'data']);
    expect(modes).toEqual(['local', 'relay']);
    expect(device.localURL).toBeNull();
  });

  it('keeps Direct Connection for an error JDownloader itself answered', () => {
    const { call, device, modes } = setup(() => [false, { type: 'BAD_PARAMETERS' }]);

    expect(outcome(call('nas', '/captcha/solve', []))).toEqual(['fail', { type: 'BAD_PARAMETERS' }]);
    expect(modes).toEqual(['local']);
    expect(device.localURL).toBe('http://192.168.1.5:3128');
  });

  it('retries only once', () => {
    const { call, modes } = setup(() => [false, { type: 'TIMEOUT' }]);

    expect(outcome(call('nas', '/captcha/get', []))).toEqual(['fail', { type: 'TIMEOUT' }]);
    expect(modes).toEqual(['local', 'relay']);
  });
});
