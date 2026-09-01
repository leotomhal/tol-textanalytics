import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import {
	textanalyseFeld,
	setzeBefunde,
	setzeSichtbarkeit,
	baueDecorations,
	ALLE_KATEGORIEN,
} from "../src/view/decorations";
import type { Befund } from "../src/analyse/types";

function befund(kategorie: Befund["kategorie"], von: number, bis: number): Befund {
	return { kategorie, von, bis, text: "x".repeat(bis - von), sicherheit: "hoch", ignorierbar: false };
}

describe("baueDecorations", () => {
	it("erzeugt für jeden sichtbaren Befund eine Decoration mit passender Kategorie-Klasse", () => {
		const befunde = [befund("fuellwort", 0, 5), befund("perfekt", 10, 15)];
		const set = baueDecorations(befunde, new Set(ALLE_KATEGORIEN), 20);

		const klassen: string[] = [];
		set.between(0, 20, (_from, _to, deco) => {
			klassen.push((deco.spec as { class: string }).class);
		});
		expect(klassen).toEqual([
			"textanalyse-mark textanalyse-mark-fuellwort",
			"textanalyse-mark textanalyse-mark-perfekt",
		]);
	});

	it("lässt Befunde unsichtbarer Kategorien weg", () => {
		const befunde = [befund("fuellwort", 0, 5), befund("perfekt", 10, 15)];
		const set = baueDecorations(befunde, new Set(["fuellwort"]), 20);
		let anzahl = 0;
		set.between(0, 20, () => {
			anzahl++;
		});
		expect(anzahl).toBe(1);
	});

	it("ignoriert Befunde, deren Bereich außerhalb des Dokuments liegt", () => {
		const befunde = [befund("fuellwort", 0, 5), befund("perfekt", 100, 105)];
		const set = baueDecorations(befunde, new Set(ALLE_KATEGORIEN), 10);
		let anzahl = 0;
		set.between(0, 10, () => {
			anzahl++;
		});
		expect(anzahl).toBe(1);
	});
});

describe("textanalyseFeld", () => {
	function neuerState(doc = "Ein Text mit genug Zeichen fuer die Tests.") {
		return EditorState.create({ doc, extensions: [textanalyseFeld] });
	}

	it("startet leer, mit allen Kategorien sichtbar", () => {
		const state = neuerState();
		const wert = state.field(textanalyseFeld);
		expect(wert.befunde).toEqual([]);
		expect(wert.sichtbareKategorien.size).toBe(ALLE_KATEGORIEN.length);
	});

	it("übernimmt neue Befunde über setzeBefunde", () => {
		let state = neuerState();
		const befunde = [befund("fuellwort", 0, 3)];
		state = state.update({ effects: setzeBefunde.of(befunde) }).state;
		expect(state.field(textanalyseFeld).befunde).toEqual(befunde);
		let anzahl = 0;
		state.field(textanalyseFeld).decorations.between(0, state.doc.length, () => {
			anzahl++;
		});
		expect(anzahl).toBe(1);
	});

	it("blendet Kategorien über setzeSichtbarkeit aus, ohne die Befunde zu verlieren", () => {
		let state = neuerState();
		const befunde = [befund("fuellwort", 0, 3), befund("perfekt", 5, 8)];
		state = state.update({ effects: setzeBefunde.of(befunde) }).state;
		state = state.update({ effects: setzeSichtbarkeit.of(new Set(["fuellwort"])) }).state;

		expect(state.field(textanalyseFeld).befunde).toHaveLength(2);
		let anzahl = 0;
		state.field(textanalyseFeld).decorations.between(0, state.doc.length, () => {
			anzahl++;
		});
		expect(anzahl).toBe(1);
	});

	it("mapped Decorations bei Dokumentänderungen, statt sie zu verlieren", () => {
		let state = neuerState("0123456789");
		state = state.update({ effects: setzeBefunde.of([befund("fuellwort", 5, 8)]) }).state;

		// Fügt 2 Zeichen am Anfang ein — die Decoration sollte um 2 nach hinten wandern.
		state = state.update({ changes: { from: 0, insert: "XY" } }).state;

		const positionen: [number, number][] = [];
		state.field(textanalyseFeld).decorations.between(0, state.doc.length, (from, to) => {
			positionen.push([from, to]);
		});
		expect(positionen).toEqual([[7, 10]]);
	});
});
