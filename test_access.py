import earthaccess

# Asks for your Earthdata Login once, then saves it to ~/.netrc
earthaccess.login(persist=True)

# Find and download one small elevation tile (New York City)
results = earthaccess.search_data(short_name="SRTMGL1",
                                  bounding_box=(-74.3, 40.5, -73.7, 40.95), count=1)
files = earthaccess.download(results, "./test")
print("Downloaded:", files)