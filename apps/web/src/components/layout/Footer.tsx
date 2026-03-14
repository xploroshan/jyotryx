import Link from "next/link";

const footerLinks = {
  Features: [
    { label: "AI Astrologer Chat", href: "/chat" },
    { label: "Palmistry Reading", href: "/palmistry" },
    { label: "Kundli Generator", href: "/kundli" },
    { label: "Kundli Matching", href: "/matching" },
    { label: "Daily Horoscope", href: "/horoscope" },
    { label: "Panchang", href: "/panchang" },
    { label: "Muhurat Finder", href: "/muhurat" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Pricing", href: "/pricing" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Refund Policy", href: "/refund" },
    { label: "Disclaimer", href: "/disclaimer" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-mystic-500 flex items-center justify-center text-white font-bold text-sm">
                J
              </div>
              <span className="text-xl font-display font-bold text-gradient">Jyotryx</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              AI-powered astrology platform delivering instant, personalized spiritual guidance 24/7.
            </p>
            <p className="text-xs text-gray-500">
              For entertainment and spiritual guidance purposes only.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Jyotryx. All rights reserved.
          </p>
          <div className="flex gap-6 text-gray-400">
            <a href="#" className="hover:text-white transition-colors text-sm">Twitter</a>
            <a href="#" className="hover:text-white transition-colors text-sm">Instagram</a>
            <a href="#" className="hover:text-white transition-colors text-sm">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
