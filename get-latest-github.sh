#!/bin/bash
# script to set package.json to current commit for a github repo
GITHUB_URL="$1"

GITHUB_USER=$(node -e "console.log(url.parse('${GITHUB_URL}').path.split('/')[1]);")
GITHUB_REPO=$(node -e "console.log(url.parse('${GITHUB_URL}').path.split('/')[2].split('.')[0]);")
GITHUB_BRANCH=$(node -e "console.log(url.parse('${GITHUB_URL}').path.split('/')[2].split('#')[1]||'master');")

LOCAL_JSON="./.${GITHUB_REPO}-repo.json"

wget http://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH} -qO ${LOCAL_JSON}

node - << NODE

var
fs=require("fs"),
sha=JSON.parse(fs.readFileSync("${LOCAL_JSON}","utf-8")).sha,
json_rollback=fs.readFileSync("package.json","utf-8"),
pkg=JSON.parse(json_rollback),
hashline="github:${GITHUB_USER}/${GITHUB_REPO}#"+sha;

if (hashline !== pkg.dependencies["${GITHUB_REPO}"] ) {
  pkg.dependencies["${GITHUB_REPO}"]=hashline ;
  var json = JSON.stringify(pkg,undefined,4);
  console.log("${GITHUB_REPO} migrated to commit#"+sha);
  fs.writeFileSync("package.json",json);
  fs.writeFileSync("rollback.package.json",json_rollback);
  process.exit(0);
} else {
  console.log("${GITHUB_REPO} is still at commit #"+sha);
  process.exit(1);
}
NODE
