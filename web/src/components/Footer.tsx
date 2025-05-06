import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-border pt-4 px-4">
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-bold text-foreground">
          <span className="text-3xl">©</span> {new Date().getFullYear()}{" "}
          Palettum
        </p>
        <p className="text-xs text-center text-foreground-muted">
          Match every pixel of an image or gif to a custom palette
        </p>
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
