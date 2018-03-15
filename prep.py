# convert README to JSON string and put it in the translations file

import json, os

SRC = "README.md"
TARGET = "translations/en.json"

with open(SRC, "r") as file:
    readme = file.read()

with open(TARGET, 'r') as file:
    parsed = json.load(file)

parsed['app']['long_description'] = readme

with open(TARGET + ".tmp", "w") as file:
    json.dump(parsed, file, indent=2)

os.replace(TARGET+".tmp", TARGET)
