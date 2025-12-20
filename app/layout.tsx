import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Roboto, Poppins, Montserrat, Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Text layer fonts
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MotionShapes - Professional Motion Design in the Browser",
  description: "Create stunning, Apple-quality product animations directly in your browser. No heavy software, no steep learning curve.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  keywords: ["motion design", "animation", "video editor", "browser animation", "marketing videos", "motion graphics", "product showcase", "jitter alternative", "2D", "logo animation"],
  authors: [{ name: "MotionShapes Team" }],
  creator: "MotionShapes",
  publisher: "MotionShapes",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/resources/logo.png',
  },
  openGraph: {
    title: "MotionShapes - Professional Motion Design in the Browser",
    description: "Create stunning, Apple-quality product animations directly in your browser.",
    siteName: "MotionShapes",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: '/resources/logo.png',
        width: 1200,
        height: 630,
        alt: 'MotionShapes - Animation Editor',
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MotionShapes",
    description: "Professional Motion Design in the Browser",
    images: ['/resources/logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${roboto.variable} ${poppins.variable} ${montserrat.variable} ${spaceGrotesk.variable} ${dmSans.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
