import { cn } from "@/lib/utils";
import React from "react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center bg-black overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#00d8ff]/20 blur-[120px] rounded-full opacity-30" />
        <div className="absolute bottom-0 left-0 right-0 h-[500px] bg-linear-to-t from-[#00d8ff]/10 to-transparent" />
        
        {/* Light Beams Simulation */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
           <div className="absolute bottom-0 left-0 w-2 h-full bg-linear-to-t from-[#00d8ff]/50 to-transparent -rotate-45 origin-bottom transform translate-x-[-200px] blur-md" />
           <div className="absolute bottom-0 right-0 w-2 h-full bg-linear-to-t from-[#00d8ff]/50 to-transparent rotate-45 origin-bottom transform translate-x-[200px] blur-md" />
           {/* Add more beams as needed via CSS or SVG later if required */}
        </div>
        
        {/* Grid Floor */}
        <div className="absolute bottom-0 left-0 right-0 h-[300px] perspective-grid opacity-30" 
             style={{
               background: `linear-gradient(transparent 0%, #00d8ff 100%), 
                            linear-gradient(90deg, rgba(0, 216, 255, 0.1) 1px, transparent 1px),
                            linear-gradient(rgba(0, 216, 255, 0.1) 1px, transparent 1px)`,
               backgroundSize: '100% 100%, 50px 50px, 50px 50px',
               transform: 'perspective(500px) rotateX(60deg)',
               transformOrigin: 'bottom'
             }} 
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl mx-auto space-y-8">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white space-y-2">
          <span className="block">Learn by playing</span>
          <span className="block text-[#00d8ff]">paperx</span>
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl leading-relaxed">
          PaperX is here. Safe. Secure. Trusted. With real-time data and a risk-free environment, 
          master the art of trading before you invest. We are just getting started.
        </p>

        <button className="mt-8 px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(0,216,255,0.5)] hover:shadow-[0_0_30px_rgba(0,216,255,0.7)]">
          Learn More
        </button>
      </div>
    </section>
  );
}
