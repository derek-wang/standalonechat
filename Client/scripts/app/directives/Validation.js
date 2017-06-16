    angular.module('chatModule').directive('validSubmit', ['$parse', function ($parse) {
        return {
            compile: function compile(tElement, tAttrs, transclude) {
                return {
                    post: function postLink(scope, element, iAttrs, controller) {
                        var form = element.controller('form');
                        form.$submitted = false;
                        var fn = $parse(iAttrs.validSubmit);
                        element.on('submit', function (event) {
                            scope.$apply(function () {
                                element.addClass('ng-submitted');
                                form.$submitted = true;
                                if (form.$valid) {
                                    fn(scope, { $event: event });
                                }
                            });
                        });
                        scope.$watch(function () { return form.$valid }, function (isValid) {
                            if (form.$submitted == false) return;
                            if (isValid) {
                                element.removeClass('has-error').addClass('has-success');
                            } else {
                                element.removeClass('has-success');
                                element.addClass('has-error');
                            }
                        });
                    }
                }
            }
        }
    }]);