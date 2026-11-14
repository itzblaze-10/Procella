import io
import numpy as np
import pandas as pd
import requests

url = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv"
text = requests.get(url, timeout=60).text
df = pd.read_csv(io.StringIO(text), skiprows=1, na_values="***")
df = df[["Year", "J-D"]].dropna()  # annual global anomaly, deg C

# Least-squares trend since 1980
recent = df[df["Year"] >= 1980]
slope, intercept = np.polyfit(recent["Year"], recent["J-D"], 1)
print("years:", len(df), "| latest full year:", int(df["Year"].iloc[-1]))
print(f"trend since 1980: {slope * 10:.3f} C per decade")
# For significance, use scipy.stats.linregress (p-value) or pymannkendall.