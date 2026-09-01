import { describe, expect, it } from "vitest";
import { STANDARD_PROFILE, STANDARD_PROFIL_ID, profilListeZuRecord } from "../src/settings/profiles";

describe("STANDARD_PROFILE", () => {
	it("enthält die vier im Konzept (4.3) genannten Profile mit den dort angegebenen Werten", () => {
		const record = profilListeZuRecord(STANDARD_PROFILE);

		expect(record.pressemitteilung).toMatchObject({
			zielSchulstufe: 11,
			zielSatzlaenge: 16,
			zielPassivquote: 15,
			zielNominalstil: 4,
			zielLangeSaetze: 20,
		});
		expect(record.onlinemagazin).toMatchObject({
			zielSchulstufe: 10,
			zielSatzlaenge: 15,
			zielPassivquote: 10,
			zielNominalstil: 3,
			zielLangeSaetze: 15,
		});
		expect(record.fachtext).toMatchObject({
			zielSchulstufe: 14,
			zielSatzlaenge: 22,
			zielPassivquote: 30,
			zielNominalstil: 8,
			zielLangeSaetze: 35,
		});
	});

	it("Profil 'Frei' hat keine Zielwerte", () => {
		const record = profilListeZuRecord(STANDARD_PROFILE);
		expect(record.frei.zielSchulstufe).toBeUndefined();
		expect(record.frei.zielSatzlaenge).toBeUndefined();
		expect(record.frei.zielPassivquote).toBeUndefined();
		expect(record.frei.zielNominalstil).toBeUndefined();
		expect(record.frei.zielLangeSaetze).toBeUndefined();
	});

	it("STANDARD_PROFIL_ID verweist auf ein tatsächlich vorhandenes Profil", () => {
		const record = profilListeZuRecord(STANDARD_PROFILE);
		expect(record[STANDARD_PROFIL_ID]).toBeDefined();
	});
});

describe("profilListeZuRecord", () => {
	it("indiziert nach id", () => {
		const record = profilListeZuRecord([{ id: "x", name: "X" }]);
		expect(record.x.name).toBe("X");
	});

	it("liefert ein leeres Objekt für eine leere Liste", () => {
		expect(profilListeZuRecord([])).toEqual({});
	});
});
