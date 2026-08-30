'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'ToolbarController.js'), 'utf8'
);

/**
 * Regression coverage for the dead auto-send countdown.
 *
 * invalidateInitState() only starts the countdown timer under `!editMode`,
 * but editMode was initialised to true in resetScope() and set to false
 * nowhere, so startTimeout() was never reached and COUNTDOWN_FINISHED_SEND_LINKS
 * never fired — a captured request was never sent automatically.
 */
describe('ToolbarController — auto-send countdown (editMode)', () => {
  it('resetScope initialises $scope.editMode to false so the countdown can arm', () => {
    const reset = source.match(/function resetScope\s*\(\)\s*\{[\s\S]*?\n {4}\}/);
    expect(reset).not.toBeNull();
    expect(reset[0]).toMatch(/\$scope\.editMode\s*=\s*false/);
    expect(reset[0]).not.toMatch(/\$scope\.editMode\s*=\s*true/);
  });

  it('still gates the countdown on !editMode (unchanged) and re-enters edit mode on hover', () => {
    expect(source).toMatch(/countdownOptions\.active\s*&&\s*!\$scope\.editMode/);
    expect(source).toMatch(/\$scope\.enterEditMode\s*=\s*function[\s\S]*?editMode\s*=\s*true/);
  });
});
