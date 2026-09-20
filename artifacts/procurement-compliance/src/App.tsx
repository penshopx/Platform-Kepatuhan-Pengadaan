import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import NotFound from '@/pages/not-found';
import {
  Route,
  Redirect,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { Shell } from '@/components/layout';

import Dashboard from '@/pages/dashboard';
import Packages from '@/pages/packages';
import PackageDetail from '@/pages/package-detail';
import Reviews from '@/pages/reviews';
import Regulations from '@/pages/regulations';
import Activity from '@/pages/activity';
import LegalAdmin from '@/pages/legal-admin';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#3b82f6',
    colorForeground: '#f8fafc',
    colorMutedForeground: '#94a3b8',
    colorDanger: '#ef4444',
    colorBackground: '#070b12',
    colorInput: '#111827',
    colorInputForeground: '#f8fafc',
    colorNeutral: '#334155',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#070b12] rounded-2xl w-[440px] max-w-full overflow-hidden border border-slate-800',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-slate-50',
    headerSubtitle: 'text-slate-400',
    socialButtonsBlockButtonText: 'text-slate-100',
    formFieldLabel: 'text-slate-200',
    footerActionLink: 'text-blue-400',
    footerActionText: 'text-slate-400',
    dividerText: 'text-slate-500',
    identityPreviewEditButton: 'text-blue-400',
    formFieldSuccessText: 'text-emerald-400',
    alertText: 'text-red-300',
    formButtonPrimary: 'bg-blue-500 hover:bg-blue-400 text-white',
    formFieldInput: 'bg-slate-900 border-slate-700 text-slate-50',
    socialButtonsBlockButton: 'border-slate-700 bg-slate-900 hover:bg-slate-800',
    dividerLine: 'bg-slate-800',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener]);
  return null;
}

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ProtectedLegalAdmin() {
  return (
    <>
      <Show when="signed-in"><LegalAdminGate /></Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function LegalAdminGate() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) {
    return <div className="p-8 text-muted-foreground">Memeriksa akses admin...</div>;
  }
  const role = user?.publicMetadata.role;
  if (role !== 'ADMIN' && role !== 'LEGAL_ADMIN') {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
          <h1 className="text-xl font-bold text-foreground">Akses admin diperlukan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Akun ini sudah masuk, tetapi belum memiliki peran ADMIN atau LEGAL_ADMIN.
          </p>
        </div>
      </div>
    );
  }
  return <LegalAdmin />;
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route>
        <Shell>
          <RoutedErrorBoundary>
            <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/packages" component={Packages} />
          <Route path="/packages/:id" component={PackageDetail} />
          <Route path="/reviews" component={Reviews} />
          <Route path="/regulations" component={Regulations} />
          <Route path="/activity" component={Activity} />
          <Route path="/legal-admin" component={ProtectedLegalAdmin} />
          <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
        </Shell>
      </Route>
    </Switch>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      localization={{
        signIn: { start: { title: 'Masuk ke ProComply', subtitle: 'Akses khusus administrator hukum' } },
        signUp: { start: { title: 'Buat akun ProComply', subtitle: 'Daftar untuk mengakses ruang kerja' } },
      }}
    >
      <ThemeProvider defaultTheme="dark" storageKey="procomply-theme">
        <QueryClientProvider client={queryClient}>
          <ClerkQueryClientCacheInvalidator />
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}

function AppWithRouter() {
  return (
    <WouterRouter base={basePath}>
      <App />
    </WouterRouter>
  );
}

export default AppWithRouter;
