import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chennai Flood Twin — Urban Flood Intelligence",
  description:
    "Predict urban flooding in Chennai using real-time rainfall, terrain intelligence and 3D flood simulation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}