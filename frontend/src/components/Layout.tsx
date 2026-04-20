"use client";

import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export default function Layout({ children, className = "" }: LayoutProps) {
  return (
    <div className={`relative min-h-screen overflow-hidden font-sans ${className}`}
      style={{ background: "#F1F5F9", fontFamily: "'DM Sans', 'Outfit', sans-serif" }}>
      
      {/* Mesh gradient layer */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        {/* Primary lavender orb */}
        <div
          className="absolute rounded-full opacity-40"
          style={{
            width: "720px", height: "720px",
            top: "-180px", left: "-120px",
            background: "radial-gradient(circle, #C7D2FE 0%, #EEF2FF 55%, transparent 80%)",
            filter: "blur(80px)",
          }}
        />
        {/* Mint orb */}
        <div
          className="absolute rounded-full opacity-35"
          style={{
            width: "560px", height: "560px",
            bottom: "-100px", right: "-80px",
            background: "radial-gradient(circle, #A7F3D0 0%, #ECFDF5 55%, transparent 80%)",
            filter: "blur(72px)",
          }}
        />
        {/* Subtle warm orb for depth */}
        <div
          className="absolute rounded-full opacity-20"
          style={{
            width: "400px", height: "400px",
            top: "40%", left: "45%",
            background: "radial-gradient(circle, #FDE68A 0%, #FEF9C3 60%, transparent 80%)",
            filter: "blur(90px)",
          }}
        />
        {/* Fine grain texture */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)"/>
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
