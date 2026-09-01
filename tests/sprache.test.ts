import { describe, expect, it } from "vitest";
import { pruefeSprache } from "../src/analyse/sprache";
import { tokenisiereWoerter } from "../src/analyse/tokenize";

describe("pruefeSprache", () => {
	it("erkennt deutschen Fließtext", () => {
		const woerter = tokenisiereWoerter(
			"Die Universität Halle hat eine neue Studie veröffentlicht, die zeigt, dass sich der Klimawandel auf die Landwirtschaft auswirkt."
		).map((w) => w.text);
		const ergebnis = pruefeSprache(woerter);
		expect(ergebnis.istDeutsch).toBe(true);
	});

	it("erkennt englischen Text nicht als Deutsch", () => {
		const woerter = tokenisiereWoerter(
			"The university has published a new study that shows how climate change affects agriculture across the region."
		).map((w) => w.text);
		const ergebnis = pruefeSprache(woerter);
		expect(ergebnis.istDeutsch).toBe(false);
	});

	it("liefert istDeutsch: false für leere Wortliste", () => {
		expect(pruefeSprache([]).istDeutsch).toBe(false);
	});

	it("respektiert einen individuellen Schwellwert", () => {
		const woerter = ["Forschung", "Ergebnis", "Methode", "und"]; // 1 von 4 = 25 %
		expect(pruefeSprache(woerter, 0.5).istDeutsch).toBe(false);
		expect(pruefeSprache(woerter, 0.2).istDeutsch).toBe(true);
	});
});
