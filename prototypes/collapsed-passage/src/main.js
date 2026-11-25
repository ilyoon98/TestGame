import {CP} from "./bridge.js";

globalThis.CP = CP;

const legacy = document.createElement("script");
legacy.src = new URL("./legacy.js", import.meta.url).href;
document.body.append(legacy);
