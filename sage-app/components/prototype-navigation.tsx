"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PrototypeNavigationBridge(){
  const router=useRouter();
  useEffect(()=>{
    const handler=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      const anchor=target?.closest?.('a[href="#"]') as HTMLAnchorElement|null;
      if(!anchor)return;
      const label=(anchor.textContent||"").trim().toLowerCase();
      const routes:Record<string,string>={privacy:"/privacy",terms:"/terms",support:"/support"};
      if(routes[label]){event.preventDefault();router.push(routes[label]);}
    };
    document.addEventListener("click",handler);
    return()=>document.removeEventListener("click",handler);
  },[router]);
  return null;
}
