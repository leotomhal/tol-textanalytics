/**
 * Nominalstil (Konzept 3.6): Suffixe `-ung`, `-heit`, `-keit`, `-tion`,
 * `-ismus`, `-nis`, `-schaft`, `-ierung`, mit Ausnahmeliste für echte
 * Substantive. Sicherheit: mittel-hoch, abhängig von der Ausnahmeliste.
 */

import type { Satz } from "../tokenize";
import type { Befund } from "../types";

// Längste zuerst, damit "-ierung" vor dem kürzeren "-ung" greift.
const SUFFIXE = ["ierung", "schaft", "ismus", "heit", "keit", "tion", "nis", "ung"].sort(
	(a, b) => b.length - a.length
);

/** Echte Substantive, die zufällig auf einen Nominalstil-Suffix enden. Editierbar ab M7. */
export const STANDARD_AUSNAHMEN = new Set(
	[
		"Zeitung", "Wohnung", "Ordnung", "Nation", "Rechnung", "Wissenschaft",
		"Gesellschaft", "Meinung", "Übung", "Prüfung", "Zeugnis", "Ergebnis",
		"Erlebnis", "Verhältnis", "Geheimnis", "Bedürfnis", "Kenntnis",
		"Hindernis", "Wildnis", "Freundschaft", "Mannschaft", "Landschaft",
		"Botschaft", "Herrschaft", "Leidenschaft", "Nachbarschaft",
	].map((w) => w.toLowerCase())
);

const MIN_STAMMLAENGE = 3;

export function findeNominalstil(
	saetze: Satz[],
	rohtext: string,
	ausnahmen: Set<string> = STANDARD_AUSNAHMEN
): Befund[] {
	const befunde: Befund[] = [];

	for (const satz of saetze) {
		for (const wort of satz.woerter) {
			const w = wort.text.toLowerCase();
			if (ausnahmen.has(w)) continue;

			const suffix = SUFFIXE.find((s) => w.endsWith(s) && w.length - s.length >= MIN_STAMMLAENGE);
			if (!suffix) continue;

			befunde.push({
				kategorie: "nominalstil",
				von: wort.von,
				bis: wort.bis,
				text: rohtext.slice(wort.von, wort.bis),
				sicherheit: "mittel",
				ignorierbar: false,
			});
		}
	}

	return befunde;
}
