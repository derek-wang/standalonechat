﻿
    angular.module('chatModule').directive('ngDraggable', ['$document','$timeout', function ($document, $timeout) {
        return {
            restrict: 'A',
            scope: {
                dragOptions: '=ngDraggable'
            },
            link: function (scope, elem, attr) {
                var startX, startY, x = 0,
                    y = 0,
                    start, stop, drag, container;
                var flag = 0;
                var width = elem[0].offsetWidth,
                    height = elem[0].offsetHeight;
                // Obtain drag options
                if (scope.dragOptions) {
                    start = scope.dragOptions.start;
                    drag = scope.dragOptions.drag;
                    stop = scope.dragOptions.stop;
                    var id = scope.dragOptions.container;
                    if (id) {
                        container = document.getElementById(id).getBoundingClientRect();
                    }
                }
                // Bind mousedown event
                elem.on('mousedown', function (e) {
   
                    flag = 0;
                    e.preventDefault();
                    startX = e.clientX - elem[0].offsetLeft;
                    startY = e.clientY - elem[0].offsetTop;                 
                    $document.on('mouseup', mouseup);

                        $document.on('mousemove', mousemove);
                  
                      
           
               
                    if (start) start(e);
                });
                // Handle drag event
                function mousemove(e) {
             
                    flag = 1;
                    y = e.clientY - startY;
                    x = e.clientX - startX;
                    setPosition();
                    if (drag) drag(e);
                }
                // Unbind drag events
                function mouseup(e) {
                    $document.unbind('mousemove', mousemove);
                    $document.unbind('mouseup', mouseup);
                    if (stop) stop(e);
                    if (flag === 0) {
                      
                        scope.$emit('ShowDialog');
                    } else if (flag === 1) {
                     
                    }
                }
                // Move element, within container if provided
                function setPosition() {
                    if (container) {
                        if (x < container.left) {
                            x = container.left;
                        } else if (x > container.right - width) {
                            x = container.right - width;
                        }
                        if (y < container.top) {
                            y = container.top;
                        } else if (y > container.bottom - height) {
                            y = container.bottom - height;
                        }
                    }
                    elem.css({
                        top: y + 'px',
                        left: x + 'px'
                    });
                }
            }
        }
    }]);
