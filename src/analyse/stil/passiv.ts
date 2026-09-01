/**
 * Passiv (Konzept 3.6): `werden` (flektiert) + Partizip II, mit Abgrenzung
 * gegen Futur, Zustandspassiv und Perfekt-Passiv.
 *
 * - **Futur** (`wird` + Infinitiv, kein `ge-`-Präfix): Kein eigener
 *   Ausschluss-Check nötig. Die verschärfte `istWahrscheinlichPartizipZwei`-
 *   Heuristik (siehe perfekt.ts) lehnt reguläre Infinitive schon strukturell
 *   ab, auch die mit untrennbarem Präfix ("bezahlen", "verstehen") — genau
 *   der Fall, an dem Futur/Passiv sonst am ehesten verwechselt würden.
 * - **Zustandspassiv** (`sein` + Partizip II, ohne `worden`): separate
 *   Kategorie, zählt nicht in die Passivquote (Konzept 4.2).
 * - **Perfekt-Passiv** (`sein` + Partizip II + `worden`): `worden` ist das
 *   Signal, dass es sich trotz `sein`-Hilfsverb um echtes Passiv handelt,
 *   nicht um Zustandspassiv.
 *
 * WICHTIGE EINSCHRÄNKUNG, die über das im Konzept benannte Maß hinausgeht:
 * "sein + Partizip II" ist ohne Verblexikon nicht zuverlässig von aktivem
 * Perfekt mit sein-Hilfsverb zu unterscheiden ("Er ist gekommen" = aktives
 * Perfekt, kein Passiv; "Der Brief ist geschrieben" = Zustandspassiv).
 * Beide Muster sind identisch aufgebaut. Diese Funktion markiert daher jedes
 * "sein + Partizip II" ohne "worden" als `zustandspassiv` — bei
 * Bewegungs-/Zustandsverben (gehen, kommen, bleiben, …) ist das inhaltlich
 * falsch, auch wenn diese Wörter meist schon in perfekt.ts als `perfekt`
 * erfasst werden. Sicherheit deshalb "mittel" für `passiv`, nur "mittel"
 * auch für `zustandspassiv" — nicht "hoch", trotz eindeutiger Wortmuster.
 */

import type { Satz, Wort } from "../tokenize";
import type { Befund } from "../types";
import { SEIN_FORMEN, istWahrscheinlichPartizipZwei } from "./perfekt";

const WERDEN_FORMEN = new Set([
	"werde", "wirst", "wird", "werden", "werdet",
	"wurde", "wurdest", "wurden", "wurdet",
	"würde", "würdest", "würden", "würdet",
]);

const MAX_ABSTAND_TOKEN = 12;

function findeIndizes(woerter: Wort[], test: (text: string) => boolean): number[] {
	const treffer: number[] = [];
	for (let i = 0; i < woerter.length; i++) {
		if (test(woerter[i].text)) treffer.push(i);
	}
	return treffer;
}

function naechsterUnbenutzter(
	von: number,
	kandidaten: number[],
	benutzt: ReadonlySet<number>
): number | undefined {
	let ergebnis: number | undefined;
	let kleinsterAbstand = Infinity;
	for (const k of kandidaten) {
		if (benutzt.has(k)) continue;
		const abstand = Math.abs(k - von);
		if (abstand <= MAX_ABSTAND_TOKEN && abstand < kleinsterAbstand) {
			kleinsterAbstand = abstand;
			ergebnis = k;
		}
	}
	return ergebnis;
}

function befundAus(
	kategorie: "passiv" | "zustandspassiv",
	indizes: number[],
	woerter: Wort[],
	rohtext: string
): Befund {
	const sortiert = [...indizes].sort((a, b) => a - b);
	const von = woerter[sortiert[0]].von;
	const bis = woerter[sortiert[sortiert.length - 1]].bis;
	return {
		kategorie,
		von,
		bis,
		text: rohtext.slice(von, bis),
		sicherheit: "mittel",
		ignorierbar: false,
	};
}

export function findePassivkonstruktionen(saetze: Satz[], rohtext: string): Befund[] {
	const befunde: Befund[] = [];

	for (const satz of saetze) {
		const woerter = satz.woerter;
		const partizipien = findeIndizes(woerter, istWahrscheinlichPartizipZwei);
		if (partizipien.length === 0) continue;

		const werdenFormen = findeIndizes(woerter, (t) => WERDEN_FORMEN.has(t.toLowerCase()));
		const seinFormen = findeIndizes(woerter, (t) => SEIN_FORMEN.has(t.toLowerCase()));
		const wordenFormen = findeIndizes(woerter, (t) => t.toLowerCase() === "worden");

		const benutztePartizipien = new Set<number>();

		// 1. Vorgangspassiv: werden-Form + Partizip II.
		for (const w of werdenFormen) {
			const p = naechsterUnbenutzter(w, partizipien, benutztePartizipien);
			if (p === undefined) continue;
			benutztePartizipien.add(p);
			befunde.push(befundAus("passiv", [w, p], woerter, rohtext));
		}

		// 2. sein-Form + Partizip II: Perfekt-Passiv (mit "worden") oder
		//    Zustandspassiv (ohne).
		for (const s of seinFormen) {
			const p = naechsterUnbenutzter(s, partizipien, benutztePartizipien);
			if (p === undefined) continue;
			benutztePartizipien.add(p);

			const w = naechsterUnbenutzter(s, wordenFormen, new Set());
			if (w !== undefined) {
				befunde.push(befundAus("passiv", [s, p, w], woerter, rohtext));
			} else {
				befunde.push(befundAus("zustandspassiv", [s, p], woerter, rohtext));
			}
		}
	}

	return befunde;
}
