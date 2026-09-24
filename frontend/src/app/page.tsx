import Link from "next/link";

export default function MarketingLandingPage() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center relative overflow-hidden min-h-[calc(100vh-64px)]">

      {/* Background Vertical Lines (Subtle) */}
      {/* <div className="absolute inset-0 z-0 flex justify-between px-10 md:px-32 opacity-[0.05] pointer-events-none">
        <div className="w-[1px] h-full bg-white"></div>
        <div className="w-[1px] h-full bg-white hidden sm:block"></div>
        <div className="w-[1px] h-full bg-white hidden md:block"></div>
        <div className="w-[1px] h-full bg-white hidden md:block"></div>
        <div className="w-[1px] h-full bg-white hidden lg:block"></div>
        <div className="w-[1px] h-full bg-white hidden lg:block"></div>
        <div className="w-[1px] h-full bg-white hidden xl:block"></div>
        <div className="w-[1px] h-full bg-white"></div>
      </div> */}

      <main className="max-w-[1440px] w-full mx-auto px-6 py-8 text-center relative z-10 flex flex-col items-center justify-center">

        {/* Main Headline mimicking the image */}
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-4 max-w-4xl leading-[1.1] z-10">
          <span className="text-white">Tokenized real-world </span>
          <span className="text-white border border-blue-500/40 rounded-lg px-2 pb-1 bg-blue-900/20 inline-block -translate-y-1">equities</span>
          <br />
          <span className="text-blue-300 block mt-2"> traded 24/7 for </span>
          <span className="text-white block mt-2">Web3 investors</span>
        </h1>

        <p className="text-sm md:text-base text-slate-400 mb-6 max-w-2xl leading-relaxed z-10">
          Mint and redeem real US stocks like Tesla and Apple using Account Abstraction. Pay gas in USDC and trade seamlessly with enterprise-grade security.
        </p>

        <div className="z-10">
          <Link
            href="/markets"
            className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-lg transition-all shadow-[0_0_30px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_-5px_rgba(37,99,235,0.6)]"
          >
            Launch App
          </Link>
        </div>
      </main>

      {/* Glowing Orb/Planet at the bottom matching the image */}
      <div className="absolute -bottom-125 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#0B0F19] border border-blue-400/20 rounded-full shadow-[0_-20px_120px_rgba(59,130,246,0.3)] pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-[200px] rounded-t-full bg-linear-to-b from-blue-500/20 to-transparent blur-3xl"></div>
      </div>

    </div>
  );
}
