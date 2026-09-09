#!/usr/bin/env python3
# Run: python3 convert_pathurl_win_to_mac.py input.xml [output.xml]
#   input.xml  - the Windows-exported Premiere XML to convert
#   output.xml - optional; defaults to "<input>_mac.xml" if omitted
#
# Converts Windows-style <pathurl> network-drive paths (e.g.
# file://localhost/K%3a/Yes_Sdarot/...) to Mac-style volume paths (e.g.
# file://localhost/Volumes/YES%202022_1/Yes_Sdarot/...), so Premiere's media
# relink finds the right files when opening a Windows-exported XML on a Mac.
#
# Add more drive-letter -> volume-name mappings below as needed. The volume
# name must match exactly what shows up under /Volumes on the Mac (check with
# `ls /Volumes` if unsure) -- spaces get URL-encoded automatically.

import sys
import re
import os
import urllib.parse

DRIVE_TO_VOLUME = {
    "K": "YES 2022_1",
}

PATTERN = re.compile(r"file://localhost/([A-Za-z])%3[aA]/")


def convert(text):
    def replace(match):
        drive = match.group(1).upper()
        volume = DRIVE_TO_VOLUME.get(drive)
        if volume is None:
            print("Warning: no mapping for drive '%s:' -- left unchanged" % drive)
            return match.group(0)
        encoded_volume = urllib.parse.quote(volume)
        return "file://localhost/Volumes/%s/" % encoded_volume

    return PATTERN.sub(replace, text)


def main():
    if len(sys.argv) < 2:
        print("Run: python3 convert_pathurl_win_to_mac.py input.xml [output.xml]")
        sys.exit(1)

    input_path = sys.argv[1]
    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        base, ext = os.path.splitext(input_path)
        output_path = base + "_mac" + ext

    with open(input_path, "r", encoding="utf-8") as f:
        content = f.read()

    count = len(PATTERN.findall(content))
    converted = convert(content)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(converted)

    print("Converted %d path(s)." % count)
    print("Saved to: %s" % output_path)


if __name__ == "__main__":
    main()
