import { BABYLON } from "./babylon.math.js";

var SoftEngine = {};

SoftEngine.Camera = function() {
    this.Position = BABYLON.Vector3.Zero();
    this.Target   = BABYLON.Vector3.Zero();
};

SoftEngine.Mesh = function(name, verticesCount, facesCount) {
    this.name      = name;
    this.Vertices  = new Array(verticesCount);
    this.Normals   = new Array(verticesCount);
    this.UVs       = new Array(verticesCount); // { u, v } per vertex
    this.Faces     = new Array(facesCount);
    this.Rotation  = BABYLON.Vector3.Zero();
    this.Position  = BABYLON.Vector3.Zero();
    this.fillColor = new BABYLON.Color4(0.2, 0.2, 0.2, 1);
    this.wireColor = new BABYLON.Color4(0.4, 0.4, 0.4, 1);
    this.texture   = null; // ImageData — set after image loads
};

SoftEngine.Device = function(canvas) {
    this.workingCanvas  = canvas;
    this.workingWidth   = canvas.width;
    this.workingHeight  = canvas.height;
    this.workingContext = canvas.getContext("2d", { willReadFrequently: true });
};

SoftEngine.Device.prototype.clear = function() {
    this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);
    this.backbuffer = this.workingContext.getImageData(0, 0, this.workingWidth, this.workingHeight);
};

SoftEngine.Device.prototype.present = function() {
    this.workingContext.putImageData(this.backbuffer, 0, 0);
};

SoftEngine.Device.prototype.putPixel = function(x, y, r, g, b) {
    var data  = this.backbuffer.data;
    var index = ((x >> 0) + (y >> 0) * this.workingWidth) * 4;
    if (index < 0 || index >= data.length) return;
    data[index]     = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = 255;
};

SoftEngine.Device.prototype.project = function(coord, transMat) {
    var point = BABYLON.Vector3.TransformCoordinates(coord, transMat);
    var x = (point.x * this.workingWidth  + this.workingWidth  / 2.0) >> 0;
    var y = (-point.y * this.workingHeight + this.workingHeight / 2.0) >> 0;
    return { x: x, y: y, z: point.z };
};

SoftEngine.Device.prototype.projectWithWorld = function(coord, transMat, worldMat) {
    var worldPos = BABYLON.Vector3.TransformCoordinates(coord, worldMat);
    var point    = BABYLON.Vector3.TransformCoordinates(coord, transMat);
    var x = (point.x * this.workingWidth  + this.workingWidth  / 2.0) >> 0;
    var y = (-point.y * this.workingHeight + this.workingHeight / 2.0) >> 0;
    return { x: x, y: y, z: point.z, worldPos: worldPos };
};

SoftEngine.Device.prototype.drawLine = function(point0, point1, r, g, b) {
    var x0 = point0.x >> 0, y0 = point0.y >> 0;
    var x1 = point1.x >> 0, y1 = point1.y >> 0;
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = (x0 < x1) ? 1 : -1;
    var sy = (y0 < y1) ? 1 : -1;
    var err = dx - dy;
    while (true) {
        if (x0 >= 0 && y0 >= 0 && x0 < this.workingWidth && y0 < this.workingHeight)
            this.putPixel(x0, y0, r, g, b);
        if (x0 === x1 && y0 === y1) break;
        var e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 <  dx) { err += dx; y0 += sy; }
    }
};

// ── Texture sampler ────────────────────────────────────────────────────────
// Given a UV coordinate (0-1 range) and an ImageData texture, returns the
// RGB values at that position. U wraps horizontally, V maps top to bottom.
// We clamp to avoid reading outside the texture boundaries.
SoftEngine.Device.prototype.sampleTexture = function(texture, u, v) {
    // Wrap U so the texture tiles around the sphere seamlessly
    u = u - Math.floor(u);
    v = Math.max(0, Math.min(1, v));
    var tx = Math.min(texture.width  - 1, (u * texture.width)  | 0);
    var ty = Math.min(texture.height - 1, (v * texture.height) | 0);
    var idx = (tx + ty * texture.width) * 4;
    return {
        r: texture.data[idx],
        g: texture.data[idx + 1],
        b: texture.data[idx + 2]
    };
};

