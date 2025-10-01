import { BABYLON } from "./babylon.math";

var SoftEngine;
(function (SoftEngine) {
    var Camera = (function (){
        function Camera() {
            this.Position = BABYLON.Vector3.Zero();
            this.Target = BABYLON.Vector3.Zero();
        }
        return Camera;
    })
})