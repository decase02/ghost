#!/usr/bin/env node
/**
 * Ruflo Obsidian Vault Generator
 * Builds a token-optimized graph vault from all 134+ ruflo agents.
 * Each note is concise (~100-200 tokens) with [[wikilinks]] for graph navigation.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = '/home/user/ghost';
const VAULT = join(ROOT, 'obsidian-vault');
const SKILLS_DIR = join(ROOT, '.agents/skills');
const PLUGINS_DIR = join(ROOT, 'plugins');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function write(filePath, content) {
  ensureDir(join(filePath, '..'));
  writeFileSync(filePath, content, 'utf8');
}

/** Extract the second YAML block from a SKILL.md (the agent definition block) */
function parseSkillMd(content) {
  const blocks = content.split(/^---\s*$/m).filter(b => b.trim());
  // blocks[0] = outer wrapper yaml, blocks[1] = agent definition yaml, blocks[2] = markdown body
  const result = { name: '', type: '', description: '', capabilities: [], priority: 'normal', color: '', body: '' };

  // Parse the second YAML block (index 1) if it exists
  const yamlBlock = blocks.length >= 2 ? blocks[1] : blocks[0];
  const bodyBlock = blocks.length >= 3 ? blocks.slice(2).join('---\n') : blocks.slice(1).join('---\n');

  result.body = bodyBlock.trim();

  for (const line of yamlBlock.split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (!m) continue;
    const [, key, val] = m;
    if (key === 'name') result.name = val.trim().replace(/^["']|["']$/g, '');
    if (key === 'type') result.type = val.trim();
    if (key === 'description') result.description = val.trim().replace(/^["']|["']$/g, '');
    if (key === 'priority') result.priority = val.trim();
    if (key === 'color') result.color = val.trim().replace(/^["']|["']$/g, '');
  }

  // Parse capabilities list
  const capMatch = yamlBlock.match(/capabilities:\s*\n((?:\s+-\s+.+\n?)+)/);
  if (capMatch) {
    result.capabilities = capMatch[1].match(/\s+-\s+(.+)/g)
      ?.map(l => l.replace(/\s+-\s+/, '').trim()) ?? [];
  }

  return result;
}

/** Parse a simple plugin agent .md (single YAML block) */
function parsePluginAgentMd(content, fileName) {
  const blocks = content.split(/^---\s*$/m).filter(b => b.trim());
  const result = {
    name: fileName.replace('.md', ''),
    type: 'specialist',
    description: '',
    capabilities: [],
    priority: 'normal',
    model: '',
    body: '',
  };

  if (blocks[0]) {
    for (const line of blocks[0].split('\n')) {
      const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
      if (!m) continue;
      const [, key, val] = m;
      if (key === 'name') result.name = val.trim().replace(/^["']|["']$/g, '');
      if (key === 'description') result.description = val.trim().replace(/^["']|["']$/g, '');
      if (key === 'model') result.model = val.trim();
    }
    result.body = blocks.slice(1).join('---\n').trim();
  }

  return result;
}

/** Slugify agent name for filename */
function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** Turn agent name into a wikilink */
function link(name) {
  return `[[${name}]]`;
}

// ── Relationship Maps ─────────────────────────────────────────────────────────

// Known coordination pipelines (from CLAUDE.md / SKILL.md analysis)
const PIPELINES = {
  'feature-development': ['researcher', 'architecture', 'coder', 'tester', 'reviewer'],
  'bug-fix':             ['coordinator-swarm-init', 'researcher', 'coder', 'tester'],
  'refactor':            ['coordinator-swarm-init', 'architecture', 'coder', 'reviewer'],
  'performance':         ['coordinator-swarm-init', 'performance-analyzer', 'coder'],
  'security':            ['coordinator-swarm-init', 'v3-security-architect', 'security-audit'],
  'documentation':       ['researcher', 'docs-api-openapi'],
  'memory-management':   ['coordinator-swarm-init', 'swarm-memory-manager', 'performance-optimizer'],
};

// Topology membership
const TOPOLOGY_AGENTS = {
  'hierarchical':       ['hierarchical-coordinator', 'queen-coordinator', 'v3-queen-coordinator', 'coder', 'tester', 'researcher', 'reviewer'],
  'mesh':               ['mesh-coordinator', 'gossip-coordinator', 'consensus-coordinator', 'crdt-synchronizer'],
  'hierarchical-mesh':  ['hierarchical-coordinator', 'mesh-coordinator', 'adaptive-coordinator', 'collective-intelligence-coordinator'],
  'adaptive':           ['adaptive-coordinator', 'topology-optimizer', 'load-balancer', 'resource-allocator'],
  'ring':               ['sync-coordinator', 'coordinator-swarm-init'],
  'star':               ['hierarchical-coordinator', 'sparc-coordinator', 'swarm-memory-manager'],
};

// Consensus model membership
const CONSENSUS_AGENTS = {
  'raft':      ['raft-manager', 'hierarchical-coordinator', 'queen-coordinator'],
  'byzantine': ['byzantine-coordinator', 'security-manager', 'consensus-coordinator'],
  'gossip':    ['gossip-coordinator', 'mesh-coordinator'],
  'crdt':      ['crdt-synchronizer', 'mesh-coordinator'],
  'quorum':    ['quorum-manager', 'consensus-coordinator'],
};

// Memory namespaces
const NAMESPACE_AGENTS = {
  'coordination': ['hierarchical-coordinator', 'mesh-coordinator', 'swarm-memory-manager', 'coordinator-swarm-init'],
  'patterns':     ['sona-learning-optimizer', 'neural-network', 'safla-neural', 'performance-optimizer'],
  'tasks':        ['planner', 'orchestrator-task', 'sparc-coordinator', 'task-orchestrator'],
  'feedback':     ['reviewer', 'tester', 'production-validator', 'verification-quality'],
  'solutions':    ['coder', 'researcher', 'arch-system-design', 'specification'],
};

// Category assignments
const CATEGORIES = {
  'core-development':      ['coder', 'researcher', 'reviewer', 'tester', 'planner'],
  'coordination':          ['hierarchical-coordinator', 'mesh-coordinator', 'adaptive-coordinator',
                            'collective-intelligence-coordinator', 'swarm-memory-manager',
                            'coordinator-swarm-init', 'sync-coordinator', 'sparc-coordinator',
                            'queen-coordinator', 'v3-queen-coordinator', 'orchestrator-task',
                            'memory-coordinator', 'load-balancer', 'resource-allocator',
                            'topology-optimizer', 'multi-repo-swarm'],
  'consensus-distributed': ['byzantine-coordinator', 'raft-manager', 'gossip-coordinator',
                            'consensus-coordinator', 'crdt-synchronizer', 'quorum-manager',
                            'security-manager', 'matrix-optimizer'],
  'performance':           ['performance-analyzer', 'performance-benchmarker', 'performance-monitor',
                            'performance-optimizer', 'sona-learning-optimizer', 'pagerank-analyzer',
                            'scout-explorer', 'safla-neural', 'neural-network', 'worker-benchmarks'],
  'github-devops':         ['github-modes', 'github-pr-manager', 'pr-manager', 'code-review-swarm',
                            'issue-tracker', 'release-manager', 'release-swarm', 'repo-architect',
                            'ops-cicd-github', 'github-automation', 'github-code-review',
                            'github-multi-repo', 'github-project-management', 'github-release-management',
                            'github-workflow-automation', 'project-board-sync', 'swarm-pr', 'swarm-issue'],
  'sparc-methodology':     ['specification', 'pseudocode', 'architecture', 'implementer-sparc-coder',
                            'refinement', 'sparc-coordinator', 'sparc-methodology'],
  'testing-validation':    ['tdd-london-swarm', 'production-validator', 'test-long-runner',
                            'verification-quality', 'analyze-code-quality'],
  'system-architecture':   ['arch-system-design', 'base-template-generator', 'docs-api-openapi',
                            'v3-core-implementation', 'v3-ddd-architecture', 'v3-integration-architect',
                            'v3-integration-deep', 'v3-cli-modernization'],
  'intelligence-learning': ['sona-learning-optimizer', 'safla-neural', 'trading-predictor',
                            'neural-network', 'neural-training', 'reasoningbank-agentdb',
                            'reasoningbank-intelligence', 'agentdb-learning', 'agentdb-advanced',
                            'agentdb-memory-patterns', 'agentdb-optimization', 'agentdb-vector-search'],
  'specialized-dev':       ['dev-backend-api', 'spec-mobile-react-native', 'data-ml-model',
                            'code-goal-planner', 'goal-planner', 'v3-security-architect',
                            'v3-performance-engineer', 'v3-memory-specialist', 'v3-memory-unification',
                            'v3-mcp-optimization', 'v3-performance-optimization', 'v3-security-overhaul',
                            'v3-swarm-coordination'],
  'platform-services':     ['authentication', 'agentic-payments', 'payments', 'app-store', 'sandbox',
                            'user-tools', 'challenges', 'claims', 'embeddings', 'migration-plan',
                            'workflow', 'workflow-automation'],
  'swarm-orchestration':   ['swarm', 'swarm-advanced', 'swarm-orchestration', 'hive-mind',
                            'hive-mind-advanced', 'worker-specialist', 'worker-integration',
                            'hooks-automation', 'skill-builder', 'stream-chain', 'coordination',
                            'pair-programming'],
  'flow-nexus':            ['flow-nexus-neural', 'flow-nexus-platform', 'flow-nexus-swarm'],
  'agentic-tools':         ['agentic-jujutsu', 'security-audit', 'memory-management'],
};

// ── Read All Agents ────────────────────────────────────────────────────────────

const coreAgents = [];
const skillDirs = readdirSync(SKILLS_DIR);

for (const dir of skillDirs) {
  const skillPath = join(SKILLS_DIR, dir, 'SKILL.md');
  if (!existsSync(skillPath)) continue;
  const content = readFileSync(skillPath, 'utf8');
  const parsed = parseSkillMd(content);
  // Use directory name as fallback id
  const dirName = dir.replace('agent-', '');
  parsed.id = dirName;
  if (!parsed.name) parsed.name = dirName;
  parsed.source = 'core';
  coreAgents.push(parsed);
}

const pluginAgents = [];
const pluginDirs = readdirSync(PLUGINS_DIR).filter(d => {
  const stat = statSync(join(PLUGINS_DIR, d));
  return stat.isDirectory();
});

for (const pluginDir of pluginDirs) {
  const agentsPath = join(PLUGINS_DIR, pluginDir, 'agents');
  if (!existsSync(agentsPath)) continue;
  const agentFiles = readdirSync(agentsPath).filter(f => f.endsWith('.md'));
  for (const file of agentFiles) {
    const content = readFileSync(join(agentsPath, file), 'utf8');
    const parsed = parsePluginAgentMd(content, file);
    parsed.id = parsed.name;
    parsed.plugin = pluginDir;
    parsed.source = 'plugin';
    pluginAgents.push(parsed);
  }
}

const allAgents = [...coreAgents, ...pluginAgents];
const agentNames = new Set(allAgents.map(a => a.name));

console.log(`Loaded ${coreAgents.length} core agents, ${pluginAgents.length} plugin agents`);

// ── Build Reverse Relationship Maps ──────────────────────────────────────────

// For each agent, which topologies include it?
const agentTopologies = {};
for (const [topo, agents] of Object.entries(TOPOLOGY_AGENTS)) {
  for (const a of agents) {
    if (!agentTopologies[a]) agentTopologies[a] = [];
    agentTopologies[a].push(topo);
  }
}

// For each agent, which task routings include it?
const agentTasks = {};
for (const [task, agents] of Object.entries(PIPELINES)) {
  for (const a of agents) {
    if (!agentTasks[a]) agentTasks[a] = [];
    agentTasks[a].push(task);
  }
}

// For each agent, which namespaces does it use?
const agentNamespaces = {};
for (const [ns, agents] of Object.entries(NAMESPACE_AGENTS)) {
  for (const a of agents) {
    if (!agentNamespaces[a]) agentNamespaces[a] = [];
    agentNamespaces[a].push(ns);
  }
}

// For each agent, what category is it in?
const agentCategory = {};
for (const [cat, agents] of Object.entries(CATEGORIES)) {
  for (const a of agents) {
    agentCategory[a] = cat;
  }
}

// For each agent, find "works with" by scanning body for mentions of other agent names
function findRelated(agent, allNames) {
  const body = (agent.body || '').toLowerCase();
  const related = new Set();
  for (const name of allNames) {
    if (name === agent.name) continue;
    if (body.includes(name.toLowerCase())) related.add(name);
  }
  return [...related].slice(0, 12); // cap at 12 to keep notes concise
}

// ── Generate Agent Notes ──────────────────────────────────────────────────────

function agentNote(agent) {
  const name = agent.name;
  const category = agentCategory[name] || 'misc';
  const topologies = (agentTopologies[name] || []).map(t => `[[topologies/${t}]]`).join(' · ') || '—';
  const tasks = (agentTasks[name] || []).map(t => `[[task-routing/${t}]]`).join(' · ') || '—';
  const namespaces = (agentNamespaces[name] || []).map(n => `[[namespaces/${n}]]`).join(' · ') || '—';
  const related = findRelated(agent, agentNames);
  const relatedLinks = related.map(r => `[[agents/${r}]]`).join(', ') || '—';
  const caps = agent.capabilities.length
    ? agent.capabilities.map(c => `\`${c}\``).join(' · ')
    : '—';
  const pluginLine = agent.plugin
    ? `\n**Plugin:** [[plugin-packages/${agent.plugin}]]`
    : '';
  const modelLine = agent.model ? `\n**Model:** \`${agent.model}\`` : '';

  return `---
name: ${name}
type: ${agent.type || 'specialist'}
category: ${category}
priority: ${agent.priority || 'normal'}
source: ${agent.source}
tags: [agent, ${agent.type || 'specialist'}, ${category}]
---

# ${name}

${agent.description || '_No description._'}
${pluginLine}${modelLine}

## Capabilities

${caps}

## Task Routing

${tasks}

## Topologies

${topologies}

## Memory Namespaces

${namespaces}

## Related Agents

${relatedLinks}

## Category

[[categories/${category}]]
`;
}

// Write core agent notes (core wins on name conflicts)
ensureDir(join(VAULT, 'agents'));
const coreNames = new Set(coreAgents.map(a => a.name));

for (const agent of coreAgents) {
  write(join(VAULT, 'agents', `${agent.name}.md`), agentNote(agent));
}

// Write plugin agent notes — prefix with plugin name if conflict with core
for (const agent of pluginAgents) {
  const filename = coreNames.has(agent.name)
    ? `${agent.plugin}--${agent.name}`
    : agent.name;
  agent.vaultId = filename; // track the actual vault filename
  write(join(VAULT, 'agents', `${filename}.md`), agentNote(agent));
}

console.log(`Wrote ${allAgents.length} agent notes`);

// ── Generate Topology Notes ────────────────────────────────────────────────────

const topologyMeta = {
  hierarchical:      { best: '6–8 agents', consensus: 'raft',         drift: 'low',  desc: 'Queen controls workers directly — tight anti-drift, sequential control' },
  mesh:              { best: '5–10 agents', consensus: 'gossip/CRDT', drift: 'medium', desc: 'Fully connected peer network — high resilience, eventual consistency' },
  'hierarchical-mesh': { best: '10–15 agents', consensus: 'raft+gossip', drift: 'low', desc: 'Hybrid: queen + peer links — recommended for large coordinated swarms' },
  adaptive:          { best: '3–12 agents', consensus: 'dynamic',     drift: 'very low', desc: 'Switches topology dynamically based on load and task type' },
  ring:              { best: '4–12 agents', consensus: 'token-passing', drift: 'low', desc: 'Circular communication — sequential, deterministic pipelines' },
  star:              { best: '3–8 agents',  consensus: 'centralized',  drift: 'low', desc: 'Central hub with spoke agents — simple, fast delegation' },
};

ensureDir(join(VAULT, 'topologies'));
for (const [name, meta] of Object.entries(topologyMeta)) {
  const agents = (TOPOLOGY_AGENTS[name] || []).map(a => `- [[agents/${a}]]`).join('\n') || '—';
  write(join(VAULT, 'topologies', `${name}.md`), `---
name: ${name}
type: topology
tags: [topology, swarm]
---

# ${name} Topology

${meta.desc}

| Property | Value |
|---|---|
| Best For | ${meta.best} |
| Consensus | ${meta.consensus} |
| Anti-Drift | ${meta.drift} |

## Member Agents

${agents}

## Consensus

[[consensus/${meta.consensus.split('/')[0]}]]
`);
}

console.log('Wrote topology notes');

// ── Generate Task Routing Notes ────────────────────────────────────────────────

ensureDir(join(VAULT, 'task-routing'));
for (const [task, agents] of Object.entries(PIPELINES)) {
  const agentLinks = agents.map(a => `- [[agents/${a}]]`).join('\n');
  const pipelineStr = agents.map(a => `[[agents/${a}]]`).join(' → ');
  write(join(VAULT, 'task-routing', `${task}.md`), `---
name: ${task}
type: task-routing
tags: [task-routing]
agents: [${agents.join(', ')}]
---

# ${task.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}

## Agent Pipeline

${pipelineStr}

## Agents

${agentLinks}

## Token-Optimized Loading

Load only this note + the agent notes above — skip all other agents.
Total agents needed: **${agents.length}**
`);
}

console.log('Wrote task-routing notes');

// ── Generate Plugin Package Notes ────────────────────────────────────────────

ensureDir(join(VAULT, 'plugin-packages'));
for (const pluginDir of pluginDirs) {
  const agentsInPlugin = pluginAgents.filter(a => a.plugin === pluginDir);
  if (agentsInPlugin.length === 0) continue;

  // Try to read plugin README for description
  let desc = '';
  const readmePath = join(PLUGINS_DIR, pluginDir, 'README.md');
  if (existsSync(readmePath)) {
    const readmeContent = readFileSync(readmePath, 'utf8');
    const firstLine = readmeContent.split('\n').find(l => l.trim() && !l.startsWith('#'));
    desc = firstLine?.trim() || '';
  }

  const agentLinks = agentsInPlugin.map(a => `- [[agents/${a.name}]]`).join('\n');
  write(join(VAULT, 'plugin-packages', `${pluginDir}.md`), `---
name: ${pluginDir}
type: plugin-package
agent-count: ${agentsInPlugin.length}
tags: [plugin, package]
---

# ${pluginDir}

${desc || '_Plugin package for ruflo._'}

## Agents (${agentsInPlugin.length})

${agentLinks}
`);
}

console.log('Wrote plugin package notes');

// ── Generate Namespace Notes ──────────────────────────────────────────────────

const namespaceMeta = {
  coordination: 'Real-time swarm state — agent status, active tasks, swarm topology',
  patterns:     'Learned success patterns — SONA/HNSW indexed for fast retrieval',
  tasks:        'Task definitions, assignments, and progress tracking',
  feedback:     'Outcomes, quality scores, and improvement signals',
  solutions:    'Completed implementations, code snippets, and architectural decisions',
};

ensureDir(join(VAULT, 'namespaces'));
for (const [ns, desc] of Object.entries(namespaceMeta)) {
  const agents = (NAMESPACE_AGENTS[ns] || []).map(a => `- [[agents/${a}]]`).join('\n') || '—';
  write(join(VAULT, 'namespaces', `${ns}.md`), `---
name: ${ns}
type: memory-namespace
tags: [memory, namespace]
---

# ${ns.charAt(0).toUpperCase() + ns.slice(1)} Namespace

${desc}

## Primary Agents

${agents}

## Key Patterns

Memory key format: \`swarm/<agent-name>/<key>\`
`);
}

console.log('Wrote namespace notes');

// ── Generate Consensus Notes ──────────────────────────────────────────────────

const consensusMeta = {
  raft:      { desc: 'Leader-based consensus — strong consistency, tolerates f < n/2 failures', use: 'hierarchical swarms, ordered task queues' },
  byzantine: { desc: 'BFT consensus — tolerates f < n/3 Byzantine failures including malicious nodes', use: 'high-security, untrusted multi-party coordination' },
  gossip:    { desc: 'Epidemic dissemination — eventual consistency, highly scalable', use: 'mesh topologies, large swarms, status propagation' },
  crdt:      { desc: 'Conflict-free replicated data — mathematically merge-safe', use: 'distributed counters, sets, registers with no coordination overhead' },
  quorum:    { desc: 'Configurable quorum-based voting — tunable consistency/availability', use: 'voting decisions, configuration changes, leader election' },
};

ensureDir(join(VAULT, 'consensus'));
for (const [name, meta] of Object.entries(consensusMeta)) {
  const agents = (CONSENSUS_AGENTS[name] || []).map(a => `- [[agents/${a}]]`).join('\n') || '—';
  write(join(VAULT, 'consensus', `${name}.md`), `---
name: ${name}
type: consensus
tags: [consensus, distributed]
---

# ${name.charAt(0).toUpperCase() + name.slice(1)} Consensus

${meta.desc}

**Best for:** ${meta.use}

## Participating Agents

${agents}
`);
}

console.log('Wrote consensus notes');

// ── Generate Category Notes ───────────────────────────────────────────────────

ensureDir(join(VAULT, 'categories'));
for (const [cat, agents] of Object.entries(CATEGORIES)) {
  const agentLinks = agents.map(a => `- [[agents/${a}]]`).join('\n');
  const label = cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  write(join(VAULT, 'categories', `${cat}.md`), `---
name: ${cat}
type: category
agent-count: ${agents.length}
tags: [category]
---

# ${label}

## Agents (${agents.length})

${agentLinks}
`);
}

console.log('Wrote category notes');

// ── Generate MOC / Index Notes ────────────────────────────────────────────────

ensureDir(join(VAULT, '_meta'));

// Home note
const categoryLinks = Object.keys(CATEGORIES).map(c =>
  `| [[categories/${c}]] | ${CATEGORIES[c].length} |`
).join('\n');

const taskLinks = Object.keys(PIPELINES).map(t =>
  `| [[task-routing/${t}]] | ${PIPELINES[t].length} agents |`
).join('\n');

write(join(VAULT, 'Home.md'), `---
type: home
tags: [moc, index]
---

# Ruflo Agent Graph — Home

> **Token optimization**: Navigate via wikilinks to load only the subgraph you need.
> Loading this home note costs ~${Math.round(150 / 100) * 100} tokens. Each agent note ~150 tokens.
> A 4-agent pipeline = ~600 tokens vs ~8,000 for the full corpus.

## By Task (fastest path)

| Task | Agents |
|---|---|
${taskLinks}

## By Category

| Category | Count |
|---|---|
${categoryLinks}

## By Topology

| Topology | When to Use |
|---|---|
| [[topologies/hierarchical]] | 6–8 agents, tight control |
| [[topologies/hierarchical-mesh]] | 10–15 agents, production |
| [[topologies/mesh]] | resilient peer network |
| [[topologies/adaptive]] | dynamic self-organizing |
| [[topologies/ring]] | sequential pipelines |
| [[topologies/star]] | simple hub-spoke |

## All Agents (${allAgents.length})

- [[_meta/all-agents]] — full index

## Memory System

- [[namespaces/coordination]] · [[namespaces/patterns]] · [[namespaces/tasks]] · [[namespaces/feedback]] · [[namespaces/solutions]]

## Plugins (${pluginDirs.filter(d => pluginAgents.some(a => a.plugin === d)).length})

${pluginDirs.filter(d => pluginAgents.some(a => a.plugin === d)).map(p => `[[plugin-packages/${p}]]`).join(' · ')}
`);

// All-agents index
const coreByCategory = {};
for (const agent of coreAgents) {
  const cat = agentCategory[agent.name] || 'misc';
  if (!coreByCategory[cat]) coreByCategory[cat] = [];
  coreByCategory[cat].push(agent.name);
}

let allAgentsContent = `---
type: index
tags: [index, all-agents]
---

# All Agents Index

Total: **${allAgents.length}** agents (${coreAgents.length} core + ${pluginAgents.length} plugin)

## Core Agents by Category

`;
for (const [cat, agents] of Object.entries(coreByCategory)) {
  allAgentsContent += `### ${cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n`;
  allAgentsContent += agents.map(a => `- [[agents/${a}]]`).join('\n') + '\n\n';
}

allAgentsContent += `## Plugin Agents\n\n`;
for (const pluginDir of pluginDirs) {
  const inPlugin = pluginAgents.filter(a => a.plugin === pluginDir);
  if (inPlugin.length === 0) continue;
  allAgentsContent += `### [[plugin-packages/${pluginDir}]]\n`;
  allAgentsContent += inPlugin.map(a => `- [[agents/${a.name}]]`).join('\n') + '\n\n';
}

write(join(VAULT, '_meta', 'all-agents.md'), allAgentsContent);

// Token optimization guide
write(join(VAULT, '_meta', 'token-optimization-guide.md'), `---
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

The \`[[wikilinks]]\` in each note build Obsidian's graph view.
Related agents cluster automatically — use "Local Graph" in Obsidian to see
the neighborhood of any agent without loading the whole corpus.
`);

console.log('Wrote meta/index notes');

// ── .obsidian Config ──────────────────────────────────────────────────────────

ensureDir(join(VAULT, '.obsidian'));
write(join(VAULT, '.obsidian', 'graph.json'), JSON.stringify({
  collapse: false,
  colorGroups: [
    { query: 'tag:coordinator', color: { a: 1, rgb: 16744272 } },
    { query: 'tag:developer',   color: { a: 1, rgb: 5013504 } },
    { query: 'tag:topology',    color: { a: 1, rgb: 255 } },
    { query: 'tag:task-routing', color: { a: 1, rgb: 16744448 } },
    { query: 'tag:plugin',      color: { a: 1, rgb: 10494192 } },
  ],
  showTags: true,
  showAttachments: false,
  hideUnresolved: false,
  showOrphans: true,
  repelStrength: 10,
  linkStrength: 1,
  linkDistance: 250,
  scale: 1,
  close: false,
}, null, 2));

// ── Final Report ──────────────────────────────────────────────────────────────

const allFiles = [];
function countFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) countFiles(p);
    else allFiles.push(p);
  }
}
countFiles(VAULT);

console.log(`\n✅ Obsidian vault generated at: ${VAULT}`);
console.log(`   Files: ${allFiles.length}`);
console.log(`   Agents: ${allAgents.length} (${coreAgents.length} core + ${pluginAgents.length} plugin)`);
console.log(`   Topologies: ${Object.keys(topologyMeta).length}`);
console.log(`   Task Routes: ${Object.keys(PIPELINES).length}`);
console.log(`   Namespaces: ${Object.keys(namespaceMeta).length}`);
console.log(`   Consensus Models: ${Object.keys(consensusMeta).length}`);
console.log(`   Categories: ${Object.keys(CATEGORIES).length}`);
console.log(`   Plugin Packages: ${pluginDirs.filter(d => pluginAgents.some(a => a.plugin === d)).length}`);
