'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const backgroundScriptService = fs.readFileSync(
    path.join(root, 'scripts', 'services', 'BackgroundScriptService.js'), 'utf8');
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');

/**
 * Contract coverage for the popup to background message names.
 *
 * background.js answers every unknown action with {forwarded: true, action},
 * so a caller cannot tell a missing handler from a working one, and a test
 * that only asks "did the background reply?" passes for actions nobody
 * implements. That is how the device poll and the download control requests
 * stayed dead through every MV3 release: the popup sent "device-poll" and
 * "send-api-request", nothing did the work, and the reply looked fine.
 *
 * So: extract every action the popup sends and assert the background does
 * something with it beyond acknowledging it.
 */
function actionsSentByPopup() {
    const names = new Set();
    const re = /sendMessage\(\s*"myjd-toolbar"\s*,\s*"([^"]+)"/g;
    let match;
    while ((match = re.exec(backgroundScriptService)) !== null) {
        names.add(match[1]);
    }
    return [...names];
}

// Everything between the opening brace of `if (action === "name") {` and its
// matching close brace.
function handlerBody(action) {
    const marker = 'action === "' + action + '"';
    const markerAt = background.indexOf(marker);
    if (markerAt === -1) {
        return null;
    }
    const open = background.indexOf('{', markerAt);
    if (open === -1) {
        return null;
    }
    let depth = 0;
    for (let i = open; i < background.length; i++) {
        if (background[i] === '{') {
            depth++;
        } else if (background[i] === '}') {
            depth--;
            if (depth === 0) {
                return background.slice(open + 1, i);
            }
        }
    }
    return null;
}

// Strip the lines that make up a bare acknowledgement. Whatever survives is
// the work the handler actually does. A line that only passes a value to
// sendResponse is an acknowledgement; a line that calls something and hands
// the outcome to sendResponse is not.
function workingLines(body) {
    return body
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.replace(/\/\/.*$/, '').trim())
        .filter(line => line.length > 0)
        .filter(line => !line.startsWith('*') && !line.startsWith('/*'))
        .filter(line => !/^sendResponse\(.*\);?$/.test(line))
        .filter(line => line !== 'return true;' && line !== 'return;')
        .filter(line => line !== '}' && line !== '{' && line !== '});');
}

// "send-feedback" is acknowledged and dropped, the same shape of dead path.
// It belongs to the feedback form, not the device panel, so it is recorded
// here rather than fixed: the rest of the contract is still enforced.
const KNOWN_ACK_ONLY = ['send-feedback'];

describe('popup to background message contract', () => {
    const actions = actionsSentByPopup();

    it('finds the actions the popup sends', () => {
        expect(actions.length).toBeGreaterThan(0);
    });

    it.each(actions)('background.js handles "%s"', action => {
        expect(handlerBody(action)).not.toBeNull();
    });

    it.each(actions)('"%s" does more than acknowledge the message', action => {
        const body = handlerBody(action);
        expect(body).not.toBeNull();
        const worked = workingLines(body).length > 0;
        expect(worked).toBe(!KNOWN_ACK_ONLY.includes(action));
    });
});
