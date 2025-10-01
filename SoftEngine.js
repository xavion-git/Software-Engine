import { BABYLON } from "./babylon.math";

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
})(SoftEngine || (SoftEngine = {}));