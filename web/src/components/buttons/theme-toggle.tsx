import { useTheme } from "@/providers/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isDarkMode = theme === "dark";
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => setTheme(isDarkMode ? "light" : "dark")}
        className="p-1 rounded-md overflow-hidden focus:outline-none focus:ring-1 focus:ring-accent hover:scale-105"
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        <div className="relative h-6 w-10 flex items-center justify-center">
          <div className="absolute inset-0 grid grid-cols-5 grid-rows-3 gap-0.5">
            {!isDarkMode ? (
              <>
                <div className="bg-yellow-300"></div>
                <div className="bg-yellow-400"></div>
                <div className="bg-orange-400"></div>
                <div className="bg-amber-500"></div>
                <div className="bg-amber-400"></div>
                <div className="bg-yellow-200"></div>
                <div className="bg-yellow-100"></div>
                <div className="bg-yellow-300"></div>
                <div className="bg-orange-300"></div>
                <div className="bg-amber-300"></div>
                <div className="bg-yellow-100"></div>
                <div className="bg-yellow-200"></div>
                <div className="bg-orange-200"></div>
                <div className="bg-amber-200"></div>
                <div className="bg-yellow-200"></div>
              </>
            ) : (
              <>
                <div className="bg-indigo-900"></div>
                <div className="bg-purple-900"></div>
                <div className="bg-indigo-800"></div>
                <div className="bg-blue-900"></div>
                <div className="bg-violet-900"></div>
                <div className="bg-blue-800"></div>
                <div className="bg-indigo-700"></div>
                <div className="bg-purple-800"></div>
                <div className="bg-violet-800"></div>
                <div className="bg-indigo-900"></div>
                <div className="bg-purple-700"></div>
                <div className="bg-indigo-800"></div>
                <div className="bg-blue-800"></div>
                <div className="bg-violet-700"></div>
                <div className="bg-blue-900"></div>
              </>
            )}
          </div>
          <div className="relative z-10">
            {isDarkMode ? (
              <svg
                className="w-3 h-3 text-white"
                viewBox="0 0 8 8"
                fill="currentColor"
              >
                <rect x="3" y="0" width="2" height="1" />
                <rect x="3" y="1" width="2" height="1" />
                <rect x="1" y="2" width="1" height="1" />
                <rect x="2" y="2" width="1" height="1" />
                <rect x="3" y="2" width="2" height="1" />
                <rect x="5" y="2" width="1" height="1" />
                <rect x="6" y="2" width="1" height="1" />
                <rect x="0" y="3" width="1" height="1" />
                <rect x="1" y="3" width="1" height="1" />
                <rect x="2" y="3" width="4" height="1" />
                <rect x="6" y="3" width="1" height="1" />
                <rect x="7" y="3" width="1" height="1" />
                <rect x="0" y="4" width="1" height="1" />
                <rect x="1" y="4" width="6" height="1" />
                <rect x="7" y="4" width="1" height="1" />
                <rect x="1" y="5" width="1" height="1" />
                <rect x="2" y="5" width="1" height="1" />
                <rect x="3" y="5" width="2" height="1" />
                <rect x="5" y="5" width="1" height="1" />
                <rect x="6" y="5" width="1" height="1" />
                <rect x="3" y="6" width="2" height="1" />
                <rect x="3" y="7" width="2" height="1" />
              </svg>
            ) : (
              <svg
                className="w-3 h-3 text-amber-600"
                viewBox="0 0 8 8"
                fill="currentColor"
              >
                <rect x="3" y="0" width="2" height="1" />
                <rect x="2" y="1" width="4" height="1" />
                <rect x="1" y="2" width="6" height="1" />
                <rect x="1" y="3" width="6" height="1" />
                <rect x="1" y="4" width="6" height="1" />
                <rect x="2" y="5" width="4" height="1" />
                <rect x="3" y="6" width="2" height="1" />
              </svg>
            )}
          </div>
        </div>
      </button>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {isDarkMode ? "Night" : "Day"}
      </span>
    </div>
  );
}
