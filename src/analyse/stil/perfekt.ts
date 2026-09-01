/**
 * Perfekt (Konzept 3.6): `haben`/`sein` (flektiert) + Partizip II im
 * selben Satz, Abstand ≤ 12 Token.
 *
 * Die Partizip-II-Heuristik (`istWahrscheinlichPartizipZwei`) ist hier
 * bewusst schon vollständig statt nur angedeutet, obwohl das Konzept
 * "Partizip-II-Erkennung inkl. Unregelmäßigenliste" formal erst unter
 * Phase 3/M6 (Passiv) einführt: Perfekt braucht dieselbe Erkennung schon in
 * Phase 1/M3, sonst funktioniert der Perfekt-Marker gar nicht. M6
 * importiert und erweitert diese Funktion für die Passiv/Futur/
 * Zustandspassiv-Abgrenzung, statt sie zu duplizieren.
 *
 * Sicherheit: mittel (siehe Konzept 3.6) — ohne Lexikon ist die
 * Partizip-II-Erkennung heuristisch (ge-Präfix bzw. untrennbares Präfix +
 * Endung -t/-en, unregelmäßige Formen über Liste).
 */

import type { Satz } from "../tokenize";
import type { Befund } from "../types";

const HABEN_FORMEN = new Set([
	"habe", "hast", "hat", "haben", "habt",
	"hatte", "hattest", "hatten", "hattet",
	"hätte", "hättest", "hätten", "hättet",
]);

const SEIN_FORMEN = new Set([
	"bin", "bist", "ist", "sind", "seid",
	"war", "warst", "waren", "wart",
	"sei", "seist", "seiest", "seien", "seiet",
	"wäre", "wärst", "wärest", "wären", "wäret",
]);

const HILFSVERB_FORMEN = new Set([...HABEN_FORMEN, ...SEIN_FORMEN]);

/** Häufige unregelmäßige Partizip-II-Formen ohne erkennbares Muster. */
export const UNREGELMAESSIGE_PARTIZIPIEN = new Set([
	"gewesen", "gegangen", "gekommen", "getan", "gesehen", "genommen",
	"gegeben", "gefunden", "geschrieben", "gelesen", "gesprochen",
	"getroffen", "gestanden", "gehalten", "gefallen", "geholfen",
	"geworfen", "gerufen", "gebracht", "gedacht", "gewusst", "gekannt",
	"genannt", "gewonnen", "begonnen", "verstanden", "entstanden",
	"geblieben", "geschehen", "gewachsen", "gezogen", "geschlossen",
	"gemessen", "gestorben", "geboren", "verloren", "betroffen",
	"entschieden", "angefangen", "empfangen", "bekommen", "beschrieben",
	"vergessen", "verglichen", "vorgeschlagen", "ausgegangen",
]);

const UNTRENNBARE_PRAEFIXE = ["ver", "be", "ent", "er", "zer", "emp", "miss"];

/**
 * Heuristik ohne Lexikon: `ge-`-Präfix oder eines der untrennbaren Präfixe,
 * plus Endung `-t`/`-en`. Fängt weder alle regelmäßigen noch alle
 * unregelmäßigen Formen zuverlässig — siehe Sicherheitshinweis oben.
 */
export function istWahrscheinlichPartizipZwei(wort: string): boolean {
	const w = wort.toLowerCase();
	if (UNREGELMAESSIGE_PARTIZIPIEN.has(w)) return true;
	if (w.length < 5) return false;

	const hatPassendesPraefix = w.startsWith("ge") || UNTRENNBARE_PRAEFIXE.some((p) => w.startsWith(p));
	if (!hatPassendesPraefix) return false;

	return w.endsWith("t") || w.endsWith("en");
}

const MAX_ABSTAND_TOKEN = 12;

export function findePerfektkonstruktionen(saetze: Satz[], rohtext: string): Befund[] {
	const befunde: Befund[] = [];

	for (const satz of saetze) {
		const woerter = satz.woerter;
		const partizipIndizes: number[] = [];
		for (let i = 0; i < woerter.length; i++) {
			if (istWahrscheinlichPartizipZwei(woerter[i].text)) partizipIndizes.push(i);
		}
		if (partizipIndizes.length === 0) continue;

		const verwendetePartizipien = new Set<number>();

		for (let i = 0; i < woerter.length; i++) {
			if (!HILFSVERB_FORMEN.has(woerter[i].text.toLowerCase())) continue;

			let naechstesPartizip: number | undefined;
			let kleinsterAbstand = Infinity;
			for (const p of partizipIndizes) {
				if (verwendetePartizipien.has(p)) continue;
				const abstand = Math.abs(p - i);
				if (abstand <= MAX_ABSTAND_TOKEN && abstand < kleinsterAbstand) {
					kleinsterAbstand = abstand;
					naechstesPartizip = p;
				}
			}
			if (naechstesPartizip === undefined) continue;

			verwendetePartizipien.add(naechstesPartizip);
			const von = woerter[Math.min(i, naechstesPartizip)].von;
			const bis = woerter[Math.max(i, naechstesPartizip)].bis;
			befunde.push({
				kategorie: "perfekt",
				von,
				bis,
				text: rohtext.slice(von, bis),
				sicherheit: "mittel",
				ignorierbar: false,
			});
		}
	}

	return befunde;
}
