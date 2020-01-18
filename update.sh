#!/bin/bash
if [[ -e ./bin/jsblder.js ]] && [[ -e ./package.json ]] && [[ -e ./get-latest-github.sh ]]; then
  NEW_EXT=0
  NEW_ACE=0
  UPDATED=0
  ./get-latest-github.sh "https://github.com/jonathan-annett/jspolyfills.git" && NEW_EXT=1 && UPDATED=1
  ./get-latest-github.sh "https://github.com/jonathan-annett/ace-express.git" && NEW_ACE=1 && UPDATED=1
  if [[ "${UPDATED}" == "1" ]]; then
     npm install
  fi
  if [[ "$1" == "push" ]]; then
    git add bin/jsblder.js
    if [[ "${UPDATED}" == "1" ]]; then
       git add package.json
    fi
    git commit -m "auto update"
    git push
  fi
else
  echo "you need to run this from the same directory as package.json" && exit 1
fi
