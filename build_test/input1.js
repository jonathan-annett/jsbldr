
console.log("this is input 1");

/*

 function(inject){"filename";} is a literal file include with no wrapping.

 the file content is inserted without pre-parsing, replacing the entire function
 declaration with file content.

*/

function someFile2(inject){"input2.js";}

// function(include){"filename";} wraps the file  in whatever function declaration you provide, without the first
// "include" argument. other arguments are left intact and can be used to pass globals into the file
// note that the file being included does not have the function declared at all
// so the arguments behave as globals if you use the file standalone
// this means you'd need to delcare globals ( see input7.js for an example)

function someFile3(include){"input3.js";}

var someFile5 = (include) => {"input5.js";};

someFile3();
someFile5();

// whilst you **can** use arrow functions for an inject, it makes very little sense to do so
// for code... since by definition, the inject syntax replaces the function declaration
// entirely with the file content.

var x = (inject)=>{"input6.js";}

// however it is the perfect way to preload JSON

x = (inject)=>{"input6a.json";};


function someFile7(include,some,args){
    "input7.js";
}


someFile7("a","b");


function someFile12(inject,some,args){"input12.js";}


console.log(someFile12("some","args"));


console.log("and we are done");
