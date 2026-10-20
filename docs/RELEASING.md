# Releases

## Automatischer Ablauf

1. Commits auf `main` folgen [Conventional Commits](https://www.conventionalcommits.org/de/)
   (`feat: …`, `fix: …`, `deps: …`).
2. Der Workflow **Release** (`.github/workflows/release.yml`) pflegt mit
   [release-please](https://github.com/googleapis/release-please) automatisch einen
   „Release-PR“: Versionssprung in `package.json`, `src-tauri/Cargo.toml`/`Cargo.lock` und
   Einträge in `CHANGELOG.md`.
3. **Merge des Release-PRs** ⇒ Tag `vX.Y.Z` + GitHub-Release werden erstellt.
4. Im selben Workflow laufen die Tests erneut, dann baut
   [tauri-action](https://github.com/tauri-apps/tauri-action) die Installer und hängt sie an das Release:
   - macOS: Universal-`.dmg` (Apple Silicon + Intel)
   - Windows: NSIS-`setup.exe` und `.msi` (x64)
   - Linux: `.AppImage`, `.deb`, `.rpm`

Ein bestehender Tag lässt sich über *Actions → Release → Run workflow* (Eingabe `tag`) neu bauen.

Jeder Pull Request baut über **CI** ebenfalls Installer für alle Plattformen; diese liegen 14 Tage
als Artefakte am Workflow-Lauf (zum Testen vor dem Merge).

> Damit release-please PRs öffnen darf: *Settings → Actions → General → Workflow permissions*
> → „Read and write permissions“ und „Allow GitHub Actions to create and approve pull requests“.

## Code-Signing (optional, empfohlen)

Ohne Zertifikate entstehen funktionsfähige, aber **unsignierte** Builds (Warnung beim ersten
Start). Sobald die folgenden Repository-Secrets gesetzt sind, wird automatisch signiert:

### macOS (Developer ID + Notarisierung)

| Secret | Inhalt |
| ------ | ------ |
| `APPLE_CERTIFICATE` | Developer-ID-Application-Zertifikat als `.p12`, base64-kodiert |
| `APPLE_CERTIFICATE_PASSWORD` | Passwort der `.p12` |
| `APPLE_SIGNING_IDENTITY` | z. B. `Developer ID Application: Firma (TEAMID)` |
| `APPLE_ID`, `APPLE_PASSWORD` | Apple-ID und app-spezifisches Passwort (Notarisierung) |
| `APPLE_TEAM_ID` | Team-ID |

### Windows (Authenticode)

| Secret | Inhalt |
| ------ | ------ |
| `WINDOWS_CERTIFICATE` | Code-Signing-Zertifikat als `.pfx`, base64-kodiert |
| `WINDOWS_CERTIFICATE_PASSWORD` | Passwort der `.pfx` |

(Für Cloud-HSM-Zertifikate wie Azure Trusted Signing kann `bundle.windows.signCommand` in
`tauri.conf.json` verwendet werden.)

## Prüfregeln aktualisieren

1. Neue Version/URL in `rules/sources.json` eintragen (EN 16931: `ConnectingEurope/eInvoicing-EN16931`,
   XRechnung: `itplr-kosit/xrechnung-schematron`, Peppol: `OpenPEPPOL/peppol-bis-invoice-3`).
2. `pnpm rules:build --update-lock` – lädt, verifiziert und aktualisiert `rules/sources.lock.json`.
   Schlägt ein `patch` fehl, Upstream-Änderung prüfen und Patch anpassen oder entfernen.
3. `pnpm test -u` und die Änderungen an `tests/__snapshots__/validate.test.ts.snap` reviewen.
4. Als `feat: …`/`fix: …` committen – der nächste Release enthält die neuen Regeln.

## Version anzeigen

Die App-Version kommt aus `package.json` (`tauri.conf.json` verweist darauf).
