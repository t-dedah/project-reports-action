#!/bin/bash

set -e  

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

export RUNNER_TEMP="${SCRIPT_DIR}/_cache"
mkdir -p "${RUNNER_TEMP}"

export INPUT_CONFIGPATH=${1:-samples/sample.yaml}
echo "Running ${INPUT_CONFIGPATH}"

[ -n "${GHPAT}" ] || { 
    echo "set GHPAT envvar" && exit  1
}

export GITHUB_WORKSPACE="${SCRIPT_DIR}"
export INPUT_TOKEN="${GHPAT}"

echo "Running action"
npm run build
cp -R samples dist

# dev scenario of using charles proxy for https 
# export https_proxy=http://localhost:8080
# export NODE_TLS_REJECT_UNAUTHORIZED='0'

 node ./dist/index.js
