

angular.module('chatModule').factory("cookiesHandlerService", ["$cookies", function ($cookies) {
    return {
        setCookieData: function (Data) {
            $cookies.put("Data", Data);
        },
        getCookieData: function () {
            Data = $cookies.get("Data");
            return Data;
        },
        clearCookieData: function () {
            Data = "";
            $cookies.remove("Data");
        }
    }
}]);
