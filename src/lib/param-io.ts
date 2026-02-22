import type { TrayParams } from "@/types/tray";
import type { CustomLayoutParams, AppMode } from "@/types/custom-tray";

// ═══════════════════════════════════════════
// 参数导入导出工具
// ═══════════════════════════════════════════

interface ParamFile {
    version: number;
    mode: AppMode;
    params: TrayParams | CustomLayoutParams;
}

const CURRENT_VERSION = 1;

// ── 导出 ──────────────────────────────────

/** 将参数序列化为 JSON 并触发浏览器下载 */
export function exportParams(
    mode: AppMode,
    params: TrayParams | CustomLayoutParams
) {
    const data: ParamFile = { version: CURRENT_VERSION, mode, params };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `tray-${mode}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── 导入 ──────────────────────────────────

/** 读取 JSON 文件并校验，返回解析后的参数 */
export function importParams(
    file: File,
    expectedMode: AppMode
): Promise<TrayParams | CustomLayoutParams> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = reader.result as string;
                const data = JSON.parse(text) as ParamFile;

                if (!data || typeof data !== "object") {
                    throw new Error("文件内容无效");
                }
                if (data.version !== CURRENT_VERSION) {
                    throw new Error(`不支持的版本号: ${data.version}`);
                }
                if (data.mode !== expectedMode) {
                    throw new Error(
                        `模式不匹配：文件为「${data.mode === "grid" ? "网格" : "自定义"}」模式，当前为「${expectedMode === "grid" ? "网格" : "自定义"}」模式`
                    );
                }

                // 校验参数结构
                if (expectedMode === "grid") {
                    validateGridParams(data.params as TrayParams);
                } else {
                    validateCustomParams(data.params as CustomLayoutParams);
                }

                resolve(data.params);
            } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
            }
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsText(file);
    });
}

// ── 校验 ──────────────────────────────────

function requireNumber(obj: Record<string, unknown>, key: string) {
    if (typeof obj[key] !== "number") {
        throw new Error(`缺少或无效的字段: ${key}`);
    }
}

function validateGridParams(p: TrayParams) {
    const obj = p as unknown as Record<string, unknown>;
    const numFields = [
        "rows", "columns", "holeDiameter", "spacing",
        "baseThickness", "holeDepth", "cornerRadius",
    ];
    for (const f of numFields) requireNumber(obj, f);
}

function validateCustomParams(p: CustomLayoutParams) {
    const obj = p as unknown as Record<string, unknown>;
    const numFields = [
        "trayWidth", "trayDepth", "spacing",
        "baseThickness", "holeDepth", "cornerRadius",
    ];
    for (const f of numFields) requireNumber(obj, f);
    if (!Array.isArray(obj.slots)) {
        throw new Error("缺少或无效的字段: slots");
    }
}
