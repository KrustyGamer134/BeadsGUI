# Beads GUI

A small, local browser interface for [Beads](https://github.com/steveyegge/beads) tickets. It reads and writes through the `bd` command already installed on your machine, so the browser and terminal always use the same ticket data.

## What it does

- Shows ticket title, status, created date, and last-updated date.
- Filters by project, status, ticket type, and keywords.
- Sorts by title, status, created date, or updated date.
- Opens a complete ticket view, with an editor for supported Beads fields.
- Lets you hide closed tickets from the normal list; that choice is remembered in the browser.
- Keeps the ticket list and ticket detail pane independently scrollable on desktop.

## Requirements

- Windows, macOS, or Linux with [Node.js](https://nodejs.org/) 18 or newer.
- The Beads CLI (`bd`) installed and available in your terminal.
- One or more initialized Beads projects. Each project folder must contain a `.beads` directory.

There are no npm packages to install: the app only uses Node's built-in modules and the `bd` CLI.

## Start the app

Open a terminal in the folder where you cloned this repository, then run the GUI against one Beads project:

```powershell
cd BeadsGUI
npm start -- --repo C:\path\to\your\beads-project
```

Open [http://127.0.0.1:3434](http://127.0.0.1:3434) in your browser.

> If you see `no beads project found`, the path after `--repo` is not the folder containing that project's `.beads` directory.

## Use multiple projects

Pass `--repo` once for each project. The text before `|` is the label displayed in the project picker:

```powershell
npm start -- --repo "Project One|C:\projects\project-one" --repo "Project Two|C:\projects\project-two"
```

If port 3434 is already in use, choose another one:

```powershell
npm start -- --port 3435 --repo C:\path\to\your\beads-project
```

## Using the interface

- Select a project from the **Project** dropdown.
- Use the search box and status/type dropdowns to narrow the ticket list.
- Click a column heading to sort; click it again to reverse the order.
- Click a ticket to open its complete details in the right pane.
- Choose **Edit ticket** to change ticket fields and save through `bd update`.
- Choose **Settings** (the gear) to show or hide closed tickets. Selecting **Closed** in the status filter always shows closed tickets.

## Privacy and safety

The server listens only on `127.0.0.1`, so it is not reachable from other devices on your network. Ticket reads and edits are run locally through `bd`; this project does not contain a database, API token, or cloud sync service.

Because edits call `bd update`, a saved edit changes the same Beads ticket that you would change from the terminal. Use the normal Beads/Git workflow for backup and collaboration.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| `npm` cannot find `package.json` | Run `cd` into the cloned `BeadsGUI` folder before `npm start`. |
| `bd` is not recognized | Install Beads, then open a new terminal so its install location is on your `PATH`. |
| `no beads project found` | Pass the root folder of an initialized Beads project, not the `.beads` folder itself. |
| Port 3434 is already in use | Add `--port 3435` (or another unused port) after `npm start --`. |
| Changes do not appear | Use the refresh button in the upper-right corner, or reload the browser page. |
