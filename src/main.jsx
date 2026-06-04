import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";

import AuthForm from "./components/AuthForm.jsx";
import HomePage from "./pages/HomePage.jsx";
import TwoFAPage from "./components/TwoFAPage.jsx";
import TwoFASetupPage from "./components/TwoFASetupPage.tsx";

import AppLayout from "./layouts/AppLayout";

// Private pages
const Dashboard = React.lazy(() => import("./pages/Dashboard.jsx"));
const MatrixPage = React.lazy(() => import("./pages/MatrixPage.tsx"));
const PublicMatrixPage = React.lazy(() => import("./pages/PublicMatrixPage.tsx"));
const EvaluatorMatrixPage = React.lazy(() => import("./pages/EvaluatorMatrixPage.tsx"));
const StandardsPage = React.lazy(() => import("./pages/StandardsPage.jsx"));
const MyProfilePage = React.lazy(() => import("./pages/MyProfilePage.tsx"));
const MyTeamsPage = React.lazy(() => import("./pages/MyTeamsPage.tsx"));
const DogsPage = React.lazy(() => import("./pages/DogsPage.tsx"));
const AdminAcceptPage = React.lazy(() => import("./pages/AdminAcceptPage.tsx"));
const AdminInvitesPage = React.lazy(() => import("./pages/AdminInvitesPage.tsx"));
const ForgotLoginPage = React.lazy(() => import("./pages/ForgotLoginPage.tsx"));
const ResetLoginPage = React.lazy(() => import("./pages/ResetLoginPage.tsx"));
const AdminUsersPage = React.lazy(() => import("./pages/admin/AdminUserPage.tsx"));
const AdminMemberPage = React.lazy(() => import("./pages/admin/AdminMemberPage.tsx"));
const AdminHandlerPage = React.lazy(() => import("./pages/admin/AdminHandlerPage.tsx"));
const AdminTeamPage = React.lazy(() => import("./pages/admin/AdminTeamPage.tsx"));
const AdminDogPage = React.lazy(() => import("./pages/admin/AdminDogPage.tsx"));
const AdminConfigPage = React.lazy(() => import("./pages/admin/AdminConfigPage.tsx"));
const ContactPage = React.lazy(() => import("./pages/ContactPage"));
const CertificatePrintPage = React.lazy(() => import("./pages/CertificatePrintPage.tsx"));
const AdminCleanupPage = React.lazy(() => import("./pages/admin/AdminCleanupPage.tsx"));
const SignatureUploadPage = React.lazy(() => import("./pages/SignatureUploadPage"));
const AdminAffiliationsPage = React.lazy(() => import("./pages/admin/AdminAffiliationsPage.tsx"));
const SupervisorAffiliationRequestsPage = React.lazy(() => import("./pages/supervisor/SupervisorAffiliationRequestsPage.tsx"));
const AffiliationsPage = React.lazy(() => import("./pages/AffiliationsPage.tsx"));
const AdminDuesPage = React.lazy(() => import("./pages/admin/AdminDuesPage.tsx"));
const HelpPage = React.lazy(() => import("./pages/Help.jsx"));
const LoginActivityPage = React.lazy(() => import("./pages/admin/LoginActivityPage.tsx"));
const ForumCategoryPage = React.lazy(() => import("./pages/ForumCategoryPage.jsx"));
const ForumHomePage = React.lazy(() => import("./pages/ForumHomePage.jsx"));
const ForumTopicPage = React.lazy(() => import("./pages/ForumTopicPage.jsx"));
const ForumSettingsPage = React.lazy(() => import("./pages/ForumSettingsPage.jsx"));
const EmailAudiencePage = React.lazy(() => import("./pages/admin/EmailAudiencePage.jsx"))
const AdminHelpPage = React.lazy(() => import("./pages/admin/AdminHelpPage.jsx"));
const AdminForumSurveyPage = React.lazy(() => import("./pages/admin/AdminForumSurveyPage.tsx"));
const AdminCleanupAuditPage = React.lazy(() => import("./pages/admin/AdminCleanupAuditPage.tsx"));

function PrivateRoute() {
  const token = localStorage.getItem("token");
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

function ComingSoon({ title }) {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-4xl bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 mt-2">Coming soon.</p>
      </div>
    </div>
  );
}

console.log("TSK9SAR frontend build:", import.meta.env.VITE_BUILD_ID);

function AppRoutes() {
  return (
    <Suspense fallback={<div style={{ padding: "1rem", fontSize: "0.9rem" }}>Loading…</div>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/directory" element={<PublicMatrixPage />} />
          <Route path="/login" element={<AuthForm />} />
          <Route path="/accept-invite" element={<AdminAcceptPage />} />
          <Route path="/forgot-login" element={<ForgotLoginPage />} />
          <Route path="/reset-password" element={<ResetLoginPage />} />
          <Route path="/standards" element={<StandardsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/twofa" element={<TwoFAPage />} />
          <Route path="/twofa-setup" element={<TwoFASetupPage />} />
          <Route path="/help" element={<HelpPage />} />

          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/matrix/evaluators" element={<EvaluatorMatrixPage />} />
            <Route path="/matrix" element={<MatrixPage />} />
            <Route path="/profile" element={<MyProfilePage />} />
            <Route path="/my-teams" element={<MyTeamsPage />} />
            <Route path="/dogs" element={<DogsPage />} />
            <Route path="/certificates/:certificationId" element={<CertificatePrintPage />} />
            <Route path="/signature" element={<SignatureUploadPage />} />
            <Route path="/affiliations" element={<AffiliationsPage />} />

            <Route path="/forums" element={<ForumHomePage />} />
            <Route path="/forums/:categoryId" element={<ForumCategoryPage />} />
            <Route path="/forums/topics/:topicId" element={<ForumTopicPage />} />
            <Route path="/forums/settings" element={<ForumSettingsPage />} />

            <Route path="/admin/invites" element={<AdminInvitesPage />} />
            <Route path="/admin/user" element={<AdminUsersPage />} />
            <Route path="/admin/member" element={<AdminMemberPage />} />
            <Route path="/admin/handlers/:handlerId" element={<AdminHandlerPage />} />
            <Route path="/admin/teams/:teamId" element={<AdminTeamPage />} />
            <Route path="/admin/dogs/:dogId" element={<AdminDogPage />} />
            <Route path="/admin/config" element={<AdminConfigPage />} />
            <Route path="/admin/cleanup" element={<AdminCleanupPage />} />
            <Route path="/admin/affiliations" element={<AdminAffiliationsPage />} />
            <Route path="/admin/supervisor/affiliation-requests" element={<SupervisorAffiliationRequestsPage />} />
            <Route path="/admin/dues" element={<AdminDuesPage />} />
            <Route path="/admin/login-activity" element={<LoginActivityPage />} />
            <Route path="/admin/email-users" element={<EmailAudiencePage />} />
            <Route path="/admin/help" element={<AdminHelpPage />} />
            <Route path="/admin/forum-surveys" element={<AdminForumSurveyPage />} />
            <Route path="/admin/cleanup-audit" element={<AdminCleanupAuditPage />} />
            
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);