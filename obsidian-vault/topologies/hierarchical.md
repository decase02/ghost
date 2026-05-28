---
name: hierarchical
type: topology
tags: [topology, swarm]
---

# hierarchical Topology

Queen controls workers directly — tight anti-drift, sequential control

| Property | Value |
|---|---|
| Best For | 6–8 agents |
| Consensus | raft |
| Anti-Drift | low |

## Member Agents

- [[agents/hierarchical-coordinator]]
- [[agents/queen-coordinator]]
- [[agents/v3-queen-coordinator]]
- [[agents/coder]]
- [[agents/tester]]
- [[agents/researcher]]
- [[agents/reviewer]]

## Consensus

[[consensus/raft]]
