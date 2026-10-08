import * as g from './gen.mjs';
const [,, fn, theme, arg] = process.argv;
console.log(g[fn](theme, arg?JSON.parse(arg):undefined));
