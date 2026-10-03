import type { Metadata } from "next";
import { Amiri, Nunito } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast-provider";

const nunitoSans = Nunito({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/**
 * Amiri renders the hadith on the teacher home page. `globals.css` already
 * asks for `'Amiri'` in its `.hadith-arabic` / `.arabic-text` stacks, but
 * nothing ever loaded it, so the Arabic text silently fell back to whatever
 * serif the device had. Loading it here fixes that with no CSS change: the
 * production build emits the plain `font-family: Amiri` @font-face (plus
 * `--font-amiri`, with the font-fallback metric), so those existing stacks
 * now resolve — and new components can reference the variable directly.
 *
 * `preload: false` + `display: "swap"`, weight 400 only: Arabic is one
 * paragraph on one page, so it should not sit in the critical path of every
 * other route, and it is never rendered bold.
 */
const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Applies the persisted theme before first paint so there is no flash of the
 * wrong colour scheme. Light is the default; the OS preference is not used.
 * Mirrors the logic in `src/components/ui/theme-toggle.tsx`.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "NgajarYuk - SMP ABBS Surakarta",
  description: "Sistem Manajemen Sekolah SMP ABBS Surakarta",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${nunitoSans.variable} ${amiri.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Blocking: runs while the HTML is parsed, before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-dark-900 text-dark-100">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
