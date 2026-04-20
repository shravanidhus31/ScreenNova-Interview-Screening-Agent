import "./globals.css"; // This loads all your Tailwind styles!

export const metadata = {
  title: "ScreenNova HR",
  description: "AI-Powered Interview Screening Agent",
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