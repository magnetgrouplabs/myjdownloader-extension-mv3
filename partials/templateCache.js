angular.module('myjdWebextensionApp').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('partials/controllers/background.html',
    "<h1>MyJDownloader Web Extension</h1>"
  );


  $templateCache.put('partials/controllers/popup.html',
    "<div id=\"mainPanel\">\n" +
    "    <div class=\"mainContent container\" ng-hide=\"!state.isInitializing\">\n" +
    "        <div class=\"initalLoadingContainer\">\n" +
    "            <div class=\"loader\"></div>&nbsp;<b>{{'ui_login_loading' | translate}}</b>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "    <div ng-if=\"state.isLoggedIn\" ng-cloak>\n" +
    "        <div class=\"outdatedMessage\" ng-if=\"isOutdatedVersion\">\n" +
    "            {{'ui_login_outdated_message' | translate}}\n" +
    "        </div>\n" +
    "        <my-connected-panel></my-connected-panel>\n" +
    "    </div>\n" +
    "\n" +
    "    <div class=\"formPanel\" ng-show=\"!state.isInitializing && !state.isLoggedIn\" ng-cloak>\n" +
    "        <div id=\"menubarwrapper\">\n" +
    "            <div id=\"menubar\">\n" +
    "                <a class=\"loggedOutSettingsButton\" ng-click=\"showLoggedOutSettings()\" title=\"{{'menu_entry_settings'\n" +
    "            | translate}}\"\n" +
    "                ><i class=\"fa fa-cog\" aria-hidden=\"true\"></i></a>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        <div class=\"menubarspacer\">&nbsp;</div>\n" +
    "        <div id=\"loginStatus\" class=\"container\">\n" +
    "            <div ng-show=\"((state.error.message && state.error.message.length > 0)  === true)\"\n" +
    "                 class=\"errorMessage\"\n" +
    "                 id=\"errorMessage\">\n" +
    "                {{state.error.message || (\"ui_login_sorry_error\" | translate)}}<span ng-if=\"state.error.link\">&nbsp;<a\n" +
    "                    href=\"{{state.error.link}}\" target=\"_blank\">{{'ui_login_click_here' | translate}}</a>.</p></span>\n" +
    "            </div>\n" +
    "            <div ng-show=\"(state.successMessage && state.successMessage.length > 0) === true\"\n" +
    "                 class=\"successMessage\"\n" +
    "                 id=\"successMessage\">{{state.successMessage}}\n" +
    "            </div>\n" +
    "            <div ng-show=\"state.isConnecting\" class=\"loadingIndicator\">\n" +
    "                <div class=\"loader\"></div>\n" +
    "                <div class=\"loadingMessage\"><b>{{'ui_login_connecting' | translate}}</b></div>\n" +
    "            </div>\n" +
    "            <my-appstate state=\"state\"></my-appstate>\n" +
    "        </div>\n" +
    "        <div class=\"container\">\n" +
    "            <div class=\"errorMessage\" ng-if=\"isOutdatedVersion\">\n" +
    "                {{'ui_login_outdated_message' | translate}}\n" +
    "            </div>\n" +
    "            <form name=\"loginForm\" id=\"loginForm\" method=\"post\" autocomplete=\"on\" novalidate>\n" +
    "                <div>\n" +
    "                    <div><label for=\"emailInput\">{{'ui_login_email_label' | translate}}</label>\n" +
    "\n" +
    "                        <small ng-show=\"loginForm.$submitted && loginForm.email.$error.required && !loginForm.email.$error.email\"\n" +
    "                               class=\"validationError\">\n" +
    "                            {{'ui_login_email_required' | translate}}\n" +
    "                        </small>\n" +
    "\n" +
    "                        <small ng-show=\"loginForm.$submitted && loginForm.email.$error.email\"\n" +
    "                               class=\"validationError\">\n" +
    "                            {{'ui_login_email_invalid' | translate}}\n" +
    "                        </small>\n" +
    "                    </div>\n" +
    "                    <input id=\"emailInput\" name=\"email\" type=\"email\" ng-model=\"credentials.email\" required>\n" +
    "                </div>\n" +
    "                <div>\n" +
    "                    <div><label for=\"passwordInput\">Password</label>\n" +
    "                        <small ng-show=\"loginForm.$submitted && loginForm.password.$error.required\"\n" +
    "                               class=\"validationError\">\n" +
    "                            {{'ui_login_password_required' | translate}}\n" +
    "                        </small>\n" +
    "                    </div>\n" +
    "                    <input id=\"passwordInput\" name=\"password\" type=\"password\" autocomplete=\"off\" required\n" +
    "                           ng-model=\"credentials.password\">\n" +
    "                </div>\n" +
    "                <input ng-disabled=\"!loginForm.$valid\" id=\"loginButton\" type=\"submit\" class=\"btn\"\n" +
    "                       value=\"Login\"\n" +
    "                       ng-click=\"login(credentials)\">\n" +
    "                <div id=\"loginActions\">\n" +
    "                    <small><a\n" +
    "                            href=\"https://my.jdownloader.org/login.html#forgotPassword?email={{loginForm.email.$viewValue}}\"\n" +
    "                            target=\"_blank\" style=\"float:left;\">{{'ui_login_forgot_password' | translate}}</a>\n" +
    "                        <a href=\"https://my.jdownloader.org/login.html?register\"\n" +
    "                           target=\"_blank\"\n" +
    "                           style=\"float:right;\">{{'ui_login_register' | translate}}</a></small>\n" +
    "                </div>\n" +
    "            </form>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n"
  );


  $templateCache.put('partials/controllers/settings.html',
    "<div id=\"settingsContainer\" style=\"padding-left: 8px; padding-right: 8px\">\n" +
    "    <h4>{{'ui_settings_general' | translate}}</h4>\n" +
    "    <div ng-if=\"username\" style=\"padding: 8px\"><i class=\"fa fa-user\"></i>&nbsp;&nbsp;{{'ui_settings_logged_in_as' |\n" +
    "        translate}}\n" +
    "        <b>{{username}}</b>\n" +
    "    </div>\n" +
    "    <div class=\"inlineSettingsContainer\" id=\"clicknloadSettings\">\n" +
    "        <label for=\"clicknload_active\">\n" +
    "            <input type=\"checkbox\" id=\"clicknload_active\" ng-model=\"settings[settingsKeys.CLICKNLOAD_ACTIVE.key]\" />{{'ui_settings_cnl_via_myjd' |\n" +
    "            translate}}</label>\n" +
    "\n" +
    "        <div style=\"clear:both;\"></div>\n" +
    "        <p class=\"description\">\n" +
    "            <small>\n" +
    "                {{'ui_settings_cnl_via_myjd_description' | translate}}\n" +
    "            </small>\n" +
    "        </p>\n" +
    "    </div>\n" +
    "    <div class=\"inlineSettingsContainer\" id=\"clipboardSettings\" ng-if=\"!clipboardHistorySupported\">\n" +
    "        <label for=\"clipboard_observer_running\">\n" +
    "            <input type=\"checkbox\" id=\"clipboard_observer_running\"\n" +
    "                ng-model=\"settings[settingsKeys.CLIPBOARD_OBSERVER.key]\" />{{'ui_settings_checkbox_clipboard_observer'\n" +
    "            | translate}}<br />\n" +
    "        </label>\n" +
    "        <p class=\"keyboardShortcut\" title=\"{{'ui_settings_keyboard_shortcut_title' | translate}}\">\n" +
    "            <small><i class=\"fa fa-keyboard-o\" aria-hidden=\"true\"></i>&nbsp;{{'ui_settings_keyboard_shortcuts' |\n" +
    "                translate}}\n" +
    "            </small>\n" +
    "        </p>\n" +
    "        <div style=\"clear:both;\"></div>\n" +
    "        <p class=\"description\">\n" +
    "            <small>\n" +
    "                {{'ui_settings_clipboard_observer_description'\n" +
    "                | translate}}\n" +
    "            </small>\n" +
    "        </p>\n" +
    "    </div>\n" +
    "    <div class=\"inlineSettingsContainer\" id=\"contextMenuSettings\">\n" +
    "        <label for=\"context_menu_flat\">\n" +
    "            <input type=\"checkbox\" id=\"context_menu_flat\" ng-model=\"settings[settingsKeys.CONTEXT_MENU_SIMPLE.key]\" />{{'ui_settings_checkbox_simple_contextmenu'\n" +
    "            | translate}}</label>\n" +
    "\n" +
    "        <div style=\"clear:both;\"></div>\n" +
    "        <p class=\"description\">\n" +
    "            <small>\n" +
    "                {{'ui_settings_simple_contextmenu_description'\n" +
    "                | translate}}\n" +
    "            </small>\n" +
    "        </p>\n" +
    "    </div>\n" +
    "    <div class=\"inlineSettingsContainer\" id=\"useAddLinksCheckboxContainer\">\n" +
    "        <label for=\"useAddLinksCheckbox\">\n" +
    "            <input ng-disabled=\"settings[settingsKeys.DEFAULT_PREFERRED_JD.key].id === AskEveryTimeDevice.id\"\n" +
    "                type=\"checkbox\" id=\"useAddLinksCheckbox\"\n" +
    "                ng-model=\"settings[settingsKeys.ADD_LINKS_DIALOG_ACTIVE.key]\" />\n" +
    "            {{'ui_settings_show_add_links_dialog'\n" +
    "            | translate}}</label>\n" +
    "        <div style=\"clear:both;\"></div>\n" +
    "        <p class=\"description\">\n" +
    "            <small>\n" +
    "                {{'ui_settings_show_add_links_dialog_description'\n" +
    "                | translate}}\n" +
    "            </small>\n" +
    "        </p>\n" +
    "    </div>\n" +
    "    <h4>{{'ui_settings_add_links_dialog_header'\n" +
    "        | translate}}</h4>\n" +
    "    <p ng-if=\"!isCnlSupported\">\n" +
    "        {{'ui_settings_add_links_browser_no_cnl_support'\n" +
    "        | translate}}\n" +
    "    </p>\n" +
    "    <div id=\"defaultValuesContainer\">\n" +
    "        <h5>{{'ui_settings_add_links_default_values_header'\n" +
    "            | translate}}</h5>\n" +
    "        <p>\n" +
    "            {{'ui_settings_add_links_default_values_howto_unset'\n" +
    "            | translate}} <i title=\"{{'ui_settings_add_links_default_values_unset_title'\n" +
    "            | translate}}\" class=\"fa fa-remove\"></i>.\n" +
    "        </p>\n" +
    "        <form>\n" +
    "            <div id=\"preferredJdContainer\">\n" +
    "                <label title=\"{{'ui_settings_add_links_default_values_preferred_target_title'\n" +
    "            | translate}}\" for=\"preferredJd\">{{'ui_settings_add_links_default_values_preferred_target_title'\n" +
    "                    | translate}}</label>\n" +
    "                <br />\n" +
    "                <select id=\"preferredJd\" ng-model=\"settings[settingsKeys.DEFAULT_PREFERRED_JD.key]\"\n" +
    "                    ng-options=\"device as translatedTarget(device) for device in devices track by device.id\">\n" +
    "                </select>\n" +
    "            </div>\n" +
    "            <div ng-if=\"hasTargetWithCountdown()\" id=\"countdownCheckboxContainer\" style=\"padding-left: 16px;\">\n" +
    "                <input type=\"checkbox\" id=\"countdownCheckbox\" ng-model=\"settings[settingsKeys.COUNTDOWN_ACTIVE.key]\" />\n" +
    "                <span for=\"countdownCheckbox\">{{'ui_settings_add_links_default_values_preferred_target_checkbox_autoclose'\n" +
    "                    | translate}}</span>\n" +
    "            </div>\n" +
    "            <div ng-if=\"hasTargetWithCountdown()\" id=\"countdownValueContainer\" style=\"padding-left: 16px;\">\n" +
    "                <span for=\"countdownValue\">{{'ui_settings_add_links_default_values_preferred_target_seconds_until_autoclose'\n" +
    "                    | translate}}</span>\n" +
    "                <input style=\"width:40px; padding: 4px 0px 4px 4px; margin-right: 16px;\" type=\"number\"\n" +
    "                    id=\"countdownValue\" ng-model=\"settings[settingsKeys.COUNTDOWN_VALUE.key]\" />\n" +
    "            </div>\n" +
    "            <div id=\"priorityContainer\">\n" +
    "                <label title=\"{{'ui_settings_add_links_default_values_download_priority_title'\n" +
    "                    | translate}}\" for=\"priority\">{{'ui_settings_add_links_default_values_download_priority_title'\n" +
    "                    | translate}}</label>\n" +
    "                <br />\n" +
    "                <select id=\"priority\" ng-model=\"settings[settingsKeys.DEFAULT_PRIORITY.key]\"\n" +
    "                    ng-options=\"priority as translatedPriority(priority.text) for priority in priorityValues track by priority.id\">\n" +
    "                </select>\n" +
    "            </div>\n" +
    "            <div class=\"addLinksOptionsCheckbox deepDecryptContainer\">\n" +
    "                <input type=\"checkbox\" id=\"deepDecrypt\" ng-model=\"settings[settingsKeys.DEFAULT_DEEPDECRYPT.key]\" />\n" +
    "                <label title=\"{{'ui_settings_add_links_default_values_deep_decrypt_title'\n" +
    "                    | translate}}\" for=\"deepDecrypt\"\n" +
    "                    ng-class=\"{'unset' : settings[settingsKeys.DEFAULT_DEEPDECRYPT.key] === 'unset'}\">\n" +
    "                    <small>{{'ui_settings_add_links_default_values_deep_decrypt_title'\n" +
    "                        | translate}}\n" +
    "                    </small>\n" +
    "                </label>&nbsp;\n" +
    "                <i title=\"{{'ui_settings_add_links_default_values_unset_title'\n" +
    "            | translate}}\" ng-click=\"unset(settingsKeys.DEFAULT_DEEPDECRYPT.key)\" class=\"fa fa-remove unset\"></i>\n" +
    "            </div>\n" +
    "            <div class=\"addLinksOptionsCheckbox autoStart\">\n" +
    "                <input type=\"checkbox\" id=\"autoStart\" ng-model=\"settings[settingsKeys.DEFAULT_AUTOSTART.key]\" />\n" +
    "                <label title=\"{{'ui_settings_add_links_default_values_autostart_title'\n" +
    "                        | translate}}\" for=\"autoStart\"\n" +
    "                    ng-class=\"{'unset' : settings[settingsKeys.DEFAULT_AUTOSTART.key] === 'unset'}\">\n" +
    "                    <small>{{'ui_settings_add_links_default_values_autostart_title'\n" +
    "                        | translate}}\n" +
    "                    </small>\n" +
    "                </label>&nbsp;\n" +
    "                <i title=\"{{'ui_settings_add_links_default_values_unset_title'\n" +
    "            | translate}}\" ng-click=\"unset(settingsKeys.DEFAULT_AUTOSTART.key)\" class=\"fa fa-remove unset\"></i>\n" +
    "            </div>\n" +
    "            <div class=\"addLinksOptionsCheckbox autoExtract\">\n" +
    "                <input type=\"checkbox\" id=\"autoExtract\" ng-model=\"settings[settingsKeys.DEFAULT_AUTOEXTRACT.key]\" />\n" +
    "                <label title=\"{{'ui_settings_add_links_default_values_autoextract_title'\n" +
    "                        | translate}}\" for=\"autoExtract\"\n" +
    "                    ng-class=\"{'unset' : settings[settingsKeys.DEFAULT_AUTOEXTRACT.key] === 'unset'}\">\n" +
    "                    <small>{{'ui_settings_add_links_default_values_autoextract_title'\n" +
    "                        | translate}}\n" +
    "                    </small>\n" +
    "                </label>&nbsp;\n" +
    "                <i ng-click=\"unset(settingsKeys.DEFAULT_AUTOEXTRACT.key)\" title=\"{{'ui_settings_add_links_default_values_unset_title'\n" +
    "            | translate}}\" class=\"fa fa-remove unset\"></i>\n" +
    "            </div>\n" +
    "            <div class=\"addLinksOptionsCheckbox packagizerOverwrite\">\n" +
    "                <input type=\"checkbox\" id=\"checkboxOverWritePackagizer\"\n" +
    "                    ng-model=\"settings[settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key]\" />\n" +
    "                <label title=\"{{'ui_settings_add_links_default_values_overwrite_packagizer_title'\n" +
    "                        | translate}}\"\n" +
    "                    ng-class=\"{'unset' : settings[settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key] === 'unset'}\"\n" +
    "                    for=\"checkboxOverWritePackagizer\">\n" +
    "                    <small>{{'ui_settings_add_links_default_values_overwrite_packagizer_title'\n" +
    "                        | translate}}\n" +
    "                    </small>\n" +
    "                </label>&nbsp;\n" +
    "                <i title=\"{{'ui_settings_add_links_default_values_unset_title'\n" +
    "            | translate}}\" ng-click=\"unset(settingsKeys.DEFAULT_OVERWRITE_PACKAGIZER.key)\"\n" +
    "                    class=\"fa fa-remove unset\"></i>\n" +
    "            </div>\n" +
    "        </form>\n" +
    "    </div>\n" +
    "    <div class=\"settingsContainer\" id=\"webinterfaceEnhancerContainer\">\n" +
    "        <h4>{{'ui_settings_webinterface_enhancer_header'\n" +
    "            | translate}}</h4>\n" +
    "        <p>{{'ui_settings_webinterface_enhancer_description'\n" +
    "            | translate}}\n" +
    "        </p>\n" +
    "        <div class=\"inlineSettingsContainer\" id=\"enhanceCaptchaDialogContainer\">\n" +
    "            <label for=\"enhanceCaptchaDialog\"><input type=\"checkbox\" id=\"enhanceCaptchaDialog\"\n" +
    "                    ng-model=\"settings[settingsKeys.ENHANCE_CAPTCHA_DIALOG.key]\" />\n" +
    "                {{'ui_settings_enhance_captcha_dialog_title'\n" +
    "                | translate}}</label>\n" +
    "            <div style=\"clear:both;\"></div>\n" +
    "            <p class=\"description\">\n" +
    "                <small>{{'ui_settings_enhance_captcha_dialog_description'\n" +
    "                    | translate}}\n" +
    "                </small>\n" +
    "            </p>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <h4>About</h4>\n" +
    "    <div id=\"aboutContainer\">\n" +
    "        <div ng-if=\"buildMeta\">\n" +
    "            <b>Version:</b> {{buildMeta.version}}\n" +
    "        </div>\n" +
    "        <br />\n" +
    "        <div><a href=\"http://jdownloader.org/impressum\" target=\"_blank\"><i class=\"fa fa-external-link\"\n" +
    "                    aria-hidden=\"true\"></i>&nbsp;{{'ui_settings_imprint_title'\n" +
    "            | translate}}</a>\n" +
    "        </div>\n" +
    "        <div><a href=\"https://my.jdownloader.org/legal/privacy.html\" target=\"_blank\"><i class=\"fa fa-external-link\"\n" +
    "                    aria-hidden=\"true\"></i>&nbsp;{{'ui_settings_privacy_statement_title'\n" +
    "            | translate}}\n" +
    "            </a></div>\n" +
    "        <div><a href=\"https://my.jdownloader.org/legal/terms.html\" target=\"_blank\"><i class=\"fa fa-external-link\"\n" +
    "                    aria-hidden=\"true\"></i>&nbsp;{{'ui_settings_toc_title'\n" +
    "            | translate}}</a></div>\n" +
    "    </div>\n" +
    "</div>"
  );


  $templateCache.put('partials/controllers/toolbar.html',
    "<div id=\"{{isPopup ? 'toolbarInPopup' : 'toolbar'}}\" class=\"toolbarContainer appear\" ng-if=\"!closed\"\n" +
    "    ng-mouseover=\"enterEditMode()\">\n" +
    "    <div id=\"menubarwrapper\" ng-if=\"!displayedInPopup\">\n" +
    "        <h3 ng-if=\"state.countdown !== -1 && selection.device.id !== SaveForLaterDevice.id\">Sending links to\n" +
    "            {{selection.device.name}}</h3>\n" +
    "        <h3 ng-if=\"state.countdown !== -1 && selection.device.id === SaveForLaterDevice.id\">Saving for later</h3>\n" +
    "        <h3 ng-if=\"state.countdown === -1\">{{'ui_add_links_header' | translate}}</h3>\n" +
    "\n" +
    "        <div class=\"countdown\" ng-if=\"state.countdown > 0\">\n" +
    "            <div class=\"loader\"></div>\n" +
    "            &nbsp;\n" +
    "            <span class=\"countDown\">{{state.countdown}}s</span>\n" +
    "\n" +
    "        </div>\n" +
    "        <div class=\"countdown\" ng-if=\"state.countdown ===-1\">\n" +
    "            <small><a class=\"cancelLink\" ng-click=\"cancel()\">{{'ui_add_links_cancel' | translate}}</a></small>\n" +
    "        </div>\n" +
    "        <div class=\"clearfix\"></div>\n" +
    "    </div>\n" +
    "    <div ng-if=\"((state.error.message && state.error.message.length > 0)  === true)\" class=\"errorMessage\"\n" +
    "        id=\"errorMessage\">\n" +
    "        {{state.error.message || \"Sorry, there was an error\"}}<span ng-if=\"state.error.link\">&nbsp;<a\n" +
    "                href=\"{{state.error.link}}\" target=\"_blank\">Click here</a>.</p></span><span\n" +
    "            ng-if=\"state.error.log\">&nbsp;<a ng-click=\"sendError(state.error.raw)\">Send a log to us</a>.</p></span>\n" +
    "    </div>\n" +
    "    <div ng-if=\"(state.successMessage && state.successMessage.length > 0) === true\" class=\"successMessage\"\n" +
    "        id=\"successMessage\">{{state.successMessage}}\n" +
    "    </div>\n" +
    "    <div ng-if=\"state.loading\" class=\"toolbarLoadingContainer\">\n" +
    "        <div class=\"loader\"></div>\n" +
    "        <div class=\"loadingMessage\"><b>Loading...</b></div>\n" +
    "    </div>\n" +
    "    <div id=\"sendLinkProperiesContainer\" ng-if=\"devices\">\n" +
    "        <div ng-if=\"state.requestQueue && state.displayQueue\" class=\"requestsContainer\">\n" +
    "            <div class=\"box-grey clipboardItem appear\"\n" +
    "                ng-repeat=\"historyItem in state.requestQueue | orderBy: '-time' track by historyItem.id\">\n" +
    "                <div>\n" +
    "                    <div class=\"typeicon\">\n" +
    "                        <span ng-if=\"historyItem.type === 'text'\" title=\"Text\" class=\"historyItemTypeIcon\"><i\n" +
    "                                class=\"fa fa-file-text-o\" aria-hidden=\"true\"></i></span>\n" +
    "                        <span title=\"Link\" ng-if=\"historyItem.type === 'link'\" class=\"historyItemTypeIcon\"><i\n" +
    "                                class=\"fa fa-link\" aria-hidden=\"true\"></i></span>\n" +
    "                        <span title=\"Click'n'Load\" ng-if=\"historyItem.type === 'cnl'\" class=\"historyItemTypeIcon\"><img\n" +
    "                                width=\"20px\" src=\"images/icon32.png\" /></span>\n" +
    "\n" +
    "                    </div>\n" +
    "                    <div ng-if=\"historyItem.type === 'text' || historyItem.type === 'link'\" class=\"content\"\n" +
    "                        ng-init=\"previewText = createPreviewText(historyItem.previewText || historyItem.content); historyItem.expanded = false;\">\n" +
    "                        <div ng-click=\"historyItem.expanded = previewText.length > 150\" ng-if=\"!historyItem.expanded\">\n" +
    "                            {{previewText\n" +
    "                            | limitTo:150\n" +
    "                            }}<span ng-if=\"previewText.length > 150\">&nbsp;<small><a>more ...</a></small></span>\n" +
    "                        </div>\n" +
    "                        <div ng-click=\"historyItem.expanded = false\" ng-if=\"historyItem.expanded\">\n" +
    "                            {{previewText}}<span>&nbsp;<small><a>less ...</a></small></span>\n" +
    "                        </div>\n" +
    "                        <div class=\"meta\">\n" +
    "                            <div title=\"{{historyItem.parent.title}}\" class=\"title\"><i class=\"fa fa-quote-left\"\n" +
    "                                    aria-hidden=\"true\"></i>&nbsp;&nbsp;{{historyItem.parent.title\n" +
    "                                | limitTo:56 }}<span ng-if=\"historyItem.parent.title.length > 56\">&nbsp;...</span></div>\n" +
    "                            <div title=\"{{historyItem.parent.url}}\" class=\"url\"><img class=\"favicon\"\n" +
    "                                    ng-src=\"{{historyItem.parent.favIconUrl}}\" imgErrorHide /><a\n" +
    "                                    href=\"{{historyItem.parent.url}}\" target=\"_blank\">{{historyItem.parent.url\n" +
    "                                    | limitTo:56 }}<span ng-if=\"historyItem.parent.url.length > 56\">&nbsp;...</span></a>\n" +
    "                            </div>\n" +
    "                            <div title=\"{{historyItem.time}}\" class=\"time\"><i class=\"fa fa-calendar\"\n" +
    "                                    aria-hidden=\"true\"></i>&nbsp;&nbsp;{{historyItem.time\n" +
    "                                | date:'medium'}}\n" +
    "                            </div>\n" +
    "                        </div>\n" +
    "                    </div>\n" +
    "                    <div ng-if=\"historyItem.type === 'cnl'\" class=\"content\">\n" +
    "                        <div>Click'n'Load</div>\n" +
    "                        <div class=\"meta\" ng-init=\"title = getCnlTitle(historyItem); url = getCnlUrl(historyItem);\">\n" +
    "                            <div title=\"{{title}}\" class=\"title\"><i class=\"fa fa-quote-left\"\n" +
    "                                    aria-hidden=\"true\"></i>&nbsp;&nbsp;{{title\n" +
    "                                | limitTo:45 }}<span ng-if=\"title.length > 45\">&nbsp;...</span></div>\n" +
    "                            <div title=\"{{url}}\" class=\"url\"><img class=\"favicon\"\n" +
    "                                    ng-src=\"{{historyItem.parent.favIconUrl}}\" imgErrorHide /><a href=\"{{url}}\"\n" +
    "                                    target=\"_blank\">{{url\n" +
    "                                    | limitTo:45 }}<span ng-if=\"url.length > 45\">&nbsp;...</span></a></div>\n" +
    "                            <div title=\"{{historyItem.time}}\" class=\"time\"><i class=\"fa fa-calendar\"\n" +
    "                                    aria-hidden=\"true\"></i>&nbsp;&nbsp;{{historyItem.time\n" +
    "                                | date:'medium'}}\n" +
    "                            </div>\n" +
    "                        </div>\n" +
    "                    </div>\n" +
    "                    <div class=\"actions\">\n" +
    "                        <span ng-click=\"removeRequest(historyItem.id)\" class=\"remove-request-icon\"><i\n" +
    "                                class=\"fa fa-times\" aria-hidden=\"true\"></i></span>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"clearfix\"></div>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        <div ng-if=\"state.countdown > 0\" class=\"cancelCountdown\">Click here to cancel countdown\n" +
    "        </div>\n" +
    "        <my-add-links-panel ng-show=\"state.countdown === -1\" device=\"selection.device\" requests=\"state.requestQueue\"\n" +
    "            capturedrequestmode=\"true\"></my-add-links-panel>\n" +
    "        <div ng-if=\"state.success && state.countdown !== -1\" id=\"successContainer\"><i class=\"fa fa-check successCheck\"\n" +
    "                aria-hidden=\"true\"></i><br />\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>"
  );


  $templateCache.put('partials/directives/myaddlinkspanel.html',
    "<div id=\"addlinkspanel\" class=\"appear\">\n" +
    "    <div ng-if=\"!state.isLoggedIn\"><b>{{'ui_add_links_panel_please_check_logged_in' | translate}}</b>\n" +
    "        {{'ui_add_links_panel_try_again_logged_in' | translate}}\n" +
    "    </div>\n" +
    "    <div ng-if=\"state.sending.state !== requestStates.SUCCESS\">\n" +
    "        <div ng-if=\"state.sending.state === requestStates.ERROR\"\n" +
    "             class=\"errorMessage\"\n" +
    "             id=\"errorMessage\">\n" +
    "            {{'ui_add_links_failed_to_send' | translate}}\n" +
    "            <p ng-if=\"state.errorMessage\">Error: {{state.errorMessage}}</p>\n" +
    "        </div>\n" +
    "        <div ng-if=\"(state.successMessage && state.successMessage.length > 0) === true\"\n" +
    "             class=\"successMessage\"\n" +
    "             id=\"successMessage\">{{state.successMessage}}\n" +
    "        </div>\n" +
    "        <div ng-if=\"state.loading\" class=\"toolbarLoadingContainer\">\n" +
    "            <div class=\"loader\"></div>\n" +
    "            <div class=\"loadingMessage\"><b>{{'ui_add_links_loading' | translate}}</b></div>\n" +
    "        </div>\n" +
    "        <div class=\"clearfix\"></div>\n" +
    "        <div id=\"sendLinkProperiesContainer\" ng-if=\"devices\">\n" +
    "            <div ng-if=\"requests\">\n" +
    "                <div class=\"box-yellow\" ng-repeat=\"link in state.requestQueue track by link.id\">\n" +
    "                <span ng-if=\"link.type === 'CNL'\">\n" +
    "                    <img src=\"images/icon32.png\"/> Click and Load <span ng-click=\"removeRequest(link.id)\"\n" +
    "                                                                        class=\"remove-request-icon\"><i\n" +
    "                        class=\"fa fa-times\" aria-hidden=\"true\"></i></span>\n" +
    "                </span>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "            <div style=\"font-size: 0.8em;text-align: right;padding-right: 8px;padding-bottom:8px;\">\n" +
    "                <span>{{state.lastDeviceReloadResult}}</span>&nbsp;&nbsp;\n" +
    "                <a href=\"\" ng-click=\"refreshDevices()\">{{'ui_add_links_refresh_devices' | translate}}</a>\n" +
    "                &nbsp;|&nbsp;\n" +
    "                <a class=\"button\" href=\"https://support.jdownloader.org\"\n" +
    "                   target=\"_blank\">{{'ui_add_links_click_here_for_help' | translate}}</a>\n" +
    "            </div>\n" +
    "            <div id=\"deviceButtonContainer\">\n" +
    "                <div ng-repeat=\"device in devices track by device.id\">\n" +
    "                    <button ng-click=\"send(device)\" ng-disabled=\"devices.length === 0\"\n" +
    "                            class=\"sendDeviceButton\"><i\n" +
    "                            ng-if=\"state.sending.state === requestStates.RUNNING\" class=\"fa fa-spinner\"\n" +
    "                            ng-class=\"{'fa fa-spinner fa-pulse': state.sending.state === requestStates.RUNNING}\"\n" +
    "                            aria-hidden=\"true\"></i>&nbsp;<span\n" +
    "                            ng-if=\"device.id!==SaveForLaterDevice.id && device.id!==LastUsedDevice.id\"\n" +
    "                            class=\"deviceName\" for=\"{{device.id}}\"><img\n" +
    "                            width=\"16px\" src=\"/images/icon32.png\"/>&nbsp;{{device.name}}</span>\n" +
    "                        <span ng-if=\"device.id===SaveForLaterDevice.id\" class=\"deviceName\" for=\"{{device.id}}\"> <i\n" +
    "                                class=\"fa fa-bookmark\" aria-hidden=\"true\"></i>&nbsp;{{device.name}}</span>\n" +
    "                    </button>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "            <div class=\"noDevicesInfoContainer\" ng-if=\"devices.length === 0\">\n" +
    "                <div class=\"box-grey nodevicebox\">\n" +
    "                    <div class=\"infoIcon\"><i class=\"fa fa-info\" aria-hidden=\"true\"></i></div>\n" +
    "                    <div class=\"infoText\"><b>{{'ui_add_links_no_jd_connected' | translate}}</b>\n" +
    "                        {{'ui_add_links_to_add_links' | translate}}\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div style=\"clear:both\"></div>\n" +
    "            </div>\n" +
    "            <div class=\"actions\">\n" +
    "                <div ng-if=\"!showSaveForLater\"\n" +
    "                     class=\"removefromqueuecontainer\">\n" +
    "                    <input type=\"checkbox\" id=\"removefromqueue\" ng-model=\"selection.removeAfterSend\"\n" +
    "                           ng-click=\"saveOptions()\"/>\n" +
    "                    <label for=\"removefromqueue\">{{'ui_add_links_remove_from_saved_after_sent' | translate}}</label>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "            <div class=\"clearfix\"></div>\n" +
    "            <div id=\"optionalValuesContainer\"\n" +
    "                 ng-if=\"devices.length > 0 && selection.device\">\n" +
    "                <div id=\"optionalValuesActivation\">\n" +
    "                    <a class=\"expandOptionalValuesLink\" ng-click=\"toggleOptionalValues(); saveOptions();\">\n" +
    "                        <i class=\"fa\"\n" +
    "                           ng-class=\"{'fa-caret-right': !selection.showOptionalValues, 'fa-caret-down': selection.showOptionalValues}\"\n" +
    "                           aria-hidden=\"true\"></i>&nbsp;{{'ui_add_links_optional' | translate}}</a>\n" +
    "                    <div class=\"optionalValuesActions\" ng-if=\"selection.showOptionalValues\">\n" +
    "                        <input type=\"checkbox\" ng-click=\"autoFillOptionalValues(true);saveOptions();\"\n" +
    "                               id=\"autoFillCheckbox\"\n" +
    "                               ng-model=\"selection.autoFill\"/><label\n" +
    "                            title=\"{{'ui_add_links_autofill_active' | translate}}\"\n" +
    "                            for=\"autoFillCheckbox\">{{'ui_add_links_autofill' | translate}}</label>&nbsp;|&nbsp;\n" +
    "                        <a ng-click=\"autoFillOptionalValues()\"><i class=\"fa fa-history\" aria-hidden=\"true\"\n" +
    "                                                                  title=\"{{'ui_add_links_last_used_values' | translate}}\"></i></a>&nbsp;|&nbsp;\n" +
    "                        <a ng-click=\"autoFillDefaultValues()\"><i class=\"fa fa-cogs\" aria-hidden=\"true\"\n" +
    "                                                                 title=\"{{'ui_add_links_default_values' | translate}}\"></i></a>&nbsp;|&nbsp;\n" +
    "                        <a ng-click=\"clearAllOptionalValues()\"><i class=\"fa fa-times\" aria-hidden=\"true\"\n" +
    "                                                                  title=\"{{'ui_add_links_clear_values' | translate}}\"></i></a>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"clearfix\"></div>\n" +
    "                <div ng-if=\"selection.showOptionalValues\" id=\"optionalValuesActive\" class=\"appear\">\n" +
    "                    <form id=\"optionalvaluesform\">\n" +
    "\n" +
    "                        <div>\n" +
    "                            <label title=\"{{'ui_add_links_comment' | translate}}\" for=\"comment\"><img\n" +
    "                                    src=\"/images/document.png\"/></label><input\n" +
    "                                ng-value=\"selection.comment\" ng-model=\"selection.comment\"\n" +
    "                                id=\"comment\" name=\"comment\" type=\"text\" list=\"commentHistory\">\n" +
    "                            <datalist id=\"commentHistory\">\n" +
    "                                <option ng-repeat=\"entry in history.comment\" value=\"{{entry}}\">\n" +
    "                            </datalist>\n" +
    "                        </div>\n" +
    "                        <div>\n" +
    "                            <label title=\"{{'ui_add_links_package_name' | translate}}\" for=\"packageName\"><img\n" +
    "                                    src=\"/images/package.png\"/></label><input\n" +
    "                                ng-value=\"selection.packageName\" ng-model=\"selection.packageName\"\n" +
    "                                id=\"packageName\" name=\"packageName\" type=\"text\" list=\"packageNameHistory\">\n" +
    "                            <datalist id=\"packageNameHistory\">\n" +
    "                                <option ng-repeat=\"entry in history.packageName\" value=\"{{entry}}\">\n" +
    "                            </datalist>\n" +
    "                        </div>\n" +
    "                        <div>\n" +
    "                            <label title=\"{{'ui_add_links_save_to' | translate}}\" for=\"saveto\"><img\n" +
    "                                    src=\"/images/saveto.png\"/></label><input\n" +
    "                                ng-value=\"selection.saveto\" ng-model=\"selection.saveto\"\n" +
    "                                id=\"saveto\" name=\"saveto\" type=\"text\" list=\"savetoHistory\">\n" +
    "                            <datalist id=\"savetoHistory\">\n" +
    "                                <option ng-repeat=\"entry in history.saveto\" value=\"{{entry}}\">\n" +
    "                            </datalist>\n" +
    "                        </div>\n" +
    "                        <div>\n" +
    "                            <label title=\"{{'ui_add_links_archive_password' | translate}}\" for=\"archivepw\"><img\n" +
    "                                    src=\"/images/archive_password.png\"/></label><input\n" +
    "                                ng-value=\"selection.archivepw\" ng-model=\"selection.archivepw\"\n" +
    "                                id=\"archivepw\" name=\"archivepw\" type=\"text\" list=\"archivepwHistory\">\n" +
    "                            <datalist id=\"archivepwHistory\">\n" +
    "                                <option ng-repeat=\"entry in history.archivepw\" value=\"{{entry}}\">\n" +
    "                            </datalist>\n" +
    "                        </div>\n" +
    "                        <div>\n" +
    "                            <label title=\"{{'ui_add_links_download_password' | translate}}\" for=\"downloadpw\"><img\n" +
    "                                    src=\"/images/download_password.png\"/></label><input\n" +
    "                                ng-value=\"selection.downloadpw\" ng-model=\"selection.downloadpw\"\n" +
    "                                id=\"downloadpw\" name=\"downloadpw\" type=\"text\" list=\"downloadpwHistory\">\n" +
    "                            <datalist id=\"downloadpwHistory\">\n" +
    "                                <option ng-repeat=\"entry in history.downloadpw\" value=\"{{entry}}\">\n" +
    "                            </datalist>\n" +
    "                        </div>\n" +
    "                        <div id=\"priorityContainer\">\n" +
    "                            <label title=\"{{'ui_add_links_priority' | translate}}\" for=\"priority\">{{'ui_add_links_priority'\n" +
    "                                | translate}}</label>\n" +
    "                            <br/>\n" +
    "                            <select id=\"priority\" ng-model=\"selection.priority\"\n" +
    "                                    ng-options=\"priority as translatedPriority(priority.text) for priority in priorityValues track by priority.id\">\n" +
    "                            </select>\n" +
    "                        </div>\n" +
    "                        <div class=\"addLinksOptionsCheckbox deepDecryptContainer\">\n" +
    "                            <input type=\"checkbox\" id=\"deepDecrypt\" ng-model=\"selection.deepDecrypt\"/>\n" +
    "                            <label title=\"{{'ui_add_links_deep_decrypt' | translate}}\" for=\"deepDecrypt\">\n" +
    "                                <small>{{'ui_add_links_deep_decrypt' | translate}}</small>\n" +
    "                            </label>\n" +
    "                        </div>\n" +
    "                        <div class=\"addLinksOptionsCheckbox autoStart\">\n" +
    "                            <input type=\"checkbox\" id=\"autoStart\" ng-model=\"selection.autoStart\"/>\n" +
    "                            <label title=\"{{'ui_add_links_autostart' | translate}}\" for=\"autoStart\">\n" +
    "                                <small>{{'ui_add_links_autostart' | translate}}</small>\n" +
    "                            </label>\n" +
    "                        </div>\n" +
    "                        <div class=\"addLinksOptionsCheckbox autoExtract\">\n" +
    "                            <input type=\"checkbox\" id=\"autoExtract\" ng-model=\"selection.autoExtract\"/>\n" +
    "                            <label title=\"{{'ui_add_links_autoextract' | translate}}\" for=\"autoExtract\">\n" +
    "                                <small>{{'ui_add_links_autoextract' | translate}}</small>\n" +
    "                            </label>\n" +
    "                        </div>\n" +
    "                        <div class=\"addLinksOptionsCheckbox packagizerOverwrite\">\n" +
    "                            <input type=\"checkbox\" id=\"checkboxOverWritePackagizer\"\n" +
    "                                   ng-model=\"selection.overwritePackagizer\"\n" +
    "                            />\n" +
    "                            <label title=\"{{'ui_add_links_overwrite_packagizer' | translate}}\"\n" +
    "                                   for=\"checkboxOverWritePackagizer\">\n" +
    "                                <small>{{'ui_add_links_overwrite_packagizer' | translate}}</small>\n" +
    "                            </label>\n" +
    "                        </div>\n" +
    "                    </form>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div ng-if=\"state.sending.state === requestStates.SUCCESS\" id=\"successContainer\"><i class=\"fa fa-check successCheck\"\n" +
    "                                                                                        aria-hidden=\"true\"></i><br/>\n" +
    "    </div>\n" +
    "</div>"
  );


  $templateCache.put('partials/directives/myclipboardhistory.html',
    "<div id=\"clipboardWrapper\">\n" +
    "    <div id=\"undoContainer\" ng-click=\"undo()\" ng-if=\"undoableAction\"><a><i class=\"fa fa-undo\" aria-hidden=\"true\"></i>&nbsp;Undo</a>\n" +
    "    </div>\n" +
    "    <div id=\"selectionheader\" ng-class=\"{'selectionheader scrolled': isScrolled, 'selectionheader': !isScrolled}\"\n" +
    "         ng-if=\"isSelectionActive()\">\n" +
    "        <div class=\"selectioninfo\">\n" +
    "            <div class=\"infotext\">{{count = selectionCount()}} item<span ng-if=\"count > 1\">s</span> selected</div>\n" +
    "            <div class=\"actions\">\n" +
    "                <a ng-if=\"viewState.current !== views.ADD_LINKS_DIALOG\" ng-click=\"selectAll()\"><i\n" +
    "                        class=\"fa fa-object-group\"\n" +
    "                        aria-hidden=\"true\"></i>&nbsp;{{'ui_clipboard_history_add_all' | translate}}</a>\n" +
    "                <a ng-if=\"viewState.current !== views.ADD_LINKS_DIALOG\" ng-click=\"clearSelection()\"><i\n" +
    "                        class=\"fa fa-times\"\n" +
    "                        aria-hidden=\"true\"></i>&nbsp;{{'ui_clipboard_history_clear_selection' | translate}}</a>\n" +
    "                <a ng-if=\"viewState.current !== views.ADD_LINKS_DIALOG\" ng-click=\"deleteSelected()\"><i\n" +
    "                        class=\"fa fa-trash\"\n" +
    "                        aria-hidden=\"true\"></i>&nbsp;{{'ui_clipboard_history_delete' | translate}}</a>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        <a class=\"button\" ng-if=\"viewState.current !== views.ADD_LINKS_DIALOG\" ng-click=\"toggleAddLinksDialog()\"><i\n" +
    "                class=\"fa fa-send\"\n" +
    "                aria-hidden=\"true\"></i>&nbsp;{{'ui_clipboard_history_send' | translate}}</a>\n" +
    "\n" +
    "        <a class=\"button\" ng-click=\"toggleAddLinksDialog()\" ng-if=\"viewState.current === views.ADD_LINKS_DIALOG\"><i\n" +
    "                class=\"fa fa-arrow-left\"\n" +
    "                aria-hidden=\"true\"></i>&nbsp;\n" +
    "            {{'ui_clipboard_history_back' | translate}}</a>\n" +
    "\n" +
    "    </div>\n" +
    "    <div id=\"selectionBumber\" ng-if=\"isSelectionActive()\">&nbsp;</div>\n" +
    "    <div class=\"clearfix\"></div>\n" +
    "    <div ng-if=\"viewState.current === views.CLIPBOARD_HISTORY\">\n" +
    "        <div class=\"clipboardEmptyItem\" ng-if=\"isClipboardHistoryEmpty()\">\n" +
    "            <i class=\"fa fa-info-circle big-icon\"></i>\n" +
    "            {{'ui_clipboard_history_still_empty' | translate}}\n" +
    "        </div>\n" +
    "        <div class=\"box-grey clipboardItem\"\n" +
    "             ng-repeat=\"historyItem in historyToArray() | orderBy: '-time' track by historyItem.id\">\n" +
    "            <div>\n" +
    "                <div class=\"typeicon\"\n" +
    "                     ng-click=\"toggleSelectionHistoryItem(historyItem.id)\">\n" +
    "                    <i ng-class=\"{'selectionCheckmark fa fa-check-square-o text-color-green': selection[historyItem.id] && selection[historyItem.id] === true, 'selectionCheckmark fa fa-square-o text-color-green': !selection[historyItem.id] || selection[historyItem.id] === false}\"\n" +
    "                       aria-hidden=\"true\"></i>\n" +
    "                    <br/>\n" +
    "                    <span ng-if=\"historyItem.type === type.TEXT\"\n" +
    "                          title=\"Text\"\n" +
    "                          class=\"historyItemTypeIcon\"><i\n" +
    "                            class=\"fa fa-file-text-o\"\n" +
    "                            aria-hidden=\"true\"></i></span>\n" +
    "                    <span ng-if=\"historyItem.type === type.LINK\" class=\"historyItemTypeIcon\" title=\"Link\"><i\n" +
    "                            class=\"fa fa-link\"\n" +
    "                            aria-hidden=\"true\"></i></span>\n" +
    "                    <span ng-if=\"historyItem.type === type.CNL\" class=\"historyItemTypeIcon\" title=\"Click'n'Load\"><img\n" +
    "                            width=\"14px\"\n" +
    "                                                                                                 src=\"images/icon32.png\"/></span>\n" +
    "\n" +
    "                </div>\n" +
    "                <div ng-if=\"historyItem.type === type.TEXT || historyItem.type === type.LINK\" class=\"content\"\n" +
    "                     ng-init=\"previewText = createPreviewText(historyItem.previewText || historyItem.content); historyItem.expanded = false;\">\n" +
    "                    <div ng-click=\"historyItem.expanded = previewText.length > 150\" ng-if=\"!historyItem.expanded\">\n" +
    "                        {{previewText\n" +
    "                        | limitTo:150\n" +
    "                        }}<span\n" +
    "                            ng-if=\"previewText.length > 150\">&nbsp;<small><a>more ...</a></small></span>\n" +
    "                    </div>\n" +
    "                    <div ng-click=\"historyItem.expanded = false\" ng-if=\"historyItem.expanded\">{{previewText}}<span>&nbsp;<small><a>{{'ui_clipboard_history_less' | translate}}</a></small></span>\n" +
    "                    </div>\n" +
    "                    <div class=\"meta\">\n" +
    "                        <div title=\"{{historyItem.parent.title}}\" class=\"title\"><i class=\"fa fa-quote-left\"\n" +
    "                                                                                   aria-hidden=\"true\"></i>&nbsp;&nbsp;{{historyItem.parent.title\n" +
    "                            | limitTo:56 }}<span\n" +
    "                                    ng-if=\"historyItem.parent.title.length > 56\">&nbsp;...</span></div>\n" +
    "                        <div title=\"{{historyItem.parent.url}}\" class=\"url\"><img class=\"favicon\"\n" +
    "                                                                                 ng-src=\"{{historyItem.parent.favIconUrl}}\"\n" +
    "                                                                                 imgErrorHide/><a\n" +
    "                                href=\"{{historyItem.parent.url}}\" target=\"_blank\">{{historyItem.parent.url\n" +
    "                            | limitTo:56 }}<span\n" +
    "                                    ng-if=\"historyItem.parent.url.length > 56\">&nbsp;...</span></a></div>\n" +
    "                        <div title=\"{{historyItem.time}}\" class=\"time\"><i class=\"fa fa-calendar\"\n" +
    "                                                                          aria-hidden=\"true\"></i>&nbsp;&nbsp;{{historyItem.time\n" +
    "                            | date:'medium'}}\n" +
    "                        </div>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div ng-if=\"historyItem.type === type.CNL\" class=\"content\">\n" +
    "                    <div>Click'n'Load</div>\n" +
    "                    <div class=\"meta\">\n" +
    "                        <div title=\"{{historyItem.parent.title}}\" class=\"title\"><i class=\"fa fa-quote-left\"\n" +
    "                                                                                   aria-hidden=\"true\"></i>&nbsp;&nbsp;{{historyItem.parent.title\n" +
    "                            | limitTo:56 }}<span\n" +
    "                                    ng-if=\"historyItem.parent.title.length > 56\">&nbsp;...</span></div>\n" +
    "                        <div title=\"{{historyItem.parent.url}}\" class=\"url\"><img class=\"favicon\"\n" +
    "                                                                                 ng-src=\"{{historyItem.parent.favIconUrl}}\"\n" +
    "                                                                                 imgErrorHide/><a\n" +
    "                                href=\"{{historyItem.parent.url}}\" target=\"_blank\">{{historyItem.parent.url\n" +
    "                            | limitTo:56 }}<span\n" +
    "                                    ng-if=\"historyItem.parent.url.length > 56\">&nbsp;...</span></a></div>\n" +
    "                        <div title=\"{{historyItem.time}}\" class=\"time\"><i class=\"fa fa-calendar\"\n" +
    "                                                                          aria-hidden=\"true\"></i>&nbsp;&nbsp;{{historyItem.time\n" +
    "                            | date:'medium'}}\n" +
    "                        </div>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"actions\">\n" +
    "        <span title=\"{{'ui_clipboard_history_remove_item' | translate}}\" ng-click=\"removeHistoryItem(historyItem)\"\n" +
    "              class=\"remove-request-icon\"><i\n" +
    "                class=\"fa fa-times\" aria-hidden=\"true\"></i></span>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "            <div class=\"clearfix\"></div>\n" +
    "        </div>\n" +
    "        <div class=\"clearfix\"></div>\n" +
    "        <div ng-if=\"historyToArray().length === 1\" class=\"fillList\"><i class=\"fa fa-bookmark\"></i></div>\n" +
    "    </div>\n" +
    "    <div class=\"addlinkspanelcontainer\" ng-if=\"viewState.current === views.ADD_LINKS_DIALOG\"\n" +
    "         ng-init=\"selectedRequests = selectionToArray()\">\n" +
    "        <my-add-links-panel requests=\"selectedRequests\"></my-add-links-panel>\n" +
    "    </div>\n" +
    "</div>"
  );


  $templateCache.put('partials/directives/myconnectedpanel.html',
    "<div id=\"popup-header\">\n" +
    "    <div class=\"logo\"><a href=\"https://my.jdownloader.org\" target=\"_blank\"><img class=\"logo\" src=\"images/logo.png\"\n" +
    "                                                                                height=\"18px\"/></a></div>\n" +
    "    <ul class=\"menu\">\n" +
    "        <li><a ng-class=\"{'selected': isShowingJDList()}\" ng-click=\"showJDList()\"\n" +
    "        ><i class=\"fa fa-plug\" aria-hidden=\"true\"></i>&nbsp;{{\"menu_entry_status\"\n" +
    "            | translate}}</a>\n" +
    "        <li><a ng-class=\"{'selected': isShowingClipboard()}\"\n" +
    "               ng-click=\"showClipboardHistoryPanel()\"><i class=\"fa fa-bookmark\" aria-hidden=\"true\"></i>&nbsp;{{\"menu_entry_saved\"\n" +
    "            | translate}}</a>\n" +
    "        </li>\n" +
    "        <li><a ng-click=\"showSettings()\" title=\"{{'menu_entry_settings'\n" +
    "            | translate}}\"\n" +
    "               ng-class=\"{'selected': isShowingSettings()}\"><i\n" +
    "                class=\"fa fa-cog\" aria-hidden=\"true\"></i></a></li>\n" +
    "        <li><a ng-click=\"toggleFeedbackPanel()\" ng-class=\"{'selected': isShowingFeedbackPanel()}\" title=\"{{'menu_entry_send_feedback'\n" +
    "            | translate}}\"><i\n" +
    "                class=\"fa fa-envelope\"\n" +
    "                aria-hidden=\"true\"></i></a>\n" +
    "        </li>\n" +
    "        <li><a title=\"Logout\" ng-click=\"reallyLogout()\"><i class=\"fa fa-sign-out\" aria-hidden=\"true\"></i></a></li>\n" +
    "    </ul>\n" +
    "</div>\n" +
    "<my-really-logout-panel really-logout-dialog-shown=\"reallyLogoutDialogShown\"></my-really-logout-panel>\n" +
    "<div class=\"container-fluid\">\n" +
    "    <div class=\"row deviceContainer\">\n" +
    "        <div class=\"clearfix\"></div>\n" +
    "        <div ng-if=\"initializing\" class=\"loadingIndicator connecting\">\n" +
    "            <div class=\"loader\"></div>\n" +
    "            <div class=\"loadingMessage\"><b>{{'ui_loading_connecting' | translate}}</b></div>\n" +
    "        </div>\n" +
    "        <div class=\"clearfix\"></div>\n" +
    "        <form name=\"feedbackForm\" class=\"container feedbackPanel appear card\" ng-if=\"showFeedbackPanel\" novalidate>\n" +
    "\n" +
    "            <div class=\"header\"><b>Feedback:</b><a\n" +
    "                    ng-click=\"toggleFeedbackPanel()\"><i\n" +
    "                    class=\"fa fa-times\"\n" +
    "                    aria-hidden=\"true\"></i></a><a class=\"clearAction\" ng-if=\"!feedback.sending\"\n" +
    "                                                  ng-click=\"clearFeedback()\"><i\n" +
    "                    class=\"fa fa-trash\"\n" +
    "                    aria-hidden=\"true\"></i>&nbsp;{{'ui_feedback_clear' | translate}}</a></div>\n" +
    "            <div class=\"clearfix\"></div>\n" +
    "            <textarea ng-disabled=\"feedback.sending || feedback.success\" ng-model=\"feedback.msg\" name=\"feedback\"\n" +
    "                      ng-maxlength=\"feedback.max\"\n" +
    "                      required></textarea>\n" +
    "            <small class=\"charleftCounter\" ng-class=\"{'error':feedbackForm.feedback.$error.maxlength}\">{{feedback.msg\n" +
    "                ? (feedback.max - feedback.msg.length) : (feedbackForm.feedback.$error.maxlength ? 0 : feedback.max)}}\n" +
    "                {{'ui_feedback_chars_left' | translate}}\n" +
    "            </small>\n" +
    "            <div class=\"actions\">\n" +
    "                <button ng-click=\"sendFeedback(feedback.msg)\"\n" +
    "                        ng-disabled=\"feedback.sending || feedback.success || !feedbackForm.$valid\"\n" +
    "                        class=\"xbutton\">{{'ui_feedback_button_send' | translate}}\n" +
    "                </button>\n" +
    "            </div>\n" +
    "            <span class=\"feedbackRequestStatus\" ng-if=\"feedback.success\" class=\"appear\"><b>{{'ui_feedback_thank_you' | translate}}</b></span>\n" +
    "            <span class=\"feedbackRequestStatus\" ng-if=\"feedback.sending\" class=\"appear\"><b>{{'ui_feedback_sending' | translate}}</b></span>\n" +
    "        </form>\n" +
    "        <div class=\"clearfix\"></div>\n" +
    "        <div class=\"grabber-running-container\" ng-if=\"autoGrabberState.isActive\">\n" +
    "            <p style=\"margin: 8px;font-weight:bold;font-size: 1.16em;\">{{'ui_autograbber_running' | translate}} <a\n" +
    "                    style=\"float:right; margin-top: 2px;margin-right:2px;font-size: 0.8em; color: #c3325f; text-decoration: none;\"\n" +
    "                    href=\"\"\n" +
    "                    title=\"{{'ui_autograbber_button_stop' | translate}}\"\n" +
    "                    ng-click=\"stopAutoGrabber()\"><i\n" +
    "                    class=\"fa fa-stop\" aria-hidden=\"true\"></i> stop</a></p>\n" +
    "\n" +
    "            <my-autograbber-listitem tab-data=\"data\" ng-repeat=\"data in autoGrabberState.activeTabs\">\n" +
    "            </my-autograbber-listitem>\n" +
    "        </div>\n" +
    "        <my-clipboardhistory ng-if=\"isShowingClipboard()\"></my-clipboardhistory>\n" +
    "        <div class=\"clearfix\"></div>\n" +
    "        <div class=\"container\">\n" +
    "            <div ng-show=\"state.error !== undefined && state.error.message !== undefined\"\n" +
    "                 class=\"errorContainer errorMessage\"\n" +
    "                 id=\"errorMessage\">\n" +
    "                {{state.error.message.message || \"Sorry, there was an error\"}}<span ng-if=\"state.error.link\">&nbsp;<a\n" +
    "                    href=\"{{state.error.link}}\" target=\"_blank\">Click here</a>.</p></span><span ng-if=\"state.error.log\">&nbsp;<a\n" +
    "                    ng-click=\"sendError(state.error.raw)\">Send a log to us</a>.</p></span>\n" +
    "            </div>\n" +
    "            <div ng-show=\"(state.successMessage && state.successMessage.length > 0) === true\"\n" +
    "                 class=\"successMessage\"\n" +
    "                 id=\"successMessage\">{{state.successMessage}}\n" +
    "            </div>\n" +
    "            <div ng-show=\"state.loading\" class=\"loadingJDownloadersIndicator\">\n" +
    "                <div class=\"loader\"></div>\n" +
    "                <div class=\"loadingMessage\"><b>{{'ui_status_panel_loading' | translate}}</b></div>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        <div style=\"margin-top: 6px\">\n" +
    "            <my-device ng-if=\"isShowingJDList()\" ng-repeat=\"device in devices\" device=\"device\"></my-device>\n" +
    "        </div>\n" +
    "        <div ng-if=\"isShowingJDList() && devices.length === 1 && !initializing\" class=\"fillList\"><i\n" +
    "                class=\"fa fa-rocket\"></i></div>\n" +
    "        <my-settings ng-if=\"isShowingSettings()\"></my-settings>\n" +
    "\n" +
    "        <div ng-if=\"isShowingJDList() && devices.length === 0 && !initializing\" class=\"noDeviceConnected\">\n" +
    "            <i class=\"fa fa-info-circle big-icon\"></i>\n" +
    "            {{'ui_status_panel_no_device_connected' | translate}}\n" +
    "            <a href=\"http://support.jdownloader.org\" target=\"_blank\">{{'ui_status_panel_no_device_connected_click_here'\n" +
    "                | translate}}</a></b>\n" +
    "        </div>\n" +
    "        <div class=\"clearfix\"></div>\n" +
    "    </div>\n" +
    "</div>"
  );


  $templateCache.put('partials/directives/mydevice.html',
    "<div class=\"panel panel-default\" style=\"border-radius:3px; margin-bottom:2px;margin-right:4px;margin-left:4px;\"\n" +
    "     ng-class=\"{'panel-danger': error && error.message}\">\n" +
    "    <div class=\"panel-body\">\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-md-12 deviceErrorMessage\" ng-if=\"error && error.message\">{{error.message}}<span\n" +
    "                    ng-if=\"error.link\">&nbsp;<a\n" +
    "                    href=\"{{error.link}}\" target=\"_blank\">{{'ui_my_device_click_here' | translate}}</a> </span></div>\n" +
    "            <div class=\"col-md-8 deviceName pull-left\"><h4><a style=\"text-decoration:none\"\n" +
    "                                                              title=\"{{'ui_my_device_open_webinterface' | translate}}\"\n" +
    "                                                              href=\"https://my.jdownloader.org/?deviceId={{getEncodedDeviceId(device)}}#webinterface:downloads\"\n" +
    "                                                              target=\"_blank\">{{device.name}}&nbsp;<i\n" +
    "                    class=\"fa fa-external-link\"\n" +
    "                    aria-hidden=\"true\"></i></a></h4>\n" +
    "            </div>\n" +
    "            <div class=\"col-md-4 deviceActions pull-right\">\n" +
    "                <div ng-if=\"controlRequestRunning\" class=\"loaderContainer\">\n" +
    "                    <div class=\"loader\"></div>\n" +
    "                </div>\n" +
    "                <div ng-if=\"!controlRequestRunning\">\n" +
    "                    <button ng-if=\"deviceStatus.state === states.STOPPED_STATE || deviceStatus.state === states.IDLE || deviceStatus.state === states.PAUSE  || deviceStatus.state === states.RUNNING || deviceStatus.state === states.STOPPING\"\n" +
    "                            class=\"btn btn-sm\" title=\"{{'ui_my_device_start' | translate}}\"\n" +
    "                            ng-disabled=\"deviceStatus.state === states.RUNNING || deviceStatus.state === states.PAUSE\"\n" +
    "                            ng-click=\"start()\" ng-class=\"{'activeAction': deviceStatus.state === states.RUNNING }\">\n" +
    "                        <i\n" +
    "                                class=\"fa fa-play\"\n" +
    "                                aria-hidden=\"true\"></i>\n" +
    "                    </button>\n" +
    "                    <button ng-if=\"deviceStatus.state === states.RUNNING || deviceStatus.state === states.PAUSE \"\n" +
    "                            class=\"btn btn-sm\" class=\"actionButton\" title=\"{{'ui_my_device_pause' | translate}}\"\n" +
    "                            ng-click=\"pause(deviceStatus.state !== states.PAUSE)\"\n" +
    "                            ng-class=\"{'activeAction': deviceStatus.state === states.PAUSE}\">\n" +
    "                        <i class=\"fa fa-pause\"\n" +
    "                           aria-hidden=\"true\"></i></button>\n" +
    "                    <button ng-if=\"deviceStatus.state === states.RUNNING || deviceStatus.state === states.PAUSE || deviceStatus.state === states.STOPPING\"\n" +
    "                            title=\"{{'ui_my_device_stop' | translate}}\" class=\"btn btn-sm\" ng-click=\"stop()\"><i\n" +
    "                            class=\"fa fa-stop\"\n" +
    "                            aria-hidden=\"true\"></i>\n" +
    "                    </button>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"panel-footer\">\n" +
    "        <div class=\"deviceInfoItems\"><span title=\"{{'ui_my_device_eta' | translate}}\"><i class=\"fa fa-clock-o\"></i>&nbsp;{{deviceStatus.eta}}</span><span\n" +
    "                title=\"Speed\"><i\n" +
    "                class=\"fa fa-tachometer\"></i>&nbsp;{{deviceStatus.speed}}</span><span\n" +
    "                title=\"{{'ui_my_device_downloaded_bytes' | translate}}\"><i\n" +
    "                class=\"fa fa-check\"></i>&nbsp;{{deviceStatus.done}}</span><span\n" +
    "                title=\"{{'ui_my_device_total_bytes' | translate}}\"><i\n" +
    "                class=\"fa fa-file-o\"></i>&nbsp;{{deviceStatus.total}}</span></div>\n" +
    "    </div>\n" +
    "</div>"
  );


  $templateCache.put('partials/directives/myreallylogoutpanel.html',
    "<div id=\"reallyLogoutContainer\" ng-if=\"reallyLogoutDialogShown\">\n" +
    "    <div class=\"logoutInfo\"><b>{{'ui_logout_data_loss_warning' | translate}}</b></div>\n" +
    "    <a class=\"logoutButton\" ng-click=\"toggleReallyLogout()\">\n" +
    "    <i title=\"{{'ui_logout_close' | translate}}\"\n" +
    "       class=\"fa fa-times\"></i>&nbsp;{{'ui_logout_close' | translate}}</a><br/><a href=\"#\"\n" +
    "                                                                                  ng-click=\"logout()\"\n" +
    "                                                                                  class=\"logoutButton\"><i\n" +
    "        title=\"{{'ui_logout_title' | translate}}\"\n" +
    "        class=\"fa fa-check\"></i>&nbsp;{{'ui_logout_title' | translate}}</a>\n" +
    "\n" +
    "</div>"
  );

}]);
