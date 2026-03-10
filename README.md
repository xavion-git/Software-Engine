# Planetary Observatory – Software 3D Renderer

## Demo

https://github.com/user-attachments/assets/8a2ae0bc-87cb-4313-8057-f7c3a6326f27

### Final Result

<video src="videos/final-demo.mp4" controls width="800"></video>

### Camera Controls and Interaction

<video src="videos/camera-controls.mp4" controls width="800"></video>

### Rendering Pipeline Visualization

<video src="videos/rendering-pipeline.mp4" controls width="800"></video>


---

# Overview

Planetary Observatory is a real-time solar system simulation rendered entirely in software using JavaScript and the HTML5 Canvas API.

Instead of relying on WebGL or GPU acceleration, the entire 3D rendering pipeline is implemented manually. Every pixel drawn on the screen is computed by the CPU and written directly into a canvas backbuffer.

The project demonstrates how modern graphics engines work internally by implementing the key stages of a 3D pipeline from scratch.

The renderer includes:

- 3D transformations
- Perspective projection
- Triangle rasterization
- Texture mapping
- Gouraud lighting
- Back-face culling
- Painter's algorithm depth sorting
- Interactive camera controls
- Procedural starfield generation

The final scene renders a dynamic solar system with orbiting planets, lighting from the sun, textured surfaces, and Saturn’s ring system.

---

# Mathematical Foundations

The renderer relies heavily on linear algebra and geometric transformations.

## Coordinate Transformations

Vertices are transformed through three main coordinate spaces.

Model Space → World Space → View Space → Projection Space → Screen Space


This transformation chain can be written as:


V_screen = Projection * View * World * V_model


Where:

- **World Matrix** positions objects in the scene
- **View Matrix** represents the camera
- **Projection Matrix** converts 3D coordinates to perspective space

---

## Perspective Projection

Perspective projection converts 3D coordinates into normalized device coordinates.


x' = x / z
y' = y / z


The engine uses a perspective projection matrix with a field of view:


f = 1 / tan(FOV / 2)


Projection matrix form:


| f/aspect 0 0 0 |
| 0 f 0 0 |
| 0 0 zf/(zf-zn) 1 |
| 0 0 (-zn*zf)/(zf-zn) 0 |
Where:

- `zn` = near clipping plane  
- `zf` = far clipping plane  

---

## Diffuse Lighting Model

Lighting is computed per vertex using a Lambertian diffuse model.
brightness = max(0, dot(N, L))


Where:

- **N** = surface normal  
- **L** = normalized light direction  

The final brightness includes a small ambient term:


brightness = ambient + max(0, dot(N, L))


The brightness value is interpolated across the triangle surface during rasterization.

---

# Features

## Full Software Rendering Pipeline

The renderer performs all graphics processing on the CPU.

Implemented stages include:

- Vertex transformation
- Back-face culling
- Triangle rasterization
- Gouraud shading
- Texture sampling
- Painter’s algorithm depth sorting

Pixels are written directly into the canvas `ImageData` buffer.

---

## Textured Planet Surfaces

Each planet uses UV-mapped textures.

Texture coordinates are interpolated across triangles and sampled per pixel.

Final color calculation:
finalColor = textureColor * brightness


This produces textured surfaces combined with lighting.

---

## Interactive Camera System

The camera uses spherical coordinates to orbit around the scene.


x = r * cos(pitch) * sin(yaw)
y = r * sin(pitch)
z = r * cos(pitch) * cos(yaw)


This allows simple orbit controls.

### Controls

Mouse Drag  
Rotate the camera around the solar system

Mouse Wheel  
Zoom in and out

---

## Solar System Simulation

Each planet is defined by parameters including:

- Radius
- Orbital distance
- Orbital speed
- Axial tilt

Planet positions are updated every frame using circular orbit equations.


x = cos(angle) * orbitRadius
z = sin(angle) * orbitRadius


The sun acts as the central light source.

---

## Saturn Ring System

Saturn's rings are generated using a custom ring mesh.

The ring is constructed as a disc with an inner and outer radius and segmented triangles.


outer[i] ------- outer[i+1]
| /
| /
inner[i] ---- inner[i+1]


Two triangles form each quad segment.

The ring is linked to Saturn so the renderer sorts them together for correct visibility.

---

## Procedural Starfield

A starfield is generated randomly at startup.

Each star has:

- Random screen position
- Random brightness
- Random size

Stars are drawn directly into the backbuffer before rendering the 3D scene.

---

## Planet Labels

Planet names are projected from world space to screen space and drawn above each planet.

Labels dynamically follow their corresponding planet as it moves through the scene.

---

# Renderer Architecture

The engine is organized into several core components.

## Math Library

A lightweight math library provides vector and matrix operations.

Classes include:

- `Vector2`
- `Vector3`
- `Matrix`
- `Color4`

These classes handle all geometry calculations used by the renderer.

---

## Camera

The camera defines the viewpoint of the scene.

Responsibilities:

- Store position and target
- Generate the view matrix
- Control perspective orientation

---

## Mesh

A mesh represents a 3D object.

Each mesh contains:

- Vertex positions
- Vertex normals
- UV coordinates
- Triangle faces
- Transform data
- Optional texture

Meshes are used to represent planets and rings.

---

## Device (Software Renderer)

The device is the core renderer responsible for drawing the scene.

Responsibilities include:

- Managing the canvas backbuffer
- Writing pixel data
- Projecting vertices
- Rasterizing triangles
- Sampling textures
- Applying lighting

---

# Rendering Pipeline

The render loop performs the following steps:

1. Update planetary orbit positions
2. Transform vertices using world, view, and projection matrices
3. Perform back-face culling
4. Compute lighting per vertex
5. Sort triangles by depth
6. Rasterize triangles using scanline algorithms
7. Sample textures and apply lighting
8. Write pixels into the canvas backbuffer
9. Present the final frame

---

---

# Educational Purpose

This project was created to explore the internal mechanics of 3D rendering systems.

It demonstrates how modern graphics pipelines operate by recreating them entirely in software using JavaScript.

Key concepts explored include:

- Linear algebra for graphics
- Perspective projection
- Rasterization algorithms
- Lighting models
- Texture mapping
- Camera systems

---

# Future Improvements

Potential extensions include:

- Z-buffer depth testing
- Perspective-correct texture mapping
- Specular lighting
- Shadow mapping
- More accurate orbital mechanics
- GPU version using WebGL
- Additional celestial objects

---
