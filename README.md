# VoiceRDR2

A browser-based dialogue asset builder for the **Nightwalker** Red Dead Redemption 2 Story Mode mod.

VoiceRDR2 converts MP3/WAV voice takes into the exact audio format used by Nightwalker, matches recordings against the authored dialogue catalog, keeps multi-line conversations coherent, and exports a game-ready dialogue pack without uploading voice files to a server.

## What it does

- Drag in any number of `.mp3` or `.wav` voice takes.
- Decodes and processes everything **locally in the browser**.
- Converts to **44.1 kHz / mono / 16-bit PCM WAV**.
- Optional edge-silence trimming and safe peak normalization.
- Extracts a draft transcript from filenames such as `Vam-2026-09-13-04-35-Men-pray-for-eternal-life...mp3`.
- Loads the current Nightwalker dialogue catalog directly from `matthewcodergamer/Rdr2vampire` and matches recordings to stable sequence/audio IDs.
- Lets you organize unmatched lines into RDR2/Nightwalker contexts such as QUESTION, CHALLENGE, LEAVE, aim, melee, firearm, punch, hit/miss, approach, and withdrawal.
- Groups selected takes into one authored conversation so randomization happens **between complete sequences**, never between unrelated individual sentences.
- Warns about unsafe/duplicate IDs and dialogue timing that would cut off a WAV.
- Can export a patched `Nightwalker.dialogue` when an existing line needs a longer duration.
- Builds a single ZIP containing:
  - `audio/*.wav`
  - `Nightwalker.audio`
  - `Nightwalker.voice.dialogue` when custom supplemental sequences are present
  - patched `Nightwalker.dialogue` when matched audio needs timing changes
  - batch inventory JSON
  - install note
- Works as an installable PWA and caches its own UI after first load.

## Run locally

No build step is required.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## GitHub Pages

The included workflow publishes the static site from `main`. In repository settings, set **Pages → Source** to **GitHub Actions** if it is not already enabled.

## Nightwalker output contract

Nightwalker voice assets are installed beside `Nightwalker.asi`:

```text
Nightwalker.asi
Nightwalker.ini
Nightwalker.dialogue
Nightwalker.voice.dialogue
Nightwalker.audio
audio/
  nw.audio.sd....wav
```

`Nightwalker.dialogue` remains the authoritative base script. Supplemental custom sequences belong in `Nightwalker.voice.dialogue`. Stable audio IDs map through `Nightwalker.audio` to relative WAV paths.

## Privacy

Audio conversion happens entirely in the browser using Web Audio APIs. Voice files are not uploaded to this repository or to a VoiceRDR2 backend. The only network request the app makes by default is to read the current public Nightwalker dialogue catalogs from GitHub for matching; you can also import a catalog file manually.

## Scope

VoiceRDR2 prepares dialogue assets. It does not generate voices, clone actors, modify RDR2 game files, or provide online/multiplayer functionality.
