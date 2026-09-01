/**
 * Silbenzählung (Konzept 3.1).
 *
 * Umsetzung für M1: Vokalgruppen-Heuristik (jede zusammenhängende Folge von
 * Vokalen zählt als eine Silbe). Anders als im Englischen wird im Deutschen
 * ein unbetontes End-e mitgesprochen und braucht daher keine Sonderregel.
 *
 * Trennmuster-basiert (`hyph-de-1996`, siehe Architekturübersicht 2.1) ist
 * laut Konzept das primäre Verfahren, die Vokalgruppen-Heuristik nur der
 * Fallback. Die Trennmuster-Daten (`data/hyph-de.json`, ~30 KB) liegen noch
 * nicht vor; bis dahin ist die Heuristik das einzige Verfahren. Sobald die
 * Daten verfügbar sind, wird `zaehleSilben` intern umgestellt — die Signatur
 * bleibt stabil, kein Aufrufer muss sich ändern.
 */

const VOKALE = new Set(["a", "e", "i", "o", "u", "y", "ä", "ö", "ü"]);

export function zaehleSilben(wort: string): number {
	const w = wort.toLowerCase();
	let silben = 0;
	let inVokalgruppe = false;
	for (const ch of w) {
		const istVokal = VOKALE.has(ch);
		if (istVokal && !inVokalgruppe) {
			silben++;
		}
		inVokalgruppe = istVokal;
	}
	return Math.max(silben, 1);
}
