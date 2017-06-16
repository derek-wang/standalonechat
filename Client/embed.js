(function () {
    var cdn = "//localhost/AutoMotoCastWebChat/"; 
    var loadedStates = ["complete", "interactive"];
    if (loadedStates.indexOf(document.readyState) > -1) {      
             init(); 

    } else {
        window.onload = init;
        
    }
    function init() {
        try {
            addscript("Scripts/ChatterFox.js");
           var styles = document.createElement("link");
            styles.type = "text/css";
            styles.rel = "stylesheet";
            styles.href = cdn + "/css/style.css";
            document.getElementsByTagName("head")[0].appendChild(styles);
        } catch (ex) {

            console.log(ex);
        }
    }
    function addscript(src) {
        var head = document.getElementsByName('ChatterFox');
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = cdn + src;
        document.getElementsByTagName("head")[0].appendChild(script);
    };  

}).call(this);