// ── Textured Gouraud scanline ──────────────────────────────────────────────
// Like drawScanlineGouraud but also interpolates U and V across the span.
// At each pixel we sample the texture at the interpolated UV, then multiply
// the RGB by the interpolated brightness for combined texture + lighting.
SoftEngine.Device.prototype.drawScanlineTextured = function(
    y, x0, x1,
    bl, br,           // brightness left / right
    ul, ur,           // U coordinate left / right
    vl, vr,           // V coordinate left / right
    texture,          // ImageData
    wireR, wireG, wireB
) {
    var startX = Math.min(x0, x1) >> 0;
    var endX   = Math.max(x0, x1) >> 0;
    var width  = endX - startX;
    if (width === 0) return;

    for (var x = startX; x <= endX; x++) {
        var t = (x - startX) / width;

        // Interpolate brightness and UV across the scanline
        var bright = bl + (br - bl) * t;
        var u      = ul + (ur - ul) * t;
        var v      = vl + (vr - vl) * t;

        // Sample the texture at this UV position
        var texel = this.sampleTexture(texture, u, v);

        // Multiply texture colour by lighting brightness
        var r = Math.min(255, (texel.r * bright) | 0);
        var g = Math.min(255, (texel.g * bright) | 0);
        var b = Math.min(255, (texel.b * bright) | 0);

        if (x >= 0 && y >= 0 && x < this.workingWidth && y < this.workingHeight)
            this.putPixel(x, y, r, g, b);
    }
};

// ── Textured Gouraud triangle ──────────────────────────────────────────────
// Sorts vertices by Y, then for each scanline interpolates brightness AND
// UV coordinates along both edges before filling the span.
// Falls back to flat Gouraud shading if no texture is assigned.
SoftEngine.Device.prototype.drawTriangleTextured = function(
    p0, p1, p2,
    b0, b1, b2,       // per-vertex brightness
    uv0, uv1, uv2,    // per-vertex UV { u, v }
    fillR, fillG, fillB,
    wireR, wireG, wireB,
    texture
) {
    var verts = [
        { p: p0, b: b0, uv: uv0 },
        { p: p1, b: b1, uv: uv1 },
        { p: p2, b: b2, uv: uv2 }
    ];
    verts.sort(function(x, y) { return x.p.y - y.p.y; });
    var a = verts[0], b = verts[1], c = verts[2];
    var totalHeight = c.p.y - a.p.y;
    if (totalHeight === 0) return;

    for (var y = a.p.y >> 0; y <= (c.p.y >> 0); y++) {
        var inUpperHalf = y < (b.p.y >> 0);
        var alpha = (y - a.p.y) / totalHeight;
        var beta  = inUpperHalf
            ? (b.p.y - a.p.y !== 0 ? (y - a.p.y) / (b.p.y - a.p.y) : 0)
            : (c.p.y - b.p.y !== 0 ? (y - b.p.y) / (c.p.y - b.p.y) : 0);

        // Interpolate X
        var xLeft  = (a.p.x + (c.p.x - a.p.x) * alpha) >> 0;
        var xRight = inUpperHalf
            ? (a.p.x + (b.p.x - a.p.x) * beta) >> 0
            : (b.p.x + (c.p.x - b.p.x) * beta) >> 0;

        // Interpolate brightness
        var bLeft  = a.b + (c.b - a.b) * alpha;
        var bRight = inUpperHalf ? a.b + (b.b - a.b) * beta : b.b + (c.b - b.b) * beta;

        // Interpolate U
        var uLeft  = a.uv.u + (c.uv.u - a.uv.u) * alpha;
        var uRight = inUpperHalf
            ? a.uv.u + (b.uv.u - a.uv.u) * beta
            : b.uv.u + (c.uv.u - b.uv.u) * beta;

        // Interpolate V
        var vLeft  = a.uv.v + (c.uv.v - a.uv.v) * alpha;
        var vRight = inUpperHalf
            ? a.uv.v + (b.uv.v - a.uv.v) * beta
            : b.uv.v + (c.uv.v - b.uv.v) * beta;

        if (texture) {
            this.drawScanlineTextured(
                y, xLeft, xRight,
                bLeft, bRight,
                uLeft, uRight,
                vLeft, vRight,
                texture, wireR, wireG, wireB
            );
        } else {
            // No texture — fall back to plain Gouraud with fill colour
            var width = Math.abs(xRight - xLeft);
            for (var x = Math.min(xLeft, xRight); x <= Math.max(xLeft, xRight); x++) {
                var t      = width > 0 ? (x - Math.min(xLeft, xRight)) / width : 0;
                var bright = bLeft + (bRight - bLeft) * t;
                var r = Math.min(255, (fillR * bright) | 0);
                var g = Math.min(255, (fillG * bright) | 0);
                var bv= Math.min(255, (fillB * bright) | 0);
                if (x >= 0 && y >= 0 && x < this.workingWidth && y < this.workingHeight)
                    this.putPixel(x, y, r, g, bv);
            }
        }
    }

    // Wireframe removed — clean textured surface only
};

