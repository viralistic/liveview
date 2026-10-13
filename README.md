# LiveView for n8n

A multiplayer workflow manager for n8n. One canvas for every client, every workflow and everyone who touches them.

LiveView sits next to your n8n instance (connected through the n8n MCP in a later step) and answers three questions at a glance:

1. **What is running where?** Every company is a section on a Figma-style canvas. Every workflow is a card inside it. Zoom in and the card becomes the real node graph; zoom out and you are back in the client's container. There is no "close", only "zoom out".
2. **What is connected to what?** Workflows that trigger each other are drawn as edges with travelling dots. Webhook-triggered workflows hang off an "Internet" globe on the left of each section, scheduled ones off a clock, so you can read sources without opening anything. The Obsidian-style graph view shows the same thing as a force-directed cluster.
3. **Who may see what?** Access is hierarchical: Everything → company → workflow. Share a view like in Figma (can view, can comment, can edit, admin), switch users to see exactly what a client sees, and watch other people's cursors move over the canvas in their own shade of pink.

Health is painted on the canvas like a weather map: red where a workflow is breaking, orange where it is wasting runs, yellow for small tips. Zoom in and the markers explain what is wrong and how to fix it.

> This repository contains the **design prototype with dummy data**. Nothing talks to a real n8n yet; the data model in `src/data` mirrors what the n8n MCP exposes (workflows, nodes, executions, credentials, users) so wiring it up later is a data-source swap, not a rewrite.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
npm run check    # astro type check
```

## Tour

| Route | What you see |
| --- | --- |
| `/` | Overview: executions, success rate, failures, health score, findings sorted by severity, improvement opportunities with estimated savings, companies, activity, who is online. |
| `/workflows` | All workflows as a list with filters. Click a row for the detail panel. |
| `/workflows/graph` | Obsidian-style cluster graph. Hover to highlight neighbours, click for details, filters and legend. |
| `/workflows/canvas` | Figma-style canvas: sections per company, semantic zoom into node graphs, sources, inter-workflow edges, health heatmap, comments, live cursors, share links with the exact viewport. |
| `/companies/<slug>` | Company dashboard: KPIs, chart, workflows, findings, access and credentials for one client. |
| `/users` | People, their highest role, where they have access, an access matrix per company, and the role model. |
| `/credentials` | Every credential, who owns it, what uses it, and what breaks when it expires. |

Switch users from the bottom of the sidebar. Pin companies with the pin icon. Share anything with the black **Share** button; changes you make in the dialog apply to the demo immediately and persist in `localStorage` (use **Reset** in the user switcher to start over).

## Design

The look follows n8n's 2026 rebrand (the design-system tokens that shipped with it): Geist and Geist Mono, a monochrome primary, pink only as an accent, a grey canvas with white cards and hairline borders. The sidebar is black, the workspace is grey, content cards are white. Tokens live in `src/styles/global.css`.

## Structure

```
src/
  data/         companies, workflows (nodes, connections, stats, issues), users + grants, credentials, comments, activity
  lib/          access.ts (hierarchical roles), layout.ts (canvas world layout), health.ts, format.ts
  stores/       session state shared across islands (current user, pins, grants, share dialog)
  components/
    shell/      black sidebar, topbar with presence + share, command palette, toast
    share/      Figma-style share dialog with hierarchy picker
    canvas/     the Figma-style canvas
    graph/      the Obsidian-style graph
    pages/      overview, company, list, users, credentials, workflow panel, charts
    ui/         buttons, badges, cards, avatars, node icons, sparklines, health ring
  pages/        Astro routes
```

Astro renders the shell; the interactive parts are React islands. The canvas and graph are `client:only` so they can use the browser freely; everything else is server-rendered and hydrated.

## Connecting a real n8n

Replace the modules in `src/data` with loaders that call the n8n MCP (`search_workflows`, `get_workflow_details`, `search_workflow_executions`, `list_credentials`, `search_projects`). The shapes in `src/data/types.ts` were chosen to map 1:1 onto those responses; the access model maps onto n8n projects and their member roles.
