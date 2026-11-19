import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Khmer Pro · AI Voice Studio & Khmer Alphabet',
  description: 'Learn the Khmer alphabet and generate studio-quality speech with OpenBMB VoxCPM2 voice cloning and voice design.',
  keywords: ['Khmer', 'alphabet', 'language', 'VoxCPM2', 'voice cloning', 'TTS', 'AI speech', 'Cambodia'],
  authors: [{ name: 'Rainy Tech & Khmer Pro' }],
};

export const viewport: Viewport = {
  themeColor: '#0f0d0e',
  width: 'device-width',
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts: Lilita One (Rainy Tech display font), Outfit (body font), Hanuman (Khmer font) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Hanuman:wght@400;700;900&family=Lilita+One&family=Outfit:wght@300;400;500;600;700;800&display=swap" 
          rel="stylesheet"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className="app-body">
        {children}
      </body>
    </html>
  );
}
