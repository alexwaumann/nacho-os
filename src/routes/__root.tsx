import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { SignIn } from "@clerk/clerk-react";
import { Authenticated, Unauthenticated } from "convex/react";

import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

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
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
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
        <TanStackQueryProvider queryClient={queryClient}>
          <ThemeProvider>
            <Toaster position="top-center" richColors closeButton />
            <ClerkProvider>
              <ConvexProvider>
                <Authenticated>
                  <div className="flex flex-col min-h-screen bg-background">
                    <TopBar />
                    <main className="flex-1 max-w-lg mx-auto w-full px-6 pb-27">{children}</main>
                    <BottomNav />
                  </div>
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
