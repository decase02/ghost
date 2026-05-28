---
name: mesh
type: topology
tags: [topology, swarm]
---

# mesh Topology

Fully connected peer network — high resilience, eventual consistency

| Property | Value |
|---|---|
| Best For | 5–10 agents |
| Consensus | gossip/CRDT |
| Anti-Drift | medium |

## Member Agents

- [[agents/mesh-coordinator]]
- [[agents/gossip-coordinator]]
- [[agents/consensus-coordinator]]
- [[agents/crdt-synchronizer]]

## Consensus

[[consensus/gossip]]
