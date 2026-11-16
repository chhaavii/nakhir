# Nakhir — نذير

**Early warning for desert water sources.** UAE Hackathon 2026 · challenge **W-001**.

Herders find out a source has failed when the trough is already empty. Nakhir reads rainfall,
heat, the falling water table, satellite vegetation and moisture, and what people on the ground
report — then says which source will fail, **when**, how confident it is, and **where to go instead**.

---

## Live

| | |
|---|---|
| **App** | https://site-ad9445eb5749462bab140ca168e6b154.freebuff.page |
| **Operator dashboard** | https://site-ad9445eb5749462bab140ca168e6b154.freebuff.page/dashboard |
| **Phone app (installable PWA)** | https://site-ad9445eb5749462bab140ca168e6b154.freebuff.page/app |
| **Why Nakhir is different** | https://site-ad9445eb5749462bab140ca168e6b154.freebuff.page/why |
| **Raw API** | https://site-ad9445eb5749462bab140ca168e6b154.freebuff.page/status |
| Preview build | https://site-650d870bd0d24059960330bb9dcbb1ba.freebuff.page |

The dashboard is live from the production environment: 10 sources, 3 CRITICAL, 4 WATCH,
1 abstained, scored on every request.

---

## The finding

Rainfall across these ten sources is **more than double** the ten-year normal for the same
coordinates — and **3 sources are still failing**. Rain is not the driver. **Extraction is.**
A rainfall-only model would have seen nothing here. Nakhir also **abstains on 1 source** because
the data is too thin to be honest about.

---

## What makes it different from a dashboard

An operator dashboard answers *"what is happening now?"*. Nakhir answers *"what will happen next,
how sure am I, and where do we move the herd?"* — and it says **"I don't know"** out loud when it
isn't sure. See `/why` for the side-by-side.

- **Predictive, not reactive** — failure windows in days, with an uncertainty band.
- **Honest abstention** — below 0.35 confidence the engine refuses to warn and marks the source UNKNOWN.
- **Routing** — every critical source is paired with its nearest working alternative and the distance.
- **Ground truth** — herder reports with confirm/deny voting and 72 h decay.
- **Warns on transition** into CRITICAL, so a week-old failure does not buzz a phone every minute.

---

## The seven features

| # | feature | source | honest status |
|---|---|---|---|
| 1 | rainfall deficit vs 10-year normal | ERA5 via Open-Meteo | **live** |
| 2 | heat days > 40 °C (90 d) | ERA5 via Open-Meteo | **live** |
| 3 | water-table drawdown | synthetic series | **simulated** (no public well-level feed for the UAE) |
| 4 | pump depth / headroom | synthetic | **simulated** |
| 5 | salinity | synthetic | **simulated** |
| 6 | vegetation (NDVI) + moisture (NDWI) | Sentinel-2 L2A, Earth Search STAC | **live** |
| 7 | **surface moisture (SAR VV/VH)** | Sentinel-1 RTC, Planetary Computer | **live** |

### Feature 7 — SAR surface moisture

`data/pull_sar.py` reads C-band VV and VH at each well coordinate and derives the VV/VH ratio.
Co-polarised VV is dominated by surface roughness and dielectrics; cross-polarised VH by volume
scattering in canopies. Their ratio cancels incidence angle, gross terrain and calibration, and
keeps the part that responds to surface wetness.

Two speckle mitigations: a **40 m circular mean** (tens of independent looks) and a **3-scene
temporal median** per source.

The engine does **not** consume the raw ratio. Absolute VV/VH spans 2.1 to 77 across this network
because it mixes moisture with structure, so a threshold would be meaningless. It consumes:

```
log_dev = log10( ratio_med3 / that source's own 90-day median ratio )
```

which is scale-free and reads *"drier than this place normally is"*. The log is taken in the
pipeline, not the engine, so the JS and Python runtimes cannot drift on a transcendental.

**This is a surface proxy, not groundwater.** C-band sees the top few centimetres; it cannot see a
water table at 20–90 m. It never touches `level_m` and is never described as an aquifer reading.
A source whose baseline is more than 6× the network median is flagged `suspect` (corner reflector —
a building or metal trough inside the buffer) and the engine ignores the feature for it.

---

## Data honesty

Every field carries a badge: `live` (pulled from the source), `stale` (fetch failed, last good
value kept), `simulated` (no public feed exists). `/satellites` reports each feed's operator,
instrument, access route, refresh cadence, physics, covered-source count, and — for anything not
wired — the exact blocker.

- Sentinel-2 L2A via **Earth Search STAC** — no API key, 10/10 sources have a real scene.
- Sentinel-1 RTC via **Planetary Computer** — anonymous SAS token, 10/10 sources, ~6 passes / 90 d.
- Copernicus DEM GLO-30 on public S3 — elevation 40–356 m, slopes 0.2–18° across the network.
- NASA GRACE-FO and Landsat TIRS are **queued with their blockers written down**, not faked.

---

## Alert channels

| channel | how | env |
|---|---|---|
| SMS | Twilio or Infobip | `ALERT_SMS_TO` + provider keys |
| Discord | webhook post on CRITICAL transition | `DISCORD_WEBHOOK_URL` |
| Voice message | Infobip TTS | `INFOBIP_API_KEY`, `INFOBIP_VOICE_TO`, `INFOBIP_VOICE_FROM` |
| Companion push | Web Push, VAPID | `VAPID_PRIVATE_JWK` |
| Phone call | Infobip voice | same as voice |

Warnings are composed in **English, العربية and हिन्दी**. A channel that is not configured reports
itself as such in the API; the UI shows only whether the warning is live.

---

## Architecture

```
engine/water-core.js    the decision engine (JS, runs in the Worker and the browser)
engine/water_core.py    line-for-line Python mirror
engine/parity_test.py   asserts both runtimes return identical scores/bands/forecasts
data/make_sources.py    ERA5 rainfall + heat -> data/sources.json
data/pull_satellite.py  Sentinel-2 NDVI/NDWI (STAC, no key)
data/pull_sar.py        Sentinel-1 VV/VH surface moisture + DEM
deploy/worker.js        Cloudflare Worker: routes, D1, channels, alert pass
deploy/public/          landing, dashboard, phone app, why page
dev/server.mjs          local server that runs the real Worker module
```

One engine, two runtimes, asserted equal. `bash deploy/build.sh` assembles the bundle.

---

## Run locally

```bash
bash deploy/build.sh
node dev/server.mjs            # http://localhost:3000

python3 data/make_sources.py   # ERA5 (rate-limited: backs off and retries)
python3 data/pull_satellite.py # Sentinel-2, needs pystac-client + rasterio
python3 data/pull_sar.py --days 90 --show   # Sentinel-1, needs pystac-client + rasterio + pandas

python3 engine/parity_test.py          # PARITY OK
python3 engine/uae_conditions_test.py  # UAE CONDITIONS OK
```

### API

`/status` · `/sources` · `/sources.geojson` · `/satellites` · `/backtest` · `/config.json` ·
`/weather.json` · `GET|POST /reports` · `/reports/:id/confirm|deny` · `/alerts/scan` ·
`/push/subscribe` · `/push/test` · `/sms-test` · `/discord-test` · `/voice`

---

## Status

- 10 sources, 3 CRITICAL, 4 WATCH, 1 abstained.
- Parity: 16 vectors, max score delta 0.000000, 0 band/rule mismatches.
- SAR: 10/10 sources, 6 scenes each, real backscatter and DEM.

Every warning carries a confidence figure, and the engine refuses to warn when it is not sure.
