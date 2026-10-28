# Trial Time Tracker

**Open the app:** https://digiacco.github.io/mocktrial/

A phone-friendly stopwatch for timing mock trials. It does what the "Trial Time Tracker" Google Sheet did and adds a live timer:

- **One stopwatch** that you can start, pause (for objections or breaks), resume, and **Record** into the selected segment. Recording selects the next empty segment.
- **Live clocks for each side** show time used and time left, including the time currently running. A side's clock turns yellow under the warning threshold and red once it goes over.
- Segments match the sheet: openings, direct/cross/redirect/recross for 4 witnesses, closings, and rebuttal. Witnesses 1–2 are called by the Prosecution/Plaintiff and 3–4 by the Defense. Cross and recross count against the side doing the crossing. Recross is skipped when Record moves to the next segment; tap it to use it.
- **+ Add segment** (bottom of the list) adds any other timed part of a trial. Pick which side it counts against, or "Neither side" to just record it. Tap ✎ on an added segment to rename or delete it. Added segments stay when you start a new trial.
- Tap a time to fix it by hand, tap a witness header to type the witness's name, and use **Undo** to take back the last record.
- **Copy for Slack** (or **Share…** on phones) produces the same summary as the sheet:

  ```
  *Round 2 time check*
  Prosecution/Plaintiff: 60:10 used, 14:50 left
  Defense: 59:56 used, 15:04 left

  *By segment*
  Prosecution/Plaintiff Opening: 5:34
  ...
  ```

- Settings (gear icon): round name, time limit per side, warning threshold, the first side's name (e.g. "Prosecution" or "Plaintiff"), and **New trial**.
- **On a computer:** keyboard shortcuts are <kbd>Space</kbd> start/pause, <kbd>Enter</kbd> record, <kbd>↑</kbd>/<kbd>↓</kbd> change segment, <kbd>U</kbd> undo, <kbd>C</kbd> copy for Slack. On wide screens the Slack summary sits beside the segment list.
- Works offline after the first visit. Everything is saved on the phone, so a running timer stays correct if the screen locks or the app is closed.

## Installing on a phone

Open the site's URL, then:

- **iPhone (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** ⋮ menu → **Add to Home screen** / **Install app**.

## Hosting

It's a static site with no build step. To host it on GitHub Pages: repo **Settings → Pages → Deploy from a branch → `master` / root**. The URL will be `https://digiacco.github.io/mocktrial/`.

When you change any file, bump `CACHE` in `sw.js` so installed copies pick up the update.
