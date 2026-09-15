"use client";

import Navbar from "@/components/Navbar";
import CityScene from "@/components/CityScene";

export default function ClientHome() {
  return (
    <main className="relative h-screen w-full overflow-hidden">

      {/* Navbar */}
      <div className="absolute top-0 left-0 right-0 z-[100]">
        <Navbar />
      </div>

      {/* 3D City */}
      <CityScene />

    </main>
  );
}