'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');

/**
 * Behavioral coverage for the device status poller (issue #21).
 *
 * The popup showed "~" for ETA, speed, done and total forever because nothing
 * ever polled the device: the only caller of oneTimePoll() lived in an MV2
 * background controller that MV3 never instantiated. The poll result also used
 * to be published with chrome.runtime.sendMessage, which Chrome never delivers
 * back to the frame that sent it, so a popup-side poller could not have been
 * observed either.
 *
 * Nothing in this repo bootstraps AngularJS, so the service is loaded by
 * evaluating its source against a stub `angular` global and instantiating the
 * captured factory function directly. That runs the real code, which is the
 * point: a source-text check cannot tell a live callback from a dead one.
 */
function loadAngularRegistration(relativePath, registeredName) {
    const src = fs.readFileSync(path.join(root, relativePath), 'utf8');
    let captured;
    const moduleStub = {
        service: capture,
        factory: capture,
        controller: capture,
        directive: capture,
        filter: capture,
        config: () => moduleStub,
        run: () => moduleStub
    };
    function capture(name, definition) {
        if (name === registeredName) {
            captured = definition;
        }
        return moduleStub;
    }
    const angularStub = { module: () => moduleStub };
    new Function('angular', src)(angularStub);
    if (captured === undefined) {
        throw new Error('did not find "' + registeredName + '" in ' + relativePath);
    }
    return captured;
}

// The registration is an annotated array: dependency names then the function.
function definitionFunction(definition) {
    return Array.isArray(definition) ? definition[definition.length - 1] : definition;
}

function dependencyNames(definition) {
    return Array.isArray(definition) ? definition.slice(0, -1) : [];
}

// jQuery-style deferreds, which is what vendor/js/jdapi.js hands back.
function resolvedDeferred(value) {
    const deferred = {
        done(cb) { cb(value); return deferred; },
        fail() { return deferred; }
    };
    return deferred;
}

function rejectedDeferred(error) {
    const deferred = {
        done() { return deferred; },
        fail(cb) { cb(error); return deferred; }
    };
    return deferred;
}

function pendingDeferred() {
    const doneCbs = [];
    const failCbs = [];
    const deferred = {
        done(cb) { doneCbs.push(cb); return deferred; },
        fail(cb) { failCbs.push(cb); return deferred; },
        resolve(value) { doneCbs.forEach(cb => cb(value)); },
        reject(error) { failCbs.forEach(cb => cb(error)); }
    };
    return deferred;
}

// A realistic /polling/poll envelope for {jdState:true, aggregatedNumbers:true}.
function pollEnvelope(overrides) {
    const numbers = Object.assign({
        eta: 125,
        downloadSpeed: 2500000,
        loadedBytes: 1048576,
        totalBytes: 10485760
    }, overrides || {});
    return {
        data: [
            { eventName: 'jdState', eventData: { data: 'RUNNING' } },
            { eventName: 'aggregatedNumbers', eventData: { data: numbers } }
        ]
    };
}

function buildService(send) {
    const definition = loadAngularRegistration(
        'scripts/services/MyjdDeviceService.js', 'MyjdDeviceService');
    const $timeout = jest.fn();
    $timeout.cancel = jest.fn();
    const myjdClientFactory = { get: () => ({ send }) };
    const apiErrorService = {
        createApiError: e => e,
        createReadableApiError: e => ({ message: String(e) })
    };
    const ServiceFn = definitionFunction(definition);
    return {
        service: new ServiceFn($timeout, myjdClientFactory, apiErrorService),
        deps: dependencyNames(definition),
        $timeout
    };
}

function buildClient(send, device) {
    const built = buildService(send);
    return new built.service.MyJDDeviceService(device || { id: 'device-a', name: 'JD-A' });
}

