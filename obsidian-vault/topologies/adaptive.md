---
name: adaptive
type: topology
tags: [topology, swarm]
---

# adaptive Topology

Switches topology dynamically based on load and task type

| Property | Value |
|---|---|
| Best For | 3–12 agents |
| Consensus | dynamic |
| Anti-Drift | very low |

## Member Agents

- [[agents/adaptive-coordinator]]
- [[agents/topology-optimizer]]
- [[agents/load-balancer]]
- [[agents/resource-allocator]]

## Consensus

[[consensus/dynamic]]
