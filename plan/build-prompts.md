# Build-Prompts (Transparenz-Log)

> Dokumentiert die Prompts, mit denen dieses Spiel entwickelt wurde — für volle
> Nachvollziehbarkeit (Setup → Build → Deploy). Ergänzt den Push-Verlauf.

## 1. Setup (einmalig, von Sebastian)
Sebastians Setup-Prompt aus dem `README.md` — richtet Auto-Push ins eigene Repo +
projekt-eigene `CLAUDE.md` ein. (Wortlaut: siehe `README.md`, Abschnitt „Setup-Prompt".)

## 2. Build-Kickoff
```text
Lies plan/spielkonzept.md und plan/mitglieder.md komplett. Bau daraus das Minigame
"Duck Rescue" mit Vanilla HTML5 Canvas + JS (keine Datenbank, keine Frameworks).

Wichtig:
- Genau in der Reihenfolge unter "Bauplan" (MVP zuerst, dann Juice).
- Texte 1:1: Fang-Toast "Danke für die Rettung, [Name]",
  Endscreen-Überschrift "Diese wertvollen Mitglieder wurden gerettet".
- Sounds liegen in assets/: quak.mp3 (beim Fangen einer Ente) und
  donner.mp3 (beim caveman-Gewitter). Relative Pfade.
- Sebastian-"Gott" am oberen Ufer als gezeichnete Canvas-Figur
  (Wolke + orangener Anthropic-Sunburst-Heiligenschein), schaut auf den Manikin.
- Mitglieder nur mit Vorname + Rolle (DSGVO).
- Nach JEDEM fertigen Schritt committen + pushen.

Fang mit Schritt 1 (Gerüst) an und zeig mir das Ergebnis, bevor du weitermachst.
```

## 3. Weiterbauen
Nach jedem gezeigten Schritt: kurzer Folge-Prompt („passt, mach Schritt 2 weiter" usw.),
bis alle Bauplan-Schritte durch sind. Push nach jedem Schritt.

## 4. Deploy (am Ende, von Sebastian)
Sebastians Deploy-Prompt aus dem `README.md` — Vercel-Deploy + Live-Verifikation.
(Wortlaut: siehe `README.md`, Abschnitt „Deploy-Prompt".)

---
### Assets (vorab erzeugt)
- `assets/quak.mp3` — Quietscheente, beim Fangen (ElevenLabs).
- `assets/donner.mp3` — Donner, beim caveman-Gewitter (ElevenLabs).
- Sebastian-Gott: per Canvas gezeichnet (Bild-Generator war nicht verfügbar).
