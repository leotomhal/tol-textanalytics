/**
 * Wortschatz statt „Sprachniveau" (Konzept 3.5).
 *
 * ABWEICHUNG VOM KONZEPT: Die verfügbare DeReWo-Datenbasis ist eine
 * Wortformenliste ohne Häufigkeitsrang (siehe scripts/derewo-aufbereiten.ts
 * für Details). Es gibt deshalb keine Top-5.000/20.000-Abstufung — nur
 * "bekannt" (in der Liste enthalten) oder "unbekannt". Kein Stemming
 * nötig, da die Liste bereits alle Flexionsformen enthält; Abgleich per
 * exaktem Wortformvergleich (Kleinschreibung).
 *
 * LADEN IST ASYNCHRON: Die 817.938 Wortformen liegen komprimiert
 * (gzip+base64, siehe scripts/derewo-aufbereiten.ts) und werden über die
 * Web-Standard-API `DecompressionStream` entpackt — die ist promise-basiert,
 * es gibt keinen synchronen Weg ohne Node-`zlib` (das Obsidian Mobile
 * ausschließen würde, siehe Kommentar im Aufbereitungsskript). Das
 * entspricht dem Konzept: `analysiere()` selbst bleibt synchron (Konzept 1,
 * "läuft vollständig lokal und synchron") — das einmalige Entpacken passiert
 * beim Plugin-Start (main.ts `onload`, ab M4), nicht bei jedem Analyselauf.
 * Bis dahin nutzen Aufrufer ohne übergebene Frequenzquelle den Fallback
 * `alleBekanntQuelle` (siehe unten) — das ist explizit korrekt und kein Bug.
 */

import derewoDaten from "../data/derewo-top20k.json";

export interface Frequenzquelle {
	/** true, wenn `wort` (ohne Beachtung der Groß-/Kleinschreibung) in der Liste bekannt ist. */
	istBekannt(wort: string): boolean;
}

class WortlistenFrequenzquelle implements Frequenzquelle {
	private readonly bekannt: Set<string>;

	constructor(woerter: Iterable<string>) {
		this.bekannt = new Set(woerter);
	}

	istBekannt(wort: string): boolean {
		return this.bekannt.has(wort.toLowerCase());
	}
}

/**
 * Fallback, wenn (noch) keine echte Frequenzquelle geladen ist: Kein Wort
 * gilt als Fachbegriff. `analysiere()` liefert damit weiterhin ein
 * vollständiges Ergebnis, nur ohne Fachwort-Korrektur/Wortschatz-Signal —
 * besser als ein Absturz oder ein stillschweigend falscher Wert.
 */
export const alleBekanntQuelle: Frequenzquelle = { istBekannt: () => true };

async function entpacke(base64Gzip: string): Promise<string> {
	const bytes = Uint8Array.from(atob(base64Gzip), (c) => c.charCodeAt(0));
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
	return await new Response(stream).text();
}

let geladeneQuelle: Promise<Frequenzquelle> | undefined;

/**
 * Lädt die DeReWo-Wortliste (einmalig, danach gecacht) und liefert die
 * daraus gebaute Frequenzquelle. In Obsidian einmal beim Plugin-Start
 * aufrufen (ab M4) und das Ergebnis an `analysiere()` weiterreichen.
 */
export function ladeDerewoFrequenzquelle(): Promise<Frequenzquelle> {
	if (!geladeneQuelle) {
		const daten = derewoDaten as { komprimiert: string };
		geladeneQuelle = entpacke(daten.komprimiert).then(
			(text) => new WortlistenFrequenzquelle(text.split("\n"))
		);
	}
	return geladeneQuelle;
}

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
	quelle: Frequenzquelle
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
