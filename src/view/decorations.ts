/**
 * CodeMirror-6-Decorations für Markierungen (Konzept 2.1, 2.4).
 *
 * Ein StateField hält den zuletzt bekannten Befund-Stand plus die Menge
 * sichtbarer Kategorien und leitet daraus den Decoration-Set ab. Neue
 * Analyseergebnisse kommen über `setzeBefunde` als StateEffect herein
 * (dispatcht von main.ts, verzögert um 1,5 s nach der letzten Eingabe —
 * siehe Kommentar dort); Kategorien-Sichtbarkeit über `setzeSichtbarkeit`
 * (vom Klick auf eine Checklistenzeile im Panel).
 *
 * Zwischen zwei vollständigen Neuberechnungen werden bestehende
 * Decorations bei Dokumentänderungen nur durch die Änderung hindurch
 * gemappt (`decorations.map(tr.changes)`), nicht neu berechnet — das ist
 * eine Annäherung (Positionen können zwischen zwei Analyseläufen leicht
 * abweichen), aber konsistent mit dem synchronen, debounced
 * Gesamtdokument-Ansatz des Konzepts (2.2): Es gibt ohnehin keine
 * inkrementelle Analyse einzelner Änderungen.
 */

import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { Befund, Kategorie } from "../analyse/types";
import { KATEGORIE_META } from "./kategorien";

export const ALLE_KATEGORIEN: Kategorie[] = [
	"langer-satz",
	"sehr-langer-satz",
	"gleichfoermige-passage",
	"passiv",
	"zustandspassiv",
	"perfekt",
	"fuellwort",
	"nominalstil",
	"streckverb",
	"seltenes-wort",
	"wortwiederholung",
	"abkuerzung",
];

export const setzeBefunde = StateEffect.define<Befund[]>();
export const setzeSichtbarkeit = StateEffect.define<Set<Kategorie>>();

export interface TextanalyseFeldZustand {
	befunde: Befund[];
	sichtbareKategorien: Set<Kategorie>;
	decorations: DecorationSet;
}

export function baueDecorations(
	befunde: Befund[],
	sichtbareKategorien: Set<Kategorie>,
	dokumentLaenge: number
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const gefiltert = befunde
		.filter((b) => sichtbareKategorien.has(b.kategorie) && b.von < b.bis && b.bis <= dokumentLaenge)
		.sort((a, b) => a.von - b.von || a.bis - b.bis);

	for (const b of gefiltert) {
		const meta = KATEGORIE_META[b.kategorie];
		const titel = b.hinweis ? `${meta.label}: ${b.hinweis}` : `${meta.label} — ${meta.kurzerklaerung}`;
		builder.add(
			b.von,
			b.bis,
			Decoration.mark({
				class: `textanalyse-mark textanalyse-mark-${b.kategorie}`,
				attributes: { title: titel },
			})
		);
	}

	return builder.finish();
}

export const textanalyseFeld = StateField.define<TextanalyseFeldZustand>({
	create(): TextanalyseFeldZustand {
		return {
			befunde: [],
			sichtbareKategorien: new Set(ALLE_KATEGORIEN),
			decorations: Decoration.none,
		};
	},
	update(wert, tr): TextanalyseFeldZustand {
		let { befunde, sichtbareKategorien, decorations } = wert;
		let neuBerechnen = false;

		for (const effect of tr.effects) {
			if (effect.is(setzeBefunde)) {
				befunde = effect.value;
				neuBerechnen = true;
			} else if (effect.is(setzeSichtbarkeit)) {
				sichtbareKategorien = effect.value;
				neuBerechnen = true;
			}
		}

		if (neuBerechnen) {
			decorations = baueDecorations(befunde, sichtbareKategorien, tr.state.doc.length);
		} else if (tr.docChanged) {
			decorations = decorations.map(tr.changes);
		}

		return { befunde, sichtbareKategorien, decorations };
	},
	provide: (feld) => EditorView.decorations.from(feld, (v) => v.decorations),
});

export function textanalyseDecorationsExtension(): Extension {
	return [textanalyseFeld];
}
