import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { SignIn } from "@clerk/clerk-react";
import { Authenticated, Unauthenticated } from "convex/react";

import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { HideNativeSplash } from "../components/HideNativeSplash";

import ClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { ThemeProvider } from "../lib/theme";
import { Toaster } from "../components/ui/sonner";

import appCss from "../styles.css?url";
import type { QueryClient } from "@tanstack/react-query";
import { Provider as TanStackQueryProvider } from "@/integrations/tanstack-query/root-provider";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
      },
      {
        title: "Nacho OS",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/*
          Netlify injects a comment (plus a newline) into <head> on *.netlify.app. React never
          rendered those nodes, so hydration fails (error #418). Remove them before React loads.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              Array.from(document.head.childNodes).forEach(function(node) {
                var isComment = node.nodeType === Node.COMMENT_NODE;
                var isBlankText = node.nodeType === Node.TEXT_NODE && !node.textContent.trim();
                if (isComment || isBlankText) node.remove();
              });
            `,
          }}
        />
        {/*
          In the iOS app shell (Capacitor injects window.Capacitor before any page script), mark
          <html> and reserve room for the home indicator. With contentInset "always" the page
          scrolls clear of it, but WebKit still lays out position:fixed down to the screen's
          bottom edge and env(safe-area-inset-bottom) is 0. The fixed layout viewport does start
          below the status bar, so screen height minus innerHeight is the top inset: over 24pt
          means a Face ID iPhone, whose home indicator needs 34pt in portrait.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var cap = window.Capacitor;
                if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
                var root = document.documentElement;
                root.setAttribute('data-native-shell', cap.getPlatform());
                if (screen.height - window.innerHeight > 24) {
                  root.style.setProperty('--native-safe-bottom', '34px');
                }
              })();
            `,
          }}
        />
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const stored = localStorage.getItem('nacho-theme');
                let theme = stored;
                if (!theme || theme === 'system') {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.classList.add(theme);
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <TanStackQueryProvider>
          <ThemeProvider>
            <Toaster position="top-center" richColors closeButton />
            <ClerkProvider>
              <ConvexProvider>
                <Authenticated>
                  <div className="flex flex-col min-h-screen bg-background">
                    <TopBar />
                    <main className="flex-1 max-w-lg mx-auto w-full px-2 pb-30">{children}</main>
                    <BottomNav />
                  </div>
                  <HideNativeSplash />
                </Authenticated>
                <Unauthenticated>
                  <div className="min-h-screen flex items-center justify-center bg-muted p-4">
                    <SignIn
                      appearance={{
                        elements: {
                          rootBox: "mx-auto",
                          card: "shadow-none border border-border",
                        },
                      }}
                    />
                  </div>
                  <HideNativeSplash />
                </Unauthenticated>
                <TanStackDevtools
                  config={{
                    position: "top-right",
                    triggerHidden: true,
                  }}
                  plugins={[
                    {
                      name: "Tanstack Router",
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                    TanStackQueryDevtools,
                  ]}
                />
              </ConvexProvider>
            </ClerkProvider>
          </ThemeProvider>
        </TanStackQueryProvider>
        <Scripts />
      </body>
    </html>
  );
}