describe('MyjdDeviceService status poll (issue #21)', () => {
    it('is injected with the cloud client factory and no extension messaging', () => {
        const built = buildService(jest.fn());
        expect(built.deps).toContain('myjdClientFactory');
        // The status result is handed to the popup in-process. Routing it back
        // through chrome.runtime.sendMessage cannot work: the publisher and the
        // subscriber are the same frame.
        expect(built.deps).not.toContain('ExtensionMessagingService');
    });

    it('asks the device for jdState and aggregatedNumbers', () => {
        const send = jest.fn(() => resolvedDeferred(pollEnvelope()));
        buildClient(send).oneTimePoll();

        expect(send).toHaveBeenCalledTimes(1);
        const [deviceId, call, params] = send.mock.calls[0];
        expect(deviceId).toBe('device-a');
        expect(call).toBe('/polling/poll');
        expect(JSON.parse(params[0])).toEqual({ jdState: true, aggregatedNumbers: true });
    });

    it('hands a registered status callback the mapped numbers and state', () => {
        const send = jest.fn(() => resolvedDeferred(pollEnvelope()));
        const client = buildClient(send);
        const onStatus = jest.fn();

        client.onStatus(onStatus);
        client.oneTimePoll();

        expect(onStatus).toHaveBeenCalledTimes(1);
        expect(onStatus.mock.calls[0][0].data).toEqual({
            eta: 125,
            speed: 2500000,
            done: 1048576,
            total: 10485760,
            state: 'RUNNING'
        });
    });

    it('notifies every registered callback', () => {
        const client = buildClient(jest.fn(() => resolvedDeferred(pollEnvelope())));
        const first = jest.fn();
        const second = jest.fn();

        client.onStatus(first);
        client.onStatus(second);
        client.oneTimePoll();

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('reads the poll entries by event name, not by position', () => {
        const envelope = pollEnvelope();
        envelope.data.reverse();
        const client = buildClient(jest.fn(() => resolvedDeferred(envelope)));
        const onStatus = jest.fn();

        client.onStatus(onStatus);
        client.oneTimePoll();

        expect(onStatus.mock.calls[0][0].data.state).toBe('RUNNING');
        expect(onStatus.mock.calls[0][0].data.speed).toBe(2500000);
    });

    it('still reads a nameless envelope in the historic order', () => {
        const envelope = pollEnvelope();
        envelope.data.forEach(entry => { delete entry.eventName; });
        const client = buildClient(jest.fn(() => resolvedDeferred(envelope)));
        const onStatus = jest.fn();

        client.onStatus(onStatus);
        client.oneTimePoll();

        expect(onStatus.mock.calls[0][0].data.state).toBe('RUNNING');
        expect(onStatus.mock.calls[0][0].data.total).toBe(10485760);
    });

    it('reports a failed poll as an error instead of staying silent', () => {
        const apiError = { status: 403, responseText: '{"type":"SESSION"}' };
        const client = buildClient(jest.fn(() => rejectedDeferred(apiError)));
        const onStatus = jest.fn();

        client.onStatus(onStatus);
        client.oneTimePoll();

        expect(onStatus).toHaveBeenCalledTimes(1);
        const message = onStatus.mock.calls[0][0];
        expect(message.data).toBeUndefined();
        expect(message.error).toBe(apiError);
    });

    it('reports an unconnected api as an error rather than throwing', () => {
        // MyjdService.send() returns undefined, not a deferred, while the
        // session is still being restored from storage.
        const client = buildClient(jest.fn(() => undefined));
        const onStatus = jest.fn();

        client.onStatus(onStatus);
        expect(() => client.oneTimePoll()).not.toThrow();
        expect(onStatus).toHaveBeenCalledTimes(1);
        expect(onStatus.mock.calls[0][0].error).toBeDefined();
    });

    it('skips a poll while the previous one is still in flight', () => {
        const inFlight = pendingDeferred();
        const send = jest.fn(() => inFlight);
        const client = buildClient(send);

        client.oneTimePoll();
        client.oneTimePoll();
        expect(send).toHaveBeenCalledTimes(1);

        inFlight.resolve(pollEnvelope());
        client.oneTimePoll();
        expect(send).toHaveBeenCalledTimes(2);
    });

    it('releases the in-flight guard after a failed poll', () => {
        const inFlight = pendingDeferred();
        const send = jest.fn(() => inFlight);
        const client = buildClient(send);

        client.oneTimePoll();
        inFlight.reject({ status: 500 });
        client.oneTimePoll();

        expect(send).toHaveBeenCalledTimes(2);
    });

    it('keeps sendRequest pointed at its own device and drops empty params', () => {
        const send = jest.fn(() => resolvedDeferred({}));
        const client = buildClient(send, { id: 'device-b' });

        client.sendRequest('/downloads/start');
        expect(send).toHaveBeenCalledWith('device-b', '/downloads/start', []);

        client.sendRequest('/downloadcontroller/pause', false);
        expect(send).toHaveBeenLastCalledWith('device-b', '/downloadcontroller/pause', [false]);
    });
});

describe('myjdDeviceClientFactory (one client per device)', () => {
    function buildFactory() {
        const definition = loadAngularRegistration(
            'scripts/factories/myjdDeviceClientFactory.js', 'myjdDeviceClientFactory');
        const send = jest.fn(() => resolvedDeferred(pollEnvelope()));
        const built = buildService(send);
        return { factory: definitionFunction(definition)(built.service), send };
    }

    it('returns a distinct client for each device', () => {
        const { factory } = buildFactory();
        const first = factory.get({ id: 'device-a' });
        const second = factory.get({ id: 'device-b' });

        expect(first).not.toBe(second);
        expect(first.getActiveDevice().id).toBe('device-a');
        expect(second.getActiveDevice().id).toBe('device-b');
    });

    it('does not repoint an existing client when a second one is created', () => {
        const { factory, send } = buildFactory();
        const first = factory.get({ id: 'device-a' });
        factory.get({ id: 'device-b' });

        first.oneTimePoll();
        expect(send.mock.calls[0][0]).toBe('device-a');
    });

    it('does not deliver one panel status to the other panel', () => {
        const { factory } = buildFactory();
        const first = factory.get({ id: 'device-a' });
        const second = factory.get({ id: 'device-b' });
        const firstStatus = jest.fn();
        const secondStatus = jest.fn();

        first.onStatus(firstStatus);
        second.onStatus(secondStatus);
        second.oneTimePoll();

        expect(secondStatus).toHaveBeenCalledTimes(1);
        expect(firstStatus).not.toHaveBeenCalled();
    });
});
