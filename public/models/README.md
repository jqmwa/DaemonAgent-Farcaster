# 3D Models Directory

This directory contains 3D models for the DaemonFetch app.

## Required File

Place your 3D model here as: **`azura.glb`**

## GLB Format (Recommended)

GLB is the binary version of glTF and is optimized for web use.

### Where to Get GLB Models

1. **Create Your Own:**
   - Blender: Export as glTF 2.0 (.glb)
   - SketchFab: Download models in GLB format
   - Ready Player Me: Create custom avatars

2. **Free Resources:**
   - [Sketchfab](https://sketchfab.com/) - Free 3D models (filter by downloadable)
   - [Ready Player Me](https://readyplayer.me/) - Create custom avatars
   - [Polyhaven](https://polyhaven.com/) - Free assets
   - [Quaternius](http://quaternius.com/) - Free low-poly models

3. **Convert Other Formats:**
   - Use [gltf.report](https://gltf.report/) to convert and optimize
   - Blender can import OBJ/FBX and export as GLB

### Model Requirements

- Format: GLB (binary glTF)
- Recommended size: < 5MB for web performance
- Centered at origin (0, 0, 0)
- Appropriate scale (will be scaled 1.5x in viewer)

### Testing

After adding `azura.glb`, restart your dev server and visit the homepage.
The model will appear between the ASCII art and "listening through the static..."

## Customization

To change the model path, edit `/app/page.tsx`:

```tsx
<Model3DViewer modelUrl="/models/your-model-name.glb" />
```

## Troubleshooting

- **Model not loading:** Check browser console for errors
- **Model too small/large:** Adjust `scale` prop in `/components/Model3DViewer.tsx`
- **Model not centered:** Edit the model in Blender and center it to origin
- **Performance issues:** Optimize your GLB file at gltf.report

