# Task Aggregator config

# Score formula
Available variables: priority, ageDays, dueOffsetDays
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
# #child-tag | #parent-tag #another-parent
#obsidian | #plugin #notes
#plugin | #programming #project
