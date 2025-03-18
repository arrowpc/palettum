import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-border pt-4 px-4">
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div className="flex flex-col items-center mb-4 md:mb-0">
          <a
            href="https://github.com/arrowpc/palettum/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
            className="flex items-center justify-center w-8 h-8 mb-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-6 h-6 fill-current text-foreground-muted hover:text-foreground transition-colors"
            >
              <path
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 
                8.167 6.839 9.49.5.09.682-.217.682-.48 
                0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 
                1.003.07 1.531 1.03 1.531 1.03.892 1.529 
                2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 
                0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 
                0 0 .84-.268 2.75 1.026A9.578 9.578 0 0 1 12 6.836c.85.004 
                1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 
                1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 
                0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 
                0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.138 
                20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"
              />
            </svg>
          </a>
          <p className="text-xs text-center text-foreground-muted">
            GitHub repository
          </p>
        </div>

        <div className="flex flex-col items-center gap-1 pr-5 pl-5">
          <p className="text-sm font-bold text-foreground">
            <span className="text-3xl">©</span> {new Date().getFullYear()}{" "}
            Palettum
          </p>
          <p className="text-xs text-center text-foreground-muted">
            Match every pixel of an image or gif to a custom palette
          </p>
        </div>

        <div className="flex flex-col items-center">
          <a
            href="https://pypi.org/project/palettum/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="PyPI Package"
            className="flex items-center justify-center w-8 h-8 mb-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-6 h-6 fill-current text-foreground-muted hover:text-foreground transition-colors"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 7v10l10 5 10-5V7l-10 5z" />
            </svg>
          </a>
          <p className="text-xs text-center text-foreground-muted">
            PyPI package
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1 w-full bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10"></div>
        <div className="flex">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 animate-pixel-fade-in"
              style={{
                backgroundColor: i % 2 ? "var(--primary)" : "var(--secondary)",
                animationDelay: `${i * 50}ms`,
              }}
            ></div>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
