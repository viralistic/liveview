# Viralistic LiveView

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
| `/` | Overview: a greeting, what you manage as clickable pills, five tiles with details on hover, companies that only speak up when something breaks, action-first findings, one improvement, activity. Export the report as PDF or send it to a client. |
| `/planner` | Week calendar with client calls and planned work, plus an inbox. Tag someone with `@`, the model suggests high, medium or low; high is planned within a day, medium within three working days, low only reaches the inbox. |
| `/workflows/grid`, `/workflows`, `/workflows/canvas`, `/workflows/graph` | The same workflows as cards, a list, the Figma-style canvas (sections per project, zoom into the real node graphs, sources, travelling-dot edges, heatmap, Smart fix, live cursors, comments, floating glass detail panel) and the Obsidian-style graph (threads with travelling blobs, hover-only labels, cursors). |
| `/improvements` | Everything that would make the workflows cheaper or faster, biggest win first, with estimated savings. |
| `/products` | Reusable automations in four categories, shown as a live-firing gallery. One source of truth: update a product and every instance follows. Purple everywhere a product is used. |
| `/changelog` | n8n releases read by the model for what they touch. Simple changes are applied in a staging container, tested, then promoted to live. |
| `/companies`, `/companies/<slug>` | The projects you manage; each with its trajectory (introduction, visit, inspiration workshop, business case, proof of concept, build, test, live), who to ask (process owner, technical owner, client contacts), what the client wants, the communication log, workflows, findings, people and credentials. |
| `/users` | People, their highest role, where they have access, an access matrix per company, and the role model. |
| `/credentials` | Every credential, who owns it, what uses it, and what breaks when it expires. |

Smart fix: on any finding (breaking or wasteful) the model proposes a concrete change set with a test plan; the project's technical owner accepts or rejects it before anything touches n8n.

Switch users from the bottom of the sidebar. Pin companies with the pin icon. Share anything with the black **Share** button; changes you make in the dialog apply to the demo immediately and persist in `localStorage` (use **Reset** in the user switcher to start over).

## Design

The look follows n8n's 2026 rebrand (the design-system tokens that shipped with it): Geist and Geist Mono, hairline borders, calm greys, the n8n pink as the one accent, purple reserved for products, no yellow. Light and dark themes (toggle in the top bar, follows the system by default); the sidebar is light grey in the light theme and black in the dark theme. Health is pink when low and fluorescent when full. Hot colours exist only inside the canvas. Tokens live in `src/styles/global.css`.

## Structure

```
src/
  data/         companies, workflows, users + grants, credentials, comments, activity, products, projects (trajectory + communication), planner, fixes, changelog
  lib/          access.ts (hierarchical roles), layout.ts (canvas world layout), health.ts, format.ts
  stores/       session (user, theme, pins, grants, share), planner (tasks, scheduling), fixes (smart fix proposals)
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
