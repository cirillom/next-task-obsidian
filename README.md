# Next Task

Next Task is an Obsidian plugin that helps you decide what task deserves your attention next.

It scans your vault for markdown tasks with Next Task metadata, shows them in one task view, and orders them by a configurable score. The score can use priority, creation date, due date, and status, so old tasks can slowly rise instead of starving forever.

Tasks stay in their original markdown files. Next Task only reads and edits normal Obsidian notes.

## Main idea

Next Task is built around score-based ordering.

Instead of manually deciding what should be at the top of your task list, each task receives a numeric score. Higher scores appear first.

The scoring formula is configured in `Tasks-Config.md`, so you can decide how much each factor matters:

* priority
* task age
* due date
* status

This lets you build a task system where urgent tasks rise quickly, but older tasks also come back to your attention over time.

## Task format

Next Task only tracks markdown tasks that include the required metadata.

This is intentional. You can still keep small casual todo lists in your notes without cluttering the main task system. A checkbox only becomes a Next Task task when you add the required properties.

Required metadata:

* `@c:YYYY-MM-DD` creation date
* `@p:number` priority

Example:

```md id="2xawqq"
- [ ] Write release notes @c:2026-06-24 @d:2026-06-30 @p:3 @s:doing #work #next-task
    Include install instructions and release assets.
```

Supported metadata:

* `@c:` creation date, required
* `@p:` priority, required, integer starting at `1`
* `@d:` due date, optional
* `@s:` status, optional
* `#tags`, optional

Indented text below the task is treated as the task description. It can contain normal markdown, links, and other Obsidian content.

## Task view

The Next Task view collects tracked tasks and shows them as editable cards.

From the task view, you can:

* see tasks ordered by score
* filter by tag
* filter by status
* mark tasks done or undone
* change due date, priority, and status
* edit title, metadata, tags, and description
* open the source file at the task line

When a task is marked done, Next Task removes its `@s:` status and gives it a score of `0`.

## Scoring

The score system is the core feature of Next Task.

Each task receives a number, and the highest number appears first. The formula is written in JavaScript inside `Tasks-Config.md`.

Available variables:

* `priority`
* `ageDays`
* `dueOffsetDays`
* `statusValue`

`ageDays` is the number of days since the creation date.

`dueOffsetDays` works like a countdown:

* negative before the due date
* zero on the due date or when there is no due date
* positive after the due date

`statusValue` comes from the status configuration.

Example:

```js id="9l81tp"
let score = 0;

score += priority * 20;
score += ageDays * 1.5;
score += statusValue * 10;

if (dueOffsetDays > 0) {
	score += dueOffsetDays * 50;
}

return score;
```

This example makes high-priority tasks rise, old tasks slowly gain weight, status affect ordering, and overdue tasks rise quickly.

If the formula has a syntax or runtime error, Next Task shows a warning and falls back to the default score calculation.

## Tags

Next Task supports tag relationships inspired by Tag Studio.

A child tag can also count as its parent tags when filtering. This lets you classify tasks precisely without losing broad filters.

Example:

```md id="zmi8tw"
#project-a | #work
#project-a-v2 | #project-a
```

A task with `#project-a-v2` also matches filters for:

```md id="m2tjpr"
#project-a
#work
```

This makes it possible to filter broadly or narrowly:

* `#work` for all work tasks
* `#project-a` for a specific project
* `#project-a-v2` for a specific version or phase

Only the tags written directly on the task are shown on the card. Parent tags are used internally for filtering and sorting.

## Statuses

Statuses are configured in `Tasks-Config.md`.

Format:

```md id="fmk1h9"
status-name | default-marker score-value
```

Example:

```md id="xijycc"
todo | default 0
doing | default 1
blocked | - 2
waiting | - -1
done | - 0
```

The `default` marker means the status is selected by default in the status filter.

The number becomes `statusValue` in the score formula. This lets status affect ordering. For example, blocked tasks can be made more visible, while waiting tasks can be pushed lower.

## Configuration

Next Task uses this configuration file:

```text id="1bycj1"
Tasks-Config.md
```

You can open or create it from the gear icon in the Next Task view.

The config file controls:

* tag relationships
* statuses
* default status filters
* status score values
* the scoring formula

## Default task file

New tasks are created in:

```text id="kfuf8l"
Tasks.md
```

If the file does not exist, Next Task creates it.

## Manual installation

Download the release zip from the GitHub Releases page.

Extract it into:

```text id="f50hix"
<Vault>/.obsidian/plugins/next-task/
```

The plugin folder should contain:

```text id="opn6q4"
main.js
manifest.json
styles.css
```

Then enable **Next Task** in Obsidian:

```text id="ywgt6y"
Settings -> Community plugins -> Installed plugins -> Next Task
```

## Development

Install dependencies:

```bash id="jj7liw"
npm install
```

Run the development build:

```bash id="dwvt6h"
npm run dev
```

Run checks:

```bash id="1d2db8"
npm run lint
npm run build
```

Build release files:

```bash id="qk2l94"
npm run build
```

## Project status

Next Task is currently in release-candidate stage.

The core direction is stable: a score-based Obsidian task view with configurable ranking, status filtering, and tag relationships. Some configuration details may still change before a stable release.

## License

MIT
