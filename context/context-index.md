# Context Loading Guide

## Available Context Files

### Essential (Always Load)
- `session-notes.md` (~200 tokens) - Current progress and goals
- `project-context.md` (~300 tokens) - Project structure and state

### Conversation History
- `chat-history.json` (~0 tokens) - Empty, new session

### Metadata
- `context-metadata.json` (~150 tokens) - Token counts and statistics

## Loading Recommendations

### For New Sessions
- **Quick Start**: Load session-notes.md only
- **Full Context**: Load all files (total ~650 tokens)

### Token Budget Considerations
- **Light Load**: ~500 tokens (notes + context)
- **Complete Load**: ~650 tokens (all files)

## Context Size: Small (new session)
Recommended: Load all context for full continuity