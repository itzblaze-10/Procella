# Resources — what each is and whether we use it

Checked 2026-11-14. "Open" means no login needed from a browser or script.

## NASA data and tools

| Resource | What it is | Access | Use in Procella |
|---|---|---|---|
| [Giovanni](https://giovanni.gsfc.nasa.gov/) | NASA web tool: menus of variables, time-series plots and downloads | Earthdata login for real use | Reference only. Link "replicate this in Giovanni" from results |
| [Hydrology Time Series](https://disc.gsfc.nasa.gov/information/tools?title=Hydrology%20Time%20Series) | GES DISC tool for hydrology time series | Earthdata login | Skip |
| [AppEEARS](https://appeears.earthdatacloud.nasa.gov/) | Subsets and transforms geospatial data, makes time series | Earthdata login, queued async jobs | Skip for live; possible offline snapshot source |
| [Climate Data Online](https://www.ncei.noaa.gov/cdo-web/) | NOAA station weather and climate archive | API token by email, paged results | Optional stretch |
| [SeaWiFS chlorophyll paper](https://ntrs.nasa.gov/api/citations/20090042747/downloads/20090042747.pdf) | Worked example: time series plus significance testing in river-influenced coastal regions | Open PDF | Method reference. Finding: regions with human impact mostly show significant negative trends; floods distort series |

## Space-agency partner resources

| Resource | What it is | Use |
|---|---|---|
| [KNMI Climate Explorer](https://climexp.knmi.nl/) | Web climate analysis tool | Human-verification wall and maintenance windows; reference only |
| [Statistical test methods to detect trends](https://medium.com/@snp.kriss/statistical-test-methods-to-detect-trends-in-time-series-data-b361a0ec530b) | Explainer on trend tests | Blocked to scripts (HTTP 403); read in a browser |
| [Guide to statistical significance](https://www.statsig.com/perspectives/a-comprehensive-guide-to-statistical-significance) | Explainer on significance | Wording for the plain-English verdicts |
| [RCM data (CSA)](https://donnees-data.asc-csa.gc.ca/) | Canadian radar satellites | Out of scope |
| [Geo.ca](http://geo.ca/) | Canadian open geospatial data | Out of scope |
| [SWOT mission](https://www.asc-csa.gc.ca/eng/satellites/swot/) | Surface-water elevation mission | Possible future variable |
| [Monitoring ecosystems from space](https://www.asc-csa.gc.ca/eng/satellites/everyday-lives/monitoring-and-protecting-our-ecosystems-from-space.asp) | Background article | Context for the write-up |
| [SAR Python tutorial](https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial) | Radar imagery with Python and QGIS | Out of scope |
| [Space Apps Connect](https://github.com/nasa/spaceapps) | Official hackathon GitHub | Questions and updates |

## Sources we actually use (not on the official list, but they fit the brief)

| Source | Why |
|---|---|
| [NASA POWER](https://power.larc.nasa.gov/) | NASA-run, MERRA-2 and CERES derived, any lat/lon, monthly and daily, open, browser-callable |
| [ORNL DAAC MODIS REST](https://modis.ornl.gov/rst/api/v1/) | MODIS land products (NDVI etc.) at a point, open, browser-callable |

The challenge allows "variables measured by missions or produced by Earth science models", and
POWER is exactly that. The write-up must say POWER values come from MERRA-2 and CERES, not direct
observation.
