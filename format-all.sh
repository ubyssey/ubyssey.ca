#!/bin/bash

# List all tracked files and pass them to prettier via xargs
git ls-files -z | xargs -0 npx prettier --write
pre-commit install
pre-commit run --all-files
