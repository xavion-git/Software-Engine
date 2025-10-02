
// Making the Camera & Mesh Objects
/**
 * The Camera will have two properties its position in the 3D world
 * and where it's looking at the target.
 * 
 * Both are coordinates named vector3 
 */
var SoftEngine;
(function (SoftEngine) {
    var Camera = (function (){
        function Camera() {
            this.Position = BABYLON.Vector3.Zero();
            this.Target = BABYLON.Vector3.Zero();
        }
        return Camera;
    })();
    SoftEngine.Camera = Camera;
    var Mesh = (function (){
        function Mesh(name, verticesCount) {
            this.name = name;
            this.Vertices = new Array(verticesCount);
            this.Rotation = BABYLON.Vector3.Zero();
            this.Position = BABYLON.Vector3.Zero();
        }
        return Mesh;
    })();
    SoftEngine.Mesh = Mesh;
    var Device = (function () {
        function Device(canvas) {
            this.workingCanvas = canvas;
            this.workingWidth = canvas.width;
            this.workingHeight = canvas.height;
            this.workingContext = this.workingCanvas.getContext("2d");
        }
        Device.prototype.clear = function () {
         this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);
         this.backbuffer = this.workingContext.getImageData(0, 0 , this.workingWidth, this.workingHeight);
        }
        Device.prototype.present = function () {
         this. workingContext.putImageData(this.backbuffer, 0, 0);
        } 
        Device.prototype.putPixel = function (x, y, color) {
         this.backbufferdata = this.backbuffer.data;
         
        }
    })
})(SoftEngine || (SoftEngine = {}));

