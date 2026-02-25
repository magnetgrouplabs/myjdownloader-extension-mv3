# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a completed Chrome Extension Manifest V3 conversion of MyJDownloader. The original MV2 extension has been fully converted to MV3 and all core features are working.

## Directory Structure

```
myjdownloader-extension-mv3/
  README.md                        # GitHub-ready project README
  CLAUDE.md                        # This file
  LICENSE                          # GPL-3.0 license
  .gitignore                      # Git exclusions
  manifest.json                   # MV3 manifest
  background.js                   # Service worker
  popup.html / popup.js           # Login popup
  toolbar.html                    # In-page add-links toolbar
  offscreen.html / offscreen.js   # API operations when popup closed
  scripts/                        # AngularJS application
  vendor/                         # Third-party libraries
  contentscripts/                 # Content scripts
  .github/workflows/              # CI/CD workflows
    ci.yml                        # Manifest V3 validation
    security.yml                  # Security scanning
    release.yml                   # Release automation

## Migration Status: COMPLETE

All core features working:
- Login/logout
- Device discovery and selection
- Context menu "Download with JDownloader" with in-page toolbar
- Add-links dialog with countdown and options
- Click'N'Load (CNL) interception
- Session persistence
- Settings page (via AngularJS route)
- Captcha solving (RC2)

## When Working on This Project

1. **Read** `ARCHITECTURE.md` for detailed architecture
2. **Test** by reloading extension at `chrome://extensions/`
3. **Key constraint**: All contexts must use APP_KEY `"myjd_webextension_chrome"`
4. **Key constraint**: Toolbar sends links directly via local `myjdDeviceClientFactory`, not through background/offscreen
5. **Key constraint**: `ng-if` (not `ng-show`) for connected panel to prevent premature controller init