SoftEngine.Device.prototype.computeVertexLighting = function(worldNormal, worldPos, lightPos) {
    var toLight = lightPos.subtract(worldPos);
    toLight.normalize();
    var diffuse = Math.max(0, BABYLON.Vector3.Dot(worldNormal, toLight));
    return Math.min(1.0, 0.08 + diffuse);
};

SoftEngine.Device.prototype.render = function(camera, meshes) {
    var viewMatrix = BABYLON.Matrix.LookAtLH(
        camera.Position, camera.Target, BABYLON.Vector3.Up()
    );
    var projectionMatrix = BABYLON.Matrix.PerspectiveFovLH(
        0.78, this.workingWidth / this.workingHeight, 0.01, 1.0
    );
    var lightPos = BABYLON.Vector3.Zero();
    var self     = this;

    function collectTriangles(mesh) {
        var worldMatrix = BABYLON.Matrix.RotationYawPitchRoll(
            mesh.Rotation.y, mesh.Rotation.x, mesh.Rotation.z
        ).multiply(BABYLON.Matrix.Translation(
            mesh.Position.x, mesh.Position.y, mesh.Position.z
        ));
        var transformMatrix = worldMatrix.multiply(viewMatrix).multiply(projectionMatrix);

        var projectedPoints = [];
        for (var v = 0; v < mesh.Vertices.length; v++) {
            var pp = self.projectWithWorld(mesh.Vertices[v], transformMatrix, worldMatrix);
            if (mesh.Normals && mesh.Normals[v]) {
                pp.worldNormal = BABYLON.Vector3.TransformNormal(mesh.Normals[v], worldMatrix);
                pp.worldNormal.normalize();
            } else {
                pp.worldNormal = BABYLON.Vector3.Copy(pp.worldPos);
                pp.worldNormal.normalize();
            }
            pp.brightness = mesh.isLightSource
                ? 1.0
                : self.computeVertexLighting(pp.worldNormal, pp.worldPos, lightPos);
            // Carry UV through for texture sampling
            pp.uv = (mesh.UVs && mesh.UVs[v]) ? mesh.UVs[v] : { u: 0, v: 0 };
            projectedPoints[v] = pp;
        }

        var result = [];
        for (var f = 0; f < mesh.Faces.length; f++) {
            var face = mesh.Faces[f];
            if (!face) continue;
            var pA = projectedPoints[face.A];
            var pB = projectedPoints[face.B];
            var pC = projectedPoints[face.C];
            if (!pA || !pB || !pC) continue;

            // Back-face culling
            var edge1  = pB.worldPos.subtract(pA.worldPos);
            var edge2  = pC.worldPos.subtract(pA.worldPos);
            var normal = BABYLON.Vector3.Cross(edge1, edge2);
            normal.normalize();
            var centre = new BABYLON.Vector3(
                (pA.worldPos.x + pB.worldPos.x + pC.worldPos.x) / 3,
                (pA.worldPos.y + pB.worldPos.y + pC.worldPos.y) / 3,
                (pA.worldPos.z + pB.worldPos.z + pC.worldPos.z) / 3
            );
            var toCamera = camera.Position.subtract(centre);
            toCamera.normalize();
            var dot = BABYLON.Vector3.Dot(normal, toCamera);
            if (dot < 0) {
                if (mesh.doubleSided) { var tmp = pB; pB = pC; pC = tmp; }
                else continue;
            }

            var avgBright = (pA.brightness + pB.brightness + pC.brightness) / 3;
            var wd = Math.min(1.0, avgBright + 0.2);

            result.push({
                pA: pA, pB: pB, pC: pC,
                bA: pA.brightness, bB: pB.brightness, bC: pC.brightness,
                uvA: pA.uv, uvB: pB.uv, uvC: pC.uv,
                fR: mesh.fillColor.r * 255,
                fG: mesh.fillColor.g * 255,
                fB: mesh.fillColor.b * 255,
                wR: mesh.wireColor.r * wd * 255,
                wG: mesh.wireColor.g * wd * 255,
                wB: mesh.wireColor.b * wd * 255,
                texture: mesh.texture || null,
                z: (pA.z + pB.z + pC.z) / 3
            });
        }
        return result;
    }

    // Group linked meshes and sort by depth
    var processed = new Array(meshes.length);
    var groups    = [];
    for (var i = 0; i < meshes.length; i++) {
        if (processed[i]) continue;
        if (meshes[i].linkedParent) { processed[i] = true; continue; }
        var group = { meshes: [meshes[i]] };
        if (meshes[i].linkedChildren) {
            for (var c = 0; c < meshes[i].linkedChildren.length; c++) {
                var ci = meshes.indexOf(meshes[i].linkedChildren[c]);
                if (ci !== -1) { group.meshes.push(meshes[ci]); processed[ci] = true; }
            }
        }
        var wm = BABYLON.Matrix.RotationYawPitchRoll(
            meshes[i].Rotation.y, meshes[i].Rotation.x, meshes[i].Rotation.z
        ).multiply(BABYLON.Matrix.Translation(
            meshes[i].Position.x, meshes[i].Position.y, meshes[i].Position.z
        ));
        var cv = BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Zero(), wm.multiply(viewMatrix));
        group.depth = cv.z;
        groups.push(group);
        processed[i] = true;
    }
    groups.sort(function(a, b) { return b.depth - a.depth; });

    for (var g = 0; g < groups.length; g++) {
        var allTris = [];
        for (var m = 0; m < groups[g].meshes.length; m++) {
            var tris = collectTriangles(groups[g].meshes[m]);
            for (var t = 0; t < tris.length; t++) allTris.push(tris[t]);
        }
        allTris.sort(function(a, b) { return b.z - a.z; });
        for (var t = 0; t < allTris.length; t++) {
            var tri = allTris[t];
            this.drawTriangleTextured(
                tri.pA, tri.pB, tri.pC,
                tri.bA, tri.bB, tri.bC,
                tri.uvA, tri.uvB, tri.uvC,
                tri.fR, tri.fG, tri.fB,
                tri.wR, tri.wG, tri.wB,
                tri.texture
            );
        }
    }
};

export { SoftEngine };