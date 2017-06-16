angular.module('chatModule').factory("StompQueueHandlers", function () {
            function checkHandler(handler) {
                if (!angular.isObject(handler) || !angular.isFunction(handler.handle)) {
                    throw "Supplied handler must be an object containing a handle function";
                }
            }

            function CompositeHandler(handlers) {
                var stompHandlers;
                if (!angular.isArray(handlers) || handlers.length == 0) {
                    throw "Composite Handler requires a non-empty array of handlers";
                }
                _.each(handlers, checkHandler);
                stompHandlers = angular.copy(handlers);
                return {
                    handle: function (data) {
                        var d = data;
                        _.each(stompHandlers, function (handler) {
                            d = handler.handle(d);
                        });
                    }
                };
            }

            function ConvertFrameBodyFromJsonHandler() {
                return {
                    handle: function (data) {
                        if (!angular.isObject(data)) {
                            return data;
                        }
                        var frame = angular.copy(data);
                        frame.body = angular.fromJson(data.body);
                        frame.body.$messageId = frame.headers["message-id"];
                        return frame;
                    }
                };
            }

            function OncePerExecutionHandler(handler) {
                var handled = false;
                checkHandler(handler);
                return {
                    handle: function (data) {
                        if (handled) {
                            return data;
                        }
                        handled = true;
                        return handler.handle(data);
                    }
                };
            }

            function DelegatingHandler(handler) {
                if (!angular.isFunction(handler)) {
                    throw "Supplied handler must be a function";
                }
                return {
                    handle: function (data) {
                        var delegateData = handler(data);
                        if (delegateData) {
                            return delegateData;
                        }
                        return data;
                    }
                };
            }
            return {
                CompositeHandler: CompositeHandler,
                ConvertFrameBodyFromJsonHandler: ConvertFrameBodyFromJsonHandler,
                OncePerExecutionHandler: OncePerExecutionHandler,
                DelegatingHandler: DelegatingHandler
            };
});
angular.module('chatModule').provider("StompJs", function () {
    var debug = false;
    var rtt = 5e3;
    this.$get = ["$q",function ($q) {
        function overSockJs(url) {
            var client = null;

            function setClient(url) {
                var socket = new SockJS(url, null, {
                    debug: debug,
                    rtt: rtt
                });
                client = Stomp.over(socket);
                client.debug = debug ? client.debug : null
            }

            function connect() {
                var deferred = $q.defer();
                var headers = {};
                if (!isConnected()) {
                    setClient(url)
                }
                var StompJsSession = {
                    connected: false,
                    frame: null,
                    interruptHandler: angular.noop
                };

                function connectSuccess(frame) {
                    StompJsSession.connected = true;
                    StompJsSession.frame = frame;
                    deferred.resolve(StompJsSession)
                }

                function connectFailure(error) {
                    client = null;
                    if (StompJsSession.connected && angular.isFunction(StompJsSession.interruptHandler)) {
                        StompJsSession.interruptHandler(error)
                    }
                    deferred.reject(error)
                }
                client.connect(headers, connectSuccess, connectFailure);
                return deferred.promise
            }

            function disconnect() {
                var deferred = $q.defer();
                if (client == null) {
                    deferred.resolve();
                    return deferred.promise
                }
                client.disconnect(deferred.resolve);
                client = null;
                return deferred.promise
            }

            function isConnected() {
                return client != null
            }

            function subscribe(queue, handler) {
                var deferred = $q.defer();
                if (!isConnected()) {
                    deferred.reject("Client must be connected to subscribe to a queue");
                    return deferred.promise
                }
                if (!handler || !angular.isFunction(handler)) {
                    deferred.reject("Supplied handler must be a function");
                    return deferred.promise
                }
                var subscription = client.subscribe(queue, handler);
                deferred.resolve(subscription);
                return deferred.promise
            }

            function unsubscribe(subscription) {
                var deferred = $q.defer();
                if (!subscription || !angular.isObject(subscription) || !subscription.id || !angular.isFunction(subscription.unsubscribe)) {
                    deferred.reject("Invalid subscription object");
                    return deferred.promise
                }
                subscription.unsubscribe();
                deferred.resolve();
                return deferred.promise
            }

            function send(queue, message) {
                var data = angular.toJson(message);
                if (!client) {
                    return
                }
                client.send(queue, {}, data)
            }
            return {
                isConnected: isConnected,
                connect: connect,
                disconnect: disconnect,
                subscribe: subscribe,
                unsubscribe: unsubscribe,
                send: send
            }
        }
        return {
            overSockJs: overSockJs
        }
    }]
});
angular.module('chatModule').provider("StompClientService", ['ApiContext', function (ApiContext) {
    this.$get = ['$q', 'StompJs','StompQueueHandlers',function ($q, StompJs, StompQueueHandlers) {
            /**
             * Return a queue handler function used during queue registration
             * @param {Function|queueHandler} handler registration function
             * @returns {queueHandler}
             */
            function getQueueHandler(handler) {
                var queueHandler = null;
                if (angular.isFunction(handler)) {
                    queueHandler = StompQueueHandlers.DelegatingHandler(handler);
                } else if (angular.isObject(handler) && angular.isFunction(handler.handle)) {
                    queueHandler = handler;
                }
                if (queueHandler) {
                    queueHandler = StompQueueHandlers.CompositeHandler([StompQueueHandlers.ConvertFrameBodyFromJsonHandler(), queueHandler]);
                }
                return queueHandler;
            }
            /**
             * Connect to Stomp server returning a promise that is fulfilled after connecting to the Stomp server.
             * @returns {promise} resolving with a decorated stompSession
             */
            function connect() {
                var client = StompJs.overSockJs(ApiContext + "/stomp");
                var subscriptions = [];
                /**
                 * Disconnect from Stomp server
                 * @returns {Promise} resolving after client disconnect
                 */
                function disconnect() {
                    if (!client) {
                        return $q.when(null);
                    }

                    function reset() {
                        client = null;
                        subscriptions = [];
                    }
                    return client.disconnect().finally(reset);
                }
                /**
                 * Subscribe the supplied handler with a queue and return a promise
                 * @param {String} queue name
                 * @param {Function} handler
                 * @returns {Promise} resolving with a queue subscription object
                 */
                function subscribe(queue, handler) {
                    if (client == null) {
                        return $q.reject("Client must be connected to subscribe to a queue")
                    }
                    var queueHandler = getQueueHandler(handler);
                    if (!queueHandler) {
                        return $q.reject("Supplied handler is invalid");
                    }
                    return client.subscribe(queue, queueHandler.handle);
                }
                /**
                 * Unsubscribe the queue and handler from the supplied subscription object
                 * @param {Object} subscription
                 * @returns {Promise} resolving after subscription has been removed
                 */
                function unsubscribe(subscription) {
                    if (client == null) {
                        return $q.reject("Client must be connected to subscribe to a queue");
                    }
                    return client.unsubscribe(subscription);
                }
                /**
                 * Send the supplied message to the supplied queue
                 * @param {String} queue
                 * @param {Object} message
                 */
                function send(queue, message) {
                    if (!client) {
                        return;
                    }
                    client.send(queue, message);
                }
                /**
                 *
                 * @returns {Object} for an active stomp client connection
                 */
                function getActiveStompClientProxy(StompSession) {
                    function setInterruptHandler(handler) {
                        StompSession.interruptHandler = handler;
                    }
                    return {
                        setInterruptHandler: setInterruptHandler,
                        disconnect: disconnect,
                        subscribe: subscribe,
                        unsubscribe: unsubscribe,
                        send: send
                    }
                }

                function errorHandler(error) {
                    disconnect();
                    return $q.reject(error);
                }
                return client.connect()
                    .then(getActiveStompClientProxy)
                    .catch(errorHandler);
            }
            return {
                connect: connect
            }
        }]
}]);


    
    angular.module('chatModule').factory("RelayDispatcher", function () {
        var tracker = 0;
        function Subscription(id, handler, dispatcher) {
            return {
                id: id,
                handler: handler,
                unsubscribe: function () {
                    dispatcher.unsubscribe(this)
                }
            }
        }
        function RelayDispatcher() {
            var subscriptions = [];
            return {
                subscribe: function (handler) {
                    if (!angular.isFunction(handler)) {
                        throw "Supplied handler must be a function"
                    }
                    var subscription = Subscription("sub-" + tracker++, handler, this);
                    subscriptions.push(subscription);
                    return subscription
                },
                unsubscribe: function (subscription) {
                    if (!subscription || !subscription.id) {
                        return
                    }
                    subscriptions = _.reject(subscriptions, function (sub) {
                        return sub.id == subscription.id
                    });
                    subscription.id = "";
                    subscription.unsubscribe = angular.noop
                },
                dispatch: function (message) {
                    if (!message) {
                        return
                    }
                    _.each(subscriptions, function (sub) {
                        sub.handler(angular.copy(message))
                    })
                }
            }
        }
        return {
            getDispatcher: function () {
                var dispatcher = RelayDispatcher();
                return {
                    subscribe: dispatcher.subscribe,
                    unsubscribe: dispatcher.unsubscribe,
                    dispatch: dispatcher.dispatch
                }
            }
        }
    });



    angular.module('chatModule').factory("TopicDispatcher", function () {
        var tracker = 0;
        function Subscription(id, handler, dispatcher) {
            return {
                id: id,
                handler: handler,
                unsubscribe: function () {
                    dispatcher.unsubscribe(this)
                }
            }
        }
        function TopicDispatcher(topicExtractor) {
            var subscriptions = {};
            return {
                subscribe: function (topic, handler) {
                    if (!angular.isString(topic) || topic.length == 0) {
                        throw "Supplied topic must be a non-empty string"
                    }
                    if (!angular.isFunction(handler)) {
                        throw "Supplied handler must be a function"
                    }
                    if (!angular.isArray(subscriptions[topic])) {
                        subscriptions[topic] = []
                    }
                    var subscription = Subscription(topic + "-" + tracker++, handler, this);
                    subscription.topic = topic;
                    subscriptions[topic].push(subscription);
                    return subscription
                },
                unsubscribe: function (subscription) {
                    if (!subscription || !subscription.id || !subscription.topic) {
                        return
                    }
                    if (subscriptions[subscription.topic]) {
                        subscriptions[subscription.topic] = _.reject(subscriptions[subscription.topic], function (sub) {
                            return sub.id == subscription.id
                        })
                    }
                    subscription.id = "";
                    subscription.topic = "";
                    subscription.unsubscribe = angular.noop
                },
                dispatch: function (message) {
                    if (!message) {
                        return
                    }
                    var topic = topicExtractor(angular.copy(message));
                    _.each(subscriptions[topic], function (sub) {
                        sub.handler(angular.copy(message))
                    })
                }
            }
        }
        return {
            getDispatcher: function (topicExtractor) {
                if (!angular.isFunction(topicExtractor)) {
                    throw "TopicDispatcher requires a defined topic extractor function"
                }
                var dispatcher = TopicDispatcher(topicExtractor);
                return {
                    subscribe: dispatcher.subscribe,
                    unsubscribe: dispatcher.unsubscribe,
                    dispatch: dispatcher.dispatch
                }
            }
        }
    });

    angular.module('chatModule').factory("RelayChannelManager"['RelayDispatcher', function (RelayDispatcher) {
        var channels = {};

        function RelayChannel(channelName) {
            var dispatcher = RelayDispatcher.getDispatcher();
            dispatcher.channel = channelName;
            return dispatcher
        }
        return {
            getChannel: function (channelName) {
                if (!angular.isString(channelName) || channelName.length == 0) {
                    throw "Supplied channel name must be a string of non-zero length"
                }
                var channel = channelName && channels[channelName];
                if (!channel) {
                    channel = RelayChannel(channelName);
                    channels[channelName] = channel
                }
                return channel
            }
        }
    }]);
    
    angular.module('chatModule').factory("TopicChannelManager", ['TopicDispatcher', function (TopicDispatcher) {
        var channels = {};

        function TopicChannel(channelName, topicExtractor) {
            var dispatcher = TopicDispatcher.getDispatcher(topicExtractor);
            dispatcher.channel = channelName;
            return dispatcher
        }
        return {
            getChannel: function (channelName, topicExtractor) {
                if (!angular.isString(channelName) || channelName.length == 0) {
                    throw "Supplied channel name must be a string of non-zero length"
                }
                if (!angular.isFunction(topicExtractor)) {
                    throw "Supplied topic extractor must be a defined function"
                }
                var channel = channelName && channels[channelName];
                if (!channel) {
                    channel = TopicChannel(channelName, topicExtractor);
                    channels[channelName] = channel
                }
                return channel
            }
        }
    }]);
