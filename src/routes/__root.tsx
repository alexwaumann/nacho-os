import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { SignIn, SignedIn, SignedOut } from "@clerk/clerk-react";

import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

import ClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <TanStackQueryProvider queryClient={queryClient}>
          <ClerkProvider>
            <ConvexProvider>
              <SignedIn>
                <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
                  <TopBar />
                  <main className="flex-1 max-w-lg mx-auto w-full px-6 pb-27">{children}</main>
                  <BottomNav />
                </div>
              </SignedIn>
              <SignedOut>
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                  <SignIn
                    appearance={{
                      elements: {
                        rootBox: "mx-auto",
                        card: "shadow-none border border-gray-100",
                      },
                    }}
                  />
                </div>
              </SignedOut>
              <TanStackDevtools
                config={{
                  position: "top-right",
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
        </TanStackQueryProvider>
        <Scripts />
      </body>
    </html>
  );
}
