import {inflateSync} from "node:zlib";

// Read the unmodified runtime PNGs to check alpha and registration, without image tooling.
export function inspectRgbaPng(bytes){
  if(bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a") throw new Error("Not a PNG");
  const width=bytes.readUInt32BE(16), height=bytes.readUInt32BE(20);
  if(bytes[24]!==8 || bytes[25]!==6 || bytes[28]!==0) throw new Error("Expected noninterlaced RGBA8");
  const chunks=[];
  for(let offset=8;offset<bytes.length;){
    const size=bytes.readUInt32BE(offset), type=bytes.toString("ascii",offset+4,offset+8);
    if(type==="IDAT") chunks.push(bytes.subarray(offset+8,offset+8+size));
    offset+=size+12;
  }
  const raw=inflateSync(Buffer.concat(chunks)), stride=width*4;
  const rgba=Buffer.alloc(stride*height);
  const bounds={left:width,top:height,right:-1,bottom:-1};
  let transparent=0, opaque=0;
  const paeth=(a,b,c)=>{
    const p=a+b-c, pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
    return pa<=pb && pa<=pc?a:pb<=pc?b:c;
  };
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];
    if(filter>4) throw new Error("Invalid PNG filter");
    for(let x=0;x<stride;x++){
      const pos=y*stride+x, a=x>=4?rgba[pos-4]:0, b=y?rgba[pos-stride]:0, c=y && x>=4?rgba[pos-stride-4]:0;
      const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      rgba[pos]=(raw[y*(stride+1)+1+x]+predictor)&255;
      if(x%4!==3) continue;
      const alpha=rgba[pos], px=(x-3)/4;
      if(alpha===0) transparent++;
      if(alpha===255) opaque++;
      if(alpha>=250){bounds.left=Math.min(bounds.left,px);bounds.right=Math.max(bounds.right,px);bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);}
    }
  }
  return {width,height,transparent,opaque,bounds,alphaAt:(x,y)=>rgba[(y*width+x)*4+3]};
}
