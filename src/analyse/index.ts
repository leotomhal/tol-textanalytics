/**
 * Analysekern. Importiert bewusst nichts aus "obsidian" (siehe Konzept 2.1),
 * damit dieser Ordner isoliert mit Vitest testbar bleibt.
 *
 * Stand M1: Fundament (Maskierung, Segmentierung, Tokenizer, Satztrennung,
 * Silbenzählung, Sprachprüfung). `kennzahlen` und `befunde` sind bis M2/M3
 * leere Arrays — die dafür nötigen Formeln und Stilmarker sind noch nicht
 * umgesetzt.
 */

import { maskiere } from "./vorbereitung";
import { segmentiereSaetze, tokenisiereWoerter } from "./tokenize";
import { pruefeSprache } from "./sprache";
import type { Ergebnis } from "./types";

export type { Ergebnis, Kategorie, Sicherheit, Befund, Kennzahl } from "./types";
export { maskiere } from "./vorbereitung";
export type { MaskierungsErgebnis } from "./vorbereitung";
export { segmentiereSaetze, tokenisiereWoerter } from "./tokenize";
export type { Satz, Wort } from "./tokenize";
export { zaehleSilben } from "./silben";
export { pruefeSprache, FUNKTIONSWOERTER } from "./sprache";

export interface AnalyseOptionen {
	/** Auslöserzeilen für den Schlussteil (Konzept 2.3, Schritt B). Ab M7 aus den Settings befüllt. */
	schlussteilAusloeser?: string[];
	/** Schwellwert für die Deutscherkennung (Konzept 2.5). Standard 5 %. */
	sprachSchwelle?: number;
}

function zeileAusZeichenoffset(rohtext: string, offset: number): number {
	let zeile = 0;
	for (let i = 0; i < offset && i < rohtext.length; i++) {
		if (rohtext[i] === "\n") zeile++;
	}
	return zeile;
}

export function analysiere(rohtext: string, optionen: AnalyseOptionen = {}): Ergebnis {
	const start = performance.now();

	const maskierung = maskiere(rohtext, optionen.schlussteilAusloeser ?? []);
	const saetze = segmentiereSaetze(maskierung.maskiert);
	const woerterAnalysiert = saetze.flatMap((s) => s.woerter);
	const woerterGesamt = tokenisiereWoerter(rohtext).length;

	const sprachpruefung = pruefeSprache(
		woerterAnalysiert.map((w) => w.text),
		optionen.sprachSchwelle
	);

	return {
		istDeutsch: sprachpruefung.istDeutsch,
		kennzahlen: [],
		befunde: [],
		satzlaengen: saetze.map((s) => s.woerter.length),
		woerterGesamt,
		woerterMaskiert: Math.max(woerterGesamt - woerterAnalysiert.length, 0),
		schlussteilAbZeile:
			maskierung.schlussteilAbZeichen !== undefined
				? zeileAusZeichenoffset(rohtext, maskierung.schlussteilAbZeichen)
				: undefined,
		dauerMs: performance.now() - start,
	};
}
