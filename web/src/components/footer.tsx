import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const POLICY_SECTIONS = [
  {
    title: "Last updated: July 21, 2025",
    content:
      "Palettum is a fully static web application. No user data is collected, stored, or transferred to any server. All image, GIF, and video processing happens entirely within your browser on your device.",
    isBold: true,
  },
  {
    title: "Hosting & Security",
    content:
      "This site is hosted on Google Firebase Static Hosting and routed through Cloudflare. No server-side code is executed, and no personal data is transmitted or stored.",
    isBold: true,
  },
  {
    title: "Local Storage",
    content:
      "Your palettes and preferences are saved locally in your browser’s storage. This information never leaves your device and can be cleared at any time by clearing your browser storage.",
    isBold: true,
  },
  {
    title: "Third-Party Services",
    content:
      "We do not use any analytics, tracking, or third-party services that collect personal information. There are no cookies set by this application other than the local storage mechanisms under your control.",
    isBold: true,
  },
];

const PrivacyPolicyContent: React.FC = () => (
  <div className="font-mono prose prose-sm dark:prose-invert max-h-[70vh] overflow-y-auto p-1 text-foreground">
    {POLICY_SECTIONS.map((section) => (
      <React.Fragment key={section.title}>
        {section.isBold ? (
          <p className="text-2xl">
            <strong>{section.title}</strong>
          </p>
        ) : (
          <h3 className="text-2xl text-bold">{section.title}</h3>
        )}
        <p>{section.content}</p>
      </React.Fragment>
    ))}
  </div>
);

const PrivacyPolicyDialog: React.FC = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button
        variant="link"
        className="p-0 h-auto text-xs text-muted-foreground hover:text-primary"
      >
        Privacy Policy
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[600px] md:max-w-[750px] bg-background">
      <DialogHeader>
        <DialogTitle className="text-foreground">Privacy Policy</DialogTitle>
      </DialogHeader>
      <PrivacyPolicyContent />
      <DialogClose asChild>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full sm:w-auto"
        >
          Close
        </Button>
      </DialogClose>
    </DialogContent>
  </Dialog>
);

const DecorativeBar: React.FC = () => {
  const NUM_BAR_SEGMENTS = 20;

  return (
    <div className="mt-3 flex">
      {[...Array(NUM_BAR_SEGMENTS)].map((_, i) => (
        <div
          key={i}
          className="h-1 flex-1 animate-pixel-fade-in"
          style={{
            backgroundColor: i % 2 ? "var(--primary)" : "var(--secondary)",
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
};

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-border px-4 pt-4 pb-4">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-bold text-foreground">
          <span className="text-3xl">©</span> {new Date().getFullYear()}{" "}
          Palettum
        </p>
        <p className="text-xs text-center text-muted-foreground">
          Instantly style and recolor images, GIFs, and videos with your custom
          palette
        </p>
        <PrivacyPolicyDialog />
      </div>
      <DecorativeBar />
    </footer>
  );
};

export default Footer;
