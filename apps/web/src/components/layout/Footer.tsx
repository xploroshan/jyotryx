import Link from "next/link";

const footerLinks = {
  Features: [
    { label: "AI Chat", href: "/chat" },
    { label: "Palmistry", href: "/palmistry" },
    { label: "Kundli", href: "/kundli" },
    { label: "Matching", href: "/matching" },
    { label: "Horoscope", href: "/horoscope" },
    { label: "Panchang", href: "/panchang" },
    { label: "Muhurat", href: "/muhurat" },
  ],
  Resources: [
    { label: "Pricing", href: "/pricing" },
    { label: "Reports", href: "/reports" },
    { label: "Get Started", href: "/auth?mode=signup" },
  ],
  Company: [
    { label: "Profile", href: "/profile" },
    { label: "Sign In", href: "/auth?mode=login" },
    { label: "Buy Credits", href: "/pricing" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t divider bg-surface-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-7 w-7 rounded-md bg-primary-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-white tracking-tight">Jyotron</span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed mb-4">
              AI-powered Vedic astrology platform. Personalized insights, available 24/7.
            </p>
            <p className="text-xs text-white/25">
              For guidance and entertainment purposes.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-sm text-white/40 hover:text-white transition-colors duration-150">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t divider flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/25">
            &copy; {new Date().getFullYear()} Jyotron. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-white/25 hover:text-white/50 transition-colors text-xs">Twitter</a>
            <a href="#" className="text-white/25 hover:text-white/50 transition-colors text-xs">Instagram</a>
            <a href="#" className="text-white/25 hover:text-white/50 transition-colors text-xs">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
