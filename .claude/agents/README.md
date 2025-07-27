# Agents Directory

This directory contains custom agent definitions for the agents-learning project.

## Agent Types

### Built-in Claude Code Agents
- General-purpose agents available through the Task tool
- Automatically activated based on context and complexity

### Custom Project Agents
- Specialized agents for specific project needs
- Defined in JSON/YAML format
- Can be shared across team members

## Agent Configuration Format

```yaml
---
name: "agent-name"
type: "specialist-type"
description: "What this agent does"
when_to_use: "Trigger conditions"
tools: ["Tool1", "Tool2", "Tool3"]
system_prompt: "Specialized instructions"
auto_activate: true/false
---
```

## Available Agents
(To be populated as agents are created)