angular.module('myjdWebextensionApp')
    .controller('ReallyLogoutCtrl', ['$scope', '$timeout', 'MyjdService', 'StorageService', function ($scope, $timeout, MyjdService, StorageService) {
        $scope.logout = function () {
            MyjdService.disconnect().then(function () {
                // Clear stored credentials and session
                StorageService.set(MyjdService.CREDS_STORAGE_KEY, null);
                StorageService.set(MyjdService.SESSION_STORAGE_KEY, null);
                $timeout(function () {
                    // Update parent scope's login state to hide connected panel and show login form
                    $scope.$emit('logout');
                    $scope.state = $scope.state || {};
                    $scope.state.isLoggedIn = false;
                    // Force reload the popup view
                    window.location.hash = '#!/popup';
                    window.location.reload();
                });
            }, function (error) {
                console.error('Logout failed:', error);
            });
        };
        $scope.toggleReallyLogout = function () {
            $timeout(function () {
                $scope.reallyLogoutDialogShown = !$scope.reallyLogoutDialogShown;
            });
        };

        $scope.$watch('reallyLogoutDialogShown', function (newVal, oldVal, scope) {
            $timeout(function () {
                $scope.reallyLogoutDialogShown = scope.reallyLogoutDialogShown;
            });
        });
    }]);
