import { useState } from "react";

interface NewsArticle {
  id: number;
  category: string;
  headline: string;
  blurb: string;
  source: string;
  date: string;
  image?: string;
}

const NEWS_ARTICLES: NewsArticle[] = [
  {
    id: 1,
    category: "RBA Policy",
    headline: "RBA Hikes Cash Rate to 3.85% in First Increase Since November 2023",
    blurb:
      "The Reserve Bank of Australia raised the official cash rate by 25 basis points to 3.85 per cent at its February meeting, the first hike in more than two years. Lenders are expected to pass the increase onto variable mortgage rates, with NAB already confirming a 0.25% rise effective 13 February.",
    source: "Reserve Bank of Australia",
    date: "3 Feb 2026",
    image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80",
  },
  {
    id: 2,
    category: "Regulation",
    headline: "APRA Introduces Debt-to-Income Lending Cap From 1 February 2026",
    blurb:
      "Banks are now limited to issuing only 20% of new mortgages to borrowers whose debt exceeds six times their income. The macroprudential measure targets a build-up of riskier lending, particularly among investors who typically borrow at higher DTI ratios.",
    source: "APRA",
    date: "1 Feb 2026",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80",
  },
  {
    id: 3,
    category: "Property Market",
    headline: "House Prices Forecast to Rise 7.7% in 2026 Despite Rate Uncertainty",
    blurb:
      "KPMG's latest Residential Property Outlook predicts continued momentum in the property market, with Perth set to lead at nearly 13% growth. Brisbane house prices are expected to climb 11%, while Sydney is forecast for a more moderate 5.8% increase.",
    source: "KPMG",
    date: "28 Jan 2026",
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&q=80",
  },
  {
    id: 4,
    category: "First Home Buyers",
    headline: "First Home Buyer Deposits Blow Out as Entry Prices Surge 68% in Five Years",
    blurb:
      "The time to save a 20% deposit now stretches up to seven years and seven months for a house in Sydney. Entry-level house prices have surged 68% nationally over five years, while wages grew just 21%, widening the gap for aspiring homeowners.",
    source: "Australian Broker News",
    date: "28 Feb 2026",
    image: "https://images.unsplash.com/photo-1560520031-3a4dc4e9de0c?w=400&q=80",
  },
  {
    id: 5,
    category: "Lending",
    headline: "Major Banks Expect RBA to Hold at March Meeting, Eye May Hike",
    blurb:
      "All four major banks expect the RBA to hold the cash rate steady at 3.85% at the 16-17 March meeting. However, if Q1 trimmed mean inflation remains above 3%, three of the four expect another 25bp hike in May, taking the cash rate to 4.10%.",
    source: "Canstar",
    date: "2 Mar 2026",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80",
  },
  {
    id: 6,
    category: "Market Activity",
    headline: "Autumn Selling Season Heats Up: Listings Surge 40% Since December",
    blurb:
      "Raine & Horne research shows listings up nearly 40% since December 2025 and property appraisals surging over 75% month-on-month. Buyer demand remains resilient with open inspection attendances up 3% year-on-year nationally.",
    source: "Raine & Horne",
    date: "26 Feb 2026",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80",
  },
  {
    id: 7,
    category: "Housing Policy",
    headline: "First Home Guarantee Scheme Expands: Income Limits and Annual Caps Removed",
    blurb:
      "The 2026 changes to the First Home Guarantee remove previous income limits and annual place caps while increasing property price thresholds in many regions. The reforms aim to give more first home buyers a pathway into homeownership.",
    source: "Australian Government",
    date: "1 Jan 2026",
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&q=80",
  },
  {
    id: 8,
    category: "Property Market",
    headline: "Australia's Two-Speed Property Market Widens as Mid-Sized Capitals Surge",
    blurb:
      "Perth, Brisbane, and Adelaide continue to pull ahead of Sydney and Melbourne in price growth, creating a pronounced two-speed market. Analysts attribute the divergence to relative affordability, interstate migration, and limited housing supply in smaller capitals.",
    source: "API Magazine",
    date: "24 Feb 2026",
    image: "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=400&q=80",
  },
  {
    id: 9,
    category: "Regulation",
    headline: "APRA Consults on Three-Tiered Banking Framework for Proportional Regulation",
    blurb:
      "APRA is proposing a new tier of Most Significant Financial Institutions for banks with over $300 billion in assets. The framework aims to embed proportionality and drive competition, with submissions closing 27 February 2026.",
    source: "APRA",
    date: "10 Feb 2026",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80",
  },
  {
    id: 10,
    category: "Mortgage Rates",
    headline: "Rate Hike Impact: Average Monthly Repayment Rises $90 on $600K Loan",
    blurb:
      "For an owner-occupier with $600,000 in debt and 25 years remaining, the February rate hike increases minimum monthly repayments by approximately $90. Brokers are advising clients to stress-test budgets ahead of a potential second hike in May.",
    source: "NAB",
    date: "14 Feb 2026",
    image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&q=80",
  },
];

