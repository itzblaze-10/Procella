import earthaccess

# The JPL mascon record is one NetCDF file covering 2002 to present
results = earthaccess.search_data(
    short_name="TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4",
    count=5,
)
print(len(results), "file(s)")
for g in results:
    print(g["umm"]["GranuleUR"])

# earthaccess.login()
# path = earthaccess.download(results, "./grace")[0]
# import xarray as xr; print(xr.open_dataset(path))