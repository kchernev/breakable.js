#!/bin/sh
# Opens the demo in a Chrome of its own (its own profile, so your usual Chrome is untouched) with
# WebGPU on: Chrome on Linux has no WebGPU adapter without these flags. skip_validation makes the
# solver's many indirect dispatches cheap; it's a developer setting, so use this profile only for
# the demo. It only opens the page: `pnpm dev` has to be running for the dev server's address.
#
#   npm run chrome            the world picker
#   npm run chrome -- neon    straight into a world
#   URL=https://<user>.github.io/<repo>/ npm run chrome    the published demo instead of the dev server
setsid google-chrome --user-data-dir="${XDG_CACHE_HOME:-$HOME/.cache}/breakable-chrome" \
  --no-first-run --no-default-browser-check \
  --enable-unsafe-webgpu --enable-features=Vulkan --use-angle=vulkan --ignore-gpu-blocklist \
  --enable-dawn-features=skip_validation --ozone-platform=x11 \
  "${URL:-http://127.0.0.1:${PORT:-5330}/}${1:+?world=$1}" >/dev/null 2>&1 &
