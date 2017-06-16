
    angular.module('chatModule').controller('SignInController', ['$scope', '$rootScope', '$uibModalInstance', 'AppUrl', 'Authentication', 'ChatSessionService', 'cookiesHandlerService', 'ModelDialogService', 'UserAccountService', function ($scope, $rootScope, $uibModalInstance, AppUrl, Authentication, ChatSessionService, cookiesHandlerService, ModelDialogService, UserAccountService) {
    $scope.AppUrl = AppUrl;
    $scope.Dealerselected = false;
    angular.forEach($rootScope.Dealers, function (Dealer, index) {
        if (Dealer.selected) {
            $scope.Dealerselected = true;
        } 
    });

    $scope.updateSelection = function (position, Dealers) {
        angular.forEach(Dealers, function (Dealer, index) {
            if (position != index) {
                Dealer.selected = false;
            } else {
                if (Dealer.selected) {
                    $scope.Dealerselected = true;
                } else {
                    $scope.Dealerselected = false;
                }
            }
        });
    }
    $scope.signIn = function () {


        if ($scope.userForm.$valid && $scope.Dealerselected) {
           
           
            angular.forEach($rootScope.Dealers, function (Dealer) {
                if (Dealer.selected) {
                    $rootScope.SelectedDealer = Dealer;
                }
            });
            var source = "http%3A%2F%2Fwww.agdealer.com%2Flist%2Fview_image.cfm%3FJohn-Deere-9510R-Tractor-828658%26Featured%3D1";
            $rootScope.loading = true;
            UserAccountService.checkAndCreateRetailChatUser($rootScope.user, $rootScope.SelectedDealer.id, source).then(function (result) {
                Authentication.Authenticate($rootScope.user, $rootScope.SelectedDealer.id).then(function (result) {
                    if (result != null && result.id > 0) {
                        ChatSessionService.Connect().then(function () {
                
                            ModelDialogService.ChatWindow();
                        })
                    }
                });
            })
            $uibModalInstance.close();
        }
    };
    $scope.hide = function () {
        $uibModalInstance.close();
    };
    $scope.cancel = function () {
        $uibModalInstance.close();
    };


 
    }]);
