# Next Task

Next Task is an Obsidian plugin for finding the next task worth working on.

Markdown task lists are wonderful because they stay close to your notes, but they become hard to use once tasks are spread across projects, daily notes, research notes, and reference material. Next Task scans your vault for task metadata, shows everything in one focused view, and lets you filter, edit, and rank tasks without moving them out of their original files.

## What it solves

Next Task is built for people who keep tasks inside real notes instead of a separate task database.

It helps when:

- tasks live across many markdown files
- some tasks are more urgent or important than others
- tags have hierarchy, such as `#plugin` belonging to `#project`
- done tasks should disappear from the main working view
- task priority should be calculated from your own rules
- you want to edit task metadata without jumping back to the source file every time

The plugin does not try to replace your notes with a separate system. It reads and writes normal markdown tasks in place.

## Task format

For a markdown checkbox to be treated as a Next Task task, it must have:

- a creation date with `@c:YYYY-MM-DD`
- a priority with `@p:number`

Example:

```md
- [ ] Write release notes @c:2026-06-24 @d:2026-06-30 @p:3 @s:doing #next-task
    Include install instructions and release assets.
```

Supported metadata:

- `@c:` creation date, required
- `@p:` priority, required, integer starting at `1`
- `@d:` due date, optional
- `@s:` status, optional
- `#tags`, optional

The description is stored as indented markdown below the task. It can include normal markdown, links, and math that Obsidian can render.

## Task view

The Next Task view collects matching tasks from your vault and shows them as editable cards.

From the card view you can:

- mark a task done or undone
- change due date
- change priority
- change status
- open the source file at the task line
- click a tag to filter by it
- open a modal to edit title, metadata, tags, and description

When a task is marked done, Next Task removes its `@s:` status. Done tasks get a score of `0`.

## Default task file

New tasks are created in:

```text
Tasks.md
```

If the file does not exist, Next Task creates it.

## Configuration

Next Task uses:

```text
Tasks-Config.md
```

You can open or create it from the gear icon in the Next Task view.

The config file controls tag relationships, statuses, and scoring.

## Tag relationships

Tag relationships let a child tag also count as its parents when filtering.

Example:

```md
#plugin | #programming #project
#next-task | #plugin
```

If a task has `#next-task`, it can also match filters for `#plugin`, `#programming`, and `#project`.

In the task card itself, only the tags written directly on the task are shown. Parent tags are used internally for filtering and sorting.

## Statuses

Statuses are configured in `Tasks-Config.md`.

Format:

```md
status-name | default-marker score-value
```

Example:

```md
todo | default 0
doing | default 1
blocked | - 2
done | - 0
```

The `default` marker means that status is selected by default in the status filter.

The number is exposed to the score script as:

```js
statusValue
```

This lets you make status part of your ranking formula.

## Scoring

Next Task calculates a score for every task and sorts higher scores first.

The score is configured with JavaScript in a code block inside `Tasks-Config.md`.

Available variables:

- `priority`
- `ageDays`
- `dueOffsetDays`
- `statusValue`

`dueOffsetDays` works like a launch countdown:

- negative before the due date
- zero on the due date or when no due date exists
- positive after the due date

Example:

```js
let score = 0;

score += priority * 20;
score += ageDays * 1.5;
score += statusValue * 10;

if (dueOffsetDays > 0) {
	score += dueOffsetDays * 50;
}

return score;
```

If the score script has a syntax or runtime error, Next Task shows a warning and falls back to the default score calculation.

## Manual installation

Download the release asset and place these files in:

```text
<Vault>/.obsidian/plugins/next-task/
```

Required files:

- `manifest.json`
- `main.js`
- `styles.css`

Then enable **Next Task** in Obsidian under **Settings -> Community plugins**.

## Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run lint
npm run build
```

Build release files:

```bash
npm run build
```

The built plugin entry file is `main.js`.

## License

MIT
