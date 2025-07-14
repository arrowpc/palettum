export function GitHubButton() {
  return (
    <a
      href="https://github.com/arrowpc/palettum"
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1 p-1 rounded-md focus:outline-none hover:opacity-80 transition-opacity"
      aria-label="View project on GitHub"
    >
      <div className="relative h-8 w-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-5 grid-rows-3 gap-0.5">
          <div className="bg-slate-300 dark:bg-slate-700"></div>
          <div className="bg-slate-400 dark:bg-slate-800"></div>
          <div className="bg-slate-300 dark:bg-slate-700"></div>
          <div className="bg-slate-400 dark:bg-slate-800"></div>
          <div className="bg-slate-300 dark:bg-slate-700"></div>
          <div className="bg-slate-400 dark:bg-slate-800"></div>
          <div className="bg-slate-500 dark:bg-slate-900"></div>
          <div className="bg-slate-400 dark:bg-slate-800"></div>
          <div className="bg-slate-500 dark:bg-slate-900"></div>
          <div className="bg-slate-400 dark:bg-slate-800"></div>
          <div className="bg-slate-300 dark:bg-slate-700"></div>
          <div className="bg-slate-400 dark:bg-slate-800"></div>
          <div className="bg-slate-300 dark:bg-slate-700"></div>
          <div className="bg-slate-400 dark:bg-slate-800"></div>
          <div className="bg-slate-300 dark:bg-slate-700"></div>
        </div>

        <div className="relative z-10">
          <svg
            className="w-5 h-5 text-zinc-800 dark:text-white"
            viewBox="0 0 10 10"
            fill="currentColor"
          >
            {/* Octocat head */}
            <rect x="2" y="0" width="6" height="1" />
            <rect x="1" y="1" width="8" height="1" />
            <rect x="0" y="2" width="2" height="1" />
            <rect x="3" y="2" width="1" height="1" />
            <rect x="6" y="2" width="1" height="1" />
            <rect x="8" y="2" width="2" height="1" />
            <rect x="0" y="3" width="10" height="1" />
            <rect x="0" y="4" width="10" height="1" />
            <rect x="1" y="5" width="8" height="1" />
            {/* Tentacles */}
            <rect x="2" y="6" width="1" height="1" />
            <rect x="4" y="6" width="2" height="1" />
            <rect x="7" y="6" width="1" height="1" />
            <rect x="1" y="7" width="1" height="1" />
            <rect x="4" y="7" width="2" height="1" />
            <rect x="8" y="7" width="1" height="1" />
            <rect x="0" y="8" width="1" height="1" />
            <rect x="4" y="8" width="2" height="1" />
            <rect x="9" y="8" width="1" height="1" />
          </svg>
        </div>
      </div>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        GitHub
      </span>
    </a>
  );
}
 
