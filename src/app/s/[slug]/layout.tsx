import { Fraunces, Instrument_Sans } from "next/font/google";

const serif = Fraunces({
  variable: "--font-public-serif",
  subsets: ["latin"],
  axes: ["opsz"],
});

const sans = Instrument_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${serif.variable} ${sans.variable}`}>
      {children}
    </div>
  );
}
