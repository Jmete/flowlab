import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FlowLab",
  description: "Directed flow network editor and max-flow/min-cut visualizer",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
