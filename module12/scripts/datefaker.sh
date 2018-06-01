#!/bin/sh

# This script replaces exif metadata in a photo to replace the dateTimeOriginal value with
# the current time according to the system clock. This is to allow us to pull weather data
# from the Weather Company Data API which only provides the previous 24 hours

# Usage: place in a directory with some images where you want to fake the date

#Check if the tool is installed
command -v exiftool >/dev/null 2>&1 || { echo >&2 "I require exiftool but it's not installed. Download at https://www.sno.phy.queensu.ca/~phil/exiftool/  Aborting."; exit 1; }

#Check if you are in the right directory
if [ -n "$(ls -A ./*.JPG 2>/dev/null)" ]
then
  now=$(date +"%Y:%m:%d %T")
  exiftool -DateTimeOriginal="$now" "./"
else
  echo "No JPG images found, please copy the script to the images directory. Aborting."
  exit 1
fi
