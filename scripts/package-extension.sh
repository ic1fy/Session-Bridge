#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
dist_dir="$project_dir/dist"
archive="$dist_dir/session-bridge-chromium-extension.zip"

mkdir -p "$dist_dir"
if [ -f "$archive" ]; then
  rm "$archive"
fi

cd "$project_dir"
COPYFILE_DISABLE=1 zip -X -r "$archive" extension README.md -x "*/.DS_Store"
