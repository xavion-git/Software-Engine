import { BABYLON } from "./babylon.math.js";
import { SoftEngine } from "./SoftEngine.js";

var requestAnimationFrame = (function () {
    return window.requestAnimationFrame       ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame    ||
           function (callback) {
               window.setTimeout(callback, 1000 / 60);
           };
})();

var canvas;
var device;
var meshes   = [];
var mera;
var saturnRing;
var stars          = []; // 2D screen positions generated once at startup
var screenPositions = []; // projected screen position of each planet centre

// ── Camera orbit state ─────────────────────────────────────────────────────
// Instead of a fixed position we store spherical coordinates and convert
// them to x/y/z each frame. This makes orbit and zoom trivial to implement.
var camRadius = 30;    // distance from origin — scroll wheel changes this
var camYaw    = 0;     // horizontal angle around Y axis — drag left/right
var camPitch  = 0.25;  // vertical angle — drag up/down (clamped so no flipping)
var drag      = { active: false, lastX: 0, lastY: 0 }; // reference so we can update its position each frame

function createSphere(name, radius, stacks, slices) {
    var vertCount = (stacks + 1) * (slices + 1);
    var faceCount = stacks * slices * 2;
    var mesh      = new SoftEngine.Mesh(name, vertCount, faceCount);
    var vIndex    = 0;
    var fIndex    = 0;

    for (var stack = 0; stack <= stacks; stack++) {
        var phi = (stack / stacks) * Math.PI;
        for (var slice = 0; slice <= slices; slice++) {
            var theta = (slice / slices) * 2 * Math.PI;
            var nx = Math.sin(phi) * Math.cos(theta);
            var ny = Math.cos(phi);
            var nz = Math.sin(phi) * Math.sin(theta);
            mesh.Vertices[vIndex] = new BABYLON.Vector3(nx * radius, ny * radius, nz * radius);
            // Normal points straight outward — just the unit direction
            mesh.Normals[vIndex]  = new BABYLON.Vector3(nx, ny, nz);
            // UV coordinates map the texture onto the sphere surface:
            // U goes 0→1 around the equator (longitude), V goes 0→1 top to bottom (latitude)
            mesh.UVs[vIndex]      = {
                u: slice / slices,
                v: stack / stacks
            };
            vIndex++;
        }
    }

    for (var stack = 0; stack < stacks; stack++) {
        for (var slice = 0; slice < slices; slice++) {
            var current = stack * (slices + 1) + slice;
            var below   = current + (slices + 1);
            mesh.Faces[fIndex++] = { A: current,     B: below,     C: current + 1 };
            mesh.Faces[fIndex++] = { A: current + 1, B: below,     C: below + 1   };
        }
    }

    return mesh;
}

// ── Ring generator ─────────────────────────────────────────────────────────
// Builds a flat disc with a hole — like a washer shape.
// Vertices are placed at two radii (inner and outer) around the Y axis.
// Each segment between two angles is two triangles forming a quad.
//
//   outer[i] ------- outer[i+1]
//      |           /      |
//      |         /        |
//   inner[i] ------- inner[i+1]
//
// Triangle 1: outer[i],  inner[i],  outer[i+1]
// Triangle 2: outer[i+1], inner[i], inner[i+1]

