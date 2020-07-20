#!/bin/bash

echo 
echo Building generator
echo
npx tsc 
npx ncc build ./index.ts -o ./dist 
cp ./interfaces.js ./dist

echo
echo Building built-in reports
echo
# reports are loaded dynamically at runtime so we need to build each
mkdir -p ./dist/reports
npx ncc build ./reports/wip-limits.ts -o ./dist/reports/wip-limits 
npx ncc build ./reports/echo-board.ts -o ./dist/reports/echo-board 

