/**
 * Streckverben (Konzept 3.6), Teil des Nominalstil-Befunds: feste Phrasen
 * wie "zur Anwendung kommen" statt "angewendet werden". Phrasenliste,
 * editierbar ab M7.
 *
 * BEKANNTE GRENZE: Der Abgleich verlangt unmittelbar aufeinanderfolgende
 * Wörter. Nach einem Modalverb/Infinitiv steht die Phrase tatsächlich so
 * ("... soll zur Anwendung kommen"), im Hauptsatz mit Verb-Zweitstellung
 * trennt sich das Verb aber vom Rest ("Die Methode kommt ... zur
 * Anwendung"). Solche getrennten Fälle werden hier nicht erkannt — eine
 * Erweiterung auf nicht-benachbarte Wortstellung ist ein möglicher
 * Folgeschritt, im Konzept aber nicht gefordert.
 */

import type { Satz } from "../tokenize";
import type { Befund } from "../types";

export const STANDARD_STRECKVERBEN = [
	"zur anwendung kommen",
	"zur anwendung bringen",
	"durchführung von",
	"unter beweis stellen",
	"in anspruch nehmen",
	"zur verfügung stellen",
	"berücksichtigung finden",
	"zum ausdruck bringen",
	"in betracht ziehen",
	"zur sprache bringen",
	"in kraft treten",
	"zur geltung bringen",
	"in erwägung ziehen",
];

interface Phrase {
	tokens: string[];
	text: string;
}

function zuPhrasen(liste: string[]): Phrase[] {
	return liste
		.map((text) => ({ text, tokens: text.toLowerCase().split(/\s+/) }))
		.sort((a, b) => b.tokens.length - a.tokens.length);
}

export function findeStreckverben(
	saetze: Satz[],
	rohtext: string,
	liste: string[] = STANDARD_STRECKVERBEN
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
					kategorie: "streckverb",
					von,
					bis,
					text: rohtext.slice(von, bis),
					sicherheit: "mittel",
					ignorierbar: false,
				});
				i += n - 1;
				break;
			}
		}
	}

	return befunde;
}
