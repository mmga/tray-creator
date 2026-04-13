#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

LOCAL_GRAPHIFY_PATH = Path(__file__).resolve().parents[1] / "tmp" / "graphify-py"
if LOCAL_GRAPHIFY_PATH.exists():
    sys.path.insert(0, str(LOCAL_GRAPHIFY_PATH))

from graphify.analyze import god_nodes, suggest_questions, surprising_connections
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.detect import _is_ignored, _is_noise_dir, _load_graphifyignore
from graphify.export import to_html, to_json
from graphify.extract import extract
from graphify.report import generate


CODE_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".go",
    ".rs",
    ".java",
    ".c",
    ".h",
    ".cpp",
    ".cc",
    ".cxx",
    ".hpp",
    ".rb",
    ".cs",
    ".kt",
    ".kts",
    ".scala",
    ".php",
    ".swift",
    ".lua",
    ".toc",
    ".zig",
    ".ps1",
    ".m",
    ".mm",
}

TEST_DIR_NAMES = {"test", "tests", "__test__", "__tests__"}


def is_test_path(path: Path, root: Path) -> bool:
    lower_name = path.name.lower()
    if ".test." in lower_name or ".spec." in lower_name:
        return True

    try:
        relative_parts = path.relative_to(root).parts
    except ValueError:
        relative_parts = path.parts

    return any(part.lower() in TEST_DIR_NAMES for part in relative_parts[:-1])


def collect_code_files(root: Path) -> list[Path]:
    ignore_patterns = _load_graphifyignore(root)
    results: list[Path] = []

    for dirpath, dirnames, filenames in os.walk(root):
        current_dir = Path(dirpath)

        if any(part.startswith(".") for part in current_dir.relative_to(root).parts):
            dirnames.clear()
            continue

        dirnames[:] = [
            name
            for name in dirnames
            if not name.startswith(".")
            and name != "graphify-out"
            and name.lower() not in TEST_DIR_NAMES
            and not _is_noise_dir(name)
            and not _is_ignored(current_dir / name, root, ignore_patterns)
        ]

        for filename in filenames:
            path = current_dir / filename
            if filename.startswith("."):
                continue
            if path.suffix.lower() not in CODE_EXTENSIONS:
                continue
            if is_test_path(path, root):
                continue
            if _is_ignored(path, root, ignore_patterns):
                continue
            results.append(path)

    return sorted(results)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    out_dir = root / "graphify-out"
    out_dir.mkdir(exist_ok=True)

    code_files = collect_code_files(root)
    if not code_files:
        print("[graphify rebuild] No code files found.")
        return 1

    result = extract(code_files)
    detection = {
        "files": {
            "code": [str(path.relative_to(root)).replace(os.sep, "/") for path in code_files],
            "document": [],
            "paper": [],
            "image": [],
        },
        "total_files": len(code_files),
        "total_words": 0,
        "graphifyignore_patterns": len(_load_graphifyignore(root)),
    }

    graph = build_from_json(result)
    communities = cluster(graph)
    cohesion = score_all(graph, communities)
    gods = god_nodes(graph)
    surprises = surprising_connections(graph, communities)
    labels = {community_id: f"Community {community_id}" for community_id in communities}
    questions = suggest_questions(graph, communities, labels)

    report = generate(
        graph,
        communities,
        cohesion,
        labels,
        gods,
        surprises,
        detection,
        {"input": 0, "output": 0},
        ".",
        suggested_questions=questions,
    )
    (out_dir / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    to_json(graph, communities, str(out_dir / "graph.json"))
    to_html(graph, communities, str(out_dir / "graph.html"), community_labels=labels)

    print(
        f"[graphify rebuild] Rebuilt clean code graph: "
        f"{graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges, "
        f"{len(communities)} communities"
    )
    print(
        f"[graphify rebuild] Source files: {len(code_files)} "
        f"(ignored patterns: {len(_load_graphifyignore(root))})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
