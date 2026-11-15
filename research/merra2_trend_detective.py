"""
NASA Space Apps Challenge 2026: Be An Earth System Trend Detective!
Procella: MERRA-2 Temperature & Environmental Trend Analysis Pipeline

Phase 1: Data Access & Variable Validation
"""

import os
import sys
from pathlib import Path
import numpy as np
import xarray as xr
import pandas as pd
import earthaccess

# ==============================================================================
# CONFIGURATION BLOCK (All user settings defined in one place)
# ==============================================================================
CONFIG = {
    # Dataset settings
    "short_name": "M2TMNXSLV",  # MERRA-2 Monthly single-level diagnostics
    "variable": "T2M",          # 2-meter air temperature
    "convert_kelvin_to_celsius": True,

    # Temporal range for initial pipeline test (Phase 1: 3 test months)
    "test_start_date": "2024-01-01",
    "test_end_date": "2024-03-31",
    "test_count": 3,

    # Full record range (for later phases upon confirmation)
    "full_start_year": 1980,
    "full_end_year": 2024,

    # Three contrasting geographic regions (lat min/max, lon min/max)
    "regions": {
        "Arctic": {
            "lat_min": 66.5, "lat_max": 85.0,
            "lon_min": -180.0, "lon_max": 180.0,
            "description": "High-latitude polar region (Arctic amplification)"
        },
        "Amazon Basin": {
            "lat_min": -10.0, "lat_max": 5.0,
            "lon_min": -75.0, "lon_max": -50.0,
            "description": "Tropical rainforest biome (hydrological & thermal stress)"
        },
        "Mediterranean & W. Europe": {
            "lat_min": 35.0, "lat_max": 50.0,
            "lon_min": -10.0, "lon_max": 25.0,
            "description": "Temperate/subtropical climate change hotspot"
        }
    },

    # Storage paths
    "raw_dir": Path(".tmp/merra2_raw"),
    "cache_dir": Path(".tmp/cache"),
    "output_dir": Path("output"),
}


def authenticate():
    """
    Authenticates with NASA Earthdata using earthaccess.
    Searches ~/.netrc, environment variables (EARTHDATA_USERNAME, EARTHDATA_PASSWORD,
    or EARTHDATA_TOKEN), or prompts interactively.
    """
    print("\n--- [Step 1] NASA Earthdata Authentication ---")
    auth = earthaccess.login(persist=True)
    if not auth.authenticated:
        print("[!] Earthdata login failed.")
        print("    Ensure your credentials are set in ~/.netrc or as environment variables:")
        print("    EARTHDATA_USERNAME and EARTHDATA_PASSWORD (or EARTHDATA_TOKEN).")
        sys.exit(1)
    print("Authentication successful.")
    return auth


def run_phase1():
    """
    Phase 1: Data Access & Variable Validation
    1. Authenticate with NASA Earthdata.
    2. Search M2TMNXSLV for initial test granules.
    3. Download test files into temporary directory.
    4. Open with xarray to inspect coordinates, variable names, units, and grid shape.
    5. Convert T2M from Kelvin to Celsius.
    6. Print short quality check.
    """
    authenticate()

    CONFIG["raw_dir"].mkdir(parents=True, exist_ok=True)
    CONFIG["cache_dir"].mkdir(parents=True, exist_ok=True)

    print("\n--- [Step 2] Searching MERRA-2 Granules (M2TMNXSLV) ---")
    results = earthaccess.search_data(
        short_name=CONFIG["short_name"],
        temporal=(CONFIG["test_start_date"], CONFIG["test_end_date"]),
        count=CONFIG["test_count"],
    )
    print(f"Found {len(results)} granule(s) for test period {CONFIG['test_start_date']} to {CONFIG['test_end_date']}.")
    for i, g in enumerate(results, 1):
        print(f"  [{i}] {g['umm']['GranuleUR']} ({g.size:.1f} MB)")

    print("\n--- [Step 3] Downloading Test Granules ---")
    downloaded_files = earthaccess.download(results, str(CONFIG["raw_dir"]))
    print(f"Downloaded {len(downloaded_files)} file(s) into {CONFIG['raw_dir']}.")

    print("\n--- [Step 4] Inspecting with xarray ---")
    first_path = downloaded_files[0]
    ds = xr.open_dataset(first_path)

    # Confirm variable presence
    target_var = CONFIG["variable"]
    if target_var not in ds.data_vars:
        print(f"[!] Target variable '{target_var}' not found! Available variables:")
        print(list(ds.data_vars)[:15], f"... ({len(ds.data_vars)} total)")
        sys.exit(1)

    da = ds[target_var]
    orig_units = da.attrs.get("units", "unknown")
    long_name = da.attrs.get("long_name", "unknown")

    # Grid metadata
    lats = ds["lat"].values
    lons = ds["lon"].values
    times = ds["time"].values
    lat_step = abs(lats[1] - lats[0]) if len(lats) > 1 else 0
    lon_step = abs(lons[1] - lons[0]) if len(lons) > 1 else 0

    # Unit conversion: Kelvin to Celsius
    if CONFIG["convert_kelvin_to_celsius"] and orig_units.upper() == "K":
        da_celsius = da - 273.15
        da_celsius.attrs["units"] = "°C"
        da_celsius.attrs["long_name"] = f"{long_name} (Celsius)"
        current_units = "°C"
        sample_vals = da_celsius.values
    else:
        current_units = orig_units
        sample_vals = da.values

    # Check for fill / missing values
    fill_value = da.attrs.get("fmissing_value", 1e15)
    valid_mask = (sample_vals != fill_value) & (~np.isnan(sample_vals))
    missing_count = int(np.sum(~valid_mask))
    total_points = sample_vals.size

    # Print Phase 1 summary check
    print("\n" + "=" * 65)
    print("PHASE 1 SUMMARY & QUALITY CHECK")
    print("=" * 65)
    print(f"Dataset Short Name : {CONFIG['short_name']} (MERRA-2 monthly 2D diagnostics)")
    print(f"Target Variable    : {target_var} ({long_name})")
    print(f"Original Units     : {orig_units}")
    print(f"Converted Units    : {current_units} (formula: T_degC = T_K - 273.15)")
    print(f"Array Shape (t,y,x): {sample_vals.shape} (Time: {len(times)}, Lat: {len(lats)}, Lon: {len(lons)})")
    print(f"Latitude Grid      : {lats.min():.2f}° to {lats.max():.2f}° ({len(lats)} points, spacing: {lat_step:.2f}°)")
    print(f"Longitude Grid     : {lons.min():.2f}° to {lons.max():.2f}° ({len(lons)} points, spacing: {lon_step:.3f}°)")
    print(f"Time Range Sample  : {pd.to_datetime(times.min()).strftime('%Y-%m')} to {pd.to_datetime(times.max()).strftime('%Y-%m')}")
    print(f"Value Range (Min)  : {sample_vals[valid_mask].min():.2f} {current_units}")
    print(f"Value Range (Max)  : {sample_vals[valid_mask].max():.2f} {current_units}")
    print(f"Value Range (Mean) : {sample_vals[valid_mask].mean():.2f} {current_units}")
    print(f"Missing Values     : {missing_count} of {total_points} cells ({missing_count / total_points:.1%})")
    print("=" * 65)

    print("\nSelected Contrasting Regions for Phase 2:")
    for name, r in CONFIG["regions"].items():
        print(f"  - {name}: Lat [{r['lat_min']}°, {r['lat_max']}°], Lon [{r['lon_min']}°, {r['lon_max']}°] ({r['description']})")

    ds.close()
    return downloaded_files


if __name__ == "__main__":
    run_phase1()
