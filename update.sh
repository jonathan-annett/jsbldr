#!/bin/bash
if [[ -e ./bin/jsbldr.js ]] && [[ -e ./package.json ]] && [[ -e ./get-latest-github.sh ]]; then
  if [[ "$1" == "push" ]]; then
    git add bin/jsbldr.js
    ./update_git_repos.sh push
  else
    ./update_git_repos.sh
  fi
else
  echo "you need to run this from the same directory as package.json" && exit 1
fi
