/**
 * Analysekern. Importiert bewusst nichts aus "obsidian" (siehe Konzept 2.1),
 * damit dieser Ordner isoliert mit Vitest testbar bleibt.
 *
 * Stand M2: Fundament (M1) plus Lesbarkeits- und Rhythmus-Kennzahlen (WSTF
 * inkl. Fachwort-Korrektur, LIX, Satzlängenstatistik, Rhythmus/MAD) sowie
 * die Fachbegriff-Kennzahl aus wortschatz.ts. `status` und `ziel` jeder
 * Kennzahl bleiben bis M7 neutral/undefined — die Zielprofile aus Konzept
 * 4.3 existieren noch nicht. Stilmarker-Befunde (Füllwörter, Passiv, …)
 * kommen mit M3/M6; Wort-Fundstellen für "seltenes-wort" (Markierung im
 * Editor) mit M5.
 */

import { maskiere } from "./vorbereitung";
import { segmentiereSaetze, tokenisiereWoerter } from "./tokenize";
import { pruefeSprache } from "./sprache";
import { berechneWSTF, berechneLIX, berechneSatzlaengenStatistik } from "./lesbarkeit";
import {
	berechneMAD,
	berechneVariationskoeffizient,
	klassifiziereRhythmus,
	findeGleichfoermigePassagen,
} from "./rhythmus";
import { analysiereWortschatz, alleBekanntQuelle } from "./wortschatz";
import type { Frequenzquelle } from "./wortschatz";
import type { Ergebnis, Kennzahl } from "./types";

export type { Ergebnis, Kategorie, Sicherheit, Befund, Kennzahl } from "./types";
export { maskiere } from "./vorbereitung";
export type { MaskierungsErgebnis } from "./vorbereitung";
export { segmentiereSaetze, tokenisiereWoerter } from "./tokenize";
export type { Satz, Wort } from "./tokenize";
export { zaehleSilben } from "./silben";
export { pruefeSprache, FUNKTIONSWOERTER } from "./sprache";
export {
	berechneWSTF,
	berechneLIX,
	berechneSatzlaengenStatistik,
} from "./lesbarkeit";
export {
	berechneMAD,
	berechneVariationskoeffizient,
	klassifiziereRhythmus,
	findeGleichfoermigePassagen,
} from "./rhythmus";
export { analysiereWortschatz, alleBekanntQuelle, ladeDerewoFrequenzquelle } from "./wortschatz";
export type { Frequenzquelle, WortschatzErgebnis } from "./wortschatz";

export interface AnalyseOptionen {
	/** Auslöserzeilen für den Schlussteil (Konzept 2.3, Schritt B). Ab M7 aus den Settings befüllt. */
	schlussteilAusloeser?: string[];
	/** Schwellwert für die Deutscherkennung (Konzept 2.5). Standard 5 %. */
	sprachSchwelle?: number;
	/**
	 * Standard: `alleBekanntQuelle` (keine Fachwort-Korrektur/Wortschatz-Signal).
	 * Die echte DeReWo-Wortliste lädt asynchron (`ladeDerewoFrequenzquelle()`,
	 * siehe wortschatz.ts) — einmal beim Plugin-Start laden (ab M4) und hier
	 * übergeben, damit `analysiere()` selbst synchron bleiben kann.
	 */
	frequenzquelle?: Frequenzquelle;
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
	const satzlaengen = saetze.map((s) => s.woerter.length);
	const quelle = optionen.frequenzquelle ?? alleBekanntQuelle;

	const sprachpruefung = pruefeSprache(
		woerterAnalysiert.map((w) => w.text),
		optionen.sprachSchwelle
	);

	const kennzahlen: Kennzahl[] = [];
	const befunde = findeGleichfoermigePassagen(saetze, rohtext);

