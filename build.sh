#!/bin/bash

set -e 

function build_module() {
    filename=$(basename $1)
    module=${filename%.*}

    cmd="ncc build ${filepath} -o ./dist/$2/${module} > /dev/null"
    echo
    echo $cmd
    eval ${cmd}
}

echo 
echo Building generator
echo
npx tsc 
npx ncc build ./index.ts -o ./dist  > /dev/null
# cp ./interfaces.js ./dist

echo
echo Building built-in reports

# reports are loaded dynamically at runtime so we need to build each into dist
mkdir -p ./dist/reports

for filepath in ./reports/*.ts; do
    build_module "${filepath}" reports
done

for filepath in ./processors/*.ts; do
    build_module "${filepath}" processors
done
 