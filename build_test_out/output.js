
console.log("this is input 1");

/*

 function(inject){"filename";} is a literal file include with no wrapping.

 the file content is inserted without pre-parsing, replacing the entire function
 declaration with file content.

*/

/*[aaaaaaau]-(injected file:input2.js)-->*/
console.log("this is input 2");

/*[aaaaaaap]-(injected file:input4.js)-->*/


console.log("this is input 4");
/*<--(injected file:input4.js)-[aaaaaaap]*/

/*[aaaaaaat]-(injected file:subdir/input8.js)-->*/
console.log("this is input 8");

/*[aaaaaaas]-(injected file:input9.js)-->*/

console.log("this is input 9");

/*[aaaaaaaq]-(injected file:input10.js)-->*/
function input10() {

   console.log("this is input 10");

}
/*<--(injected file:input10.js)-[aaaaaaaq]*/

/*[aaaaaaar]-(injected file:input11.js)-->*/

console.log("this is input 11");
/*<--(injected file:input11.js)-[aaaaaaar]*/
/*<--(injected file:input9.js)-[aaaaaaas]*/
/*<--(injected file:subdir/input8.js)-[aaaaaaat]*/
/*<--(injected file:input2.js)-[aaaaaaau]*/

// function(include){"filename";} wraps the file  in whatever function declaration you provide, without the first
// "include" argument. other arguments are left intact and can be used to pass globals into the file
// note that the file being included does not have the function declared at all
// so the arguments behave as globals if you use the file standalone
// this means you'd need to delcare globals ( see input7.js for an example)

/*[aaaaaaav]>>> file:input3.js >>>*/
function someFile3 (){
    
    console.log("this is input 3");
}/*<<< file:input3.js <<<[aaaaaaav]*/

var someFile5 = /*[aaaaaaaw]>>> file:input5.js >>>*/
()=>{
    
    
    console.log("this is input 5");
}/*<<< file:input5.js <<<[aaaaaaaw]*/;

someFile3();
someFile5();

// whilst you **can** use arrow functions for an inject, it makes very little sense to do so
// for code... since by definition, the inject syntax replaces the function declaration
// entirely with the file content.

var x = /*[aaaaaaax]-(injected file:input6.js)-->*/


console.log("this is input 6");
/*<--(injected file:input6.js)-[aaaaaaax]*/

// however it is the perfect way to preload JSON

x = /*[aaaaaaay]-(injected file:input6a.json)-->*/
{
    "data":"hello world"
}
/*<--(injected file:input6a.json)-[aaaaaaay]*/;


/*[aaaaaab2]>>> file:input7.js >>>*/
function someFile7 (some,args){
    /*{#>aaaaaaaz<#}*/
    
    console.log("This is input 7",some,args);
    
    /*{#>aaaaaab1<#}*/
    
    console.log("That's all from input 7");
    
    /*{#>aaaaaab0<#}*/
}/*<<< file:input7.js <<<[aaaaaab2]*/


someFile7("a","b");


/*[aaaaaab3]-(injected file:input12.js)-->*/
function someFile12(even,some,more,args){
    return {some:some,args:args};
}
/*<--(injected file:input12.js)-[aaaaaab3]*/


console.log(someFile12("some","args"));


console.log("and we are done");

/*{"omits.db":"eJztVltv2jAU/iuWX9ZWqBDoFdQ+TNqep2lvSzU5yQkxTWxmO4UO5b/vOBAuIR1Wtabd1IAgPvH5vnNx7G9B2eqiwwXlYgKh+cxTsKMY/wXL8B4fTHNzdjrRtIP3YZpH8CMup9E4F6HhUhAtM7CuZ0dLmOOFv/Hz6aigRdGp6ILDdF7Pjc/r1QlLzzpj6MDoPZvRa2CMDjNeuxFe1/muG+jgj3Q6DyKuuqX3lRvr1RZr3b1OHh/Ote/G2q/n2m+gGy/pSqSn+AZufIOj1Yw14aCBMHEgPG8kXMOTm1tSUZw3UPDDJbx4iqEs2M1tBX/RAD9xgGfoJ4UTw3JqneTewsqMGzr8vqAG5nhDu10y0QkXhmRsDkoNvR5evtjYdcIiORsalcO2ORcRxHvWQMmZBrVnFzKCPWMED5CurL54YKrse4epsR5ZS/ekspcpa1wZ+iOMuSifck2YIHJqFwxLMXx1D4qYhBmcHvGQGdBkloACHKMdiC0YWVUvIqEUBmx+himjfWESRMRvriHOU8Jj8ihzMmM4xUiMNeYCMGuOQ9AG3aM1sMY+legdJORhQsZgEGsspIIII13OwlGGgSI+CZkuc7afk679pUVnQfU0td2hTSnT4m7TynSnlc1un0Q0KlFXnX6qonbe36wniOjVqrms5TLD+ZzckP5gZGu7VbrMoXRfGMLuFQ8T1DKF01SOj3z6zSY4k+IDLvqtKqyik7nBF7HMwqfHowMd/go6z2C3xcJhU7t020Uvq22us36/cD8VBC9/A4TbhS8KhMPnGI0w2p5MlcP2RiIdTmvHA8WrTpSd0LYwyk3MIaZpuxLpZ+sSSbUukXS7Esm8pkTK25VID21LpNnLS6T5y0qkxzYk0q93ifSfSKSg9y6RnimRAu/fkEhB/81KpGDwdiRS8RuCb29i"}*/