	// Kennzahlen nur berechnen, wenn es überhaupt Sätze gibt — sonst sind
	// Mittelwerte etc. undefiniert (0/0) und die Anzeige wäre irreführend.
	if (sprachpruefung.istDeutsch && saetze.length > 0) {
		const wstf = berechneWSTF(woerterAnalysiert, satzlaengen, quelle);
		const lix = berechneLIX(woerterAnalysiert, satzlaengen);
		const satzstatistik = berechneSatzlaengenStatistik(satzlaengen);
		const mad = berechneMAD(satzlaengen);
		const rhythmusKlasse = klassifiziereRhythmus(mad);
		const wortschatz = analysiereWortschatz(woerterAnalysiert, quelle);

		kennzahlen.push(
			{
				id: "schulstufe",
				label: "Lesbarkeit (WSTF)",
				wert: wstf.roh,
				anzeige: `Schulstufe ${Math.round(wstf.roh)}`,
				nebenwert:
					wstf.ausgeschlosseneFachbegriffe > 0
						? `ohne ${wstf.ausgeschlosseneFachbegriffe} Fachbegriffe: Schulstufe ${Math.round(wstf.korrigiert)}`
						: undefined,
				status: "neutral",
				sicherheit: "hoch",
				tooltip:
					"Wiener Sachtextformel 1. Miss überwiegend Wortlänge, nicht nur Satzbau — deshalb die Fachwort-Korrektur daneben. " +
					"Zielwerte je Profil kommen erst mit den Zielprofilen (noch nicht umgesetzt).",
			},
			{
				id: "lix",
				label: "LIX (zweite Meinung)",
				wert: lix,
				anzeige: `LIX ${lix.toFixed(1)}`,
				status: "neutral",
				sicherheit: "hoch",
				tooltip: "Läsbarhetsindex, zweite Formel zur Einordnung. Weicht sie stark von der Schulstufe ab, ist das selbst ein Signal.",
			},
			{
				id: "satzlaenge-mittel",
				label: "Ø Satzlänge",
				wert: satzstatistik.mittelwert,
				anzeige: `${satzstatistik.mittelwert.toFixed(1)} Wörter/Satz`,
				nebenwert: `Median ${satzstatistik.median}, Max ${satzstatistik.max}`,
				status: "neutral",
				sicherheit: "hoch",
				tooltip: "Mittlere Satzlänge in Wörtern. Zielwert je Profil kommt mit den Zielprofilen.",
			},
			{
				id: "lange-saetze",
				label: "Lange Sätze",
				wert: satzstatistik.anteilUeber20,
				anzeige: `${satzstatistik.anteilUeber20.toFixed(0)} % über 20 Wörter`,
				nebenwert: `${satzstatistik.anteilUeber30.toFixed(0)} % über 30 Wörter`,
				status: "neutral",
				sicherheit: "hoch",
				tooltip: "Anteil der Sätze mit mehr als 20 bzw. 30 Wörtern, in % aller Sätze.",
			},
			{
				id: "rhythmus",
				label: "Rhythmus",
				wert: mad,
				anzeige: `MAD ${mad.toFixed(1)} — ${rhythmusKlasse}`,
				nebenwert: `Variationskoeffizient ${berechneVariationskoeffizient(satzlaengen).toFixed(2)}`,
				status: "neutral",
				sicherheit: "hoch",
				tooltip:
					"Mittlere absolute Differenz aufeinanderfolgender Satzlängen. Schwellen (gleichförmig <4, sprunghaft >10) sind gesetzt, nicht validiert.",
			},
			{
				id: "fachbegriffe",
				label: "Fachbegriffe",
				wert: wortschatz.anteilUnbekannt,
				anzeige: `${wortschatz.anteilUnbekannt.toFixed(0)} % nicht im Wörterbuch`,
				status: "neutral",
				sicherheit: "mittel",
				tooltip:
					"Anteil der Wörter außerhalb der DeReWo-Wortliste. Abweichung vom Konzept: Es liegt keine nach Häufigkeit sortierte Liste vor, " +
					"sondern nur ein Bekanntheits-Wörterbuch ohne Top-5.000/20.000-Abstufung (siehe scripts/derewo-aufbereiten.ts). " +
					"Eigennamen laufen mangels Erkennung als Fachbegriffe mit.",
			}
		);
	}

	return {
		istDeutsch: sprachpruefung.istDeutsch,
		kennzahlen,
		befunde,
		satzlaengen,
		woerterGesamt,
		woerterMaskiert: Math.max(woerterGesamt - woerterAnalysiert.length, 0),
		schlussteilAbZeile:
			maskierung.schlussteilAbZeichen !== undefined
				? zeileAusZeichenoffset(rohtext, maskierung.schlussteilAbZeichen)
				: undefined,
		dauerMs: performance.now() - start,
	};
}
