
    angular.module('chatModule').factory("RoomEventService", ['$http', '$q', '$log', 'ApiContext', 'RoomMessageDecoratorFactory', function ($http, $q, $log, ApiContext, RoomMessageDecoratorFactory) {
        function formatErrorsIntoErrorObject(errors) {
            var formattedErrors = {};
            if (angular.isObject(errors.data) && angular.isArray(errors.data.errors)) {
                _.each(errors.data.errors, function (error) {
                    formattedErrors[error.fieldName] = {
                        message: error.errorMessage,
                        type: error.errorType
                    }
                });
                $log.error("Formatted response: " + angular.toJson(formattedErrors))
            } else {
                formattedErrors = errors
            }
            return $q.reject(formattedErrors)
        }

        function fetchPreviousRoomEvents(room, lastMessageId) {
            return $http.get(ApiContext + "/room/" + room.id + "/messageHistory.json?lastMessageId=" + lastMessageId).then(function (result) {
                return decorateRoomEventHistoryResponse(result.data.result, room)
            }, formatErrorsIntoErrorObject)
        }

        function decorateRoomEventHistoryResponse(response, room) {
            var events = RoomMessageDecoratorFactory.decorateRoomEventHistory(response.roomEvents, room);
            room.messages = events.concat(room.messages);
            room.$lastMessage = response.$lastMessage;
            return room
        }

        function loadInitialRoomEventsIntoRoom(room) {
            return $http({
                url: ApiContext + "/room/" + room.id + "/messages.json",
                dataType: 'json',
                method: 'GET',
                withCredentials: true
            }).then(function (result) {
                return decorateInitialRoomEventResponse(result.data.result, room)
            }, formatErrorsIntoErrorObject)
        }

        function decorateInitialRoomEventResponse(response, room) {
            room.messages = RoomMessageDecoratorFactory.decorateRoomEventHistory(response.roomEvents, room);
            room.$lastMessage = false;
            return room
        }

        function createHistoryRequest(searchRequest) {
            var eventHistorySearchRequest = {};
            eventHistorySearchRequest.userId = searchRequest.user.id || null;
            eventHistorySearchRequest.from = searchRequest.from || new Date("January 1, 2000 12:00:00");
            eventHistorySearchRequest.to = searchRequest.to || new Date;
            eventHistorySearchRequest.textFilter = searchRequest.textFilter;
            eventHistorySearchRequest.tags = searchRequest.tags;
            eventHistorySearchRequest.fileTypes = _.pluck(searchRequest.fileTypes, "value");
            return eventHistorySearchRequest
        }

        function searchRoomHistoryEvents(searchRequest) {
            var historyUrl = ApiContext + "/room/" + searchRequest.room.id + "/history";
            return $http.post(historyUrl, createHistoryRequest(searchRequest)).then(function (result) {
                return decorateSearchRoomEventHistoryResponse(result.data.result, searchRequest.room)
            }, formatErrorsIntoErrorObject)
        }

        function decorateSearchRoomEventHistoryResponse(response, room) {
            return RoomMessageDecoratorFactory.decorateRoomEventSearchHistory(response.roomEvents, room)
        }
        return {
            fetchPreviousRoomEvents: fetchPreviousRoomEvents,
            loadInitialRoomEventsIntoRoom: loadInitialRoomEventsIntoRoom,
            searchRoomHistoryEvents: searchRoomHistoryEvents
        }
    }]);
    angular.module('chatModule').factory("RoomMessageDecoratorFactory", ['AppUrl', 'ApiContext', 'Authentication', function (AppUrl,ApiContext, Authentication) {
        var DEFAULT_TAG_COLOUR = "#333";

        function decorateRoomMessageEvent(roomMessageEvent, currentRoom) {
            function createTagListFromEvent(event) {
                var eventData = event.data[1] || {};
                var eventMessageTags = eventData.tags || [];
                if (eventMessageTags.length == 0 || currentRoom.roomType != "PUBLIC") {
                    return []
                }
                return _.map(eventMessageTags, function (tagName) {
                    return currentRoom.$tags[tagName] || {
                        name: tagName,
                        color: DEFAULT_TAG_COLOUR
                    }
                })
            }
            var user = roomMessageEvent.initiator;
            var eventData = roomMessageEvent.data[1] || {};
            var $userGroup = user.userGroup ? ", " + user.userGroup.name + " - " + user.userGroup.address.city + ", " + user.userGroup.address.regionAbbrievation : "";
            var $avatar = user.avatar ? ApiContext + "/files/user/avatar/" + user.id + "/" + user.avatar : AppUrl+"/images/unknown-user-avatar.png";
            var roomTitle = currentRoom != null ? currentRoom.$title : "";
            var roomMessage = {
                $type: roomMessageEvent.roomEventType || "UNDEFINED",
                $own: user.id == Authentication.getUser().id,
                $date: roomMessageEvent.date,
                $from: {
                    $display: user.firstName + " " + user.lastName + $userGroup,
                    id: user.id,
                    name: user.firstName + " " + user.lastName,
                    avatar: $avatar,
                    retail: user.retail
                },
                $room: roomMessageEvent.room,
                $roomTitle: roomMessageEvent.room.roomType == "PUBLIC" ? roomTitle : "",
                id: roomMessageEvent.id,
                message: "",
                inquiry: eventData.inquiry,
                bot: eventData.bot
            };
            switch (roomMessageEvent.roomEventType) {
                case "MESSAGE":
                    {
                        roomMessage.appendedMessage = []; roomMessage.$removed = eventData.removed; roomMessage.message = eventData.message; roomMessage.tags = createTagListFromEvent(roomMessageEvent); roomMessage.files = eventData.chatterFoxFiles; roomMessage.isBroadcast = false; roomMessage.linkMetadata = eventData.linkMetadata || null;
                        break
                    }
                case "BROADCAST":
                    {
                        roomMessage.appendedMessage = []; roomMessage.$removed = eventData.removed; roomMessage.message = eventData.message; roomMessage.tags = createTagListFromEvent(roomMessageEvent); roomMessage.files = eventData.chatterFoxFiles; roomMessage.isBroadcast = true; roomMessage.$replyCount = eventData.replyCount; roomMessage.linkMetadata = eventData.linkMetadata || null;
                        break
                    }
                case "TOPIC_CHANGE":
                    roomMessage.$oldTopic = eventData.oldTopic;
                    roomMessage.$newTopic = eventData.newTopic;
                    roomMessage.$topic = " from '" + eventData.oldTopic + "' to '" + eventData.newTopic + "'";
                    break;
                default:
                    return roomMessage
            }
            return roomMessage;
        }

        function appendMessages(roomEvents) {
            var events = [];
            _.each(roomEvents, function (event) {
                var lastMessage = _.last(events);
                if (lastMessage && shouldAppendMessage(event, lastMessage)) {
           
                    var messageAppended = {
                        id: event.id,
                        message: event.message,
                        roomId: event.$room.id,
                        $removed: event.$removed,
                        $from: event.$from.id,
                        $roomType: event.$room.roomType
                    };
                    if (lastMessage.appendedMessage !== "undefined" && lastMessage.appendedMessage != undefined && lastMessage.inquiry == false) {
                        lastMessage.appendedMessage.push(messageAppended)
                    } else {
                        events.push(event)
                    }
                } else {
                    events.push(event)
                }
            });
            return events
        }

        function shouldAppendMessage(currentMessage, lastMessage) {
            if (currentMessage.$type != "BROADCAST" && currentMessage.$type != "MESSAGE") {
                return false
            }
            var noTags = _.isEmpty(currentMessage.tags) && _.isEmpty(lastMessage.tags);
            var noFiles = _.isEmpty(currentMessage.files) && _.isEmpty(lastMessage.files);
            var notBroadcast = !currentMessage.isBroadcast && !lastMessage.isBroadcast;
            var include = noTags && noFiles && notBroadcast;
            var lastMoment = new moment(lastMessage.$date);
            var eventMoment = new moment(currentMessage.$date);
            var sameUser = false;
            if (angular.isDefined(currentMessage.$from) && angular.isDefined(lastMessage.$from)) {
     
                try
                {
                    sameUser = lastMessage.$from.id === currentMessage.$from.id
                } catch (ex)
                {

                }
           
              
            }
            return include && eventMoment.diff(lastMoment, "seconds") < 60 && sameUser
        }

        function decorateRoomEventHistory(roomEvents, currentRoom) {
            var events = _.map(roomEvents, function (event) {
                return decorateRoomMessageEvent(event, currentRoom)
            });
            events = appendMessages(events);
            currentRoom.$loaded = true;
            return events
        }

        function decorateRoomEventSearchHistory(roomEvents, currentRoom) {
            var events = _.map(roomEvents, function (event) {
                return decorateRoomMessageEvent(event, currentRoom)
            });
            events = appendMessages(events);
            events = angular.forEach(events, function (event) {
                event.$type = "HISTORY"
            });
            return events
        }
        return {
            shouldAppendMessage: shouldAppendMessage,
            decorateRoomMessageEvent: decorateRoomMessageEvent,
            decorateRoomEventHistory: decorateRoomEventHistory,
            decorateRoomEventSearchHistory: decorateRoomEventSearchHistory
        }
    }]);
