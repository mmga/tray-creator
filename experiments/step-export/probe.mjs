import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import initOC from 'replicad-opencascadejs';
import * as cad from 'replicad';
import jscad from '@jscad/modeling';
import { DEFAULT_TRAY_PARAMS } from '../../src/lib/grid-config.ts';
import { CUSTOM_LAYOUT_DEFAULTS } from '../../src/lib/custom-config.ts';
import { createTrayModel, prepareGridTrayCutSource } from '../../src/lib/tray-model.ts';
import { createCustomTrayModel, prepareCustomTrayCutSource } from '../../src/lib/custom-tray-model.ts';
import { createFreeSlotInstance } from '../../src/lib/slot-instance-factory.ts';

const require = createRequire(import.meta.url);
const wasm = await readFile(require.resolve('replicad-opencascadejs/wasm'));
const started = performance.now();
const oc = await initOC({ wasmBinary: wasm, print: () => {} });
cad.setOC(oc);
const output = new URL('./out/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { versions: { replicad: '1.2.1', kernel: '1.2.1' }, wasmBytes: wasm.length,
  wasmGzipBytes: gzipSync(wasm).length, initializationMs: performance.now() - started, cases: [] };
const { measureBoundingBox, measureVolume } = jscad.measurements;

function polygon(points) {
  const pen = cad.draw(points[0]);
  for (const point of points.slice(1)) pen.lineTo(point);
  return pen.close();
}

function validate(shape) {
  const check = new oc.BRepCheck_Analyzer(shape.wrapped, true);
  try { assert(check.IsValid(), '实体拓扑校验失败'); }
  finally { check.delete(); }
}

function bounds(shape) {
  const box = shape.boundingBox;
  try { return box.bounds; }
  finally { box.delete(); }
}

function maxDifference(a, b) {
  return Math.max(...a.flat().map((v, i) => Math.abs(v - b.flat()[i])));
}

// shortcut: 仅验证无斜面矩形外轮廓样本，正式接入前必须替换为共享的参数构造计划。
function build(source, params, circularGrooves) {
  assert.equal(params.sideBevelWidth, 0);
  assert.equal(params.stackableBox.enabled, false);
  assert(!source.baseHoles.blocked);
  const [min, max] = measureBoundingBox(source.body);
  let shape = cad.drawRoundedRectangle(max[0] - min[0], max[1] - min[1], params.cornerRadius)
    .sketchOnPlane('XY', min[2]).extrude(max[2] - min[2]);
  validate(shape);
  for (const [i, groove] of source.grooves.entries()) {
    const [lo, hi] = measureBoundingBox(groove);
    let profile;
    if (circularGrooves[i]) {
      profile = cad.drawCircle((hi[0] - lo[0]) / 2)
        .translate([(hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2]);
    } else {
      // 直接使用现有切削轮廓，保留超椭圆外扩与旋转，避免误当成标准椭圆。
      const rings = jscad.geometries.geom2.toOutlines(jscad.extrusions.project({}, groove));
      assert.equal(rings.length, 1);
      profile = polygon(rings[0]);
    }
    const cutter = profile.sketchOnPlane('XY', lo[2]).extrude(hi[2] - lo[2]);
    // 当前内核默认合并面会使磁吸腔样本拓扑无效，保留布尔运算原始拓扑。
    const next = shape.cut(cutter, { simplify: false });
    shape.delete(); cutter.delete(); shape = next;
    validate(shape);
  }
  for (const hole of source.baseHoles.instructions) {
    const cutter = cad.drawCircle(hole.diameter / 2).translate([hole.x, hole.y])
      .sketchOnPlane('XY', hole.bottom).extrude(hole.top - hole.bottom);
    const next = shape.cut(cutter, { simplify: false });
    shape.delete(); cutter.delete(); shape = next;
    validate(shape);
  }
  return shape;
}

const circleGrid = { ...DEFAULT_TRAY_PARAMS, rows: 2, columns: 2 };
const rectangleGrid = { ...circleGrid, slotShape: 'rectangle', slotBaseWidth: 25,
  slotBaseHeight: 50, slotWidth: 25.4, slotHeight: 50.4, baseHoleStructure: 'none' };
const custom = { ...CUSTOM_LAYOUT_DEFAULTS, traySizingMode: 'fixed', trayWidth: 100,
  trayDepth: 80, baseHoleStructure: 'none', slots: [
    createFreeSlotInstance({ id: 'a', x: 25, y: 40, width: 25 }),
    createFreeSlotInstance({ id: 'b', x: 70, y: 40, width: 30 }),
  ] };
const customEllipse = { ...custom, slots: [createFreeSlotInstance({ id: 'ellipse',
  x: 50, y: 40, width: 50, height: 30, rotation: 35 })] };

for (const [name, mode, params] of [
  ['grid-circle-magnetic', 'grid', circleGrid],
  ['grid-rectangle', 'grid', rectangleGrid],
  ['custom-circle', 'custom', custom],
  ['custom-superellipse-35deg', 'custom', customEllipse],
]) {
  const start = performance.now();
  const source = mode === 'grid' ? prepareGridTrayCutSource(params)
    : prepareCustomTrayCutSource(params, { status: 'inactive' });
  const reference = mode === 'grid' ? createTrayModel(params) : createCustomTrayModel(params);
  const circular = source.grooves.map((_, i) => mode === 'grid'
    ? params.slotShape === 'circle' : params.slots[i].shape === 'circle');
  const shape = build(source, params, circular);
  validate(shape);
  const volume = cad.measureVolume(shape);
  const referenceVolume = measureVolume(reference);
  const relativeVolumeError = Math.abs(volume - referenceVolume) / referenceVolume;
  assert(relativeVolumeError < 0.002, `${name}: 与现有模型体积差异超过 0.2%`);
  assert(maxDifference(bounds(shape), measureBoundingBox(reference)) < 0.001);
  const blob = cad.exportSTEP([{ shape, name }], { unit: 'MM', modelUnit: 'MM' });
  const step = await blob.text();
  assert(/MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS/.test(step));
  assert(step.includes('SI_UNIT(.MILLI.,.METRE.)'));
  const restored = await cad.importSTEP(blob);
  validate(restored);
  assert(Math.abs(cad.measureVolume(restored) - volume) / volume < 1e-8);
  assert(maxDifference(bounds(restored), bounds(shape)) < 0.001);
  await writeFile(new URL(`${name}.step`, output), step);
  await writeFile(new URL(`${name}.params.json`, output), JSON.stringify({ mode, params }, null, 2));
  report.cases.push({ name, stepBytes: blob.size, faces: shape.faces.length,
    cylindricalSurfaces: (step.match(/CYLINDRICAL_SURFACE/g) || []).length,
    volume, referenceVolume, relativeVolumeError, roundTripValid: true,
    elapsedMs: performance.now() - start });
  shape.delete(); restored.delete();
  console.log(`${name}: STEP 写出、读回、拓扑、尺寸及体积校验通过`);
}
await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