function createRing(name, innerRadius, outerRadius, segments) {
    var vertCount = segments * 2;
    var faceCount = segments * 2;
    var mesh      = new SoftEngine.Mesh(name, vertCount, faceCount);
    var vIndex    = 0;
    var fIndex    = 0;

    for (var i = 0; i < segments; i++) {
        var theta = (i / segments) * 2 * Math.PI;
        var cosT  = Math.cos(theta);
        var sinT  = Math.sin(theta);
        var u     = i / segments; // U goes 0→1 around the ring

        // Inner vertex — U maps along the ring, V=0 is the inner edge
        mesh.Vertices[vIndex] = new BABYLON.Vector3(innerRadius * cosT, 0, innerRadius * sinT);
        mesh.Normals[vIndex]  = new BABYLON.Vector3(0, 1, 0); // flat disc normal points up
        mesh.UVs[vIndex]      = { u: u, v: 0.0 };             // V=0 inner edge of texture
        vIndex++;

        // Outer vertex — same U, V=1 is the outer edge
        mesh.Vertices[vIndex] = new BABYLON.Vector3(outerRadius * cosT, 0, outerRadius * sinT);
        mesh.Normals[vIndex]  = new BABYLON.Vector3(0, 1, 0);
        mesh.UVs[vIndex]      = { u: u, v: 1.0 };             // V=1 outer edge of texture
        vIndex++;
    }

    for (var i = 0; i < segments; i++) {
        var innerCur  = i * 2;
        var outerCur  = i * 2 + 1;
        var innerNext = ((i + 1) % segments) * 2;
        var outerNext = ((i + 1) % segments) * 2 + 1;
        mesh.Faces[fIndex++] = { A: outerCur,  B: innerCur,  C: outerNext };
        mesh.Faces[fIndex++] = { A: outerNext, B: innerCur,  C: innerNext };
    }

    return mesh;
}

// ── Planet data ────────────────────────────────────────────────────────────
var planetData = [
    {
        name: "Sun",     radius: 1.5,  orbit: 0,    speed: 0,      tilt: 0,
        isLightSource: true,
        fill: new BABYLON.Color4(1.0,  0.75, 0.0,  1),
        wire: new BABYLON.Color4(1.0,  0.9,  0.2,  1)
    },
    {
        name: "Mercury", radius: 0.2,  orbit: 2.5,  speed: 0.047,  tilt: 0.03,
        fill: new BABYLON.Color4(0.55, 0.52, 0.50, 1),
        wire: new BABYLON.Color4(0.75, 0.72, 0.70, 1)
    },
    {
        name: "Venus",   radius: 0.35, orbit: 3.8,  speed: 0.035,  tilt: 0.05,
        fill: new BABYLON.Color4(0.85, 0.75, 0.45, 1),
        wire: new BABYLON.Color4(1.0,  0.92, 0.65, 1)
    },
    {
        name: "Earth",   radius: 0.38, orbit: 5.2,  speed: 0.029,  tilt: 0.41,
        fill: new BABYLON.Color4(0.15, 0.45, 0.80, 1),
        wire: new BABYLON.Color4(0.25, 0.70, 0.55, 1)
    },
    {
        name: "Mars",    radius: 0.28, orbit: 6.8,  speed: 0.024,  tilt: 0.44,
        fill: new BABYLON.Color4(0.75, 0.30, 0.10, 1),
        wire: new BABYLON.Color4(0.95, 0.50, 0.25, 1)
    },
    {
        name: "Jupiter", radius: 0.8,  orbit: 9.5,  speed: 0.013,  tilt: 0.05,
        fill: new BABYLON.Color4(0.80, 0.60, 0.40, 1),
        wire: new BABYLON.Color4(0.95, 0.78, 0.55, 1)
    },
    {
        name: "Saturn",  radius: 0.65, orbit: 12.5, speed: 0.009,  tilt: 0.47,
        fill: new BABYLON.Color4(0.85, 0.78, 0.50, 1),
        wire: new BABYLON.Color4(1.0,  0.95, 0.70, 1)
    },
];

// Saturn is always the last entry — store its index for ring positioning
var SATURN_INDEX = planetData.length - 1;

