import earthaccess

# Search needs no login. This product is global, so no bounding box.
results = earthaccess.search_data(
    short_name="M2TMNXSLV",
    temporal=("2025-01-01", "2025-12-31"),
    count=5,
)
print(len(results), "granules")
for g in results:
    print(g["umm"]["GranuleUR"])

# Next step (downloads need a free Earthdata Login):
# earthaccess.login()
# files = earthaccess.download(results[:1], "./merra2")
# import xarray as xr; ds = xr.open_dataset(files[0])