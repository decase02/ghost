---
type: guide
tags: [token-optimization, guide]
---

# Token Optimization Guide

## The Problem

Loading all 134+ agent SKILL.md files = ~200,000+ tokens. Unworkable.

## The Solution: Graph Navigation

This vault is a **token-efficient subgraph navigator**. Instead of loading everything, load the minimal subgraph for your task.

## Loading Patterns

### Pattern 1 — Task-first (most efficient)
1. Load [[Home]]
2. Find your task in "By Task" table
3. Load the task routing note (e.g. [[task-routing/feature-development]])
4. Load only the listed agent notes
5. **Total: ~600–1,000 tokens**

### Pattern 2 — Category-first
1. Load [[_meta/all-agents]]
2. Navigate to your category (e.g. [[categories/coordination]])
3. Load relevant agents
4. **Total: ~500–800 tokens**

### Pattern 3 — Topology-first
1. Load [[Home]]
2. Pick topology (e.g. [[topologies/hierarchical]])
3. Load member agents
4. **Total: ~400–900 tokens**

## Token Costs (approximate)

| Note Type | Tokens |
|---|---|
| Home.md | ~200 |
| Agent note | ~150 |
| Task routing note | ~120 |
| Topology note | ~120 |
| Category note | ~100 |
| All-agents index | ~800 |
| Full SKILL.md | ~2,000+ |

## Example: Bug Fix Task

Load: [[task-routing/bug-fix]]
→ Gets you: coordinator-swarm-init + researcher + coder + tester
→ Total: ~120 + (4 × 150) = **~720 tokens** vs 8,000+ for full agent corpus

## Wikilink Graph

The `[[wikilinks]]` in each note build Obsidian's graph view.
Related agents cluster automatically — use "Local Graph" in Obsidian to see
the neighborhood of any agent without loading the whole corpus.
