import Header from "@/components/Header";
import RegisterButton from "@/components/RegisterButton";
import WelshLandscape from "@/components/WelshLandscape";

export default function Hero() {
  return (
    <section id="home" className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-20">
        <WelshLandscape className="h-full w-full" />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-900/55 via-ink-900/25 to-ink-900/70" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-900/60 via-transparent to-transparent" />

      <Header />

      <div className="relative mx-auto flex min-h-[760px] max-w-[1400px] flex-col justify-end px-6 pb-20 pt-40 sm:px-10 sm:pb-24 lg:min-h-[820px]">
        <div className="flex items-end justify-between gap-10">
          <div className="max-w-2xl animate-fade-up">
            <h1 className="text-[2.6rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-[4rem]">
              Know what&apos;s
              <br />
              happening in Wales
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-cream/90 sm:text-lg">
              Companies. Contracts. Planning. Funding.
              <br className="hidden sm:block" /> Development. All in one
              place.
            </p>

            <div className="mt-9 flex flex-col items-start gap-4">
              <RegisterButton variant="cream" />
              <p className="text-sm text-cream/75">
                Be the first to know when we launch.
              </p>
            </div>
          </div>

          <div className="hidden shrink-0 border-l border-cream/30 pl-6 text-right text-sm font-medium leading-relaxed text-cream/85 lg:block">
            <p>Real data.</p>
            <p>Deeper insights.</p>
            <p>A stronger Wales.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
