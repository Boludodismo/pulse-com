import { describe, expect, it } from "vitest";
import { averageSamplePixels, imageSampleMarker, imageSamplePoint, samplePixelRegion } from "../shared/sessionColorSampling";

describe("selected image pixel sampling",()=>{
  const rect={left:40,top:60,width:900,height:600};
  const identity={x:0,y:0,scale:1,rotation:0};
  it("uses the selected image dimensions and excludes its letterbox",()=>{
    const client={x:rect.left+300,y:rect.top+150};
    expect(imageSamplePoint(client,rect,{width:600,height:600},identity)).toMatchObject({pixelX:150,pixelY:150});
    expect(imageSamplePoint(client,rect,{width:1200,height:600},identity)).toMatchObject({pixelX:400,pixelY:100});
    expect(imageSamplePoint({x:rect.left+100,y:rect.top+300},rect,{width:600,height:600},identity)).toBeNull();
  });
  it.each([0,15,90,180,270])("addresses the same original pixel with pan, zoom and %s degree rotation",rotation=>{
    const size={width:1200,height:800},view={x:51,y:-27,scale:2.3,rotation};
    const px=237.25,py=411.25,fit=.75;
    const x=px*fit-rect.width/2,y=py*fit-rect.height/2,angle=rotation*Math.PI/180;
    const client={x:rect.left+rect.width/2+view.x+(x*Math.cos(angle)-y*Math.sin(angle))*view.scale,y:rect.top+rect.height/2+view.y+(x*Math.sin(angle)+y*Math.cos(angle))*view.scale};
    expect(imageSamplePoint(client,rect,size,view)).toMatchObject({pixelX:237,pixelY:411});
  });
  it("clips edge neighborhoods without moving the chosen pixel, including tiny images",()=>{
    expect(samplePixelRegion(0,0,100,100)).toEqual({left:0,top:0,width:3,height:3});
    expect(samplePixelRegion(99,99,100,100)).toEqual({left:97,top:97,width:3,height:3});
    expect(samplePixelRegion(0,0,1,1)).toEqual({left:0,top:0,width:1,height:1});
    expect(samplePixelRegion(20,30,100,100)).toEqual({left:18,top:28,width:5,height:5});
  });
  it("averages actual source RGB and ignores colorless transparent pixels",()=>{
    expect(averageSamplePixels([10,20,30,255,30,40,50,255])).toEqual([20,30,40]);
    expect(averageSamplePixels([200,100,50,255,0,0,0,0])).toEqual([200,100,50]);
    expect(averageSamplePixels([255,255,255,0])).toBeNull();
  });
  it("positions recorded image points correctly after a viewport aspect ratio change",()=>{
    const marker=imageSampleMarker(25,25,600,600,900,600);
    expect(marker.xPct).toBeCloseTo(100/3);expect(marker.yPct).toBe(25);
    const portrait=imageSampleMarker(25,25,600,600,600,900);
    expect(portrait.xPct).toBe(25);expect(portrait.yPct).toBeCloseTo(100/3);
  });
});
