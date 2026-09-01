/**
 * Analysekern. Importiert bewusst nichts aus "obsidian" (siehe Konzept 2.1),
 * damit dieser Ordner isoliert mit Vitest testbar bleibt.
 *
 * Die eigentliche Implementierung (Maskierung, Segmentierung, Tokenizer,
 * Kennzahlen, Stilmarker) folgt ab M1. Dieser Platzhalter dient nur dazu,
 * das Build- und Test-Setup in M0 zu verifizieren.
 */

export interface Ergebnis {
	istDeutsch: boolean;
}

export function analysiere(_text: string): Ergebnis {
	throw new Error("Noch nicht implementiert (folgt in M1).");
}
