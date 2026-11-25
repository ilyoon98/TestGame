import {CP} from "./bridge.js";
import {scriptOrder} from "./scriptOrder.js";

globalThis.CP = CP;

// 화면 스크립트는 전역 이름을 함께 쓰는 일반 스크립트다. async=false로 넣은 순서대로 실행한다.
for(const file of scriptOrder){
  const script = document.createElement("script");
  script.src = new URL(`./${file}`, import.meta.url).href;
  script.async = false;
  document.body.append(script);
}
