export function createTooltips(doc){
  const box=doc.getElementById('gameTooltip');let anchor=null,pinned=false;
  function hide(){if(anchor)anchor.removeAttribute('aria-describedby');box.hidden=true;anchor=null;pinned=false;}
  function position(){
    if(!anchor?.isConnected){hide();return;}
    const r=anchor.getBoundingClientRect(),b=box.getBoundingClientRect(),margin=12;
    const width=doc.documentElement.clientWidth,height=doc.documentElement.clientHeight;
    if(r.bottom<=0||r.top>=height){hide();return;}
    box.style.left=`${Math.max(margin,Math.min(r.left+r.width/2-b.width/2,width-b.width-margin))}px`;
    const below=r.bottom+9;box.style.top=`${below+b.height<=height-margin?below:Math.max(margin,r.top-b.height-9)}px`;
  }
  function show(target){
    if(anchor!==target)hide();anchor=target;
    const host=target.closest('dialog[open]')||doc.body;if(box.parentElement!==host)host.append(box);
    doc.getElementById('tooltipName').textContent=target.dataset.tooltipName||'';
    doc.getElementById('tooltipText').textContent=target.dataset.tooltip;
    box.classList.toggle('negative',target.dataset.tooltipNegative==='true');box.hidden=false;
    target.setAttribute('aria-describedby',box.id);position();
  }
  doc.addEventListener('pointerover',e=>{const t=e.target.closest('[data-tooltip]');if(t&&(!pinned||t===anchor))show(t);});
  doc.addEventListener('pointerout',e=>{if(pinned)return;const t=e.target.closest('[data-tooltip]');if((t===anchor||box.contains(e.target))&&!anchor?.contains(e.relatedTarget)&&!box.contains(e.relatedTarget))hide();});
  doc.addEventListener('focusin',e=>{const t=e.target.closest('[data-tooltip]');if(t)show(t);});
  doc.addEventListener('focusout',e=>{if(e.target===anchor&&!box.contains(e.relatedTarget))hide();});
  doc.addEventListener('click',e=>{const t=e.target.closest('[data-tooltip]');if(t){if(t===anchor&&pinned)hide();else{show(t);pinned=true;}}else if(!box.contains(e.target))hide();});
  doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden){hide();e.preventDefault();e.stopImmediatePropagation();}},true);
  doc.addEventListener('scroll',()=>{if(anchor)position();},true);
  doc.defaultView.addEventListener('resize',()=>{if(anchor)position();});
  doc.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',hide));
  return {hide};
}
