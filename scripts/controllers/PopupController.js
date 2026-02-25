'use strict';

angular.module('myjdWebextensionApp')
 .controller('PopupCtrl', ['$rootScope', '$scope', '$http', '$timeout', 'BackgroundScriptService', 'ApiErrorService', 'MyjdService',
 function ($rootScope, $scope, $http, $timeout, BackgroundScriptService, ApiErrorService, MyjdService) {

 // Check existing session on load
 $scope.state = {
 isConnecting: false,
 isLoggedIn: false,
 isInitializing: true,
 successMessage: undefined,
 error: {}
 };

 $scope.credentials = {email: '', password: ''};

 // Check session on init
 MyjdService.getConnectionObservable().subscribe(function(result) {
 $timeout(function() {
 if (MyjdService.isConnected()) {
 $scope.state.isInitializing = false;
 $scope.state.isConnecting = false;
 $scope.state.isLoggedIn = true;
 }
 });
 });

 // Also check storage for existing session
 chrome.storage.local.get(['myjd_session'], function(result) {
 $timeout(function() {
 if (!result.myjd_session) {
 // No saved session, ready for login
 $scope.state.isInitializing = false;
 $scope.state.isConnecting = false;
 $scope.state.isLoggedIn = false;
 }
 });
 });

 $scope.showLoggedOutSettings = function () {
 $timeout(function () {
 chrome.runtime.openOptionsPage();
 });
 };

 $scope.login = function (credentials) {
 if ($scope.loginForm && $scope.loginForm.$valid) {
 $scope.state.error = {};
 $scope.state.isConnecting = true;
 $scope.state.isInitializing = true;

 console.log('PopupController: Attempting login for', credentials.email);

 // Use MyjdService directly instead of BackgroundScriptService
 MyjdService.connect({
 email: credentials.email,
 password: credentials.password
 }).then(function () {
 $timeout(function () {
 console.log('PopupController: Login successful');
 $scope.state.isConnecting = false;
 $scope.state.isInitializing = false;
 $scope.state.isLoggedIn = true;
 $scope.state.error = {};
 });
 }, function (error) {
 $timeout(function () {
 console.log('PopupController: Login failed', error);
 $scope.state.isConnecting = false;
 $scope.state.isInitializing = false;
 $scope.state.isLoggedIn = false;

 // Handle error properly - state.error must be an object with .message
 var errorMsg = "Login failed. Please check your email and password.";
 if (typeof error === 'string') {
 errorMsg = error;
 } else if (error && typeof error === 'object') {
 var readable = ApiErrorService.createReadableApiError(error);
 if (readable && readable.message) {
 errorMsg = readable.message;
 } else if (error.message) {
 errorMsg = error.message;
 }
 }
 $scope.state.error = { message: errorMsg };
 });
 });
 }
 };
 }])
 .directive('myAppstate', function() {
 return {
 restrict: 'E',
 scope: {
 state: '='
 },
 template: '<div ng-if="state.error.message"><div class="alert alert-danger">{{state.error.message}}</div></div>'
 };
 });
