import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import React from "react";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import NewClient from "./pages/NewClient";
import ClientProfile from "./pages/ClientProfile";
import Schedule from "./pages/Schedule";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import UserProfile from "./pages/UserProfile";
import Audit from "./pages/Audit";
import AuditDashboard from "./pages/AuditDashboard";
import CalendarPage from "./pages/CalendarPage";
import PublicAnamnese from "./pages/PublicAnamnese";
import AnamneseView from "./pages/AnamneseView";
import AnamnesePdf from "./pages/AnamnesePdf";
import RiskAlerts from "./pages/RiskAlerts";
import Stock from "./pages/Stock";
import Suppliers from "./pages/Suppliers";
import ConfirmAppointment from "./pages/ConfirmAppointment";
import Artists from "./pages/Artists";
import ResetPassword from "./pages/ResetPassword";
import CollaboratorReports from "./pages/CollaboratorReports";
import ContactsImportExport from "./pages/ContactsImportExport";
import ProcedureList from "./pages/ProcedureList";
import NewProcedure from "./pages/NewProcedure";
import PodSession from "./pages/PodSession";
import ProcedureSummary from "./pages/ProcedureSummary";
import MessagingCenter from "./pages/MessagingCenter";

function Router() {
  return (
    <Switch>
      {/* Rotas administrativas do painel */}
      <Route path="/" component={() => (
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      )} />
      
      <Route path="/clients" component={() => (
        <DashboardLayout>
          <Clients />
        </DashboardLayout>
      )} />
      
      <Route path="/clients/new" component={() => (
        <DashboardLayout>
          <NewClient />
        </DashboardLayout>
      )} />
      
      <Route path="/clients/:id" component={() => (
        <DashboardLayout>
          <ClientProfile />
        </DashboardLayout>
      )} />
      
      <Route path="/schedule" component={() => (
        <DashboardLayout>
          <Schedule />
        </DashboardLayout>
      )} />
      
      <Route path="/calendar" component={() => (
        <DashboardLayout>
          <CalendarPage />
        </DashboardLayout>
      )} />
      
      <Route path="/reports" component={() => (
        <DashboardLayout>
          <Reports />
        </DashboardLayout>
      )} />
      
      <Route path="/notifications" component={() => (
        <DashboardLayout>
          <Notifications />
        </DashboardLayout>
      )} />
      
      <Route path="/risk-alerts" component={() => (
        <DashboardLayout>
          <RiskAlerts />
        </DashboardLayout>
      )} />
      
      <Route path="/settings" component={() => (
        <DashboardLayout>
          <Settings />
        </DashboardLayout>
      )} />
      
      <Route path="/users" component={() => (
        <DashboardLayout>
          <Users />
        </DashboardLayout>
      )} />
      
      <Route path="/users/:id" component={() => (
        <DashboardLayout>
          <UserProfile />
        </DashboardLayout>
      )} />
      
      <Route path="/audit" component={() => (
        <DashboardLayout>
          <Audit />
        </DashboardLayout>
      )} />
      
      <Route path="/audit/dashboard" component={() => (
        <DashboardLayout>
          <AuditDashboard />
        </DashboardLayout>
      )} />
      
      <Route path="/artists" component={() => (
        <DashboardLayout>
          <Artists />
        </DashboardLayout>
      )} />
      
      <Route path="/collaborator-reports" component={() => (
        <DashboardLayout>
          <CollaboratorReports />
        </DashboardLayout>
      )} />
      
      <Route path="/stock" component={Stock} />
      
      <Route path="/suppliers" component={Suppliers} />
      
      <Route path="/contacts/import-export" component={ContactsImportExport} />
      
      {/* Rotas POD Session */}
      <Route path="/procedures" component={ProcedureList} />
      <Route path="/procedures/new" component={NewProcedure} />
      <Route path="/procedures/:id/summary" component={ProcedureSummary} />
      <Route path="/procedures/:id" component={PodSession} />
      
      <Route path="/messaging" component={MessagingCenter} />
      
      {/* Rotas públicas sem layout */}
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/confirmar" component={ConfirmAppointment} />
      <Route path="/anamnese/:token" component={PublicAnamnese} />
      <Route path="/anamnese/view/:id" component={AnamneseView} />
      <Route path="/anamnese/pdf/:id" component={AnamnesePdf} />
      
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
