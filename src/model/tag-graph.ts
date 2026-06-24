export type TagRelationships = Map<string, Set<string>>;

export class TagGraph {
	private readonly parentsByChild: TagRelationships = new Map();
	private readonly childrenByParent: TagRelationships = new Map();

	addTag(tag: string): void {
		const normalizedTag = normalizeTag(tag);

		if (normalizedTag.length === 0) {
			return;
		}

		if (!this.parentsByChild.has(normalizedTag)) {
			this.parentsByChild.set(normalizedTag, new Set());
		}

		if (!this.childrenByParent.has(normalizedTag)) {
			this.childrenByParent.set(normalizedTag, new Set());
		}
	}

	addRelationship(childTag: string, parentTag: string): void {
		const child = normalizeTag(childTag);
		const parent = normalizeTag(parentTag);

		if (child.length === 0 || parent.length === 0) {
			return;
		}

		this.addToMap(this.parentsByChild, child, parent);
		this.addToMap(this.childrenByParent, parent, child);

		if (!this.childrenByParent.has(child)) {
			this.childrenByParent.set(child, new Set());
		}

		if (!this.parentsByChild.has(parent)) {
			this.parentsByChild.set(parent, new Set());
		}
	}

	expandDescendants(tag: string): Set<string> {
		const normalizedTag = normalizeTag(tag);
		const expanded = new Set<string>();

		if (normalizedTag.length === 0) {
			return expanded;
		}

		const pending = [normalizedTag];

		while (pending.length > 0) {
			const current = pending.pop();

			if (!current || expanded.has(current)) {
				continue;
			}

			expanded.add(current);

			for (const child of this.childrenByParent.get(current) ?? []) {
				if (!expanded.has(child)) {
					pending.push(child);
				}
			}
		}

		return expanded;
	}

	expandAncestors(tag: string): Set<string> {
		const normalizedTag = normalizeTag(tag);
		const expanded = new Set<string>();

		if (normalizedTag.length === 0) {
			return expanded;
		}

		const pending = [normalizedTag];

		while (pending.length > 0) {
			const current = pending.pop();

			if (!current || expanded.has(current)) {
				continue;
			}

			expanded.add(current);

			for (const parent of this.parentsByChild.get(current) ?? []) {
				if (!expanded.has(parent)) {
					pending.push(parent);
				}
			}
		}

		return expanded;
	}

	detectCycles(): string[][] {
		const cycles: string[][] = [];
		const seenCycleKeys = new Set<string>();
		const visited = new Set<string>();
		const visiting = new Set<string>();
		const path: string[] = [];

		const visit = (tag: string): void => {
			if (visiting.has(tag)) {
				const cycleStart = path.indexOf(tag);

				if (cycleStart >= 0) {
					const cycle = [...path.slice(cycleStart), tag];
					const key = this.getCycleKey(cycle);

					if (!seenCycleKeys.has(key)) {
						seenCycleKeys.add(key);
						cycles.push(cycle);
					}
				}

				return;
			}

			if (visited.has(tag)) {
				return;
			}

			visiting.add(tag);
			path.push(tag);

			for (const child of this.childrenByParent.get(tag) ?? []) {
				visit(child);
			}

			path.pop();
			visiting.delete(tag);
			visited.add(tag);
		};

		for (const tag of this.getAllTags()) {
			visit(tag);
		}

		return cycles;
	}

	hasRelationships(): boolean {
		return this.parentsByChild.size > 0 || this.childrenByParent.size > 0;
	}

	getAllTags(): string[] {
		const tags = new Set<string>();

		for (const [child, parents] of this.parentsByChild) {
			tags.add(child);

			for (const parent of parents) {
				tags.add(parent);
			}
		}

		for (const [parent, children] of this.childrenByParent) {
			tags.add(parent);

			for (const child of children) {
				tags.add(child);
			}
		}

		return [...tags].sort((a, b) => a.localeCompare(b));
	}

	private getCycleKey(cycle: string[]): string {
		const uniqueCycle = cycle.slice(0, -1);
		const rotations = uniqueCycle.map((_, index) => [
			...uniqueCycle.slice(index),
			...uniqueCycle.slice(0, index)
		]);
		const canonical = rotations
			.map((rotation) => rotation.join("->"))
			.sort((a, b) => a.localeCompare(b))[0] ?? "";

		return canonical;
	}

	private addToMap(map: TagRelationships, key: string, value: string): void {
		const values = map.get(key) ?? new Set<string>();
		values.add(value);
		map.set(key, values);
	}
}

export function normalizeTag(tag: string): string {
	return tag.trim().replace(/^#/, "").toLowerCase();
}
