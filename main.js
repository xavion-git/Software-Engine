import { BABYLON } from "./babylon.math";

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
var meshes = []; // array
var mera;

// Adding a event to the DOM content while initializing it as false
document.addEventListener("DOMContentLoaded", init, false);
function init() {
    canvas = document.getElementById("frontBuffer");
    // Making the 8 points for the cube
    mesh = new SoftEngine.Mesh("cube", 8);
    //Pushing the mesh in the function
    meshes.push(mesh);
    mera = new SoftEngine.Camera();
    // Adding canvas as a new device using the software Engine
    device = new SoftEngine.Device(canvas);
    // Matrices of the 8 sided cube 
    mesh.Vertices[0] = new BABYLON.Vector3(-1, 1, 1);
    mesh.Vertices[1] = new BABYLON.Vector3(1, 1, 1);
    mesh.Vertices[2] = new BABYLON.Vector3(-1, -1, 1);
    mesh.Vertices[3] = new BABYLON.Vector3(-1, -1, -1);
    mesh.Vertices[4] = new BABYLON.Vector3(-1, 1, -1);
    mesh.Vertices[5] = new BABYLON.Vector3(1, 1, -1);
    mesh.Vertices[6] = new BABYLON.Vector3(1, -1, 1);
    mesh.Vertices[7] = new BABYLON.Vector3(1, -1, -1);
    mera.Position = new BABYLON.Vector3(0, 0, 10);
    mera.Target = new BABYLON.Vector3(0, 0, 0);
    requestAnimationFrame(drawingLoop);
    // Makes a loop of the 8 points vertices 
    }
    // Function to re-render the drawing of the cube adding the rotation to it to the x and y axis 
    function drawingLoop() {
        device.clear();
        mesh.Rotation.x += 0.01;
        mesh.Rotation.y += 0.01;
        device.render(mera, meshes);
        device.present();
        requestAnimationFrame(drawingLoop);
    }