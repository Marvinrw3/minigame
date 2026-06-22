# Duck Rescue — Spielkonzept & Bauplan

> Arbeitstitel. SKAILE Academy Building Challenge. Abgabe: Di 18:00.
> Stack: Vanilla HTML5 Canvas + JS. Deploy: Vercel (statisch).
> Pflicht-Vorgabe der Challenge: eine Quietscheente muss vorkommen. ✓ (= Kern des Spiels)

## Idee in einem Satz
Du bist der **Manikin** (ein Claude-Code-Icon mit Angel) und rettest in **60 Sekunden** so viele **Community-Mitglieder** (Enten mit Namen) wie möglich aus dem See — und meidest die **giftigen Claude-Code-Tools** im Wasser.

## Warum das gewinnt (Wertung: funktioniert · kreativ · sauber)
- **Kreativ:** echte Community-Namen + echte Skills/MCPs/Plugins als Gegner = Insider-Humor, den genau diese Jury feiert.
- **Funktioniert:** klarer 60s-Loop mit Start → Spiel → Score → Endscreen.
- **Sauber:** kleiner, klar strukturierter Vanilla-JS-Scope.

## Spielablauf
1. **Start-Popup (Anleitung):** kurz erklären — wer du bist (Manikin), Ziel (Mitglieder retten), Gefahr (giftige Tools nicht angeln), 60 Sekunden, Sebastian schaut zu. Button „Start".
2. **Spiel (60s):**
   - Am Steg/oben: der **Manikin** mit Angel. **Maus zielen + Klick = Angel auswerfen/einholen.**
   - Im See schwimmen **Enten** (Mitglieder, Name überm Kopf) + **giftige Floater** (echte Skill-/MCP-/Plugin-Namen).
   - **Ente fangen:** +Punkte, **Quak-Sound** 🦆, kurzer Toast **„Danke für die Rettung, [Name]"**. Mitglied wird als „gerettet" gemerkt.
   - **Giftiges fangen (jedes MCP/Plugin/Skill):** Minuspunkte **+ Gewitter** (Blitz + Donner-Sound + kurzer Sicht-Debuff) **+ Sebastian wird sauer und spuckt Feuer** — klares „du hast was falsch gemacht"-Feedback. **`caveman`** = die heftigste Variante (Bildschirm dunkel, längerer Sicht-Debuff ~3–4s).
   - **Sebastian** sitzt als „Gott" am gegenüberliegenden Ufer und reagiert sichtbar: strahlt/nickt zufrieden bei jeder Rettung, **wird sauer + spuckt Feuer bei jedem Fehlfang** (Gewitter zieht auf).
   - Timer + Score sichtbar.
3. **Ende (nach 60s) — Popup:** Überschrift **„Diese wertvollen Mitglieder wurden gerettet"**, darunter die Liste der geretteten Mitglieder mit **Name + Beruf/Selbstvorstellung**, dazu die Endpunktzahl. Button „Nochmal".

## Texte (1:1 so verwenden)
- Fang-Toast: `Danke für die Rettung, [Name]`
- Endscreen-Überschrift: `Diese wertvollen Mitglieder wurden gerettet`

## Entitäten
- **Manikin** — Spielfigur (Claude-Code-Icon, oranger Anthropic-Look) mit Angel. Maus-gesteuert.
- **Enten (Mitglieder)** — Daten aus `plan/mitglieder.md` → im Code als Array (`name`, `vorstellung`). Name schwebt überm Kopf.
- **Giftige Floater** — echte Namen aus Marvins Setup, „giftig" gestylt (grünes Glühen/Blubbern). **Jeder gefangene Floater löst Gewitter + Minuspunkte + Sebastians Feuer-Reaktion aus.** Auswahl:
  `caveman` (heftigstes Gewitter ⚡) · `council` · `grill-me` · `nano-banana` · `firecrawl` · `n8n` · `meta-ads` · `playwright` · `superpowers` · `claude-ads` · `claude-seo`
  → Build-Session darf aus dieser Liste wählen/ergänzen. **`caveman` = stärkster Effekt, alle anderen lösen ein kürzeres Gewitter aus.**
- **Sebastian** — „Gott"-Figur am Ufer mit 2 Zuständen: **zufrieden** (strahlt/nickt) bei Rettung, **sauer + Feuer spuckend** bei jedem Fehlfang (begleitet das Gewitter).

## Bauplan (MVP zuerst, dann Juice — nach JEDEM Schritt committen + pushen)
1. **Gerüst:** Canvas, See-Hintergrund, Manikin, Maus-Steuerung, 60s-Timer, Score-Anzeige.
2. **Enten:** spawnen + schwimmen, Namen überm Kopf, Fang-Logik → +Punkte + Toast „Danke für die Rettung, [Name]".
3. **Giftige Floater:** spawnen, Fang → Minuspunkte **+ Gewitter (Blitz + Donner-Sound) + Sebastian wird sauer/spuckt Feuer** bei jedem Fehlfang.
4. **Start-Popup** (Anleitung) + **Endscreen** (Galerie „Diese wertvollen Mitglieder wurden gerettet" + Score + Nochmal).
5. **Juice:** Quak-Sound beim Fangen, Gewitter bei jedem Fehlfang (`caveman` = heftigstes/längstes), Sebastian-Reaktionen (zufrieden ↔ sauer/Feuer), Partikel/Screenshake.
6. **Politur:** Start-/Endscreen visuell aufwerten (gern mit Skill `frontend-design` / `impeccable` / `ui-ux-pro-max`), Balancing (Spawn-Raten, Punkte), Sound-Lautstärke.
7. **Extras nur bei Restzeit:** Highscore (localStorage), Combo-Multiplikator.

## Assets
- **Sounds (liegen in `assets/`):** `quak.mp3` (beim Fangen einer Ente) + `donner.mp3` (Gewitter bei jedem Fehlfang). **Relative Pfade!**
- **Grafik:** einfache, saubere Canvas-Zeichnungen. Manikin im Claude-Code-Look. **Sebastian-Gott = gezeichnete Canvas-Figur** (Wolke + orangener Anthropic-Sunburst-Heiligenschein), schaut auf den Manikin runter.

## Tech & Deploy
- Vanilla **HTML5 Canvas + JS**, eine Seite (`index.html` / `style.css` / `game.js`), keine Datenbank.
- Deploy am Ende mit Sebastians **Deploy-Prompt** → Vercel (statisch). Pfade **case-sensitive + relativ** prüfen (sonst bricht es live).

## Challenge-Regeln (nicht vergessen)
- Nach **jedem Schritt committen + pushen** (Progress muss sichtbar sein → CLAUDE.md erzwingt das).
- Solo bauen. Öffentliches Repo. **Spielbarer Link + Repo-Link bis Di 18:00** in den Abgabe-Thread.
