---
name: tools-and-automation
description: Avito platform mechanics and claude-in-chrome browser automation notes — read before any listing edit session
sources: [backfill]
aliases: [avito-automation, chrome-mcp-notes]
---

## Avito

- [stated] Avito is the primary current acquisition channel
- [stated] Listing management via edit URL format `https://www.avito.ru/items/edit/[ID]`
- [stated] Avito blocks `web_fetch` — navigate directly via `claude-in-chrome:navigate` to the listing URL or edit URL
- [stated] The edit page (`/items/edit/[ID]`) is more informative than the public page — it exposes backend fields and quality indicators
- [stated] Scrolling the edit page requires multiple `scroll` calls (10–15 units each); the minimum order field is approximately 30 scroll units down
- [stated] Field editing: use `triple_click` to select existing content, then `type` — `ctrl+a` + `type` is unreliable for numeric fields
- [stated] Always save before navigating away from the edit page — unsaved changes are lost on navigation

## claude-in-chrome MCP integration

- [stated] Used for browser automation on this project
- [stated] Primary device ID: `def29b5d-c372-4e1e-8d43-9a50e4de9d69` — always call `select_browser` with this ID at session start before any other actions
- [stated] Always call `tabs_context_mcp` with `createIfEmpty: True` after reconnecting to get the current active tab ID — do not reuse previously known tab IDs, as they change between reconnections
- [stated] "Automatically approve" permission mode does not reliably persist (known bug) — accept prompts as they appear
- [stated] The extension experiences frequent disconnections; reconnect and refresh tab context as needed
