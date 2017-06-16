

angular.module('chatModule').provider("FileThumbnailHelper", function () {

    var supportedMimeTypes = {
        IMAGE: ["jpg", "png", "jpeg", "bmp", "gif"],
        VIDEO: ["mp4", "webm", "ogg", "quicktime"],
        PDF: ["pdf"],
        WORD_DOCUMENT: ["msword", "vnd.openxmlformats-officedocument.wordprocessingml.document", "vnd.openxmlformats-officedocument.wordprocessingml.template", "vnd.ms-word.document.macroEnabled.12", "vnd.ms-word.template.macroEnabled.12"],
        EXCEL_DOCUMENT: ["vnd.ms-excel", "vnd.openxmlformats-officedocument.spreadsheetml.sheet", "vnd.openxmlformats-officedocument.spreadsheetml.template", "vnd.ms-excel.sheet.macroEnabled.12", "vnd.ms-excel.template.macroEnabled.12", "vnd.ms-excel.addin.macroEnabled.12", "vnd.ms-excel.sheet.binary.macroEnabled.12"]
    };

    function getMimeType(file) {
        return file.type.slice(file.type.lastIndexOf("/") + 1)
    }

    function isSupported($window) {
        return !!$window.FileReader && !!$window.CanvasRenderingContext2D
    }

    function isFile($window, item) {
        return angular.isObject(item) && item instanceof $window.File
    }

    function isImage(file) {
        var type = getMimeType(file);
        return supportedMimeTypes.IMAGE.indexOf(type) !== -1
    }

    function isVideo(file) {
        var type = getMimeType(file);
        return supportedMimeTypes.VIDEO.indexOf(type) !== -1
    }

    function isPDF(file) {
        var type = getMimeType(file);
        return supportedMimeTypes.PDF.indexOf(type) !== -1
    }

    function isWordDocument(file) {
        var type = getMimeType(file);
        return supportedMimeTypes.WORD_DOCUMENT.indexOf(type) !== -1
    }

    function isExcelDocument(file) {
        var type = getMimeType(file);
        return supportedMimeTypes.EXCEL_DOCUMENT.indexOf(type) !== -1
    }

    function onLoadImageFileHandler(thumbnail) {
        return function (event) {
            var img = new Image;
            img.onload = canvasDrawerOnLoadHandler(thumbnail);
            img.src = event.target.result;
            return img
        }
    }

    function canvasDrawerOnLoadHandler(thumbnail) {
        return function () {
            var width = this.width;
            var height = this.height;
            if (width > height) {
                width = thumbnail.width || this.width / this.height;
                height = this.height / this.width * thumbnail.width
            } else {
                width = this.width / this.height * thumbnail.height;
                height = thumbnail.height || this.height / this.width
            }
            thumbnail.canvas.attr({
                width: width,
                height: height
            });
            thumbnail.canvas[0].getContext("2d").drawImage(this, 0, 0, width, height);
            thumbnail.loading = false;
            return thumbnail
        }
    }



    this.$get = function () {
        return {
            supportedMimeTypes: supportedMimeTypes,
            getMimeType: getMimeType,
            isSupported: isSupported,
            isFile: isFile,
            isImage: isImage,
            isVideo: isVideo,
            isPDF: isPDF,
            isWordDocument: isWordDocument,
            isExcelDocument: isExcelDocument,
            canvasDrawerOnLoadHandler: canvasDrawerOnLoadHandler,
            onLoadImageFileHandler: onLoadImageFileHandler
        }
    }
});
