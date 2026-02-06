import "./globals.css";
import { ReactNode } from "react";
import { Oswald, Source_Sans_3 } from "next/font/google";

const oswald = Oswald({ subsets: ["latin"], variable: "--font-display" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: "Jeopardy Twist",
  description: "Real-time multiplayer Jeopardy with Double or Nothing twist"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${oswald.variable} ${sourceSans.variable}`}>
      <body className="bg-deepBlue text-white font-body antialiased">
        {children}
      </body>
    </html>
  );
}
