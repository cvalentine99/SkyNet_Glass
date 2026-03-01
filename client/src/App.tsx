import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Manage from "./pages/Manage";
import Logs from "./pages/Logs";
import Ipsets from "./pages/Ipsets";
import ThreatMap from "./pages/ThreatMap";
import DnsSinkhole from "./pages/DnsSinkhole";
import DevicePolicies from "./pages/DevicePolicies";
import Topology from "./pages/Topology";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/manage"} component={Manage} />
      <Route path={"/logs"} component={Logs} />
      <Route path={"/ipsets"} component={Ipsets} />
      <Route path={"/threatmap"} component={ThreatMap} />
      <Route path={"/dns"} component={DnsSinkhole} />
      <Route path={"/devices"} component={DevicePolicies} />
      <Route path={"/topology"} component={Topology} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: 'oklch(0.15 0.008 260 / 80%)',
                border: '1px solid oklch(1 0 0 / 8%)',
                color: 'oklch(0.95 0.005 85)',
                backdropFilter: 'blur(24px)',
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
