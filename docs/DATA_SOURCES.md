# Free / Public OSINT Data Sources — East Asia

Inventory of freely accessible feeds relevant to the Taiwan Strait and Korean
peninsula. "Free" here means no paid plan required; some still need account
registration for an API key.

## News & event streams

| Source | Coverage | Format | Notes |
|---|---|---|---|
| [GDELT 2.0](https://www.gdeltproject.org/data.html) | Global, every 15 min | CSV, JSON, BigQuery | Geocoded event records (CAMEO codes). Best single starting point. |
| [Reuters World](https://www.reuters.com/world/asia-pacific/) | Asia-Pacific | RSS / scraping | Authoritative but heavily editorial. |
| [Yonhap News](https://en.yna.co.kr/) | Korean peninsula | RSS | South Korean state wire. |
| [NHK World](https://www3.nhk.or.jp/nhkworld/) | Japan + region | RSS | Japanese state broadcaster. |
| [CNA Focus Taiwan](https://focustaiwan.tw/) | Taiwan | RSS | Taiwan state wire (English). |
| [Kyodo News](https://english.kyodonews.net/) | Japan | RSS | |
| [38 North](https://www.38north.org/) | North Korea | RSS | DPRK-focused analysis, Stimson Center. |
| [NK News](https://www.nknews.org/) | North Korea | RSS / paywall | Some content free; subscription for full. |

## Government / military press

| Source | Coverage | Notes |
|---|---|---|
| [Taiwan MND](https://www.mnd.gov.tw/) | Daily PLA activity in Taiwan ADIZ | English summary published daily. Scrape. |
| [Republic of Korea JCS](https://www.jcs.mil.kr/) | DPRK launches, exercises | Press releases. |
| [Japan MOD scrambles](https://www.mod.go.jp/en/d_act/ryouku/) | Monthly fighter scramble stats | PDF; lagging indicator. |
| [Japan Coast Guard](https://www.kaiho.mlit.go.jp/) | CCG incursions near Senkaku | Updates daily. |
| [US Indo-Pacific Command](https://www.pacom.mil/Media/News/) | US posture in region | Press releases. |
| [USFK](https://www.usfk.mil/) | US Forces Korea | |

## Aviation (ADS-B)

| Source | Access | Notes |
|---|---|---|
| [OpenSky Network](https://opensky-network.org/apidoc/) | Free REST API; rate-limited unless registered. Generous for academic. | Best free starting point. |
| [ADSBexchange](https://www.adsbexchange.com/data/) | Free tier with rate limits | Less filtering than commercial trackers. |
| [airframes.io](https://airframes.io/) | ACARS / VHF demodulated radio | Niche but useful for military air traffic. |

## Maritime (AIS)

| Source | Access | Notes |
|---|---|---|
| [AISHub](https://www.aishub.net/) | Free if you contribute an AIS feed | Highest-quality free option. |
| [Global Fishing Watch](https://globalfishingwatch.org/) | Free for research | Useful for "dark fleet" / illegal fishing in Yellow Sea. |
| [MarineTraffic](https://www.marinetraffic.com/) | Free tier limited | Hover-only data; not great for programmatic use. |
| [VesselFinder](https://www.vesselfinder.com/) | Free tier limited | Similar to MarineTraffic. |

## Satellite / thermal

| Source | Access | Notes |
|---|---|---|
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/) | Free with API key | Thermal anomalies; near-real-time. Good for Yongbyon, refineries, fires. |
| [Sentinel Hub / Copernicus](https://www.copernicus.eu/en) | Free tier | True-color and SAR imagery. |
| [Planet Labs](https://www.planet.com/) | Education tier | High-cadence imagery; access via research programs. |
| [Skywatch / EarthCache](https://www.skywatch.com/) | Free academic | Multi-provider imagery on demand. |

## Seismic / nuclear

| Source | Access | Notes |
|---|---|---|
| [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/) | Free | Detects DPRK underground nuclear tests via seismic signatures. |
| [CTBTO Open Data](https://www.ctbto.org/) | Limited public access | International Monitoring System data. |

## Prediction markets / sentiment

| Source | Access | Notes |
|---|---|---|
| [Manifold Markets](https://manifold.markets/api) | Free API | Has multiple Taiwan/Korea contingency markets. |
| [Polymarket](https://docs.polymarket.com/) | Free API | Real-money markets; some Asia-Pacific. |
| [Metaculus](https://www.metaculus.com/api/) | Free API | Forecasting community. |

## Aggregator / analytical layers

| Source | Notes |
|---|---|
| [ACLED](https://acleddata.com/) | Free academic; armed conflict events. |
| [ICEWS](https://dataverse.harvard.edu/dataverse/icews) | Historical only since 2020. |
| [Lowy Asia Power Index](https://power.lowyinstitute.org/) | Annual snapshots. |
| [CSIS China Power Project](https://chinapower.csis.org/) | Long-form analysis. |
