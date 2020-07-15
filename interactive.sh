#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

export RUNNER_TEMP="${SCRIPT_DIR}/_cache"
mkdir -p "${RUNNER_TEMP}"

export INPUT_CONFIGPATH=${2:-samples/sample.yaml}
echo "Running ${INPUT_CONFIGPATH}"

[ -n "${GHPAT}" ] || { 
    echo "set GHPAT envvar" && exit 
}

export INPUT_TOKEN="${GHPAT}"

echo "Running action"
npx tsc
node ./index.js
