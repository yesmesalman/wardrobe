# u2netp.onnx

Background-removal model used to find the garment in a photo
(`src/ai/garmentMask.ts`).

- Model: U²-Netp, from U²-Net by Xuebin Qin et al.,
  https://github.com/xuebinqin/U-2-Net (Apache License 2.0).
- ONNX export: rembg, https://github.com/danielgatis/rembg (MIT),
  release `v0.0.0`, file `u2netp.onnx`.
- Prepared for the app by `scripts/prepare-u2netp.py`: input fixed at
  1×3×320×320, main output only, shape calculations folded into constants.
  The output is unchanged.

Bundled into the iOS app (Copy Bundle Resources) and the Android assets
(`sourceSets` in `android/app/build.gradle`).
