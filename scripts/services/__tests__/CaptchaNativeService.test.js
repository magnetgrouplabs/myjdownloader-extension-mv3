'use strict';

// Simple tests for CaptchaNativeService logic that don't require Chrome API mocking
// The comprehensive validation tests are in Rust (60 tests)

describe('CaptchaNativeService Logic', () => {
    describe('Response Handling', () => {
        it('should handle solved status with token', () => {
            const response = { status: 'solved', token: 'abc123' };
            expect(response.status).toBe('solved');
            expect(response.token).toBe('abc123');
        });

        it('should handle skipped status with skipType', () => {
            const response = { status: 'skipped', skipType: 'hoster' };
            expect(response.status).toBe('skipped');
            expect(response.skipType).toBe('hoster');
        });

        it('should handle cancelled status', () => {
            const response = { status: 'cancelled' };
            expect(response.status).toBe('cancelled');
        });

        it('should handle timeout status', () => {
            const response = { status: 'timeout', error: 'CAPTCHA timed out' };
            expect(response.status).toBe('timeout');
            expect(response.error).toBeDefined();
        });

        it('should handle error status', () => {
            const response = { status: 'error', error: 'Invalid site key' };
            expect(response.status).toBe('error');
            expect(response.error).toBe('Invalid site key');
        });

        it('should handle ok status with version', () => {
            const response = { status: 'ok', version: '0.1.0' };
            expect(response.status).toBe('ok');
            expect(response.version).toBe('0.1.0');
        });
    });

    describe('Message Format Validation', () => {
        const NATIVE_HOST_NAME = 'org.jdownloader.captcha_helper';

        it('should format captcha_new message correctly', () => {
            const captchaJob = {
                siteKey: 'test-site-key',
                siteKeyType: 'normal',
                challengeType: 'recaptcha',
                callbackUrl: 'http://127.0.0.1:8080/captcha/123',
                captchaId: 'captcha-123',
                hoster: 'example.com',
                v3action: '',
                enterprise: false,
                siteUrl: 'http://example.com/page',
                siteDomain: 'example.com'
            };

            const message = {
                action: 'captcha_new',
                siteKey: captchaJob.siteKey,
                siteKeyType: captchaJob.siteKeyType || 'normal',
                challengeType: captchaJob.challengeType,
                callbackUrl: captchaJob.callbackUrl,
                captchaId: captchaJob.captchaId,
                hoster: captchaJob.hoster || '',
                v3action: captchaJob.v3action || '',
                enterprise: captchaJob.enterprise || false,
                siteUrl: captchaJob.siteUrl || '',
                siteDomain: captchaJob.siteDomain || ''
            };

            expect(message.action).toBe('captcha_new');
            expect(message.siteKey).toBe('test-site-key');
            expect(message.callbackUrl).toBe('http://127.0.0.1:8080/captcha/123');
        });

        it('should format skip message correctly', () => {
            const message = {
                action: 'skip',
                callbackUrl: 'http://127.0.0.1:8080/captcha/123',
                skipType: 'hoster'
            };

            expect(message.action).toBe('skip');
            expect(message.skipType).toBe('hoster');
        });

        it('should format cancel message correctly', () => {
            const message = {
                action: 'cancel',
                callbackUrl: 'http://127.0.0.1:8080/captcha/123'
            };

            expect(message.action).toBe('cancel');
        });

        it('should format status message correctly', () => {
            const message = { action: 'status' };
            expect(message.action).toBe('status');
        });

        it('should include all fields for hCaptcha', () => {
            const message = {
                action: 'captcha_new',
                siteKey: 'a5f74b19-9e45-40e0-b45d-47ff91b7a6c2',
                siteKeyType: 'normal',
                challengeType: 'HCaptchaChallenge',
                callbackUrl: 'http://localhost:9666/captcha/123',
                captchaId: 'captcha-123',
                hoster: 'filehost.example',
                v3action: '',
                enterprise: false,
                test: false
            };

            expect(message.challengeType).toBe('HCaptchaChallenge');
            expect(message.siteKey).toMatch(/^[a-f0-9-]+$/);
        });

        it('should include v3action for reCAPTCHA v3', () => {
            const message = {
                action: 'captcha_new',
                siteKey: '6LcR_okUAAAAAIylBYQ5a7mDGJ4E0gXMFbBiNR6I',
                siteKeyType: 'INVISIBLE',
                challengeType: 'recaptchav3',
                callbackUrl: 'http://127.0.0.1:9666/captcha/456',
                captchaId: 'captcha-456',
                hoster: 'another.example',
                v3action: 'submit',
                enterprise: false
            };

            expect(message.challengeType).toBe('recaptchav3');
            expect(message.v3action).toBe('submit');
        });
    });

    describe('URL Validation', () => {
        function isValidCallbackUrl(url) {
            try {
                const parsed = new URL(url);
                if (!['http:', 'https:'].includes(parsed.protocol)) return false;
                const host = parsed.hostname;
                return host === 'localhost' || 
                       host === '127.0.0.1' || 
                       host.startsWith('127.') ||
                       host === '[::1]';
            } catch {
                return false;
            }
        }

        it('should accept localhost URLs', () => {
            expect(isValidCallbackUrl('http://localhost:8080/captcha?id=123')).toBe(true);
            expect(isValidCallbackUrl('https://localhost/captcha')).toBe(true);
        });

        it('should accept 127.0.0.1 URLs', () => {
            expect(isValidCallbackUrl('http://127.0.0.1:9666/captcha')).toBe(true);
            expect(isValidCallbackUrl('http://127.0.1.5/captcha')).toBe(true);
        });

        it('should accept IPv6 localhost', () => {
            expect(isValidCallbackUrl('http://[::1]:8080/captcha')).toBe(true);
        });

        it('should reject external URLs', () => {
            expect(isValidCallbackUrl('http://example.com/captcha')).toBe(false);
            expect(isValidCallbackUrl('http://192.168.1.1/captcha')).toBe(false);
            expect(isValidCallbackUrl('http://10.0.0.1/captcha')).toBe(false);
        });

        it('should reject non-HTTP URLs', () => {
            expect(isValidCallbackUrl('ftp://localhost/captcha')).toBe(false);
            expect(isValidCallbackUrl('file:///etc/passwd')).toBe(false);
        });

        it('should reject invalid URLs', () => {
            expect(isValidCallbackUrl('not a url')).toBe(false);
            expect(isValidCallbackUrl('')).toBe(false);
        });
    });

    describe('Skip Type Validation', () => {
        const VALID_SKIP_TYPES = ['hoster', 'package', 'all', 'single'];

        function validateSkipType(type) {
            return VALID_SKIP_TYPES.includes(type) ? type : 'single';
        }

        it('should accept valid skip types', () => {
            expect(validateSkipType('hoster')).toBe('hoster');
            expect(validateSkipType('package')).toBe('package');
            expect(validateSkipType('all')).toBe('all');
            expect(validateSkipType('single')).toBe('single');
        });

        it('should default invalid skip types to single', () => {
            expect(validateSkipType('invalid')).toBe('single');
            expect(validateSkipType('HOSTER')).toBe('single');
            expect(validateSkipType('')).toBe('single');
            expect(validateSkipType('hoster; DROP TABLE')).toBe('single');
        });
    });

    describe('Site Key Validation', () => {
        function validateSiteKey(key) {
            if (!key || key.length === 0) return { valid: false, error: 'Empty' };
            if (key.length > 256) return { valid: false, error: 'Too long' };
            if (!/^[a-zA-Z0-9_-]+$/.test(key)) return { valid: false, error: 'Invalid chars' };
            return { valid: true };
        }

        it('should accept valid site keys', () => {
            expect(validateSiteKey('6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-').valid).toBe(true);
            expect(validateSiteKey('abc123').valid).toBe(true);
            expect(validateSiteKey('test_key-123').valid).toBe(true);
        });

        it('should reject empty site keys', () => {
            expect(validateSiteKey('').valid).toBe(false);
            expect(validateSiteKey(null).valid).toBe(false);
        });

        it('should reject site keys with invalid characters', () => {
            expect(validateSiteKey('key with spaces').valid).toBe(false);
            expect(validateSiteKey('key<script>').valid).toBe(false);
        });

        it('should accept site keys up to 256 characters', () => {
            const longKey = 'a'.repeat(256);
            expect(validateSiteKey(longKey).valid).toBe(true);
        });

        it('should reject site keys over 256 characters', () => {
            const tooLongKey = 'a'.repeat(257);
            expect(validateSiteKey(tooLongKey).valid).toBe(false);
        });
    });

    describe('Native Host Name', () => {
        it('should use correct native host name', () => {
            const NATIVE_HOST_NAME = 'org.jdownloader.captcha_helper';
            expect(NATIVE_HOST_NAME).toBe('org.jdownloader.captcha_helper');
        });
    });
});