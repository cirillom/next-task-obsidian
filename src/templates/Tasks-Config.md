# Task Aggregator config

# Score formula
Available variables: priority, ageDays, dueOffsetDays
dueOffsetDays is negative before due date and positive after due date.
```task-aggregator-score
base = priority * 20
ageBonus = ageDays * 1.5
dueBonus = 0

if dueOffsetDays > 0 {
	dueBonus = 100
} else if dueOffsetDays >= -1 {
	dueBonus = 50
} else if dueOffsetDays >= -7 {
	dueBonus = 20
}

score = base + ageBonus + dueBonus
```

# Tag relationships
# #child-tag | #parent-tag #another-parent
#obsidian | #plugin #notes
#plugin | #programming #project
