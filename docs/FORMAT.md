# VoiceRDR2 export format

## WAV

Each exported voice asset is:

- RIFF/WAVE
- PCM (`WAVE_FORMAT_PCM`)
- 44,100 Hz
- mono
- 16 bits per sample

The converter downmixes decoded source channels to mono, resamples with linear interpolation, optionally trims edge silence, and optionally normalizes the peak to approximately -1.5 dBFS.

## `Nightwalker.audio`

```text
schema=1
asset=nw.audio.sd.example.01|audio/nw.audio.sd.example.01.wav
```

## `Nightwalker.voice.dialogue`

Custom lines use Nightwalker's existing schema:

```text
schema=1
line=<sequence>|<line-id>|<speaker>|<text-id>|<audio-id>|<duration-ms>|<subtitle text>
```

Sequence IDs are deliberately family-prefixed. For example, variants under:

```text
saint_denis.choice.leave.*
```

participate in the LEAVE family. Lines that share the exact same sequence ID remain together and play in authored order. The game randomizes complete sequences through its non-repeating family selector.

## Timing

VoiceRDR2 sets exported supplemental duration to:

```text
processed WAV duration + tail buffer
```

For a matched base-catalog line, the tool can export a patched base catalog when the generated WAV would outlast the existing authored duration.
