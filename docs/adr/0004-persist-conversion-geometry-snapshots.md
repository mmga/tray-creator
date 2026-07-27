# 持久化转换底盘几何快照

Conversion Base 的 Draft 与 Persisted Param Artifact 同时保存所选规格的身份和已解析的 Conversion Geometry Snapshot，2D 预览、3D 生成、结果摘要与导出均以快照为准，不从当前 Base Standard 目录或 Personal Base Specification Library 重新推导几何。该设计接受参数文件中的几何冗余，以保证官方预设修正、个人规格编辑或删除后已有转换仍可复现；旧版仅含标准 ID 的参数在 Legacy Param Migration 中解析一次当前规格并补齐快照。
