#!/bin/bash
GITHUB_USER=jonathan-annett
getRepos() {
node - << NODE
var
fs=require("fs"),
json_rollback=fs.readFileSync("package.json","utf-8"),
pkg=JSON.parse(json_rollback);

console.log(Object.keys(pkg.dependencies).map(function(dep){
  if (pkg.dependencies[dep].startsWith("github:${GITHUB_USER}/"+dep)) { return dep;}
  return null;
}).filter(function(x){return x!==null;}).join(" "));


NODE
}
UPDATED=0
for REPO in $(getRepos)
do
  ./get-latest-github.sh "https://github.com/${GITHUB_USER}/${REPO}.git" &&UPDATED=1
done

if [[ "${UPDATED}" == "1" ]] && [[ "$1" == "push" ]]; then
   npm install
   git add package.json
   git commit -m "updated dependancies"
   git push
   exit 0
else
   if [[ "${UPDATED}" == "0" ]] && [[ "$1" == "push" ]]; then
      exit 1
   else
      if [[ "${UPDATED}" == "1" ]]; then
        npm install
        exit 0
      fi
  fi
fi

