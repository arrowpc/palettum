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

const PrivacyPolicyContent: React.FC = () => {
  return (
    <div className="font-mono prose prose-sm dark:prose-invert max-h-[70vh] overflow-y-auto p-1 text-foreground">
      <h2>Privacy Policy for Palettum</h2>
        <strong>Last updated:</strong> May 11, 2025
        <p>TODO</p>
    </div>
  );
};

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-border pt-4 px-4 pb-4">
      {" "}
      <div className="flex flex-col items-center gap-2">
        {" "}
        <p className="text-sm font-bold text-foreground">
          <span className="text-3xl">©</span> {new Date().getFullYear()}{" "}
          Palettum
        </p>
        <p className="text-xs text-center text-muted-foreground">
          Instantly style and recolor images, GIFs, and videos with your custom palette
        </p>
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
              <DialogTitle className="text-foreground">
                Privacy Policy
              </DialogTitle>
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
      </div>
      <div className="mt-3">
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
