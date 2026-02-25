'use strict';

angular.module('myjdWebextensionApp')
 .controller('ConnectedCtrl', ['$scope', 'MyjdService', 'MyjdDeviceService', 'ApiErrorService', '$timeout', 'StorageService',
 function ($scope, MyjdService, MyjdDeviceService, ApiErrorService, $timeout, StorageService) {

 $scope.viewstate = 'JD_LIST';
 $scope.devices = [];
 $scope.initializing = true;
 $scope.state = { error: {}, isLoggedIn: true };

 // Load devices on init
 function loadDevices() {
 $scope.initializing = true;

 MyjdService.getDeviceList().then(function(result) {
 $timeout(function() {
 $scope.initializing = false;

 // Handle undefined result
 if (!result) {
 console.log('ConnectedController: No result from getDeviceList');
 $scope.devices = [];
 $scope.state.error.message = 'Failed to load device list - no response from server';
 return;
 }

 // Check for error in result
 if (result.error) {
 console.error('ConnectedController: Error in result:', result.error);
 $scope.devices = [];
 $scope.state.error.message = ApiErrorService.createReadableApiError(result.error)?.message || 'Failed to load devices';
 return;
 }

 // Process devices
 if (result.result && result.result.devices) {
 $scope.devices = result.result.devices;
 StorageService.set(StorageService.STORAGE_DEVICE_LIST_KEY, $scope.devices);
 console.log('ConnectedController: Loaded', $scope.devices.length, 'devices');
 } else if (result.result && Array.isArray(result.result)) {
 $scope.devices = result.result;
 StorageService.set(StorageService.STORAGE_DEVICE_LIST_KEY, $scope.devices);
 } else if (result.devices) {
 // Direct devices array (from offscreen)
 $scope.devices = result.devices;
 StorageService.set(StorageService.STORAGE_DEVICE_LIST_KEY, $scope.devices);
 } else {
 console.log('ConnectedController: No devices found in result:', result);
 $scope.devices = [];
 }
 });
 }).catch(function(error) {
 $timeout(function() {
 $scope.initializing = false;
 console.error('ConnectedController: Failed to load devices', error);

 // Handle error properly
 var errorMsg = 'Failed to load your JDownloader devices. Please try again.';
 if (error && error.message) {
 errorMsg = error.message;
 } else if (typeof error === 'string') {
 errorMsg = error;
 }

 $scope.state.error.message = errorMsg;
 });
 });
 }

 // Load devices on controller init
 loadDevices();

 // Device refresh handler
 $scope.refreshDevices = function() {
 loadDevices();
 };

 // Logout confirmation toggle
 $scope.reallyLogoutDialogShown = false;
 $scope.reallyLogout = function() {
 $scope.reallyLogoutDialogShown = !$scope.reallyLogoutDialogShown;
 };

 // Logout handler - delegates to MyjdService
 $scope.logout = function() {
 MyjdService.disconnect().then(function() {
 $timeout(function() {
 $scope.state.isLoggedIn = false;
 console.log('ConnectedController: Logged out');
 });
 });
 };

 // View navigation
 $scope.showJDList = function() {
 $scope.viewstate = 'JD_LIST';
 };

 $scope.showSettings = function() {
 $scope.viewstate = 'SETTINGS';
 };

 $scope.isShowingJDList = function() {
 return $scope.viewstate === 'JD_LIST';
 };

 $scope.isShowingSettings = function() {
 return $scope.viewstate === 'SETTINGS';
 };

 // Listen for connection state changes
 MyjdService.getConnectionObservable().subscribe(function(result) {
 $timeout(function() {
 if (result && result.result === 'DISCONNECTED') {
 $scope.state.isLoggedIn = false;
 }
 });
 });

 // Subscribe to device list updates
 MyjdService.getDeviceListObservable().subscribe(function(result) {
 $timeout(function() {
 if (result && result.devices) {
 $scope.devices = result.devices;
 }
 });
 });

 }
 ]);
