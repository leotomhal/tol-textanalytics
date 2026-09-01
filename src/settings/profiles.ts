/**
 * Zielwertprofile (Konzept 4.3). Werte sind gesetzt, nicht gemessen — in
 * den Settings direkt als Zahlenfelder editierbar (Settings.ts), nicht nur
 * über eine JSON-Datei.
 */

import type { Profil } from "../analyse/types";

export const STANDARD_PROFILE: Profil[] = [
	{
		id: "pressemitteilung",
		name: "Pressemitteilung",
		zielSchulstufe: 11,
		zielSatzlaenge: 16,
		zielPassivquote: 15,
		zielNominalstil: 4,
		zielLangeSaetze: 20,
	},
	{
		id: "onlinemagazin",
		name: "Onlinemagazin",
		zielSchulstufe: 10,
		zielSatzlaenge: 15,
		zielPassivquote: 10,
		zielNominalstil: 3,
		zielLangeSaetze: 15,
	},
	{
		id: "fachtext",
		name: "Fachtext",
		zielSchulstufe: 14,
		zielSatzlaenge: 22,
		zielPassivquote: 30,
		zielNominalstil: 8,
		zielLangeSaetze: 35,
	},
	{
		// "keine Schwellen, nur Zahlen" — bewusst ohne zielX-Felder.
		id: "frei",
		name: "Frei",
	},
];

export const STANDARD_PROFIL_ID = "pressemitteilung";

export function profilListeZuRecord(profile: Profil[]): Record<string, Profil> {
	const record: Record<string, Profil> = {};
	for (const p of profile) record[p.id] = p;
	return record;
}
