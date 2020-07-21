#!/bin/bash

set -e 

echo 
echo Building generator
echo
npx tsc 
npx ncc build ./index.ts -o ./dist 
# cp ./interfaces.js ./dist

echo
echo Building built-in reports

# reports are loaded dynamically at runtime so we need to build each into dist
mkdir -p ./dist/reports

for filepath in ./reports/*.ts; do
    filename=$(basename ${filepath})
    report=${filename%.*}

    cmd="ncc build ${filepath} -o ./dist/reports/${report}"
    echo
    echo $cmd
    eval ${cmd}
done
 