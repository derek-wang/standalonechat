
  
    angular.module('chatModule').directive("chatterFoxFile", ["$window", "FileThumbnailHelper", "ApiContext", function ($window, FileThumbnailHelper, ApiContext) {
        return {
            restrict: "E",
            template: "<canvas/>",
            requires: ["^cfThumb"],
            link: function (scope, element, attributes) {
                if (!FileThumbnailHelper.isSupported($window)) {
                    return
                }
                var serverContext = ApiContext + "/files/download/thumbnail/";
                var iconContext = "/img/icons/";
                var canvas = element.find("canvas");
                var thumbnail = scope.$eval(attributes.thumbnail);
                thumbnail.canvas = canvas;
                var imgReader = new Image;
                if (FileThumbnailHelper.isImage(thumbnail.file)) {
                    imgReader.alt = "Image Thumbnail";
                    imgReader.src = serverContext + thumbnail.file.id;
                    imgReader.onload = FileThumbnailHelper.canvasDrawerOnLoadHandler(thumbnail);
                    thumbnail.canvas.css("cursor", "pointer")
                } else if (FileThumbnailHelper.isVideo(thumbnail.file)) {
                    imgReader.alt = "Video Icon Thumbnail";
                    imgReader.src = iconContext + "video_icon.png";
                    imgReader.onload = FileThumbnailHelper.canvasDrawerOnLoadHandler(thumbnail)
                } else if (FileThumbnailHelper.isPDF(thumbnail.file)) {
                    imgReader.alt = "Pdf Icon Thumbnail";
                    imgReader.src = iconContext + "pdf_icon.png";
                    imgReader.onload = FileThumbnailHelper.canvasDrawerOnLoadHandler(thumbnail)
                } else if (FileThumbnailHelper.isWordDocument(thumbnail.file)) {
                    imgReader.alt = "Word Icon Thumbnail";
                    imgReader.src = iconContext + "word_icon.png";
                    imgReader.onload = FileThumbnailHelper.canvasDrawerOnLoadHandler(thumbnail)
                } else if (FileThumbnailHelper.isExcelDocument(thumbnail.file)) {
                    imgReader.alt = "Excel Icon Thumbnail";
                    imgReader.src = iconContext + "excel_icon.png";
                    imgReader.onload = FileThumbnailHelper.canvasDrawerOnLoadHandler(thumbnail)
                } else {
                    imgReader.alt = "File Thumbnail";
                    imgReader.src = iconContext + "file_icon.png";
                    imgReader.onload = FileThumbnailHelper.canvasDrawerOnLoadHandler(thumbnail)
                }
                element.on("$destroy", function () {
                    canvas.remove();
                    thumbnail.src = null;
                    thumbnail.canvas = null;
                    thumbnail.file = null;
                    thumbnail = null
                })
            }
        }
    }]);

        angular.module('chatModule').directive('cfThumb', ['$compile', function ($compile) {
            var messageTypeTemplates = {
                LOCAL_FILE: $compile('<local-file thumbnail="thumbnail"/>'),
                CHATTERFOX_FILE: $compile('<chatter-fox-file thumbnail="thumbnail"/>'),
                BLOB_FILE: $compile('<img class="paste-drag-image" ngf-thumbnail="$file">')
            };

            function getMessageTemplate($type) {
                return messageTypeTemplates[$type]
            }
            return {
                restrict: "E",
                scope: {
                    $file: "=file",
                    $height: "=height",
                    $width: "=width"
                },
                link: function (scope, element) {
                    var template;
                    var templateElement;
                    scope.thumbnail = {
                        canvas: null,
                        file: scope.$file,
                        height: scope.$height,
                        width: scope.$width,
                        loading: true
                    };
                    if (scope.$file instanceof File) {
                        template = getMessageTemplate("LOCAL_FILE")
                    } else if (angular.isDefined(scope.$file.mongoObjectId)) {
                        template = getMessageTemplate("CHATTERFOX_FILE")
                    } else if (scope.$file instanceof Blob) {
                        template = getMessageTemplate("BLOB_FILE")
                    } else {
                        return
                    }
                    template(scope, function (clonedElement, scope) {
                        templateElement = clonedElement;
                        element.append(clonedElement)
                    });
                    template = null;
                    element.on("$destroy", function () {
                        templateElement.remove();
                        templateElement = null
                    })
                }
            }
        }]);

