/**
 * Füllwörter (Konzept 3.6). Listenabgleich, mehrwortige Phrasen erlaubt
 * ("im Grunde").
 *
 * Kontextsensitiv für "natürlich" (Konzept: "in „natürliche Auslese" zählt
 * nicht → nur werten, wenn nicht attributiv vor Substantiv"): Das
 * Konzept-Beispiel verwendet die flektierte Form "natürliche", nicht das
 * bloße "natürlich". Attributive Adjektive vor einem Substantiv müssen im
 * Deutschen flektieren ("die natürliche Auslese", nicht "die natürlich
 * Auslese") — die unflektierte Form "natürlich" ist praktisch immer der
 * Füllwort-/Adverb-Gebrauch. Ein früherer Entwurf hatte hier zusätzlich
 * "nächstes Wort großgeschrieben" als Ausschlusskriterium — das war falsch
 * herum: Da im Deutschen jedes Substantiv großgeschrieben wird, hätte das
 * gerade die häufigen echten Treffer wie "Das ist natürlich Unsinn."
 * unterdrückt (Prädikativ + Substantiv ist kein attributiver Gebrauch).
 * Deshalb bewusst kein Sonderfall mehr nötig: exaktes Wortmatching auf die
 * unflektierte Form vermeidet das im Konzept beschriebene Risiko bereits
 * strukturell.
 */

import type { Satz } from "../tokenize";
import type { Befund } from "../types";

/**
 * Standardliste, editierbar in den Settings (ab M7). Mehrwortige Einträge
 * (z. B. "im grunde") werden als Phrase gegen aufeinanderfolgende Wörter
 * geprüft.
 */
export const STANDARD_FUELLWOERTER = [
	"eigentlich",
	"quasi",
	"durchaus",
	"relativ",
	"ziemlich",
	"sozusagen",
	"letztlich",
	"praktisch",
	"im grunde",
	"im grunde genommen",
	"natürlich",
	"im prinzip",
	"im endeffekt",
	"gewissermaßen",
	"irgendwie",
	"schlichtweg",
	"überhaupt",
	"ohnehin",
	"an sich",
	"sicherlich",
	"gewiss",
];

interface Phrase {
	tokens: string[];
	text: string;
}

function zuPhrasen(liste: string[]): Phrase[] {
	// Längste (meiste Tokens) zuerst, damit "im grunde genommen" vor "im grunde" greift.
	return liste
		.map((text) => ({ text, tokens: text.toLowerCase().split(/\s+/) }))
		.sort((a, b) => b.tokens.length - a.tokens.length);
}

export function findeFuellwoerter(
	saetze: Satz[],
	rohtext: string,
	liste: string[] = STANDARD_FUELLWOERTER
): Befund[] {
	const phrasen = zuPhrasen(liste);
	const befunde: Befund[] = [];

	for (const satz of saetze) {
		const woerter = satz.woerter;
		for (let i = 0; i < woerter.length; i++) {
			for (const phrase of phrasen) {
				const n = phrase.tokens.length;
				if (i + n > woerter.length) continue;
				const passt = phrase.tokens.every((t, j) => woerter[i + j].text.toLowerCase() === t);
				if (!passt) continue;

				const von = woerter[i].von;
				const bis = woerter[i + n - 1].bis;
				befunde.push({
					kategorie: "fuellwort",
					von,
					bis,
					text: rohtext.slice(von, bis),
					sicherheit: "hoch",
					ignorierbar: false,
				});
				i += n - 1; // Überlappende Treffer innerhalb derselben Stelle vermeiden.
				break;
			}
		}
	}

	return befunde;
}
