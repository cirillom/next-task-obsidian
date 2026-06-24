# Task Aggregator config

# Score formula
Available variables: `priority, ageDays, dueOffsetDays`
statusValue is defined by the matching status below.
dueOffsetDays is negative before due date and positive after due date.
```js
// Task Aggregator score

let score = 0;

score += priority * 20;
score += ageDays * 1.5;

if (dueOffsetDays > 0) {
	score += dueOffsetDays * 50;
}

return score;
```

# Tag relationships
`#child-tag | #parent-tag #another-parent`
#obsidian | #plugin #notes
#plugin | #programming #project

# Statuses
`status | default-marker score-value`
todo | default 0
doing | default 1
blocked | - 2
done | - 0
