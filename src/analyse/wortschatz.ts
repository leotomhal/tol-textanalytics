/**
 * Wortschatz statt „Sprachniveau" (Konzept 3.5).
 *
 * ABWEICHUNG VOM KONZEPT: Die verfügbare DeReWo-Datenbasis ist eine
 * Wortformenliste ohne Häufigkeitsrang (siehe scripts/derewo-aufbereiten.ts
 * für Details). Es gibt deshalb keine Top-5.000/20.000-Abstufung — nur
 * "bekannt" (in der Liste enthalten) oder "unbekannt". Kein Stemming
 * nötig, da die Liste bereits alle Flexionsformen enthält; Abgleich per
 * exaktem Wortformvergleich (Kleinschreibung). Das Interface ist bewusst
 * schmal gehalten, damit ein Wechsel auf eine echte frequenzsortierte
 * Liste später keine Aufrufer ändert.
 */

import derewoDaten from "../data/derewo-top20k.json";

export interface Frequenzquelle {
	/** true, wenn `wort` (ohne Beachtung der Groß-/Kleinschreibung) in der Liste bekannt ist. */
	istBekannt(wort: string): boolean;
}

class DerewoFrequenzquelle implements Frequenzquelle {
	private readonly bekannt: Set<string>;

	constructor(woerter: string[]) {
		this.bekannt = new Set(woerter);
	}

	istBekannt(wort: string): boolean {
		return this.bekannt.has(wort.toLowerCase());
	}
}

export const derewoFrequenzquelle: Frequenzquelle = new DerewoFrequenzquelle(
	(derewoDaten as { woerter: string[] }).woerter
);

export interface SeltenesWort {
	text: string;
	von: number;
	bis: number;
}

export interface WortschatzErgebnis {
	/** Anteil der Wörter, die nicht im Wörterbuch stehen, in % der analysierten Wörter. */
	anteilUnbekannt: number;
	/** Bis zu 20 Beispiele unbekannter Wörter, mit Fundstelle, ohne Duplikate. */
	seltensteWoerter: SeltenesWort[];
}

const MAX_BEISPIELE = 20;

export function analysiereWortschatz(
	woerter: { text: string; von: number; bis: number }[],
	quelle: Frequenzquelle = derewoFrequenzquelle
): WortschatzErgebnis {
	if (woerter.length === 0) {
		return { anteilUnbekannt: 0, seltensteWoerter: [] };
	}

	let unbekanntAnzahl = 0;
	const seltensteWoerter: SeltenesWort[] = [];
	const gesehen = new Set<string>();

	for (const wort of woerter) {
		if (quelle.istBekannt(wort.text)) continue;
		unbekanntAnzahl++;
		const schluessel = wort.text.toLowerCase();
		if (!gesehen.has(schluessel) && seltensteWoerter.length < MAX_BEISPIELE) {
			gesehen.add(schluessel);
			seltensteWoerter.push({ text: wort.text, von: wort.von, bis: wort.bis });
		}
	}

	return {
		anteilUnbekannt: (unbekanntAnzahl / woerter.length) * 100,
		seltensteWoerter,
	};
}
