
console.log("this is input 1");

/*

 function(inject){"filename";} is a literal file include with no wrapping.

 the file content is inserted without pre-parsing, replacing the entire function
 declaration with file content.

*/


console.log("this is input 2");




console.log("this is input 4");



console.log("this is input 8");



console.log("this is input 9");


function input10() {

   console.log("this is input 10");

}




console.log("this is input 11");





// function(include){"filename";} wraps the file  in whatever function declaration you provide, without the first
// "include" argument. other arguments are left intact and can be used to pass globals into the file
// note that the file being included does not have the function declared at all
// so the arguments behave as globals if you use the file standalone
// this means you'd need to delcare globals ( see input7.js for an example)


function someFile3 (){
    
    console.log("this is input 3");
}

var someFile5 = 
()=>{
    
    
    console.log("this is input 5");
};

someFile3();
someFile5();

// whilst you **can** use arrow functions for an inject, it makes very little sense to do so
// for code... since by definition, the inject syntax replaces the function declaration
// entirely with the file content.

var x = 


console.log("this is input 6");


// however it is the perfect way to preload JSON

x = 
{
    "data":"hello world"
}
;




function someFile7 (some,args){
    
    
    console.log("This is input 7",some,args);
    
    
    
    console.log("That's all from input 7");
    
    
}


someFile7("a","b");



function someFile12(even,some,more,args){
    return {some:some,args:args};
}



console.log(someFile12("some","args"));


console.log("and we are done");
