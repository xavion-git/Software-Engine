window.requestAnimationFrame = (function () {
    // this trys to use the standard version first 
    return window.requestAnimationFrame ||
        // Uses WebKit (Safari, Chrome)
        window.webkitRequestAnimationFrame ||
        // Uses Firefox
        window.mozRequestAnimationFrame ||
        // Fallback for the browsers that don't support
        function (callback) {
             window.setTimeout(callback, 1000 / 60);
    };
})();

var canvas;
var device;
var mesh;
var meshes = [];
var mera;