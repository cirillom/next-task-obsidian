import type { TaskItem } from "../model/task";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ScoreVariables = {
	priority: number;
	ageDays: number;
	dueOffsetDays: number;
};

type ScoreFunction = (
	priority: number,
	ageDays: number,
	dueOffsetDays: number
) => unknown;

export const DEFAULT_SCORE_FORMULA = `
const dueBonus =
	dueOffsetDays > 0 ? 100 :
	dueOffsetDays >= -1 ? 50 :
	dueOffsetDays >= -7 ? 20 :
	0;

return priority * 20 + ageDays * 1.5 + dueBonus;
`;

// Friendlier name for newer code, while preserving the old export expected by main.ts.
export const DEFAULT_SCORE_SCRIPT = DEFAULT_SCORE_FORMULA;

export function scoreTask(
	task: TaskItem,
	now = new Date(),
	formula = DEFAULT_SCORE_FORMULA
): number {
	if (task.completed) {
		return 0;
	}

	const variables = getScoreVariables(task, now);

	try {
		return evaluateScoreScript(formula, variables);
	} catch (error) {
		console.error("Task Aggregator score formula failed. Falling back to default.", error);
		return evaluateScoreScript(DEFAULT_SCORE_FORMULA, variables);
	}
}

export function validateScoreFormula(formula: string): string | null {
	try {
		evaluateScoreScript(formula, {
			priority: 1,
			ageDays: 0,
			dueOffsetDays: 0
		});

		return null;
	} catch (error) {
		return error instanceof Error ? error.message : "Invalid score formula";
	}
}

// Friendlier name for newer code, while preserving validateScoreFormula for main.ts.
export function validateScoreScript(script: string): string | null {
	return validateScoreFormula(script);
}

function getScoreVariables(task: TaskItem, now: Date): ScoreVariables {
	const priority = toFiniteNumber(task.priority, 0);

	const createdDate = task.createdDate ? new Date(task.createdDate) : null;
	const dueDate = task.dueDate ? new Date(task.dueDate) : null;

	const createdTime = createdDate?.getTime() ?? NaN;
	const dueTime = dueDate?.getTime() ?? NaN;

	const ageDays = Number.isFinite(createdTime)
		? Math.max(0, (now.getTime() - createdTime) / DAY_MS)
		: 0;

	// Positive means overdue.
	// Zero means due today or no due date.
	// Negative means due in the future.
	const dueOffsetDays = Number.isFinite(dueTime)
		? (now.getTime() - dueTime) / DAY_MS
		: 0;

	return {
		priority,
		ageDays,
		dueOffsetDays
	};
}

function evaluateScoreScript(script: string, variables: ScoreVariables): number {
	const scoreFunction = buildScoreFunction(script);

	const result = scoreFunction(
		variables.priority,
		variables.ageDays,
		variables.dueOffsetDays
	);

	if (typeof result !== "number" || !Number.isFinite(result)) {
		throw new Error("Score formula must return a finite number.");
	}

	return result;
}

function buildScoreFunction(script: string): ScoreFunction {
	const source = `
"use strict";

${script}
`;

	// This is intentional: the score formula is user-provided JavaScript from Tasks-Config.md.
	// Keep the eval-like behavior isolated to this function.
	// eslint-disable-next-line @typescript-eslint/no-implied-eval
	return new Function("priority", "ageDays", "dueOffsetDays", source) as ScoreFunction;
}

function toFiniteNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
