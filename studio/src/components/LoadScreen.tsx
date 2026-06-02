// Background image shipped in the artifact's public/ folder.
const loadBg = `${import.meta.env.BASE_URL}library/load-bg.png`;

export function LoadScreen({ label = 'Charting the realm…' }: { label?: string }) {
  return (
    <div
      className="absolute inset-0 flex items-end justify-center"
      style={{
        backgroundImage: `url(${loadBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="mb-12 px-6 py-3 rounded-md bg-black/55 backdrop-blur-sm border border-amber-300/30 text-amber-100 font-medium tracking-wide flex items-center gap-3 shadow-lg">
        <span
          className="inline-block w-3 h-3 rounded-full bg-amber-300 animate-pulse"
          aria-hidden
        />
        {label}
      </div>
    </div>
  );
}
