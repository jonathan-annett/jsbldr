console.log("this is input 1");
console.log("this is input 2");
console.log("this is input 4");
console.log("this is input 8");
console.log("this is input 9");
function input10() {console.log("this is input 10");}
console.log("this is input 11");
function someFile3 (){console.log("this is input 3");}
var someFile5 =()=>{console.log("this is input 5");}    ;
someFile3();
someFile5();
var x =console.log("this is input 6");
x ={"data":"hello world"}
;
function someFile7 (some,args){console.log("This is input 7",some,args);
console.log("That's all from input 7");}
someFile7("a","b");
function someFile12(even,some,more,args){return {some:some,args:args};}
console.log(someFile12("some","args"));
console.log("and we are done");