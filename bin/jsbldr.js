#!/usr/bin/env node

/*jshint maxerr:10000*/
/*jshint shadow:false*/
/*jshint undef:true*/
/*jshint browser:false*/
/*jshint node:true*/
/*jshint devel:true*/
/*jshint unused:true*/
/*jshint -W119*/
/*jshint -W098*/

var

fs           = require('fs'),
crypto       = require('crypto'),
path         = require("path"),
zlib         = require('zlib'),
JSHINT       = require("jshint").JSHINT,
UglifyJS     = require("uglify-js"),
ext          = require("jsextensions"),
chokidar     = require('chokidar'),
express      = require("express"),
wsexpress    = require("express-ws"),
ace          = require('ace-express'),

include_markers_file = /(?<include_marker>((var|let)(\s)+inclusions)((?<begin>Begin)|(?<end>End)|((?<pause>Pause)(\d)*)|((?<resume>Resume)(\d)*))(\s)*\;){1}/,
include_inject_file  = /(?<include_file>(((((((function){1}(\s)*(?<name>([a-zA-Z_][a-zA-Z0-9_]*)?)(\s)*\((\s)*(?<classic>include|inject|((include,|inject,)(?<classic_args>([a-zA-Z_][a-zA-Z0-9_,]*)?))){1}(\s)*(\))(\s)*))|(((\((\s)*(?<arrow>include|inject|((include,|inject,)(?<arrow_args>([a-zA-Z_][a-zA-Z0-9_,]*)?))){1}(\s)*(\))(\s)*)(\s)*\=\>))))(\s)*{(\s)*('|\")))(?<filename>(.*?))((\37)(\s)*;(\s)*\}))/,
include_file         = /(?<include_file>(((((((function){1}(\s)*(?<name>([a-zA-Z_][a-zA-Z0-9_]*)?)(\s)*\((\s)*(include|include,(?<classic_args>([a-zA-Z_][a-zA-Z0-9_,]*)?)){1}(\s)*(\))(\s)*))|(((\((\s)*(include|include,(?<arrow_args>([a-zA-Z_][a-zA-Z0-9_,]*)?)){1}(\s)*(\))(\s)*)(\s)*\=\>))))(\s)*{(\s)*('|\")))(?<filename>(.*?))((\33)(\s)*;(\s)*\}))/,
inject_file          = /(?<inject_file>(((((((function){1}(\s)*(?<name>([a-zA-Z_][a-zA-Z0-9_]*)?)(\s)*\((\s)*(inject|inject,(?<classic_args>([a-zA-Z_][a-zA-Z0-9_,]*)?)){1}(\s)*(\))(\s)*))|(((\((\s)*(inject|inject,(?<arrow_args>([a-zA-Z_][a-zA-Z0-9_,]*)?)){1}(\s)*(\))(\s)*)(\s)*\=\>))))(\s)*{(\s)*('|\")))(?<filename>(.*?))((\33)(\s)*;(\s)*\}))/,
require_inject       = /(?<require_file>(((require){1}(\s)*(\((\s)*(\"){1})))(((?<filename>(.)*)(\"){1}(\s)*(,(\s)*module.inject(\s)*(,)?(?<require_args>(.)*))(?<=[^\)]{1})\))))/,
tokenMarker          = /(?<omit>(\/\*(.)*\{\#\>)(?<hash>([a-z|A-Z|0-9]){8})(<\#\}(.)*\*\/))/,


js_hash_mode = 'hex';


function tob64(data) {
    return zlib.deflateSync(data).toString('base64');
}

function fromb64(b64) {
 return zlib.inflateSync(Buffer.from(b64,'base64')).toString();
}

function saveDB(hashDB) {
    var key = "omits.db";

    return '\n/*{"'+key+'":"'+
            tob64(JSON.stringify(hashDB))+
           '"}*/';
}

saveDB.match = encodeRegExp([{
    $omitdb:[
        { match: '\n/*' },
        { wsTo : '{'},
        { wsTo : '"omits.db"'},
        { wsTo : ':' },
        { wsTo : '"' },
        { $b64 : [ {anything:null}  ]},
        { match : '"'  },
        { wsTo : '}' },
        { wsTo : '*/' },
    ]
}],'gs');

function deleteKeys(db,keys){
    if (typeof keys==='string') {
        delete db[keys];
        return;
    }
    return keys.forEach(deleteKeys.bind(this,db));
}

function checkWrapRegEx (str,regex,hash) {
    try  {

        if (regex.exec(str).groups.hash!==hash) {
           throw new Error ("hash mismatch");
      }
    } catch (e) {
        console.log (str);
        console.log (e);
        console.log (regex.source);
        console.log (regex.flags);
        throw (e);
    }

}

function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function encodeRegExp(arr,flags){

    var names={},gpNo,stack=[];


    function quantify(x,n) {
        if (n===null) {
            return stack.push(x+'*');
        }
        if (typeof n==='number') {
            return stack.push(x+'{'+n+'}');
        }
        if (typeof n==='string') {
            return stack.push(x+n);
        }
    }
    var longform = {
        ws           : "\\s",
        alphanumeric : "[a-z|0-9]",
        alphaNumeric : "[a-z|A-Z|0-9]",
        ALPHANUMERIC : "[A-Z|0-9]",
        numeric      : "[0-9]",
        alpha        : "[a-z]",
        ALPHA        : "[A-Z]"
    };
    function parseRegExpBlock (obj) {

        if (typeof obj==='string') {
            return stack.push(escapeRegExp(obj));
        }

        if (typeof obj==='object' && obj.constructor===Array) {
            gpNo = gpNo?gpNo+1:1;
            stack.push('(');
            obj.forEach(parseRegExpBlock);
            return stack.push(')');
        }

        if (typeof obj==='object' && obj.constructor===Object) {
            var key=Object.keys(obj),name;
            if (key.length===1) {key=key[0];
                var val=obj[key];
                switch (key) {
                    case "skipTo":
                    case "match":
                        if (key==="skipTo") stack.push(".*");
                        return parseRegExpBlock(val);
                    case "match$":
                        return stack.push("\\"+names[val].toString());

                    case "ws":
                    case "alphaNumeric":
                    case "alphanumeric":
                    case "ALPHANUMERIC":
                    case "numeric":
                    case "alpha":
                    case "ALPHA":
                        return quantify(longform[key],val);

                    case "wsTo":
                        stack.push("\\s*");
                        return parseRegExpBlock(val);


                    case "anything":

                        if (val===1) {
                            return stack.push('.');
                        }
                        return quantify('.',val);

                default:
                    if (key.charAt(0)==="$") {
                        name=key.substr(1);
                        stack.push('(?<'+name+'>');
                        gpNo = gpNo?gpNo+1:1;
                        names[name]=gpNo;
                        parseRegExpBlock(val);
                        return stack.push(')');
                    }
                }
            }
        }
    }

    parseRegExpBlock(arr);
    return new RegExp(stack.join(''),flags||'g');
}

function findFileBlock(src,intro,outro,re) {
    var match = re.exec(src);
    if (match) {
        var
        ix = match.groups.embedded_file.indexOf(intro),
        ix2 = match.groups.embedded_file.lastIndexOf(outro);
        if (ix>=0 && ix2 >=0) {
            ix+=intro.length;
            return match.groups.embedded_file.substring(ix,ix2);
        }
    }
    return false;
}



if (
    "hello//world".whiteOutComments()==="hello       " &&
    "hello/*world*/".whiteOutComments()  ==="hello         " &&
    "hello//*world*/".whiteOutComments() ==="hello          " &&
    "hello/*\nworld\n*/".whiteOutComments()==="hello  \n     \n  " &&
    '"hello//world"'.whiteOutComments()==='"hello//world"' &&
    '"hello//*world*/"'.whiteOutComments() ==='"hello//*world*/"' &&
    '"hello/*world*/"'.whiteOutComments()==='"hello/*world*/"' &&
    "'hello//world'".whiteOutComments()==="'hello//world'" &&
    "'hello//*world*/'".whiteOutComments() ==="'hello//*world*/'" &&
    "'hello/*world*/'".whiteOutComments()==="'hello/*world*/'" &&
    "'hello/*world*/".whiteOutComments()==="'hello/*world*/" &&
    "hello//world".whiteOutComments(false)==="hello" &&
    "hello/*world*/".whiteOutComments(false)  ==="hello" &&
    "hello//*world*/".whiteOutComments(false) ==="hello" &&
    "hello/*\nworld\n*/".whiteOutComments(false)==="hello" &&
    '"hello//world"'.whiteOutComments(false)==='"hello//world"' &&
    '"hello//*world*/"'.whiteOutComments(false) ==='"hello//*world*/"' &&
    '"hello/*world*/"'.whiteOutComments(false)==='"hello/*world*/"' &&
    "'hello//world'".whiteOutComments(false)==="'hello//world'" &&
    "'hello//*world*/'".whiteOutComments(false) ==="'hello//*world*/'" &&
    "'hello/*world*/'".whiteOutComments(false)==="'hello/*world*/'" &&
    "this is /*a comment*/ to split".ArraySplitCode([" "]).join(",")
      ==="this,is,/*a comment*/,to,split"

    ) {
    console.log("whiteOutComments()ok");
}

function
classicIncludeWrapper(filename,name,args,code,indentLevel) {
    indentLevel=indentLevel||0;
    var spaces = new Array (1+indentLevel).join(" ");
    return [ spaces+'/*[',/*hash*/']>>> file:'+filename+' >>>*/\n'+
             spaces+'function '+(name||'')+' ('+(args||'')+'){\n'+
             code.reindent(indentLevel+4).trimEnd()+'\n'+
             spaces+'}/*<<< file:'+filename+' <<<[',/*hash*/']*/'];
}
classicIncludeWrapper.delimits= [
    encodeRegExp([
        { match    : '/*[' },
        { $hash    : [ {alphanumeric: 8 } ]},
        { match    : ']>>>' },
        { skipTo: '*/' }
    ],'g'),

    encodeRegExp([
            { match    : '/*' },
            { skipTo    : '<<<[' },
            { $hash    : [ {alphanumeric: 8 } ]},
            { match    : ']' },
            { wsTo: '*/' }
        ],'g')
];
classicIncludeWrapper.match= encodeRegExp([{
    $classic:[
        { match    : '/*[' },
        { $hash    : [ {alphanumeric: 8 } ]},
        { match    : ']>>>' },
        { $include    : [
//       file: somefile.js >>>  */
//       function someName (some,args,here) {
            {anything:null}
//      } /*<<< file:somefile.js
            ]},
        { match    : '<<<[' },
        { match$   : "hash" },
        { match    : ']' },
        { wsTo: '*/' },
    ]
}],'gs');
classicIncludeWrapper.find= function(inside,hash){
    return findFileBlock(
        inside,'{\n','\n}',
        encodeRegExp([{
        $embedded_file_outer:[
            { match    : '/*['  },
            { match    : hash   },
            { match    : ']>>>' },
            { $embedded_file    : [
    //       file: somefile.js >>>  */
    //       function someName (some,args,here) {
                {anything:null}
    //      } /*<<< file:somefile.js
                ]},
            { match    : '<<<[' },
            { match    : hash },
            { match    : ']' },
            { wsTo: '*/' },
        ]
    }],'gs'));
};
classicIncludeWrapper.filter= encodeRegExp([
    //file: somefile.js
    { match : '>>>' },
    { wsTo  : '*/' },
    { wsTo  : 'function' },
    // someName (some,args,here)
    { skipTo          : '{' },
    { $classic_code    : [ {anything:null}  ]},
    { match    : '}' },
    { wsTo : '/*<<<' },
],'gs');


function
arrowIncludeWrapper(filename,args,code,indentLevel) {
    indentLevel=indentLevel||0;
    var spaces = new Array (1+indentLevel).join(" ");
    return [ spaces+'/*[',/*hash*/']>>> file:'+filename+' >>>*/\n'+
             spaces+'('+(args||'')+')=>{\n'+
             code.reindent(indentLevel+4).trimEnd()+'\n'+
             spaces+'}/*<<< file:'+filename+' <<<[',/*hash*/']*/'];
}
arrowIncludeWrapper.match=classicIncludeWrapper.match;
arrowIncludeWrapper.find=classicIncludeWrapper.find;
arrowIncludeWrapper.filter= encodeRegExp([
    // file: somefile.js
    { match  : '>>>' },
    { wsTo   : '*/' },
    // (some,args,here) =>
    { skipTo          : '=>' },
    { wsTo    : '{' },
    { $arrow_code       : [ {anything:null}]},
    { match             : '}' },
    { wsTo    : '/*<<<' },

],'gs');

function
injectBlockWrapper(description,code,indentLevel) {
    indentLevel=indentLevel||0;
    var spaces = new Array (1+indentLevel).join(" ");
    return [ spaces+'/*[',/*hash*/']-('+description+')-->*/\n'+
             code.reindent(indentLevel).trimEnd()+'\n'+
             spaces+'/*<--('+description+')-[',/*hash*/']*/'];
}
injectBlockWrapper.delimits= [
    encodeRegExp([
        { match    : '/*[' },
        { $hash    : [ {alphanumeric: 8 } ]},
        { match    : ']-('   },
        { skipTo : ')-->*/'  },

    ],'g'),
    encodeRegExp([
        { match    : '/*<--('  },
        { skipTo   : ')-['   },
        { $hash    : [ {alphanumeric: 8 } ]},
        { match    : ']*/' },

    ],'g')

    ];
injectBlockWrapper.match= encodeRegExp([{
    $inject_block:[
        { match    : '/*[' },
        { $hash    : [ {alphanumeric: 8 } ]},
        { match    : ']-('   },
        { skipTo : ')-->*/'  },
        { $code    : [ {anything:null}  ]},
        { match    : '/*<--('  },
        { skipTo : ')-['   },
        { match$   : "hash" },
        { match    : ']*/' },
    ]
}],'gs');
injectBlockWrapper.find = function(inside,hash){
    return findFileBlock(
        inside,'*/\n','/*',
        encodeRegExp([{
            $embedded_file_outer:[
                { match    : '/*[' },
                { match    : hash },
                { match    : ']-('   },
                { $embedded_file:  [
                    { skipTo : ')-->*/'  },
                    { $embedded_file_inner:  [ {anything:null}  ]},
                    { match    : '/*<--('  },
                    { skipTo : ')-['   },
                    { match    : hash },
                    { match    : ']*/' },
                ]},

            ]
    }],'gs'));
};

function
arrowBlockWrapper(filename,code,indentLevel) {
    indentLevel=indentLevel||0;
    var spaces = new Array (1+indentLevel).join(" ");
    return [ spaces+'((',/*hash*/')=>{\n'+
             spaces+'/*'+filename+'*/\n'+
             code.reindent(indentLevel+4).trimEnd()+'\n'+
             spaces+'})("',/*hash*/'");\n' ];
}
arrowBlockWrapper.match= encodeRegExp([{
    $arrow_block:[
        { match : '(' },
        { wsTo  : '('},
        { ws    : null},
        { $hash    : [ {alphanumeric: 8 } ]},
        { wsTo: ')'   },
        { wsTo: '=>'   },
        { wsTo: '{'   },
        { wsTo: '/*'  },
        { skipTo : '*/'  },
        { $code    : [ {anything:null}  ]},
        { match    : '}'  },
        { wsTo: ')'   },
        { wsTo: ')'   },
        { wsTo: '"'   },
        { match$ : "hash" },
        { match  : '"' },
        { wsTo   : ')' },
        { wsTo   : ';' },
    ]
}],'gs');
arrowBlockWrapper.find = function(inside,hash){
 return findFileBlock(
     inside,'*/','/*',
     encodeRegExp([{
        $embedded_file_outer:[
            { match : '(' },
            { wsTo  : '('},
            { wsTo  : hash },
            { wsTo: ')'   },
            { wsTo: '=>'   },
            { wsTo: '{'   },
            { wsTo: '/*'  },
            { skipTo : '*/'  },
            { $embedded_file    : [ {anything:null}  ]},
            { match    : '}'  },
            { wsTo: ')'   },
            { wsTo: ')'   },
            { wsTo: '"'   },
            { match  : hash },
            { match  : '"' },
            { wsTo   : ')' },
            { wsTo   : ';' },
        ]
    }],'gs'));
};

function
classicBlockWrapper(filename,name,code,indentLevel) {
    indentLevel=indentLevel||0;
    var spaces = new Array (1+indentLevel).join(" ");
    return [ spaces+'(function'+(name?' '+name:'')+'(',/*hash*/')  {\n'+
             spaces+'/*'+filename+'*/\n'+
             code.reindent(indentLevel+4).trimEnd()+'\n'+
             spaces+'})("',/*hash*/'");\n'];
}
classicBlockWrapper.match= encodeRegExp([
    { match  : '(' },
    { wsTo   : 'function'},

    { skipTo : '(' },

    { ws     : null },{ $hash : [ {alphanumeric: 8 } ]},{ wsTo : ')' },

    { $code          : [
    // { /* somefile.js */
        {anything:null}

    ]},
    { match: '}'   },
    { wsTo : ')'   },
    { wsTo : '('   },

    { wsTo : '"'   }, { match$ : "hash" }, { match : '"' },

    { wsTo : ')' },
    { wsTo : ';' },
],'gs');
classicBlockWrapper.find=function(inside,hash){
 return findFileBlock(
     inside,'*/','/*',
     encodeRegExp([{
        $embedded_file_outer:[
           { match  : '(' },
           { wsTo   : 'function'},

           { skipTo : '(' },{ wsTo   : hash},{ wsTo : ')' },

           { $embedded_file          : [
           // { /* somefile.js */
               {anything:null}

           ]},
           { match: '}'   },
           { wsTo : ')'   },
           { wsTo : '('   },

           { wsTo : '"'   }, { match : hash }, { match : '"' },

           { wsTo : ')' },
           { wsTo : ';' },
       ]
      }],'gs'));
};
classicBlockWrapper.filter= encodeRegExp([
    { match : '{' },
    { wsTo  : '/*'},
    { skipTo       : '*/' },
    { $code          : [
    // { /* somefile.js */
        {anything:null}

    ]},
],'gs');

function
requireBlockWrapper(filename,code,indentLevel) {
    indentLevel=indentLevel||0;
    var spaces = new Array (1+indentLevel).join(" ");
    return [ spaces+'(function(module){module.id="',/*hash*/'";(function(exports){\n'+
             code.reindent(indentLevel+4).trimEnd()+'\n' +
             spaces+'})(module.exports);return module.exports;})({exports:{},filename:"'+(filename)+'",id:"',/*hash*/'"})'];

}
requireBlockWrapper.match= encodeRegExp([{
    $require_block:[
        { match    : '(' },

        { wsTo: 'function'},{ wsTo:'('},{ wsTo:'module'},{wsTo:')'},

        { wsTo: '{' },

        { wsTo: 'module.id'   },{ wsTo: '=' },

        { wsTo: '"'},{ $hash: [ {alphanumeric: 8 } ]},{ match : '"' },

        { wsTo: ';' },
        { wsTo: '(' },

        { wsTo: 'function'},{ wsTo:'('},{ wsTo:'exports'},{ wsTo: ')' },

        { wsTo: '{'   },

        { $code    : [ {anything:null}  ]},

        { match    : '}'  },

        { skipTo : '"' },
        { wsTo:  ',' },
        { wsTo:  'id' },{ wsTo : ':'},

        { wsTo: '"' },{ match$   : "hash" },{ match    : '"' },
        { wsTo: '}' },
        { wsTo: ')' },
    ]
}],'gs');
requireBlockWrapper.find = function(inside,hash){
   return findFileBlock(
       inside,'*/','/*',
       encodeRegExp([{
        $embedded_file_outer:[
            { match    : '(' },

            { wsTo: 'function'},{ wsTo:'('},{ wsTo:'module'},{wsTo:')'},

            { wsTo: '{' },

            { wsTo: 'module.id'   },{ wsTo: '=' },

            { wsTo: '"'},{ match : hash },{ match : '"' },

            { wsTo: ';' },
            { wsTo: '(' },

            { wsTo: 'function'},{ wsTo:'('},{ wsTo:'exports'},{ wsTo: ')' },

            { wsTo: '{'   },

            { $embedded_file    : [ {anything:null}  ]},

            { match    : '}'  },

            { skipTo : '"' },
            { wsTo:  ',' },
            { wsTo:  'id' },{ wsTo : ':'},

            { wsTo: '"' },{ match   : hash },{ match    : '"' },
            { wsTo: '}' },
            { wsTo: ')' },
        ]
    }],'gs'));

};

function clean_src (src) {
    // clean_src removes embedded token comments (ie showing inclusion source files), preserving line numbers.
    // other comments (ie real comments) are left intact.
    var cleaner = {
                       classicIncludeWrapper : classicIncludeWrapper.delimits,
                       injectBlockWrapper: injectBlockWrapper.delimits,
                       tokenMarker : tokenMarker
                  };
    var cleaned = src.ArraySplit(cleaner);

    return cleaned ? cleaned.join('') : src;
}

function no_indents(s) {
    return s.trim().split("\n").map(function(l){return l.trim();}).join("\n");
}

function compareIgnoringIndents(a,b) {
    var A=a.trim().split("\n");
    var B=b.trim().split("\n");
    if (A.length===B.length) {
        if (A.length===0) return true;
        return !A.some(function(AA,ix) {
            return AA.trim()!==B[ix].trim();
        });
    }
    return false;
}

function checkFileDir(dir,root) {
    //process.stdout.write('\033c');
    Object.values(dir).forEach(function(file){
        var fn = file.relpath ?  path.join(root,file.relpath,file.filename) : path.join(root,file.filename);
        if (fs.existsSync(fn)) {
            var disk = fs.readFileSync(fn,"utf8");
            if (compareIgnoringIndents(disk,file.text)) {
                //console.log({allGood:{fn}});
            } else {
                console.log({changed:{fn}});
            }
            //console.log({fn,file});
        } else {
            console.log({notFound:{fn,file}});
        }
    });

}

function writeFileSync(fn,data) {
    var dir = path.dirname(fn);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir,{recursive:true});
    }
    fs.writeFileSync(fn,data);
}

function readJSFile(filename,cb,initalMtime,initialSize) {
    if (initalMtime===undefined) {
        // first (outer) call - verify file exists and get baseline stats
        return setTimeout(fs.stat,2,filename,function(err,baselineStat){
            if (err) return cb(err);
            // now do -over with baselineStat as initalStat
            return readJSFile(filename,cb,baselineStat.mtime.getTime(),baselineStat.size);
        });
    }

    //initalMtime is the file modification time of when we started reading the file

    var
    abort=false,
    buffers=[],
    hash = crypto.createHash('sha256'),
    input = fs.createReadStream(filename);
    input.on('error',cb);
    input.on('readable', function()  {
      if (abort) return;

      fs.stat(filename,function(err,stat){

            if (err) return cb (err);
            var thisMtime = stat.mtime.getTime();
            if (thisMtime !==initalMtime|| stat.size !==initialSize) {
                // file has changed since we started reading - do over
                abort=true;
                // note we pass in thisMtime as the new initalMtime
                console.log("change detected since started reading",filename)
                return readJSFile(filename,cb,thisMtime,stat.size);
            }

            var data = input.read();
            if (data) {
                hash.update(data);
                buffers.push(data);
            } else {
                var combined;
                if (buffers.length===1) {
                    combined = buffers[0];
                    console.log ("read",combined.length,"bytes from",filename,"in 1 buffer");
                } else {
                    combined= Buffer.concat(buffers);
                    console.log ("collated",buffers.length,"buffers from",filename,"into a ",combined.length,"byte buffer");
                }
                if (combined.length===stat.size) {
                    return cb(undefined,combined.toString("utf8"),hash.digest(js_hash_mode).split("=")[0],stat);
                }

                throw new Error ("os says file is "+stat.size+" bytes, but we only got"+combined.length+" bytes");
            }

      });


    });


}

function JSHINT_check(js_src,path,sha) {
    sha = sha || hash_js_src(js_src);
    var result;
    if (JSHINT_check.cache[path]) {
        result=JSHINT_check.cache[path][sha];
        if (result) {
           // console.log({cached:{JSHINT:path,errs:JSHINT_ErrorString(result)}});
            return result;
        }
        var prev = Object.keys(JSHINT_check.cache[path]);
        prev.sort(function(a,b){
            return JSHINT_check.cache[path][b].length-JSHINT_check.cache[path][a].length;
        });
        while (prev.length>4) {
            var sh = prev.shift();
            //console.log("dumping",path,sh,"JSHINT history",JSHINT_check.cache[path][sh].length);
            delete JSHINT_check.cache[path][sh];
        }
        prev.splice(0,4);
    } else {
        JSHINT_check.cache[path]={};
    }
    var options = {
      maxerr:10000,
      undef: true,
      shadow:false,
      browser:true,
      devel:true,
      unused:true,
      esversion: 6
    };

    var ignoreWarnings  = [
      'W104',
      'W098',
      'W032',
      'W033'
    ];

    var jshint_prefix=ignoreWarnings.map(function(w){ return '/*jshint -'+w+'*/';}).join('');

    console.log({JSHINTing:path,sha:sha});
    JSHINT(jshint_prefix+js_src, options);
    var errs = JSHINT.data().errors||[];
    console.log({JSHINT:path,errs:JSHINT_ErrorString(errs)});
    result = (JSHINT_check.cache[path][sha]=errs);
    fs.writeFileSync(JSHINT_check.cache_fn,tob64(JSON.stringify(JSHINT_check.cache)));
    return result;
}

JSHINT_check.cache_fn="./JSHINT_check.cache";
try {
JSHINT_check.cache=fs.existsSync(JSHINT_check.cache_fn)?JSON.parse(fromb64(fs.readFileSync(JSHINT_check.cache_fn,"utf8"))):{};
} catch (e) {
    JSHINT_check.cache={};
    if (fs.existsSync(JSHINT_check.cache_fn))
        fs.unlinkSync(JSHINT_check.cache_fn);
}

function readJSFileViaJSHINT(filename,cb) {

    return readJSFile(filename,function(err,js_src,sha,stat){
        if (err) return cb(err);

        var errs = JSHINT_check(js_src,filename,sha);
        if (errs && errs.length>0) return cb (errs);
        return cb (undefined,js_src,sha,stat);
    });
}

function readJSFileSync(filename) {
    var buffer = fs.readFileSync(filename);
    /*jshint -W053*/
    var str = new String(buffer.toString("utf8"));
    /*jshint +W053*/
    Object.defineProperties(str,{sha256:{value:hash_js_src(buffer)}});
    return str;
}

function stringSliceToBuffers(str,maxChunk) {
    var copied=0,str_length=str.length;
    if (str_length<=maxChunk) return [Buffer.from(str)];
    var res = [];
    while (copied<str_length) {
        res.push(Buffer.from(str.substr(copied,maxChunk)));
        copied+=maxChunk;
    }
    return res;
}

function createTempJSFile (filename,options,cb) {
    if (typeof options==='function') {
        cb=options;
        options={};
    }
    fs.mkdtemp(filename+'-save-',function (err, folder) {

        if (err) {
            return cb(err);
        }
        //console.log("created temp folder",folder,"to save",filename);
        var basename = path.basename(filename);
        var tempname = path.join(folder, basename);

        var writer = fs.createWriteStream(tempname,options);
        cb (undefined,writer,function end(hash,cb){
            writer.end(function(err){
                if (err) return cb(err);
                //console.log("ended write stream for",tempname,hash);
                fs.stat(tempname,function(err,stat){
                    fs.rename(tempname,filename,function(err){
                        if (err) return cb(err);
                        //console.log("renamed file:",tempname,"to",filename);
                        cb(undefined,stat);
                        fs.rmdir(folder,function(err){
                            if (err) throw console.log (err);
                        });
                    });
                });

            });

        });
    });
}

function createTempJSFileSync (filename) {

    var folder = fs.mkdtempSync(filename+'-save-');
    var basename = path.basename(filename);
    var tempname = path.join(folder, basename);
    //console.log("created temp folder",folder,"to save",filename);
    return {
        writeFile : function (data,encoding,hash) {
            fs.writeFileSync(tempname,data,encoding);
            //console.log("wrote",data.length,"bytes to",tempname,hash);
            fs.renameSync(tempname,filename);
            //console.log("renamed file:",tempname,"to",filename);
            fs.rmdirSync(folder);
            //console.log("removed folder:",folder);

        },
        name : tempname,
        cleanup : function () {
            if (fs.existsSync(tempname)) {
                fs.unlinkSync(tempname);
                console.log("deleted file:",tempname);
            }
            fs.rmdirSync(folder);
            console.log("removed folder:",folder);
        }
    }
}

function writeJSFile(filename,js_src,cb) {
    // atomically write a largish javascript file, collecint it's sha256 hash as we do so

    // create a temp file in a temp folder adjacent to the file we are overwriting
    // (or if the file is new, a temp file in the same folder wher we will be saving it)
    createTempJSFile(filename,function(err,writer,end){

        if (err) return cb(err);

        var
        // start a hashing object
        hash = crypto.createHash('sha256'),
        i=0,// index of next buffer to save (also the count of buffers saved)
        // split the string into buffers at most 256 kb in length
        buffers = stringSliceToBuffers(js_src,1024*256),
        // looping callback to write the the next batch of buffers or wait till drain
        write = function () {

          while (i<buffers.length) {
            var data = buffers[0];
            if (writer.write(data)){
                hash.update(data);
                i++;
            } else {
                return writer.once('drain', write);
            }
          }
          // if writer.write ever failed, the loop never exits (return is hit)
          // once drain happens, write get called again

          // end the stream, clean up the temp file (rename to filename, and remove temp folder)
          var sha = hash.digest(js_hash_mode).split("=")[0];
          end(sha,function(err,stat){

              if (err) return cb(err);

              return cb(undefined,sha,stat);

          });

        };

        // kickstart the write by saving the first batch of files.
        write();
    });

}

function hash_js_src(js_src) {
   var hash = crypto.createHash('sha256');
   hash.update(typeof js_src==='string' ? Buffer.from(js_src) : js_src);
   return hash.digest(js_hash_mode).split("=")[0];
}

function writeJSFileSync(fn,js_src,sha) {
    if (!sha) sha = hash_js_src(js_src);
    createTempJSFileSync(fn).writeFile(js_src,"utf8",sha);
    return sha;
}

function JSHINT_ErrorString(errs) {
    return errs.map(function(err){return (err.code+" @"+err.line).padEnd(4)+" "+err.reason;});
}

function writeJSFileSyncViaJSHINT(fn,js_src,warns) {
    js_src = js_src.reindent(0,4);
    var sha = hash_js_src(js_src),
    errs = JSHINT_check(js_src,fn,sha);

    if (errs && errs.length>0) {
        console.log("Linting failed::",JSHINT_ErrorString(errs),"\nAborting Save",fn);
        if (js_src.length<4096) {
            console.log({src_lines:js_src.split("\n").map(function(line,ix){
                return [ix+1,line];
             })});
        }
        return false;
    } else {
        return writeJSFileSync(fn,js_src,sha);
    }
}

function writeFileDir(dir,root) {
    //process.stdout.write('\033c');
    var ok=true,sha;

    Object.values(dir).forEach(function(file){
        var fn = file.relpath ?  path.join(root,file.relpath,file.filename) : path.join(root,file.filename);
        if (fs.existsSync(fn)) {
            var disk = readJSFileSync(fn);
            var disksha = disk.sha256;
            if (compareIgnoringIndents(disk,file.text)) {
               // console.log({unchanged:{fn}});
            } else {
                ok = !!(sha=writeJSFileSyncViaJSHINT(fn,file.text)) && ok;
                console.log({changed:{fn,sha,prevsha:disksha}});
            }
            //console.log({fn,file});
        } else {
            ok = !!(sha=writeJSFileSyncViaJSHINT(fn,file.text)) && ok;
            console.log({newfile:{fn,sha}});

        }
    });
    return ok;
}

function minifyJS( js_src ) {
   return UglifyJS.minify(js_src, {
       parse: {},
       compress: {},
       mangle: false,
       output: {
           code: true
       }
   }).code;
}

function save_out_file (out_file,src_text) {
    var cleaned=clean_src(src_text);
    var stripped = src_text.codeStripped;
    writeJSFileSync(out_file.replace(".js",".clean.js"),cleaned);
    writeJSFileSync(out_file.replace(".js",".strip.js"),stripped);
    //writeJSFileSync(out_file.replace(".js",".ugly.js"),minifyJS(stripped));
   // writeJSFileSync(out_file.replace(".js",".white.js"),src_text.codeSpaced);
   // writeJSFileSync(out_file.replace(".js",".strike.js"),src_text.whiteOutComments('-','-'));
   // writeJSFileSync(out_file.replace(".js",".numbered.js"),cleaned.codeNumbered);

}


function trackEdits(
    build_dir,    // eg ./src
    main_file,     // filename within build_dir of main source file
    out_file,      // path to output file
    onChanged,
    dir,
    timeout) {



    timeout = timeout || 1000;
    onChanged = onChanged || checkFileDir;
    var out_dir = path.dirname(out_file);
    var out_fn  = path.basename(out_file);

    console.log({build_dir:build_dir,main_file:main_file,out_file:out_file,out_dir:out_dir,out_fn:out_fn});

    var track_paths = [ build_dir ];

    if ( out_dir !== build_dir ) {
        track_paths.unshift(out_file);
    }

    if (out_file.startsWith("./")) out_file= out_file.substr(2);

    var idle_ticker = timeout ? setTimeout(changed,timeout) : false;
    var last=false, last_sha;
    var editors;
    function changed(){
        if (idle_ticker) {
            clearTimeout(idle_ticker);
            idle_ticker=undefined;
        }

        var
        stats = fs.statSync(out_file),
        mtime = stats.mtime.getTime(),
        age   = Date.now() - mtime;

        if (last===false || last !== mtime && mtime && age > 50){

            console.log("reading",out_file,"(",age," msecs old,",stats.size,"bytes)");

            readJSFile(out_file,function(err,file_text,sha,read_stat){
                if (!err) {

                    if (last_sha===sha) {
                        console.log("ignoring the re-read, updated ",out_file,"sha=",sha);
                    } else {
                        last_sha=sha;
                        console.log("parsing",file_text.length,"bytes, sha=",sha);
                        var parsed = parse_src (main_file,file_text,dir);
                        onChanged(dir,build_dir);
                    }
                    idle_ticker = timeout ? setTimeout(changed,timeout) : false;
                    last = read_stat.mtime.getTime();

                } else {
                    console.log(err);
                    idle_ticker = timeout ? setTimeout(changed,timeout) : false;
                }
            });

        } else {
            idle_ticker = timeout ? setTimeout(changed,timeout) : false;
        }
    }

    var fixed_out_dir   = out_dir.startsWith("./") ? out_dir.substr(2) : out_dir;
    var fixed_build_dir = build_dir.startsWith("./") ? build_dir.substr(2) : build_dir;

    var rel_re = new RegExp("^"+ escapeRegExp(fixed_build_dir+"/") );

    chokidar.watch(
        track_paths,
        {
            persistent: true,
            recursive:true

        }).on('all', function (eventType, filename) {

         if (eventType==='change' && filename===out_file) {
             if (idle_ticker) {
                 clearTimeout(idle_ticker);
             }
             idle_ticker = timeout ? setTimeout(changed,10) : false;
         } else {
             if (eventType==='change' && (filename.search(rel_re)===0)) {
                 var rel_filename = filename.replace(rel_re,'');
                 //console.log("change:",{filename,rel_filename});
                 var dir_file = dir[rel_filename];
                 if (dir_file) {

                    readJSFileViaJSHINT(filename,function(err,js_src,sha,stat){
                         if (err) {
                             if (typeof err==='object' && err.constructor===Array) {
                                 console.log({file:rel_filename,jshint:JSHINT_ErrorString(err)});
                             } else {
                                 throw err;
                             }

                         } else {

                             //console.log({dir_sha:dir_file.sha256,file_sha:sha});

                             if (dir_file.sha256 !== sha) {
                                 var src = loadFile (path.join(build_dir,main_file),0);
                                 if (src.thrown) {
                                        console.log({file:rel_filename,thrown:src.thrown});
                                        //onChanged(dir,build_dir);
                                 } else {
                                     //dir_file.text = js_src;
                                     ///dir_file.sha256=sha;
                                     var out_file_text=src.text+src.outputDB;
                                     writeJSFile(out_file,out_file_text,function(err,sha,stat) {
                                        console.log("updated",out_file,"sha=",sha,Date.now()-stat.mtime.getTime(),"msec ago");
                                        last_sha=sha;
                                        last=stat.mtime.getTime();
                                        
                                        
                                        var ed = editors.files[out_file];
                                        if (ed) {
                                            //ed.text = out_file_text;
                                        } else {
                                            console.log("no ed to update:",out_file);
                                        }
                                     });
                                     //save_out_file (out_file,src.text);
                                 }

                            // } else {
                             //    console.log({ignoring:{rel_filename,sha}});
                             }
                         }
                     });

                 }
             }
         }

     });

    editors = ace.editMulti(

        "cobalt",


         Object.keys(dir)
            .filter(function(fn){ return fn !==main_file; })
               .map(function(fn) { return path.join(build_dir,fn);} )
                .concat([

                {
                    file:out_file,
                    theme :'dawn'
                },
                {
                    file:path.join(build_dir,main_file),
                    theme :'chaos'
                }

        ]),9000,function(){

            console.log("editing some files");

    });

    /*
    ["open","close"].forEach(function(ev){
        editors.addEventListener(ev,function(){
           console.log(

               "editor window "+ev+":",

               Function.args(arguments)
            );
        });
    });*/

    editors.addEventListener("change",function(o){
       console.log("editor window change:",o.file,o.text.length,"chars");
    });


}

var hashDB = {},
    tagLookup = {},
    instances = [],
    hashMagic = Number.parseInt("aaaaaaaa",36),
    makeHash  = function(x){return Number(hashMagic+x).toString(36);},
    makeIndex = function(x){return Number(x).toString(36);},
    createHashDB = function(data,fmt,keep){
        var hash = makeHash(Object.keyCount(hashDB));
        hashDB[hash]=data;
        return {
            text : fmt.join(hash),
            hash : hash,
            data : keep ? data : undefined
        };
    };


function loadFile(filename,indentLevel) {

    indentLevel=indentLevel||0;
    var fullpath = path.resolve(filename);
    if (instances.indexOf(fullpath)>=0) return {
        text : 'var included_files = '+

        JSON.stringify(instances.concat([fullpath+"<<<"]),undefined,4).replace(/<<<\"/,"\"   // <<<--- you are here!" )+

        ';\nthrow new Error("recursive inclusion detected");' };
    if (!fs.existsSync(fullpath)) return { text : 'throw new Error("file not found");' };

    function doLoadFile() {
        var
        thrown=[],
        source = fs.readFileSync(filename,"utf-8"),
        //strike = source.whiteOutComments('-','-');
        //fs.writeFileSync(filename.replace(".js",".strike.js"),strike);
        pairs = {
                includeMarkers  : [include_markers_file],
                includeFileName : [include_inject_file],
                requireFileName : [require_inject]
        },
        chunks = source.ArraySplitCode(pairs,undefined,undefined,' '),
        dist = chunks && chunks.token_distribution;

        if (!dist) {
            return ({
                filename : filename,
                text : source
            });
        }

        var    paused = false,
                       hidden = [
                       function (x,ix) {
                           if (ix===0) {
                              paused=false;
                           }
                           return false;
                       }
                ];

        function isHidden (x,ix) {
                    return hidden.some(function(criteria){
                        switch (typeof criteria){
                            case 'function' : return  criteria(x,ix);
                            case 'number'   : return  ix===criteria;
                            case 'object'   : return criteria.indexOf ? criteria.indexOf(x)>=0 : Object.values(criteria).indexOf(x)>=0;
                        }
                        return false;
                    });
                }

        function isShowing(x,ix) {
                    return !isHidden(x,ix);
                }

        var

        include_begins_fmt = ['/*{#>','<#}*/'],
                include_ends_fmt = include_begins_fmt,
                exclude_fmt = include_begins_fmt;

        function cleanupOmits(x){
                     return {
                         text:x.text,
                         split:x.split
                     };
                 }

        function cleanupFile(x) {
                    return  {
                        filename : x.filename,
                        include_file : x.include_file,
                        require_file : x.require_file,
                        arguments : x.classic_args || x.arrow_args || x.require_args
                    };
                }

        function  createInjectFileDb(file_token,db,indentLevel) {

              var filePkg;

              file_token.text = (filePkg=createHashDB({
                          injectFile :cleanupFile(db),
                      }, injectBlockWrapper(
                          'injected file:'+db.filename,
                          file_token.data.text,
                          indentLevel))).text;


                  //checkWrapRegEx (file_token.text,injectBlockWrapper.match,filePkg.hash)


              return filePkg;

        }

        function  createArrowIncudeFileDb(file_token,db,indentLevel) {

          var filePkg;

          file_token.text = (filePkg=createHashDB({
                      includeFile :cleanupFile(db),
                  }, arrowIncludeWrapper(
                      db.filename,
                      db.arrow_args,
                      file_token.data.text,
                      indentLevel))).text;

          //checkWrapRegEx (file_token.text,arrowIncludeWrapper.match,filePkg.hash)

          return filePkg;

        }

        function  createClassicIncludeFileDb(file_token,db,indentLevel) {

          var filePkg;

          file_token.text = (filePkg=createHashDB({
                      includeFile :cleanupFile(db),
                  }, classicIncludeWrapper(
                      db.filename,
                      db.name,
                      db.classic_args,
                      file_token.data.text,
                      indentLevel))).text;


          //checkWrapRegEx (file_token.text,classicIncludeWrapper.match,filePkg.hash)


          return filePkg;

        }

        function  createRequireFileDb(file_token,db,indentLevel) {

          var filePkg;

          file_token.text = (filePkg=createHashDB({
                      requireFile :cleanupFile(db),
                  }, requireBlockWrapper(

              db.filename,
                      file_token.data.text,
                      indentLevel))).text;

              //checkWrapRegEx (file_token.text,requireBlockWrapper.match,filePkg.hash)

          return filePkg;

        }

        function markIncludes(files) {
                    if (files){
                        var created = files.map(function(token){
                        token.indexes.forEach(function(file_ix){

                    var file_token=chunks.tokens[file_ix],
                                db=file_token.groups,
                                load_filename = db.filename,
                                isClassic = !!db.classic,
                                isArrow = !!db.arrow,
                                isRequire = !!db.require_file,

                        args = ( isClassic ?
                                         db.classic_args || ''
                                         : (isArrow ? db.arrow_args || '' : (
                                             (isRequire ? db.require_args : '' )
                                             )) ),

                        isInclude = ( isClassic ?
                                             db.classic.startsWith('include')
                                             : (isArrow   ? db.arrow.startsWith('include') : false)) ,

                        isInject = ( isClassic ?
                                             db.classic.startsWith('inject')
                                             : (isArrow   ? db.arrow.startsWith('inject') : isRequire)),

                        isRaw=isRequire || (isInject && args.indexOf("raw")>=0),
                                resolve_fn = function (fn ) {
                                    if ([".","/"].indexOf(fn.substr(0,1))>=0) return fn;
                                    return path.join(path.dirname(filename),fn);
                                },
                                loader = isRaw ? function (){
                                                    return { text : fs.readFileSync(resolve_fn(load_filename),"utf8")};
                                                 }
                                               : function(){
                                                   return loadFile(resolve_fn(load_filename),indentLevel+(isInject?0:4));
                                               };


                        try {
                                    file_token.data = loader();
                                } catch (e) {
                                    file_token.data = {
                                        text : '/* '+e .message+'*/'
                                    };

                            thrown.push (file_token.data);

                        }

                        if (isRequire) {
                                    return createRequireFileDb(file_token,db,indentLevel);
                                }

                        if (isInclude) {

                            if (isArrow) {
                                        return createArrowIncudeFileDb(file_token,db,indentLevel);
                                    }

                            if (isClassic) {
                                        return createClassicIncludeFileDb(file_token,db,indentLevel);
                                    }

                        }

                        if (isInject) {
                                    return createInjectFileDb(file_token,db,indentLevel);
                                }

                    });
                        });

            }
                }

        function markIncludeStart(begins,start_ix){
                    var
                    hide_start=function (x,ix) {return ix<start_ix;};

            hidden.push(hide_start);

            chunks.tokens[ start_ix ].text = createHashDB({
                        omit  : chunks.tokens.slice(0,start_ix+1).map(cleanupOmits),
                    },include_begins_fmt).text;

        }

        function markIncludeEnd(ends,end_ix){
                    var
                    hide_end=function (x,ix) {return ix>end_ix;};

            hidden.push(hide_end);
                    chunks.tokens[ end_ix ].text = createHashDB({
                        omit  : chunks.tokens.slice(end_ix).map(cleanupOmits),
                        //omit      : chunks.tokens[ end_ix ].split,
                    },include_ends_fmt).text;
                }

        function markIncludePause(pauses,pause_ix) {
                      hidden.push(function(x,ix){
                        if (ix===pause_ix) {
                          paused=pause_ix;
                          return true;
                        } else {
                           if (paused===pause_ix && ix > pause_ix) return true;
                        }
                        return false;
                    });
                }

        function markIncludeResume(resumes,resume_ix) {
                    hidden.push(function(x,ix){
                        if (ix===resume_ix) {
                                chunks.tokens[ ix ].text = createHashDB({
                                    omit : chunks.tokens.slice(paused,ix+1).map(cleanupOmits),
                                    //resume      : chunks.tokens[ ix ].split,
                                },exclude_fmt).text;
                                paused=false;
                        }
                        return false;
                    });
                }

        function detectIncludeMarkers(markers) {

            var count_start=0,count_end=0;
                    if (markers) {
                        markers.forEach(function(token){
                            token.indexes.forEach(function(ix){
                                 var marker = chunks.tokens[ix];
                                 if (marker && marker.groups && marker.groups.include_marker) {

                             if (marker.groups.begin) {
                                         markIncludeStart(marker,ix);
                                         count_start++;
                                     }

                             if (marker.groups.end) {
                                         markIncludeEnd(marker,ix);
                                         count_end++;
                                     }

                         } else {
                                     if (marker && marker.groups && marker.groups.mode==="included") {

                                 if (marker.groups.delim==="begins") {
                                             markIncludeStart(marker,ix);
                                             count_start++;
                                         }

                                 if (marker.groups.delim==="ends") {
                                             markIncludeEnd(marker,ix);
                                             count_end++;
                                         }

                             }
                                 }
                            });
                        });
                    }

            if (count_start>1 || count_end> 1 ) {

                throw new Error ('there should be at most 1 start and 1 end marker');

            }

            if (markers) {
                        markers.forEach(function(token){
                            token.indexes.forEach(function(ix){
                                 var marker = chunks.tokens[ix];
                                 if (marker && marker.groups && marker.groups.include_marker) {
                                    if (marker.groups.resume) {
                                      markIncludeResume(marker,ix);
                                    }
                                 }
                            });
                        });
                    }

            if (markers) {
                        markers.forEach(function(token){
                            token.indexes.forEach(function(ix){
                                 var marker = chunks.tokens[ix];
                                 if (marker && marker.groups && marker.groups.include_marker) {
                                     if (marker.groups.pause) {
                                         markIncludePause(marker,ix);
                                     }
                                 }
                            });
                        });
                    }

        }

        detectIncludeMarkers(dist.paths.includeMarkers);

        markIncludes(dist.paths.includeFileName);
                markIncludes(dist.paths.requireFileName);

        var js_src = chunks.tokens.filter(isShowing).join('');
        var sha256 = hash_js_src(js_src);
        return ({
            filename : filename,
                thrown   : thrown.length > 0 ? thrown : undefined,
                text     : js_src,
                sha256   : sha256,
                errors   : JSHINT_check(source,filename),
                outputDB : saveDB(hashDB)

        });

    }

    instances.push(fullpath);
    try {
        return doLoadFile();
    } finally {
        instances.pop();
    }



}

function parse_src (filename,src,dir,db) {
    dir = dir || {};

    var
    files= [],// internal temp stack (they end up in dir)
    result = {
        input : ""+src,// copy the input for reference
        parts : [],
        tokenPaths:[],
        text : src,// assume no embedded token or files
    },
    matches = [{// regexps to pass into ArraySplit

        omits          : saveDB.match,
        injectBlock    : injectBlockWrapper.match,
        arrowBlock     : arrowBlockWrapper.match,
        classicBlock   : classicBlockWrapper.match,
        requireBlock   : requireBlockWrapper.match,
        includeWrapper : classicIncludeWrapper.match,
    },{
        markers        : tokenMarker

    }],
    parsers = {
        //parse the results from ArraySplit(matches)
        // these functions are callled, in the listed order,
        // with any tokens detected by ArraySplit

        // special case - we do this first to populate db (above)
        // all other parsers use the results of this to
        // get access to any linked data in db (linked on groups.hash )
        omits          : function (token) {
            var b64 = token.groups.b64;
            deleteKeys(token,["split","groups","mode","src","path"]);
            db =(token.db=JSON.parse(fromb64(b64)));
            return false;
        },
        injectBlock    : function (block,data) {

            if (block && block.groups && block.groups.inject_block &&  block.groups.hash) {

                var file_src = injectBlockWrapper.find(result.input,block.groups.hash);
                if (file_src) {
                    var relpath = path.dirname(filename);
                    if (relpath==='.') relpath='';

                    var f = {
                        text     :  data.injectFile.include_file,
                        hash     :  block.groups.hash,
                        //file_src : file_src,
                        file : {
                            filename : data.injectFile.filename,
                            data : parse_src (path.join(relpath,data.injectFile.filename),file_src,dir,db)
                        },
                        ix    : block.ix
                    };

                    if (relpath!=='') f.file.relpath=relpath;

                    files.push(f);
                    return f;
                }
            }
        },
        classicBlock   : function () {},
        requireBlock   : function (block,data) {

            var f = {
                text     : data.requireFile.require_file,
                hash     : block.groups.hash,
                file : {
                    filename : data.requireFile.filename,
                },
                ix    : block.ix
            };
            files.push(f);
            return f;

        },
        includeWrapper : function (include,data) {


            if (include && include.groups && include.groups.include) {
                var locate =  include.groups.include.ArraySplit({
                    classic : classicIncludeWrapper.filter,
                    arrow   : arrowIncludeWrapper.filter
                });
                if (locate) {
                    var
                    inctok,
                    paths= locate.token_distribution.paths;
                    if (paths.classic) {
                        inctok=locate.tokens[paths.classic.indexes[0]];
                    } else {
                        if (paths.arrow) {
                            inctok=locate.tokens[paths.arrow.indexes[0]];
                        }
                    }
                    if (inctok) {

                        var file_src = classicIncludeWrapper.find(result.input,include.groups.hash);
                        if (file_src) {
                           var f = {
                               text     :  data.includeFile.include_file,
                               hash     :  include.hash,
                               file : {
                                   filename : data.includeFile.filename,
                                   data : parse_src (data.includeFile.filename,file_src,dir,db)
                               },
                               ix    : include.ix
                           };
                           var relpath = path.dirname(filename);
                           if (relpath!=='.') f.file.relpath=relpath;

                           files.push(f);
                           return f;
                        }


                    }
                }
            }





        },
        markers        : function (marker,data) {
            if (data && data.omit) {
                marker.text = data.omit.map(function(x) {return x.text || x.split ;}).join('');
                return marker;
            }
        },

    },
    parserNames = Object.keys(parsers),

    process=function(matches) {
        var parts = result.text.ArraySplit( matches );
        if (parts) {
            var dist  = parts.token_distribution,
            tokenPaths = dist.paths;

            parserNames.forEach(function(pname){
                var input  = tokenPaths[pname];
                if (!input) return;
                if (!input.indexes) return;
                if (input.indexes.length<1) return;
                var parser = parsers[pname];
                if (!parser) return;

                input.indexes.map(function(ix){
                    var tok = parts.tokens[ix];
                    tok.ix=ix;
                    return tok;
                }).map(function(tok){
                    if (db && tok.groups &&  tok.groups.hash) {
                       return parser(tok,db[tok.groups.hash]);
                    } else {
                        if (!db) {
                            return parser(tok);
                        }
                    }
                }).forEach(function(updated) {
                    if (updated) {
                        parts.tokens[updated.ix]=updated;
                    }
                });
            });
            result.parts.push(parts);
            result.tokenPaths.push(tokenPaths);
            result.text = parts.tokens.map(function(x){return x.text;}).join('');
        }
    };

    matches.forEach(process);

    files.forEach(function (filex){
        if (filex.file && filex.file.filename && filex.file.data) {
            var fn_key=filex.file.filename;
            if (filex.file.relpath) fn_key = path.join(filex.file.relpath,fn_key)

            dir[fn_key]=filex.file;
            dir[fn_key].text = filex.file.data.text;
            dir[fn_key].sha256 = hash_js_src(dir[fn_key].text);

            delete filex.file.data;
            delete filex.file;

        }
    });
    files.splice(0,files.length);
    dir[filename]={ filename : filename, text: result.text };
    return result;


}



function interactiveBuild(bld_file,out_file) {
    var dir = {};

    var bld_dir = path.dirname(bld_file);

    var bld_fn  = path.basename(bld_file);
    console.log("loading:",bld_file);
    var src = loadFile (bld_file,0);
    console.log("re-parsing:",bld_fn,src.text.length,"bytes code",src.outputDB.length, "bytes db");
    var parsed = parse_src (bld_fn,src.text+src.outputDB,dir);
    console.log("writing dir:",bld_dir,"<<<",Object.keys(dir).join(","));
    if (writeFileDir(dir,bld_dir)) {
        console.log("linting and saving:",out_file);
        if( writeJSFileSyncViaJSHINT(out_file,src.text+src.outputDB)) {
            save_out_file(out_file,src.text);
            console.log("all files linted and saved. tracking changes");

            trackEdits(
                bld_dir,        // eg ./src
                bld_fn,         // filename within build_dir of main source file
                out_file,
                writeFileDir,
                dir,500);

        } else {
            console.log("could not save:",out_file);
        }
    } else {
        console.log("could not save dir:",bld_dir);
    }





}

var filename = process.argv[2],out_file=process.argv[3];
if (filename && out_file) {
    if (fs.existsSync(filename)) {
        var out_dir = path.dirname(out_file);
        if (out_dir === "." || fs.existsSync(path.resolve(out_dir))) {
            console.log({filename,out_file});
            interactiveBuild(filename,out_file);
        } else {
            console.log({"Path Not Found":out_dir});
        }
    } else {
        console.log({"File Not Found":filename});
    }
} else {
    console.log({"usage example":"jsbdlr src/inputfile.js lib/outputfile.js"});
}