const AI_TLDR = `Today's key takeaway: The RBA held its first rate hike in over two years in February, lifting the cash rate to 3.85%. All four major banks expect a hold at the March meeting, but a May hike to 4.10% is on the table if inflation stays above 3%. Meanwhile, APRA's new DTI lending cap is tightening borrowing capacity for investors. Property prices continue to climb nationally (forecast +7.7% for 2026), with Perth leading at 13%. First home buyers face growing deposit hurdles as entry prices have surged 68% in five years. The expanded First Home Guarantee scheme may provide some relief. Brokers should be proactive in stress-testing client budgets and reviewing loan structures ahead of potential further tightening.`;

function IndustryNews() {
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const featured = NEWS_ARTICLES[0]!;
  const secondFeatured = NEWS_ARTICLES[1]!;
  const briefingArticles = NEWS_ARTICLES.slice(2, 6);
  const bottomLinks = NEWS_ARTICLES.slice(4, 6);

  return (
    <div className="space-y-6">
      {/* AI TLDR Section */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-white">AI Daily Briefing</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-200 text-purple-700 font-medium">
                AI generated
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{AI_TLDR}</p>
            <p className="text-xs text-gray-500 mt-2">
              Generated from {NEWS_ARTICLES.length} articles across {new Set(NEWS_ARTICLES.map((a) => a.source)).size} sources
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout: Briefing Sidebar + Featured Articles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Briefing Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Daily Briefing</h2>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{NEWS_ARTICLES.length} stories</span>
              </p>
            </div>

            <div className="space-y-3">
              {briefingArticles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className="w-full text-left group"
                >
                  <div className="flex gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
                      <img src={article.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-tight group-hover:text-primary-700 line-clamp-3">
                        {article.headline}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs">
                <span className="text-gray-400">+</span>
                {bottomLinks.map((a, i) => (
                  <span key={a.id}>
                    <button
                      onClick={() => setSelectedArticle(a)}
                      className="text-gray-600 underline hover:text-primary-700"
                    >
                      {a.headline.split(":")[0]}
                    </button>
                    {i < bottomLinks.length - 1 && <span className="text-gray-400">;</span>}
                  </span>
                ))}
                <span className="text-gray-600 underline cursor-pointer hover:text-primary-700">and more.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Articles - stacked to fill the space */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Primary Hero */}
          <button
            onClick={() => setSelectedArticle(featured)}
            className="w-full text-left group flex-1"
          >
            <div className="relative rounded-xl overflow-hidden h-full min-h-[240px] flex flex-col justify-end">
              <img
                src="https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="relative p-6">
                <p className="text-xs text-gray-300 mb-2">{featured.category}</p>
                <h2 className="text-2xl lg:text-3xl font-bold text-white leading-tight group-hover:text-primary-300 transition-colors">
                  {featured.headline}
                </h2>
              </div>
            </div>
          </button>

          {/* Secondary Featured - fills the gap */}
          <button
            onClick={() => setSelectedArticle(secondFeatured)}
            className="w-full text-left group flex-1"
          >
            <div className="relative rounded-xl overflow-hidden h-full min-h-[200px] flex flex-col justify-end">
              <img
                src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="relative p-6">
                <p className="text-xs text-gray-300 mb-2">{secondFeatured.category}</p>
                <h2 className="text-xl lg:text-2xl font-bold text-white leading-tight group-hover:text-primary-300 transition-colors">
                  {secondFeatured.headline}
                </h2>
                <p className="text-sm text-gray-300 mt-2 line-clamp-2">{secondFeatured.blurb}</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Article List - clean, no colors or source counts */}
      <div className="space-y-1">
        {NEWS_ARTICLES.slice(2).map((article) => (
          <button
            key={article.id}
            onClick={() => setSelectedArticle(article)}
            className="w-full text-left group"
          >
            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-200">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 font-medium">{article.category}</span>
                  <span className="text-xs text-gray-300">|</span>
                  <span className="text-xs text-gray-400">{article.date}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-800 mb-1 group-hover:text-primary-700 transition-colors">
                  {article.headline}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{article.blurb}</p>
              </div>
              <div className="w-24 h-24 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
                <img src={article.image} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">{selectedArticle.category}</span>
                <span className="text-xs text-gray-300">|</span>
                <span className="text-xs text-gray-400">{selectedArticle.date}</span>
              </div>
              <button onClick={() => setSelectedArticle(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <h2 className="text-xl font-bold text-gray-900 mb-3">{selectedArticle.headline}</h2>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">{selectedArticle.blurb}</p>
              <p className="text-xs text-gray-500 font-medium">{selectedArticle.source}</p>
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-400 italic text-center">
                  Full article content will be available here. Links to original sources coming soon.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IndustryNews;
