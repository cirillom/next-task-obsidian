import type { TaskItem } from "../model/task";

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_SCORE_FORMULA = `base = priority * 20
ageBonus = ageDays * 1.5
score = base + ageBonus`;

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
	} catch {
		return evaluateScoreScript(DEFAULT_SCORE_FORMULA, variables);
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

	return {
		ageDays,
		daysUntilDue,
		priority
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

function evaluateScoreScript(script: string, variables: ScoreVariables): number {
	const scriptLines = getScriptLines(script);
	const values = { ...variables };

	if (scriptLines.length === 1 && !scriptLines[0]?.includes("=")) {
		return evaluateExpression(scriptLines[0] ?? "", values);
	}

	executeLines(scriptLines, values, 0, scriptLines.length);

	const score = values.score;

	if (score === undefined || !Number.isFinite(score)) {
		throw new Error("Invalid score formula");
	}

	return score;
}

function executeLines(lines: string[], variables: ScoreVariables, start: number, end: number): void {
	let i = start;

	while (i < end) {
		const line = lines[i] ?? "";

		if (line.startsWith("if ")) {
			i = executeIf(lines, variables, i);
			continue;
		}

		if (line.startsWith("else")) {
			return;
		}

		const assignment = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/);

		if (!assignment) {
			throw new Error("Invalid score formula");
		}

		const name = assignment[1];
		const expression = assignment[2];

		if (!name || !expression) {
			throw new Error("Invalid score formula");
		}

		variables[name] = evaluateExpression(expression, variables);
		i++;
	}
}

function executeIf(lines: string[], variables: ScoreVariables, start: number): number {
	let i = start;
	let didRun = false;

	while (i < lines.length) {
		const line = lines[i] ?? "";
		const block = findBlock(lines, i);
		const condition = getCondition(line);

		if (!didRun && (condition === null || evaluateCondition(condition, variables))) {
			executeLines(lines, variables, block.start, block.end);
			didRun = true;
		}

		i = block.end + 1;

		if (!lines[i]?.startsWith("else")) {
			return i;
		}
	}

	return i;
}

function getCondition(line: string): string | null {
	const ifMatch = line.match(/^if\s+(.+)\s*\{\s*$/);
	const elseIfMatch = line.match(/^else\s+if\s+(.+)\s*\{\s*$/);

	if (ifMatch) {
		return ifMatch[1] ?? "";
	}

	if (elseIfMatch) {
		return elseIfMatch[1] ?? "";
	}

	if (/^else\s*\{\s*$/.test(line)) {
		return null;
	}

	throw new Error("Invalid score formula");
}

function evaluateCondition(condition: string, variables: ScoreVariables): boolean {
	const match = condition.match(/^(.+?)\s*(<=|>=|==|!=|<|>)\s*(.+)$/);

	if (!match) {
		return evaluateExpression(condition, variables) !== 0;
	}

	const left = evaluateExpression(match[1] ?? "", variables);
	const operator = match[2];
	const right = evaluateExpression(match[3] ?? "", variables);

	if (operator === "<") return left < right;
	if (operator === ">") return left > right;
	if (operator === "<=") return left <= right;
	if (operator === ">=") return left >= right;
	if (operator === "==") return left === right;
	if (operator === "!=") return left !== right;

	throw new Error("Invalid score formula");
}

function findBlock(lines: string[], start: number): { start: number; end: number } {
	if (!lines[start]?.endsWith("{")) {
		throw new Error("Invalid score formula");
	}

	let depth = 1;

	for (let i = start + 1; i < lines.length; i++) {
		const line = lines[i] ?? "";

		if (line.endsWith("{")) {
			depth++;
		}

		if (line === "}") {
			depth--;
		}

		if (depth === 0) {
			return {
				start: start + 1,
				end: i
			};
		}
	}

	throw new Error("Invalid score formula");
}

function getScriptLines(script: string): string[] {
	const lines: string[] = [];

	for (const rawLine of script.split(/\r?\n/)) {
		const line = rawLine.trim();

		if (line.length === 0 || line.startsWith("#") || line.startsWith("//")) {
			continue;
		}

		if (line.startsWith("} else")) {
			lines.push("}");
			lines.push(line.slice(2).trim());
			continue;
		}

		lines.push(line);
	}

	return lines;
}

function evaluateExpression(formula: string, variables: ScoreVariables): number {
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
