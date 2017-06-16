
 
    angular.module('chatModule').factory("SystemNotificationService", ['$http', 'ApiContext', 'ChannelManager', 'UserAccountService', 'NotificationsDecoratorFactory', function ($http, ApiContext, ChannelManager, UserAccountService, NotificationsDecoratorFactory) {
        function unwrapResponse(response) {
            return response && response.data ? response.data.result : response
        }

        function fetchUserUnreadNotifications() {
            $http({
                url: ApiContext + "/user/chat/notifications/unread",
                method: 'GET',
                withCredentials: true
            }).then(unwrapResponse, handleUnreadNotifications);
        }

        function fetchUserNotifications() {
            $http.get(ApiContext + "/user/chat/notifications").then(unwrapResponse).then(handleAllNotifications)
        }

        function handleUnreadNotifications(response) {
            var notifications = [];
            _.each(response, function (notification) {
                notifications.push(NotificationsDecoratorFactory.decorateNotification(notification))
            });
            ChannelManager.uiChannel.dispatch({
                type: ChannelManager.uiChannel.events.UNREAD_NOTIFICATIONS,
                notifications: notifications
            })
        }

        function handleAllNotifications(response) {
            var notifications = [];
            _.each(response, function (notification) {
                notifications.push(NotificationsDecoratorFactory.decorateNotification(notification))
            });
            ChannelManager.uiChannel.dispatch({
                type: ChannelManager.uiChannel.events.ALL_NOTIFICATIONS,
                notifications: notifications
            })
        }

        function handlePreviousCmsBroadcasts(broadcasts) {
            _.each(broadcasts, decorateCmsBroadcast);
            ChannelManager.uiChannel.dispatch({
                type: ChannelManager.uiChannel.events.PREVIOUS_ADMIN_MESSAGES,
                notifications: broadcasts
            })
        }

        function decorateCmsBroadcast(cmsBroadcast) {
            cmsBroadcast.user = UserAccountService.getUserProfileDecorator(cmsBroadcast.user);
            return cmsBroadcast
        }
        return {
            fetchUserUnreadNotifications: fetchUserUnreadNotifications,
            fetchUserNotifications: fetchUserNotifications
        }
    }]);


    angular.module('chatModule').factory("NotificationsDecoratorFactory", ["AppUrl", "ApiContext", "Authentication", "AppName", function (AppUrl, ApiContext, Authentication, AppName) {
        function decorateNotification(notification) {
            if (angular.isDefined(notification.messageType) && notification.messageType == "ADMIN_MESSAGE") {
                var user = notification.user;
                user.$lastWebsocketDate = Authentication.getUser().$lastWebsocketDate;
                var $avatar = user.avatar ? ApiContext + "/files/user/avatar/" + user.id + "/" + user.avatar : AppUrl + "/images/unknown-user-avatar.png";
                var notificationMessage = {
                    $type: notification.messageType,
                    $date: notification.date,
                    $from: {
                        $display: user.firstName + " " + user.lastName,
                        id: user.id,
                        name: user.firstName + " " + user.lastName,
                        avatar: $avatar
                    },
                    id: notification.id,
                    viewed: moment(notification.date).isBefore(user.$lastWebsocketDate)
                };
                notificationMessage.$title = notification.title;
                notificationMessage.$message = notification.message;
                notificationMessage.$effectiveDate = notification.effectiveDate
            } else {
                var user = notification.initiator;
                user.$lastWebsocketDate = Authentication.getUser().$lastWebsocketDate;
                var eventData = notification.data[1] || {};
                var $userGroup = user.userGroup ? ", " + user.userGroup.name + " - " + user.userGroup.address.city + ", " + user.userGroup.address.regionAbbrievation : "";
                var $avatar = user.avatar ? ApiContext + "/files/user/avatar/" + user.id + "/" + user.avatar : AppUrl + "/images/unknown-user-avatar.png";
                var notificationMessage = {
                    $type: notification.eventType || "UNDEFINED",
                    $date: notification.date,
                    $from: {
                        $display: user.firstName + " " + user.lastName + $userGroup,
                        id: user.id,
                        name: user.firstName + " " + user.lastName,
                        avatar: $avatar
                    },
                    id: notification.id,
                    viewed: moment(notification.date).isBefore(user.$lastWebsocketDate)
                };
                switch (notification.eventType) {
                    case "NEW_ADMIN_MESSAGE":
                        {
                            notificationMessage.$title = notification.title; notificationMessage.$message = notification.message; notificationMessage.$effectiveDate = notification.effectiveDate;
                            break
                        }
                    case "CMS_BROADCAST":
                        {
                            notificationMessage.$title = eventData.title; notificationMessage.$message = eventData.message; notificationMessage.$effectiveDate = notification.effectiveDate;
                            break
                        }
                    case "USER_CHANGE_CMS":
                        {
                            notificationMessage.changeType = eventData.changeType; notificationMessage.$room = eventData.room;
                            var action = notificationMessage.changeType == "DELETED" ? "deleted " : notificationMessage.changeType == "ADDED" ? "added you to " : "removed you from ";
                            if (eventData.room.childRoom) {
                                notificationMessage.$message = AppName + " has " + action + notificationMessage.$room.name
                            } else {
                                notificationMessage.$message = "CMS user " + notificationMessage.$from.name + " has " + action + notificationMessage.$room.name
                            }
                            break
                        }
                    case "USER_CHANGE_CREATOR":
                        {
                            notificationMessage.changeType = eventData.changeType; notificationMessage.$room = eventData.room;
                            var action = notificationMessage.changeType == "DELETED" ? "deleted " : notificationMessage.changeType == "INVITED" ? "invited you to " : "removed you from "; notificationMessage.$message = notificationMessage.$from.name + " has " + action + notificationMessage.$room.name; notificationMessage.$invitationAccepted = eventData.invitationAccepted;
                            break
                        }
                    case "USER_INVITATION_ACTION":
                        {
                            notificationMessage.changeType = eventData.reactionType; notificationMessage.$room = eventData.room;
                            var action = notificationMessage.changeType == "LEFT" ? "left " : notificationMessage.changeType == "JOINED" ? "joined " : "declined "; notificationMessage.$message = notificationMessage.$from.name + " has " + action + notificationMessage.$room.name;
                            break
                        }
                    case "USER_CONTACT_REQUEST":
                        {
                            notificationMessage.$contactAdded = eventData.contactAdded; notificationMessage.$requestDisabled = eventData.requestDisabled; notificationMessage.$roomEventId = eventData.roomEventId; notificationMessage.$productUrl = eventData.productUrl;
                            break
                        }
                    default:
                        return notificationMessage
                }
            }
            return notificationMessage
        }
        return {
            decorateNotification: decorateNotification
        }
    }]);

   
    angular.module('chatModule').service("DocumentTitleService", ['$window', '$interval', 'ChannelManager', function($window, $interval, ChannelManager) {
        var $document = $window.document;
        var originalTitle = $document.title;
        var privateMessageTitle = "New Messages!";
        var subscription = null;
        var interval = null;

        function reset() {
         
            $interval.cancel(interval);
            interval = null;
            $document.title = originalTitle;
            $window.onfocus = null
        }

        function updateWindowTitle() {
            if (!document.hasFocus()) {
                reset();
                interval = $interval(function () {
                    $document.title = $document.title == originalTitle ? privateMessageTitle : originalTitle
                }, 1e3);
            }
            $window.onfocus = reset
        }

        function start() {
            subscription = ChannelManager.privateChannel.subscribe("PRIVATE_ROOM_MESSAGE", updateWindowTitle)
        }

        function stop() {
            if (!subscription) {
                return
            }
            if (interval) {
                reset()
            }
            subscription.unsubscribe()
        }
        return {
            start: start,
            stop: stop
        }
    }]);
