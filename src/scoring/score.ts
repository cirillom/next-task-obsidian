import type { TaskItem } from "../model/task";

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_SCORE_FORMULA = "statusPenalty + priority * 20 + ageDays * 1.5 + duePressure";

export function scoreTask(
	task: TaskItem,
	now = new Date(),
	formula = DEFAULT_SCORE_FORMULA
): number {
	const variables = getScoreVariables(task, now);

	try {
		return evaluateScoreFormula(formula, variables);
	} catch {
		return evaluateScoreFormula(DEFAULT_SCORE_FORMULA, variables);
	}
}

function getScoreVariables(task: TaskItem, now: Date): ScoreVariables {
	const priority = task.priority ?? 0;

	const ageDays = task.createdDate
		? Math.max(0, (now.getTime() - new Date(task.createdDate).getTime()) / DAY_MS)
		: 0;

	const daysUntilDue = task.dueDate
		? (new Date(task.dueDate).getTime() - now.getTime()) / DAY_MS
		: 999;

	const duePressure =
		daysUntilDue < 0 ? 100 :
		daysUntilDue <= 1 ? 50 :
		daysUntilDue <= 7 ? 20 :
		0;

	const statusPenalty = task.completed ? -10000 : 0;

	return {
		ageDays,
		daysUntilDue,
		duePressure,
		priority,
		statusPenalty
	};
}

type ScoreVariables = Record<string, number>;

const TOKEN = /\s*([A-Za-z][A-Za-z0-9_]*|\d+(?:\.\d+)?|[()+\-*/])/gy;
const PRECEDENCE: Record<string, number> = {
	"+": 1,
	"-": 1,
	"*": 2,
	"/": 2
};

function evaluateScoreFormula(formula: string, variables: ScoreVariables): number {
	const values: number[] = [];
	const operators: string[] = [];
	const tokens = tokenize(formula);

	const applyOperator = (): void => {
		const operator = operators.pop();
		const right = values.pop();
		const left = values.pop();

		if (!operator || right === undefined || left === undefined) {
			throw new Error("Invalid score formula");
		}

		if (operator === "+") values.push(left + right);
		if (operator === "-") values.push(left - right);
		if (operator === "*") values.push(left * right);
		if (operator === "/") values.push(right === 0 ? 0 : left / right);
	};

	for (const token of tokens) {
		if (/^\d/.test(token)) {
			values.push(Number(token));
			continue;
		}

		if (/^[A-Za-z]/.test(token)) {
			values.push(variables[token] ?? 0);
			continue;
		}

		if (token === "(") {
			operators.push(token);
			continue;
		}

		if (token === ")") {
			while (operators.length > 0 && operators.at(-1) !== "(") {
				applyOperator();
			}

			if (operators.pop() !== "(") {
				throw new Error("Invalid score formula");
			}

			continue;
		}

		while (
			operators.length > 0 &&
			operators.at(-1) !== "(" &&
			(PRECEDENCE[operators.at(-1) ?? ""] ?? 0) >= (PRECEDENCE[token] ?? 0)
		) {
			applyOperator();
		}

		operators.push(token);
	}

	while (operators.length > 0) {
		applyOperator();
	}

	const result = values[0];

	if (values.length !== 1 || result === undefined || !Number.isFinite(result)) {
		throw new Error("Invalid score formula");
	}

	return result;
}

function tokenize(formula: string): string[] {
	const tokens: string[] = [];
	let match: RegExpExecArray | null;

	TOKEN.lastIndex = 0;

	while ((match = TOKEN.exec(formula)) !== null) {
		tokens.push(match[1] ?? "");
	}

	const consumed = tokens.join("").length;
	const compactFormula = formula.replace(/\s/g, "");

	if (consumed !== compactFormula.length) {
		throw new Error("Invalid score formula");
	}

	return tokens;
}
