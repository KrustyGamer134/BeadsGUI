# Beads GUI

A small local interface for viewing and editing Beads tickets. It reads and writes through the installed `bd` command, so it always uses the same data as the terminal.

## Run

From this folder:

```powershell
npm start -- --repo C:\path\to\your\beads-repository
```

Then open http://127.0.0.1:3434. If the GUI folder itself is also your Beads repository, `npm start` is enough.

To open more than one project in a single dashboard, repeat `--repo`. Use `Name|Path` to give each project a friendly name:

```powershell
npm start -- --repo "Project One|C:\projects\project-one" --repo "Project Two|C:\projects\project-two"
```

Pass `--port 3435` if port 3434 is already in use.

The app binds only to `127.0.0.1`; it is not exposed to your local network.