// ── Texture loader ─────────────────────────────────────────────────────────
// Loads an image and reads its pixel data into an ImageData object so the
// renderer can sample it directly — same approach as the backbuffer.
// Returns a promise so init() can wait for all textures before starting.
function loadTexture(path) {
    return new Promise(function(resolve) {
        var img = new Image();
        img.onload = function() {
            // Draw the image onto a temporary canvas to extract pixel data
            var tmpCanvas = document.createElement("canvas");
            tmpCanvas.width  = img.width;
            tmpCanvas.height = img.height;
            var tmpCtx = tmpCanvas.getContext("2d", { willReadFrequently: true });
            tmpCtx.drawImage(img, 0, 0);
            resolve(tmpCtx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = function() {
            console.warn("Could not load texture:", path);
            resolve(null); // resolve null so missing textures don't block init
        };
        img.src = path;
    });
}

var orbitAngles = planetData.map(function() { return Math.random() * Math.PI * 2; });

document.addEventListener("DOMContentLoaded", init, false);

async function init() {
    canvas = document.getElementById("frontBuffer");
    mera   = new SoftEngine.Camera();
    device = new SoftEngine.Device(canvas);

    for (var i = 0; i < planetData.length; i++) {
        var p    = planetData[i];
        var mesh = createSphere(p.name, p.radius, 12, 12);
        mesh.Position      = new BABYLON.Vector3(p.orbit, 0, 0);
        mesh.Rotation      = new BABYLON.Vector3(p.tilt, 0, 0);
        mesh.fillColor     = p.fill;
        mesh.wireColor     = p.wire;
        mesh.isLightSource = p.isLightSource || false;
        meshes.push(mesh);
    }

    // Load all planet textures in parallel then assign to meshes
    var texturePaths = [
        "textures/sun.jpg",
        "textures/mercury.jpg",
        "textures/venus.jpg",
        "textures/earth.jpg",
        "textures/mars.jpg",
        "textures/jupiter.jpg",
        "textures/saturn.jpg"
    ];
    var textures = await Promise.all(texturePaths.map(loadTexture));
    for (var i = 0; i < meshes.length && i < textures.length; i++) {
        if (textures[i]) meshes[i].texture = textures[i];
    }

    // Load Saturn ring texture separately
    var ringTexture = await loadTexture("textures/saturn_ring.png");

    // Create Saturn's ring — inner radius just clears the planet, outer is ~2x
    // Tilt matches Saturn's axial tilt so the ring sits around the equator
    saturnRing = createRing("SaturnRing", 0.9, 1.6, 40);
    saturnRing.fillColor   = new BABYLON.Color4(0.75, 0.68, 0.45, 0.85);
    saturnRing.wireColor   = new BABYLON.Color4(0.90, 0.85, 0.60, 1);
    saturnRing.doubleSided = true;
    if (ringTexture) saturnRing.texture = ringTexture;

    // Link ring to Saturn — renderer groups their triangles together and sorts
    // them as one unit so the ring correctly disappears behind the planet
    var saturnMesh = meshes[SATURN_INDEX];
    saturnMesh.linkedChildren = [saturnRing];
    saturnRing.linkedParent   = saturnMesh;
    saturnRing.Rotation  = new BABYLON.Vector3(planetData[SATURN_INDEX].tilt, 0, 0);
    saturnRing.Position  = new BABYLON.Vector3(planetData[SATURN_INDEX].orbit, 0, 0);
    meshes.push(saturnRing);

    mera.Target = new BABYLON.Vector3(0, 0, 0);
    updateCamera();

    // ── Mouse / scroll event listeners ────────────────────────────────────
    // Scroll wheel — zoom in and out by changing the orbit radius
    canvas.addEventListener("wheel", function(e) {
        e.preventDefault();
        camRadius += e.deltaY * 0.05;
        // Clamp so you can't zoom inside the sun or infinitely far away
        camRadius = Math.max(5, Math.min(60, camRadius));
        updateCamera();
    }, { passive: false });

    // Mouse down — start dragging
    canvas.addEventListener("mousedown", function(e) {
        drag.active = true;
        drag.lastX  = e.clientX;
        drag.lastY  = e.clientY;
    });

    // Mouse move — rotate camera while dragging
    canvas.addEventListener("mousemove", function(e) {
        if (!drag.active) return;
        var dx = e.clientX - drag.lastX;
        var dy = e.clientY - drag.lastY;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        camYaw   += dx * 0.005;
        camPitch += dy * 0.005;
        // Clamp pitch so camera never flips upside down
        camPitch = Math.max(-1.4, Math.min(1.4, camPitch));
        updateCamera();
    });

    // Mouse up / leave — stop dragging
    canvas.addEventListener("mouseup",    function() { drag.active = false; });
    canvas.addEventListener("mouseleave", function() { drag.active = false; });

    // Generate star positions once — random points across the canvas
    // Three size classes give a sense of depth: most are tiny, a few are larger
    for (var s = 0; s < 350; s++) {
        stars.push({
            x:         Math.random() * canvas.width,
            y:         Math.random() * canvas.height,
            // size 1 = faint distant star, size 2 = mid, size 3 = bright nearby
            size:      Math.random() < 0.07 ? 2 : 1,
            // brightness varies so stars don't all look identical
            brightness: 0.4 + Math.random() * 0.6
        });
    }

    requestAnimationFrame(drawingLoop);
}

// ── Orbit path drawing ────────────────────────────────────────────────────
// Draws a faint circle in 3D space for each planet's orbit.
// We step around the circle in small angle increments, project each point
// to screen space and draw a line segment between consecutive points.
// This gives a clear visual of the solar system structure.
function drawOrbitPaths() {
    var ctx = device.workingContext;
    var segments = 120; // more segments = smoother circle

    var viewMatrix = BABYLON.Matrix.LookAtLH(
        mera.Position, mera.Target, BABYLON.Vector3.Up()
    );
    var projMatrix = BABYLON.Matrix.PerspectiveFovLH(
        0.78,
        device.workingWidth / device.workingHeight,
        0.01, 1.0
    );
    var transform = viewMatrix.multiply(projMatrix);

    for (var i = 1; i < planetData.length; i++) { // skip sun at index 0
        var orbit = planetData[i].orbit;

        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth   = 0.5;

        var firstPoint = true;
        for (var s = 0; s <= segments; s++) {
            var angle = (s / segments) * 2 * Math.PI;
            var worldPoint = new BABYLON.Vector3(
                Math.cos(angle) * orbit,
                0,
                Math.sin(angle) * orbit
            );
            var p = BABYLON.Vector3.TransformCoordinates(worldPoint, transform);

            // Skip points behind the camera
            if (p.z <= 0) { firstPoint = true; continue; }

            var sx = (p.x * device.workingWidth  + device.workingWidth  / 2.0) >> 0;
            var sy = (-p.y * device.workingHeight + device.workingHeight / 2.0) >> 0;

            if (firstPoint) { ctx.moveTo(sx, sy); firstPoint = false; }
            else              ctx.lineTo(sx, sy);
        }
        ctx.stroke();
    }
}

// Converts spherical camera coordinates to a world-space position.
// Spherical coords (radius, yaw, pitch) map cleanly to orbit controls:
//   x = radius * cos(pitch) * sin(yaw)
//   y = radius * sin(pitch)
//   z = radius * cos(pitch) * cos(yaw)
function updateCamera() {
    mera.Position.x = camRadius * Math.cos(camPitch) * Math.sin(camYaw);
    mera.Position.y = camRadius * Math.sin(camPitch);
    mera.Position.z = camRadius * Math.cos(camPitch) * Math.cos(camYaw);
}

// Draws stars into the backbuffer directly so they survive putImageData.
// Drawing to the canvas context is overwritten by present() which flushes
// the backbuffer — so stars must live in the backbuffer alongside the planets.
function drawStars() {
    for (var s = 0; s < stars.length; s++) {
        var star = stars[s];
        var b    = star.brightness;
        var r    = Math.floor(200 + 55 * b);
        var g    = Math.floor(200 + 55 * b);
        var bl   = Math.floor(220 + 35 * b);
        // Write pixel(s) directly into the backbuffer
        for (var dy = 0; dy < star.size; dy++) {
            for (var dx = 0; dx < star.size; dx++) {
                var x   = (star.x + dx) >> 0;
                var y   = (star.y + dy) >> 0;
                var idx = (x + y * device.workingWidth) * 4;
                if (idx < 0 || idx >= device.backbuffer.data.length) continue;
                device.backbuffer.data[idx]     = r;
                device.backbuffer.data[idx + 1] = g;
                device.backbuffer.data[idx + 2] = bl;
                device.backbuffer.data[idx + 3] = 255;
            }
        }
    }
}

// Projects a world-space point to screen space using the current camera.
// Used to find where each planet centre lands on screen for label placement.
function projectCenter(worldPos) {
    var viewMatrix = BABYLON.Matrix.LookAtLH(
        mera.Position, mera.Target, BABYLON.Vector3.Up()
    );
    var projMatrix = BABYLON.Matrix.PerspectiveFovLH(
        0.78,
        device.workingWidth / device.workingHeight,
        0.01, 1.0
    );
    var transform = viewMatrix.multiply(projMatrix);
    var p = BABYLON.Vector3.TransformCoordinates(worldPos, transform);
    return {
        x: (p.x * device.workingWidth  + device.workingWidth  / 2.0) >> 0,
        y: (-p.y * device.workingHeight + device.workingHeight / 2.0) >> 0,
        z: p.z
    };
}

// Draws planet name labels directly onto the canvas context after present().
// Each label is offset slightly above the planet centre so it doesn't overlap.
// Labels fade out when a planet is behind the camera (z > 1).
function drawLabels() {
    var ctx = device.workingContext;
    ctx.font      = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "center";

    for (var i = 0; i < planetData.length; i++) {
        var mesh      = meshes[i];
        var projected = projectCenter(mesh.Position);

        // Skip labels for planets behind the camera (z <= 0 means behind)
        if (projected.z <= 0) continue;

        // Skip if off screen
        if (projected.x < 0 || projected.x > device.workingWidth  ||
            projected.y < 0 || projected.y > device.workingHeight) continue;

        var name = planetData[i].name;

        // Offset label above the planet — larger planets need more clearance
        var offsetY = Math.floor(planetData[i].radius * device.workingHeight * 0.06) + 14;

        // Draw a subtle dark shadow first for readability against bright backgrounds
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillText(name, projected.x + 1, projected.y - offsetY + 1);

        // Draw the label in the planet's own wire colour for visual consistency
        var wc = planetData[i].wire;
        ctx.fillStyle = "rgb(" +
            Math.floor(wc.r * 255) + "," +
            Math.floor(wc.g * 255) + "," +
            Math.floor(wc.b * 255) + ")";
        ctx.fillText(name, projected.x, projected.y - offsetY);
    }
}

function drawingLoop() {
    device.clear();

    for (var i = 0; i < planetData.length; i++) {
        var p = planetData[i];
        if (p.orbit === 0) {
            meshes[0].Rotation.y += 0.005;
            continue;
        }
        orbitAngles[i]       += p.speed * 0.02;
        meshes[i].Position.x  = Math.cos(orbitAngles[i]) * p.orbit;
        meshes[i].Position.z  = Math.sin(orbitAngles[i]) * p.orbit;
        meshes[i].Rotation.y += 0.02;
    }

    // Ring follows Saturn exactly — copy its position and rotation every frame
    var saturn = meshes[SATURN_INDEX];
    saturnRing.Position.x = saturn.Position.x;
    saturnRing.Position.y = saturn.Position.y;
    saturnRing.Position.z = saturn.Position.z;
    saturnRing.Rotation.y = saturn.Rotation.y; // spin in sync with Saturn

    // Draw stars directly onto the canvas before the 3D render
    // They sit behind everything because we draw them first
    drawStars();

    device.render(mera, meshes);
    device.present();

    // Orbit paths and labels drawn after present() so they sit on top
    drawOrbitPaths();
    drawLabels();

    requestAnimationFrame(drawingLoop);
}