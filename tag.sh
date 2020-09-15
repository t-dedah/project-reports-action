#!/bin/bash

set -e

git tag -fa v1-alpha8 -m "Update v1-alpha8 tag"
git push origin v1-alpha8 --force