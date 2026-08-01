"use client";

type LandingSproutProps = {
  className?: string;
};

/** Soft growing-plant motion for landing — on-brand substitute for off-theme Lottie packs. */
export function LandingSprout({ className }: LandingSproutProps) {
  return (
    <div className={className} aria-hidden="true">
      <svg
        className="landing-sprout-svg"
        viewBox="0 0 200 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse className="landing-sprout-soil" cx="100" cy="188" rx="54" ry="10" fill="#d8e5d4" />
        <path
          className="landing-sprout-pot"
          d="M62 148h76l-8 42c-1.5 8-8 14-16 14H86c-8 0-14.5-6-16-14l-8-42Z"
          fill="#3f7b57"
        />
        <path d="M58 148h84c2 0 4 2 4 4v2H54v-2c0-2 2-4 4-4Z" fill="#2f6847" />
        <path
          className="landing-sprout-stem"
          d="M100 148c0-18 2-42 2-62"
          stroke="#2f6847"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <g className="landing-sprout-leaf landing-sprout-leaf-left">
          <path
            d="M98 108c-22-6-38-24-40-44 24 4 42 20 44 42 0 1-2 3-4 2Z"
            fill="#6f9d78"
          />
        </g>
        <g className="landing-sprout-leaf landing-sprout-leaf-right">
          <path
            d="M104 96c20-10 34-30 34-48-22 6-38 24-40 46 0 1 2 3 6 2Z"
            fill="#3f7b57"
          />
        </g>
        <circle className="landing-sprout-bud" cx="102" cy="78" r="7" fill="#8bb892" />
      </svg>
    </div>
  );
}
