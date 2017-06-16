
    angular.module('chatModule').directive('imageonload', ['AppUrl', function (AppUrl) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element.bind('load', function () {
                   // alert('image is loaded');
                });
                element.bind('error', function () {
                    element.attr("src", AppUrl + "/images/unknown-user-avatar.png");
                });
            }
        };
    }]);

    