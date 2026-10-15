'use strict';

/**
 * CAPTCHAs of a remote JDownloader (NAS, Docker) through my.jdownloader.org.
 * Such a JDownloader cannot open a tab in this browser, so the job is read
 * through the MyJD API (offscreen document, faked here) and the token goes back
 * through the API, or through the my.jdownloader.org tab when that fails.
 *
 * The site's own "Solve" opens <siteUrl>#rc2jdt?k=<siteKey>&c=<captchaId>
 * (read off the deployed web interface bundle); its CAPTCHA icon is the
 * trigger for everything else, hCaptcha included.
 */
describe('Background.js remote JDownloader CAPTCHAs via my.jdownloader.org', () => {
  const RECAPTCHA_JOB = { id: 77, hoster: 'datavaults.co', type: 'RecaptchaV2Challenge' };
  const RECAPTCHA_CHALLENGE = {
    siteKey: 'rc-key', siteUrl: 'https://datavaults.co/abc', type: 'NORMAL', v3Action: null
  };
  const HCAPTCHA_JOB = { id: 79, hoster: 'ddownload.com', type: 'HCaptchaChallenge' };
  const HCAPTCHA_CHALLENGE = { siteKey: 'h-key', siteUrl: 'ddownload.com/file/x', type: 'NORMAL' };
  const IMAGE_JOB = { id: 78, hoster: 'example.org', type: 'ImageCaptchaChallenge' };

  let offscreenCalls;
  let solveResult;
  let skipResult;

  // The offscreen document's answers for one NAS device
  function fakeOffscreen(msg) {
    offscreenCalls.push(msg);
    switch (msg.action) {
      case 'offscreen-get-devices':
        return { success: true, devices: [{ id: 'nas', name: 'NAS' }] };
      case 'offscreen-captcha-list':
        return { success: true, jobs: [RECAPTCHA_JOB, IMAGE_JOB, HCAPTCHA_JOB] };
      case 'offscreen-captcha-get':
        if (msg.captchaId === 77 || msg.captchaId === '77') return { success: true, job: RECAPTCHA_JOB, challenge: RECAPTCHA_CHALLENGE };
        if (msg.captchaId === 79) return { success: true, job: HCAPTCHA_JOB, challenge: HCAPTCHA_CHALLENGE };
        return { success: true, job: IMAGE_JOB, challenge: {} };
      case 'offscreen-captcha-solve':
        return solveResult;
      case 'offscreen-captcha-skip':
        return skipResult;
      default:
        return {};
    }
  }

  beforeEach(() => {
    global.__resetChromeStorage();
    jest.clearAllMocks();
    global.chrome.runtime.onMessage._listeners.length = 0;
    global.chrome.runtime.onInstalled._listeners.length = 0;
    global.chrome.runtime.onStartup._listeners.length = 0;
    global.chrome.tabs.onRemoved._listeners.length = 0;
    global.chrome.contextMenus.onClicked._listeners.length = 0;
    global.chrome.alarms.onAlarm._listeners.length = 0;
    global.chrome.storage.onChanged._listeners.length = 0;
    global.chrome.webRequest.onBeforeRequest._listeners.length = 0;
    offscreenCalls = [];
    solveResult = { success: true };
    skipResult = { success: true };
    let nextTabId = 500;
    global.chrome.tabs.create.mockImplementation(() => Promise.resolve({ id: nextTabId++ }));
    global.chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      if (msg && msg.target === 'offscreen' && callback) callback(fakeOffscreen(msg));
      return Promise.resolve();
    });
    jest.resetModules();
    require('../../background.js');
  });

  afterEach(() => {
    global.chrome.runtime.sendMessage.mockImplementation(() => Promise.resolve());
    global.chrome.tabs.create.mockImplementation(() => Promise.resolve({ id: 9001 }));
  });

  function send(message, tab) {
    const listeners = global.chrome.runtime.onMessage._listeners;
    const handler = listeners[listeners.length - 1];
    return new Promise(resolve => {
      handler(message, { id: chrome.runtime.id, tab: tab }, resolve);
    });
  }

  const flush = () => new Promise(resolve => setTimeout(resolve, 20));
  const solves = () => offscreenCalls.filter(m => m.action === 'offscreen-captcha-solve');
  const skips = () => offscreenCalls.filter(m => m.action === 'offscreen-captcha-skip');

  describe('answering the site\'s extension ping', () => {
    it('is on by default', async () => {
      const response = await send({ name: 'webinterface-enhancer', action: 'settings' }, { id: 1 });
      expect(response).toEqual({ active: true });
    });

    it('follows the Enhance CAPTCHA dialog setting', async () => {
      await chrome.storage.local.set({ ENHANCE_CAPTCHA_DIALOG: false });
      const response = await send({ name: 'webinterface-enhancer', action: 'settings' }, { id: 1 });
      expect(response).toEqual({ active: false });
    });
  });

  describe('the tab the site\'s "Solve" opens', () => {
    const SITE_TAB = { id: 60, url: 'https://datavaults.co/abc#rc2jdt?k=rc-key&c=77' };

    it('looks the job up, parks it for that tab and reloads it with the CSP stripped', async () => {
      const first = await send({ action: 'myjd-get-captcha-job' }, SITE_TAB);

      expect(first).toEqual({ job: null, pending: true });
      expect(global.__getSessionStore()['myjd_captcha_job_60']).toMatchObject({
        captchaId: 77, deviceId: 'nas', siteKey: 'rc-key', callbackUrl: 'MYJD',
        targetUrl: 'https://datavaults.co/abc'
      });
      const cspRule = global.chrome.declarativeNetRequest.updateSessionRules.mock.calls
        .flatMap(call => (call[0] && call[0].addRules) || [])
        .find(rule => rule.condition && rule.condition.tabIds);
      expect(cspRule.condition.tabIds).toEqual([60]);
      expect(global.chrome.tabs.reload).toHaveBeenCalledWith(60);

      // After the reload the solver finds its job
      const second = await send({ action: 'myjd-get-captcha-job' }, SITE_TAB);
      expect(second.job).toMatchObject({ captchaId: 77, deviceId: 'nas' });
    });

    it('closes itself in favour of a tab already open for the same challenge', async () => {
      await send({ action: 'myjd-webui-captcha-click' }, { id: 1 });
      global.chrome.tabs.update.mockClear();

      const response = await send({ action: 'myjd-get-captcha-job' }, SITE_TAB);

      expect(response).toEqual({ job: null, pending: true });
      expect(global.chrome.tabs.update).toHaveBeenCalledWith(500, { active: true });
      expect(global.chrome.tabs.remove).toHaveBeenCalledWith(60);
    });

    it('reports no job for an #rc2jdt tab without a challenge id', async () => {
      const response = await send({ action: 'myjd-get-captcha-job' }, { id: 61, url: 'https://x.org/#rc2jdt' });
      expect(response).toEqual({ job: null });
      expect(global.chrome.tabs.reload).not.toHaveBeenCalled();
    });
  });

  describe('the site\'s CAPTCHA icon', () => {
    it('opens a hoster tab for each browser challenge, hCaptcha included, and skips image captchas', async () => {
      const response = await send({ action: 'myjd-webui-captcha-click' }, { id: 1 });

      expect(response).toEqual({ status: 'ok', result: { opened: 2, focused: 0 } });
      expect(global.chrome.tabs.create).toHaveBeenCalledTimes(2);
      expect(global.chrome.tabs.update).toHaveBeenCalledWith(500, { url: 'https://datavaults.co/abc#rc2jdt' });
      // A bare host from the API still gets a scheme
      expect(global.chrome.tabs.update).toHaveBeenCalledWith(501, { url: 'https://ddownload.com/file/x#rc2jdt' });
      expect(global.__getSessionStore()['myjd_captcha_job_501']).toMatchObject({
        captchaId: 79, captchaType: 'HCaptchaChallenge', deviceId: 'nas'
      });
    });

    it('focuses the open tabs on a second click instead of opening them again', async () => {
      await send({ action: 'myjd-webui-captcha-click' }, { id: 1 });
      const response = await send({ action: 'myjd-webui-captcha-click' }, { id: 1 });

      expect(response.result).toEqual({ opened: 0, focused: 2 });
      expect(global.chrome.tabs.create).toHaveBeenCalledTimes(2);
    });

    it('opens each challenge once when clicks overlap', async () => {
      await Promise.all([
        send({ action: 'myjd-webui-captcha-click' }, { id: 1 }),
        send({ action: 'myjd-webui-captcha-click' }, { id: 1 })
      ]);
      expect(global.chrome.tabs.create).toHaveBeenCalledTimes(2);
    });

    it('takes the v3 action name out of the API\'s JSON', async () => {
      RECAPTCHA_CHALLENGE.v3Action = '{"action":"download"}';
      try {
        await send({ action: 'myjd-webui-captcha-click' }, { id: 1 });
      } finally {
        RECAPTCHA_CHALLENGE.v3Action = null;
      }
      expect(global.__getSessionStore()['myjd_captcha_job_500'].v3action).toBe('download');
    });

    it('takes the v3 action name out of an already parsed v3Action', async () => {
      RECAPTCHA_CHALLENGE.v3Action = { action: 'download' };
      try {
        await send({ action: 'myjd-webui-captcha-click' }, { id: 1 });
      } finally {
        RECAPTCHA_CHALLENGE.v3Action = null;
      }
      expect(global.__getSessionStore()['myjd_captcha_job_500'].v3action).toBe('download');
    });
  });

  describe('delivering the token', () => {
    async function openedTab() {
      await send({ action: 'myjd-webui-captcha-click' }, { id: 1 });
      return { id: 500, url: 'https://datavaults.co/abc#rc2jdt' };
    }

    it('solves through the MyJD API with the device and id of the tab\'s own job', async () => {
      const tab = await openedTab();
      await send({ action: 'captcha-solved', data: { token: 't'.repeat(40), callbackUrl: 'MYJD', captchaId: 77 } }, tab);
      await flush();

      expect(solves()).toEqual([expect.objectContaining({ deviceId: 'nas', captchaId: 77, token: 't'.repeat(40) })]);
      expect(global.chrome.tabs.query).not.toHaveBeenCalled();
    });

    it('hands the token to my.jdownloader.org when the API solve fails', async () => {
      solveResult = { success: false, error: 'offline' };
      const tab = await openedTab();
      await send({ action: 'captcha-solved', data: { token: 't'.repeat(40), callbackUrl: 'MYJD', captchaId: 77 } }, tab);
      await flush();

      expect(global.chrome.tabs.query).toHaveBeenCalledWith(
        { url: ['http://my.jdownloader.org/*', 'https://my.jdownloader.org/*'] }, expect.any(Function));
    });

    it('never solves through the API for a tab it did not prepare', async () => {
      // Another tab claims a challenge id; no job is parked for it
      await openedTab();
      await send({ action: 'captcha-solved', data: { token: 'x'.repeat(40), callbackUrl: 'MYJD', captchaId: 77 } },
        { id: 777, url: 'https://evil.example/' });
      await send({ action: 'captcha-solved', data: { token: 'x'.repeat(40), callbackUrl: null } },
        { id: 778, url: 'https://other.example/' });
      await flush();

      expect(solves()).toHaveLength(0);
    });
  });

  describe('skipping', () => {
    async function openedTab() {
      await send({ action: 'myjd-webui-captcha-click' }, { id: 1 });
      return { id: 500, url: 'https://datavaults.co/abc#rc2jdt' };
    }

    it('skips through the MyJD API with the device of the tab\'s own job', async () => {
      const tab = await openedTab();
      await send({ action: 'captcha-skip', data: { callbackUrl: 'MYJD', captchaId: 77, skipType: 'hoster' } }, tab);
      await flush();

      expect(skips()).toEqual([expect.objectContaining({ deviceId: 'nas', captchaId: 77, skipType: 'hoster' })]);
      expect(global.chrome.tabs.query).not.toHaveBeenCalled();
    });

    it('skips through the MyJD API when the user closes the tab', async () => {
      await openedTab();
      global.chrome.tabs.onRemoved._listeners.forEach(listener => listener(500));
      await flush();

      expect(skips()).toEqual([expect.objectContaining({ deviceId: 'nas', captchaId: 77, skipType: 'single' })]);
      expect(global.__getSessionStore()['myjd_captcha_job_500']).toBeUndefined();
    });

    it('tells my.jdownloader.org when the API skip fails', async () => {
      skipResult = { success: false, error: 'offline' };
      const tab = await openedTab();
      await send({ action: 'captcha-skip', data: { callbackUrl: 'MYJD', captchaId: 77, skipType: 'single' } }, tab);
      await flush();

      expect(global.chrome.tabs.query).toHaveBeenCalledWith(
        { url: ['http://my.jdownloader.org/*', 'https://my.jdownloader.org/*'] }, expect.any(Function));
    });
  });
});
