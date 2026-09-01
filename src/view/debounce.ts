/**
 * Kleiner Debounce-Helfer für die Auslösung nach Konzept 2.2 (Panel 400 ms,
 * Markierungen 1,5 s — siehe main.ts / decorations.ts). Reine Zeit-Logik,
 * keine Obsidian-Abhängigkeit, aber bewusst in view/ statt analyse/, weil
 * sie ausschließlich ein UI-Timing-Anliegen ist.
 */

export interface Debounced<Args extends unknown[]> {
	(...args: Args): void;
	abbrechen(): void;
}

export function debounce<Args extends unknown[]>(
	fn: (...args: Args) => void,
	wartezeitMs: number
): Debounced<Args> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const aufgerufen = ((...args: Args) => {
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			fn(...args);
		}, wartezeitMs);
	}) as Debounced<Args>;

	aufgerufen.abbrechen = () => {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	};

	return aufgerufen;
}
