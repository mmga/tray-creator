"""通过 FreeCAD 随包 Python 检查实际下载的 STEP 和后续布尔运算。"""

from pathlib import Path
import sys

import FreeCAD
import Part

folder = Path(sys.argv[1])
files = sorted(folder.glob("*.step"))
assert files, "目录中没有 STEP 文件"
print("FreeCAD", ".".join(FreeCAD.Version()[:3]))

for file in files:
    shape = Part.read(str(file.resolve()))
    assert shape.isValid() and shape.Solids and shape.Volume > 0, file
    bounds = shape.BoundBox
    size = bounds.XLength, bounds.YLength, bounds.ZLength
    assert all(value > 0 for value in size), file
    # 削去底部薄层，检查读取结果可作为后续 CAD 布尔操作的输入。
    origin = FreeCAD.Vector(bounds.XMin - 1, bounds.YMin - 1, bounds.ZMin - 1)
    trimmed = shape.cut(Part.makeBox(size[0] + 2, size[1] + 2, 1.1, origin))
    assert trimmed.isValid() and 0 < trimmed.Volume < shape.Volume, file
    print(f"{file.name}: {len(shape.Solids)} 个实体，{size} mm，布尔切削通过")
