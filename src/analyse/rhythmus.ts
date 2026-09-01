/**
 * Rhythmus (Konzept 3.4). Hauptwert ist die mittlere absolute Differenz
 * aufeinanderfolgender Satzlängen (MAD) — reihenfolgesensitiv, anders als
 * der (hier als Nebenwert weitergeführte) Variationskoeffizient.
 */

import type { Satz } from "./tokenize";
import type { Befund } from "./types";

export function berechneMAD(satzlaengen: number[]): number {
	if (satzlaengen.length < 2) return 0;
	let summe = 0;
	for (let i = 1; i < satzlaengen.length; i++) {
		summe += Math.abs(satzlaengen[i] - satzlaengen[i - 1]);
	}
	return summe / (satzlaengen.length - 1);
}

export function berechneVariationskoeffizient(satzlaengen: number[]): number {
	if (satzlaengen.length === 0) return 0;
	const mittel = satzlaengen.reduce((a, b) => a + b, 0) / satzlaengen.length;
	if (mittel === 0) return 0;
	const varianz =
		satzlaengen.reduce((summe, l) => summe + (l - mittel) ** 2, 0) / satzlaengen.length;
	return Math.sqrt(varianz) / mittel;
}

export type RhythmusKlasse = "gleichfoermig" | "abwechslungsreich" | "sprunghaft";

export function klassifiziereRhythmus(mad: number): RhythmusKlasse {
	if (mad < 4) return "gleichfoermig";
	if (mad <= 10) return "abwechslungsreich";
	return "sprunghaft";
}

const MIN_PASSAGENLAENGE = 4;
const MAX_LAENGENUNTERSCHIED = 3;

/**
 * Jede Folge von 4 oder mehr aufeinanderfolgenden Sätzen, deren Längen sich
 * um jeweils weniger als 3 Wörter unterscheiden, wird als Befund markiert.
 * `rohtext` wird nur gebraucht, um `Befund.text` aus den Dokument-Offsets
 * zu befüllen (siehe Offset-Test-Konvention aus M1).
 */
export function findeGleichfoermigePassagen(saetze: Satz[], rohtext: string): Befund[] {
	const befunde: Befund[] = [];
	let start = 0;

	for (let i = 1; i <= saetze.length; i++) {
		const bruch =
			i === saetze.length ||
			Math.abs(saetze[i].woerter.length - saetze[i - 1].woerter.length) >= MAX_LAENGENUNTERSCHIED;

		if (bruch) {
			const laenge = i - start;
			if (laenge >= MIN_PASSAGENLAENGE) {
				const erster = saetze[start];
				const letzter = saetze[i - 1];
				befunde.push({
					kategorie: "gleichfoermige-passage",
					von: erster.von,
					bis: letzter.bis,
					text: rohtext.slice(erster.von, letzter.bis),
					hinweis: `${laenge} Sätze mit ähnlicher Länge hintereinander`,
					sicherheit: "hoch",
					ignorierbar: false,
				});
			}
			start = i;
		}
	}

	return befunde;
}
