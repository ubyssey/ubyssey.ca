#!/bin/bash
# format-all.sh
# This script applies prettier to all tracked files

# List all tracked files and pass them to prettier via xargs
git ls-files -z | xargs -0 npx prettier --write
pre-commit install
