// v13 enables unattended stories. An explicit manual choice remains manual after saving/reloading.
export function automaticPreference(saved){
  return saved?.autoModeVersion===1&&typeof saved.automatic==='boolean'?saved.automatic:true;
}
