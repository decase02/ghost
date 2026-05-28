---
name: ruflo-agentdb
type: plugin-package
agent-count: 1
tags: [plugin, package]
---

# ruflo-agentdb

The substrate plugin for Ruflo memory. Wraps three CLI MCP families — `agentdb_*` (controller bridge, 15 tools), `embeddings_*` (RuVector ONNX engine, 10 tools), and `ruvllm_hnsw_*` (WASM-backed pattern router, 3 tools) — into discoverable skills and commands. Other plugins (`ruflo-browser`, `ruflo-rag-memory`, `ruflo-intelligence`) compose this substrate; this plugin owns the namespace convention and the smoke contract for the substrate as a whole.

## Agents (1)

- [[agents/agentdb-specialist]]
