## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `$(cat .graphify_python) scripts/rebuild_graphify.py` to keep the graph current without pulling `tmp/` or `coverage/` into the graphify corpus
