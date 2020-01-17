#!/bin/bash
if which node >/dev/null; then
echo -n node ok:
node --version
else
echo please install node.js
echo eg:
echo curl -L https://raw.githubusercontent.com/tj/n/master/bin/n -o n
echo bash n lts
fi
if which uglifyjs >/dev/null; then
echo -n uglifyjs ok:
uglifyjs --version
else
echo please install uglifyjs
echo eg:   npm install -g uglify-js
fi

npm install
npm install -g
