import React from "react";
import { Link } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import Seo from "../utils/Seo";

export default function HomePage() {
  return (
    <PageContainer>
      <Seo
        title="TSK9SAR | Tri-State K9 Search and Rescue"
        description="TSK9SAR is the Tri-State K9 Search and Rescue standards and certification portal. Explore certified search and rescue K9 teams, review certification standards, learn about our organization, and access the member portal."
      />

      {/* ✅ ADD THIS WATERMARK LAYER */}
      <div className="relative mx-auto max-w-4xl min-h-[70vh] px-4 py-12">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: "url('/logo-watermark4.png')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "min(80vw, 800px)",
            opacity: 0.30,
            // transform: "rotate(-15deg)",
          }}
        />

        {/* ✅ WRAP YOUR EXISTING CONTENT */}
        <div className="relative z-10 mx-auto max-w-4xl">
          <header className="mb-6">
            <h1 className="text-lg font-semibold">
              <span className="text-emerald-400">TSK9SAR</span>{" "}
              <span className="text-slate-100">
                Tri-State K9 Search and Rescue Portal
              </span>
            </h1>

            <p className="mt-2 text-sm text-gray-300">
              TSK9SAR is the Tri-State K9 Search and Rescue standards and
              certification portal. Explore certified search and rescue K9 teams,
              review certification standards, learn who we are and what we do,
              get contact information, or sign in to the member portal.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              to="/directory"
              className="block rounded-lg border border-slate-100 bg-slate-700/60 p-4 text-gray-100 transition hover:bg-slate-300 hover:shadow-sm"
            >
              <div className="text-lg font-semibold">Team Directory</div>
              <div className="mt-1 text-sm font-light">
                Find active, certified search and rescue K9 teams.
              </div>
            </Link>

            <Link
              to="/standards"
              className="block rounded-lg border border-slate-100 bg-slate-700/60 p-4 text-gray-100 transition hover:bg-slate-300 hover:shadow-sm"
            >
              <div className="text-lg font-semibold">Certification Standards</div>
              <div className="mt-1 text-sm font-light">
                Review search and rescue K9 certification standards,
                requirements, and evaluation criteria.
              </div>
            </Link>

            <Link
              to="/contact"
              className="block rounded-lg border border-slate-100 bg-slate-700/60 p-4 text-gray-100 transition hover:bg-slate-300 hover:shadow-sm"
            >
              <div className="text-lg font-semibold">About Us &amp; Contact</div>
              <div className="mt-1 text-sm font-light">
                Learn about TSK9SAR, what we do, how to reach us with questions,
                or how to request membership.
              </div>
            </Link>

            <Link
              to="/login"
              className="block rounded-lg border border-slate-100 bg-slate-700/60 p-4 text-gray-100 transition hover:bg-slate-300 hover:shadow-sm"
            >
              <div className="text-lg font-semibold">Member Login</div>
              <div className="mt-1 text-sm font-light">
                Sign in to access the TSK9SAR member dashboard and tools.
              </div>
            </Link>
          </div>

          <div className="mt-4 text-xs text-gray-400">
            Directory listings show teams with active certifications.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}