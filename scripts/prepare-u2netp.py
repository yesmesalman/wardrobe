"""
Prepares the U²-Netp background-removal model shipped with the app:
  src/assets/ai/u2netp.onnx

U²-Netp (https://github.com/xuebinqin/U-2-Net, Apache-2.0) finds the main
object in a photo. The ONNX export published by rembg
(https://github.com/danielgatis/rembg, MIT) is simplified for the app:
  - the input is fixed at 1x3x320x320 (the app always resizes to that)
  - only the main (fused) output is kept
  - shape calculations are folded into constants (ONNX Runtime's basic graph
    optimisations), leaving plain Conv / Relu / MaxPool / Resize / Concat /
    Add / Sigmoid; the output is unchanged

Usage (needs Python 3 with `pip install onnx onnxruntime numpy`):
  curl -L -o /tmp/u2netp.onnx \
    https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
  python3 scripts/prepare-u2netp.py /tmp/u2netp.onnx src/assets/ai/u2netp.onnx
"""
import os
import sys
import tempfile

import numpy as np
import onnx
import onnxruntime as ort


def main(source, target):
    model = onnx.load(source)
    del model.graph.output[1:]
    for dim, value in zip(model.graph.input[0].type.tensor_type.shape.dim, [1, 3, 320, 320]):
        dim.ClearField("dim_param")
        dim.dim_value = value

    with tempfile.TemporaryDirectory() as tmp:
        fixed = os.path.join(tmp, "fixed.onnx")
        folded = os.path.join(tmp, "folded.onnx")
        onnx.save(model, fixed)
        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        options.optimized_model_filepath = folded
        ort.InferenceSession(fixed, options, providers=["CPUExecutionProvider"])
        model = onnx.load(folded)

    # Plain ONNX only: drop the extra domains the optimiser declares.
    standard = [o for o in model.opset_import if o.domain in ("", "ai.onnx")]
    del model.opset_import[:]
    model.opset_import.extend(standard)
    model.producer_name = "wardrobe (u2netp, 320x320, main output only)"
    onnx.checker.check_model(model)
    onnx.save(model, target)

    # Same result as the original.
    x = np.random.rand(1, 3, 320, 320).astype(np.float32)
    name = ort.InferenceSession(source).get_inputs()[0].name
    a = ort.InferenceSession(source).run(None, {name: x})[0]
    b = ort.InferenceSession(target).run(None, {name: x})[0]
    print(f"{target}: {os.path.getsize(target) / 1e6:.1f} MB, max difference {np.abs(a - b).max():.2e}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
