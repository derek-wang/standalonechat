
    angular.module('chatModule').factory("ModelDialogService", ['$uibModal', 'RequestContext', '$rootScope', function($uibModal, RequestContext, $rootScope) {
        var ChatWindowModelOpen = false;


        var error = function (title, message) {
            $rootScope.loading = false;
            return $uibModal.open({
                templateUrl: RequestContext + "partials/errorDialog.html",
                backdrop: "static",
                controller: function ($scope, $uibModalInstance, modalData) {
                    $scope.modal = modalData
                },
                resolve: {
                    modalData: function () {
                        return {
                            title: title,
                            message: message
                        }
                    }
                }
            }).result
        };
        var showModal = function (modalOptions) {
            $rootScope.loading = false;
            var options = angular.copy(modalOptions);
            options.templateUrl = RequestContext + modalOptions.templateUrl;
            return $uibModal.open(options).result
        };
        var SignIn = function () {
            $rootScope.loading = false;
            return $uibModal.open({
                animation: true,
                ariaLabelledBy: 'modal-title-bottom',
                ariaDescribedBy: 'modal-body-bottom',
                templateUrl: 'partials/signedInDialog.html',
                appendTo: angular.element(document.getElementsByClassName("chatModule")),
                controller: 'SignInController'
            }).result;
        };
        var ChatWindow = function () {
            $rootScope.loading = false;
            if (!ChatWindowModelOpen) {               
                var modalInstance = $uibModal.open({
                    animation: true,
                    ariaLabelledBy: 'modal-title-bottom',
                    ariaDescribedBy: 'modal-body-bottom',
                    templateUrl: 'partials/ChatDialog.html',
                    appendTo: angular.element(document.getElementsByClassName("chatModule")),
                    backdrop: 'static',
                    controller: 'ChatController'
                });
                function setNotificationBar(status) {
                    ChatWindowModelOpen = status;
                    $rootScope.ShowNotificationBar = !ChatWindowModelOpen;
                }


                modalInstance.opened.then(function () {

                    setNotificationBar(true);
                });
                modalInstance.result.then(function (selectedItem) {
                    setNotificationBar(false);
                }, function () {
                    setNotificationBar(false);
                });
            }
        };
        return {
            error: error,
            showModal: showModal,
            SignIn: SignIn,
            ChatWindow: ChatWindow
        }
    }]);
