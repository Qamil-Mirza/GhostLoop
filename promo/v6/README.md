# GhostLoop — promo (v6)

A 35-second, 1920×1080 / 30 fps cut that adds AI-generated 3D hero shots of the mascot to the v5 film. The product beats stay as v5's GSAP animation, because generated video can't render the plan-picker UI and its copy reliably. Four Higgsfield shots replace v5's flat swarm and logo collapse, and add a cold open.

- Final video: `output/ghostloop-promo-v6.mp4`
- Contact sheet: `output/storyboard-v6.jpg`
- Score: `output/v6/score-v6.wav`

## Story

| Film time | Shot | Source | Caption |
| --- | --- | --- | --- |
| 0–4.4 | A ghost phases out of a laptop at night; cut closer | Higgsfield A | Your first users are *ghosts.* |
| 4.0–9.6 | Drop the zip, the app builds | v5 0–5.6 | Drop in your app. / We build it. |
| 9.1–13.7 | The swarm spirals around a browser window and dives in | Higgsfield B (circle-open in) | AI testers. *Real browser.* |
| 13.3–26.1 | Stuck, three pins, three fixes, approve, retest, 3 → 0 (last frame held 0.9 s) | v5 12.6–24.5 (fade-white in) | v5 captions |
| 25.8–29.4 | The three testers high-five inside the coral ring | Higgsfield C (zoom in) | — |
| 28.9–35.1 | The hero mascot waves; wordmark and tagline on the right | Higgsfield D + overlay (last frame held 1.2 s) | ghostloop · Your first users, before your first real user. |

The UI, friction points, and the 3 → 0 count are illustrative, as in v5.

## Higgsfield shots

Keyframes are `gpt_image_2_6` (16:9) with the dashboard mascot (`apps/dashboard/public/assets/ghostloop-mascot.png`) as the image reference. They are animated with `kling3_0_turbo` at 1080p for 5 s, using the keyframe as `start_image`. The Starter plan can't use Kling 3.0 Pro, and Turbo was the cheapest model that met the quality bar. Cost: 4 × 10 credits for video plus 8 × 0.25 for keyframes, 42 credits in total.

| Shot | Keyframe job | Video job | Motion prompt (short) |
| --- | --- | --- | --- |
| A | `b2665ef8-2d8b-49d0-ab51-5744382d5663` | `b43ffca5-25fd-41b9-8731-a6ed30b9fb5e` | push-in; ghost finishes phasing out of the screen, floats forward, blinks, tilts head |
| B | `1af3e0f9-4eef-44ce-8271-31ba9a7c5dc5` | `269feddb-3c04-4c66-964d-7ec4c0ca63e6` | swarm spirals and accelerates; ghosts dive into the window, which flares |
| C | `80a505dc-1184-4d8a-bb55-76d652368d5a` | `1d99550a-d632-452d-90e3-9445a1f6cd3e` | high-five and cheer in the coral ring; ring rotates; confetti; slow pull-back |
| D | `ad041e72-83e6-4c60-a5de-3bf8708f21a8` | `9dbd3a30-488c-4c5d-adad-b878dcb044b6` | locked-off; idle bob, blink, small wave, smile; right side stays empty |

Every keyframe prompt asks for: premium stylized 3D (soft clay-like matte), the reference ghost rebuilt in 3D (matte white body, wavy hem, black oval eyes, coral `#ee7375` cheeks, curled loop tail), cream `#f7f7f2` or ink `#202825` settings, and "No text, no logos, no letters." Brand text is only ever added in the overlay, never generated.

The rendered clips live in `output/v6/clips/{A,B,C,D}.mp4` and keyframes in `output/v6/keyframes/`. Both are git-ignored. The clips are also in the Higgsfield library under the job IDs above.

## Build

Requires the v5 render (`output/picture-v5.mp4`, `output/soundtrack-v5.wav`; see `../README.md`), the four clips, Google Chrome, Python 3 with numpy, and FFmpeg.

```sh
node promo/v6/compose.mjs
ffmpeg -v error -i promo/output/ghostloop-promo-v6.mp4 -f null -
ffmpeg -y -v error -i promo/output/ghostloop-promo-v6.mp4 -vf "fps=1,scale=480:-1,tile=6x6:padding=4:color=0x111111" -frames:v 1 promo/output/storyboard-v6.jpg
```

`compose.mjs` fails if any cut lacks a real transition, or if the rendered picture length differs from the timeline.

The root README embeds a GIF of this cut at `docs/media/ghostloop-promo.gif`: 720 px wide, 10 fps, a 128-color palette, about 15 MB. The 3D gradients cost more in GIF than v5's flat art, so this is smaller and lower in frame rate than v5's GIF. Regenerate it after a new render:

```sh
ffmpeg -y -i promo/output/ghostloop-promo-v6.mp4 -vf "fps=10,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 docs/media/ghostloop-promo.gif
```

## Edit

- `compose.mjs`: the timeline (`SEGMENTS`: source, in-point, length, hold, transition). It renders the overlays, runs the score, builds the FFmpeg graph, and muxes. Every other time is derived from `SEGMENTS`.
- `overlay.html`: captions (same type and motion as v5) and the end-card wordmark, sampled frame by frame into transparent PNGs. The caption in/out times there must fit the segment lengths.
- `score.py`: places v5's score under the v5 segments, so its sound design stays frame-synced. New cues for the Higgsfield shots use v5's synth helpers (loaded from `../audio.py`) on a separate bus, leveled to the v5 groove. It reads `output/v6/timeline.json`.
