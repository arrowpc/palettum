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
      <p>
        <strong>Last updated:</strong> May 11, 2025
      </p>
      <p>
        Palettum ("us", "we", or "our") operates the https://palettum.com
        website (the "Service"). This page informs you of our policies regarding
        the collection, use, and disclosure of personal data when you use our
        Service and the choices you have associated with that data.
      </p>

      <h3>Core Principles: Client-Side Processing & No Data Storage</h3>
      <p>
        <strong>Your Privacy is Paramount.</strong> Palettum is designed with
        privacy at its core.
      </p>
      <ul>
        <li>
          <strong>Client-Side Processing:</strong> All image processing,
          including palette mapping and transformations, happens directly within
          your web browser using JavaScript. Your image files are{" "}
          <strong>never uploaded to or stored on our servers.</strong>
        </li>
        <li>
          <strong>No User Data Storage:</strong> We do not store any of your
          images, palettes you create (unless you explicitly save them locally
          through browser functionality), or any personally identifiable
          information related to your use of the tool.
        </li>
        <li>
          <strong>No Account Required:</strong> You can use Palettum without
          creating an account.
        </li>
      </ul>

      <h3>Information We Do Not Collect</h3>
      <p>
        Given the client-side nature of Palettum, we do not collect, process, or
        store:
      </p>
      <ul>
        <li>Uploaded images or GIFs.</li>
        <li>Palettes you create or import (these remain in your browser).</li>
        <li>
          Personal information such as your name, email address, or IP address
          directly through the tool's operation. (Note: Standard web server logs
          may record IP addresses for security and operational purposes, which
          is typical for any website).
        </li>
      </ul>

      <h3>Cookies and Usage Data (Google AdSense)</h3>
      <p>
        Our Service uses Google AdSense to display advertisements. Google
        AdSense is an advertising service provided by Google Inc.
      </p>
      <ul>
        <li>
          Third party vendors, including Google, use cookies to serve ads based
          on a user's prior visits to our website or other websites.
        </li>
        <li>
          Google's use of advertising cookies enables it and its partners to
          serve ads to our users based on their visit to our Service and/or
          other sites on the Internet.
        </li>
        <li>
          Users may opt out of personalized advertising by visiting{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google's Ads Settings
          </a>
          .
        </li>
        <li>
          Alternatively, users can opt out of a third-party vendor's use of
          cookies for personalized advertising by visiting{" "}
          <a
            href="http://www.aboutads.info/choices/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            www.aboutads.info/choices
          </a>
          .
        </li>
      </ul>
      <p>
        For further information on how Google uses data when you use our
        partners' sites or apps, please see:{" "}
        <a
          href="https://policies.google.com/technologies/partner-sites"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          How Google uses data when you use our partners’ sites or apps
        </a>
        .
      </p>

      <h3>Web Worker Usage</h3>
      <p>
        Palettum utilizes a Web Worker (`worker.js`) in WASM to perform image
        processing tasks in the background. This worker operates within your
        browser's environment and does not transmit your image data externally,
        except as described for the core functionality of processing the image
        and returning it to the main application thread, all within your
        browser.
      </p>

      <h3>Children's Privacy</h3>
      <p>
        Our Service does not address anyone under the age of 13 ("Children"). We
        do not knowingly collect personally identifiable information from
        Children. If you are a parent or guardian and you are aware that your
        Child has provided us with Personal Data, please contact us. If we
        become aware that we have collected Personal Data from children without
        verification of parental consent, we take steps to remove that
        information.
      </p>

      <h3>Changes to This Privacy Policy</h3>
      <p>
        We may update our Privacy Policy from time to time. We will notify you
        of any changes by posting the new Privacy Policy on this page. You are
        advised to review this Privacy Policy periodically for any changes.
        Changes to this Privacy Policy are effective when they are posted on
        this page.
      </p>
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
        <p className="text-xs text-center text-foreground-muted">
          Match every pixel of an image or gif to a custom palette
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="link"
              className="p-0 h-auto text-xs text-foreground-muted hover:text-primary"
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
