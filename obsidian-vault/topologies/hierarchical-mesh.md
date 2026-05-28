---
name: hierarchical-mesh
type: topology
tags: [topology, swarm]
---

# hierarchical-mesh Topology

Hybrid: queen + peer links — recommended for large coordinated swarms

| Property | Value |
|---|---|
| Best For | 10–15 agents |
| Consensus | raft+gossip |
| Anti-Drift | low |

## Member Agents

- [[agents/hierarchical-coordinator]]
- [[agents/mesh-coordinator]]
- [[agents/adaptive-coordinator]]
- [[agents/collective-intelligence-coordinator]]

## Consensus

[[consensus/raft+gossip]]
