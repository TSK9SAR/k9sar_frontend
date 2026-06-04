import PageContainer from "../components/PageContainer";
import Seo from "../utils/Seo";
import React, { useEffect } from "react";
import PublicContactForm from "../components/PublicContactForm";
import { apiJson } from "../lib/api";

function getPublicSessionId() {
  let sid = sessionStorage.getItem("public_session_id");
  if (!sid) {
    sid =
      crypto.randomUUID?.() ||
      Math.random().toString(36).slice(2) + Date.now();
    sessionStorage.setItem("public_session_id", sid);
  }
  return sid;
}

function trackPublicSection(section: string) {
  const key = `tracked_public_section_${section}`;
  if (sessionStorage.getItem(key)) return;

  sessionStorage.setItem(key, "1");

  apiJson("/public/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      section,
      session_id: getPublicSessionId(),
    }),
  });
}

export default function ContactPage() {
  useEffect(() => {
    trackPublicSection("contact");
  }, []);

  return (
    <>
      <Seo
        title="About TSK9SAR and Contact Information"
        description="Learn about TSK9SAR, K9 SAR Certification Agency, Tri-State K9 Search & Rescue, including its standards, certification, registry, evaluator program, and public resource directory. Find contact information or request membership."
      />

      <PageContainer maxWidth="full" className="space-y-6 py-6">
        <div className="mx-auto w-full space-y-8">
          <section className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-700 bg-slate-950/40">
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-100">
                About TSK9SAR
              </h1>
              <p className="mt-3 text-sm sm:text-base text-slate-300 leading-7 max-w-4xl">
                TSK9SAR is the public-facing standards, K9 SAR certification agency, and
                registry portal for Tri-State K9 Search &amp; Rescue. As a certification agency, the
                organization supports consistent evaluation, operational
                readiness, public transparency, and access to certified search
                and rescue K9 team information.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
              <div className="lg:col-span-2 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-700 space-y-8">
                <section>
                  <h2 className="text-xl font-semibold text-slate-100">
                    What TSK9SAR Does
                  </h2>
                  <div className="mt-3 text-sm text-slate-300 leading-7 space-y-3">
                    <p>
                      TSK9SAR develops and publishes operational certification
                      standards for search and rescue K9 disciplines, supports
                      evaluator qualification, and maintains certification and
                      registry records for participating resources.
                    </p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>
                        Publishes operational and foundational certification
                        standards
                      </li>
                      <li>
                        Supports evaluator qualification and
                        discipline-group progression
                      </li>
                      <li>
                        Maintains certification records and a public registry of
                        certified resources
                      </li>
                      <li>
                        Promotes consistent operational expectations across
                        teams, evaluators, and affiliated organizations
                      </li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-slate-100">
                    Who This Site Is For
                  </h2>
                  <div className="mt-3 text-sm text-slate-300 leading-7 space-y-3">
                    <p>
                      This site is intended for search and rescue K9 teams,
                      evaluators, training coordinators, member organizations,
                      and agencies seeking access to standards, certification
                      information, and registered operational K9 resources.
                    </p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Search and rescue K9 teams and handlers</li>
                      <li>Law enforcement and emergency response agencies</li>
                      <li>Volunteer SAR organizations</li>
                      <li>Evaluators, trainers, and training coordinators</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-slate-100">
                    Membership and Participation
                  </h2>
                  <div className="mt-3 text-sm text-slate-300 leading-7 space-y-3">
                    <p>
                      Membership is granted by invitation. If you are seeking
                      membership or organizational participation, please provide
                      enough information for us to understand your role, your
                      affiliation, and how you intend to participate in search
                      and rescue operations or evaluation activities.
                    </p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Your name and general location</li>
                      <li>Your agency, team, or organization, if applicable</li>
                      <li>Your role in search and rescue</li>
                      <li>Whether you are affiliated or independent</li>
                      <li>Why you want to become involved with TSK9SAR</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-slate-100">
                    Standards, Certification, and Registry
                  </h2>
                  <div className="mt-3 text-sm text-slate-300 leading-7 space-y-3">
                    <p>
                      Public visitors can review certification standards and
                      browse the registry of certified operational K9 search and
                      rescue resources. These public pages help support
                      transparency, consistency, and interoperability across
                      search and rescue activities.
                    </p>
                  </div>
                </section>
              </div>

              <aside className="p-6 sm:p-8 space-y-6">
                <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-400">
                    Organization
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">
                    TSK9SAR
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    Tri-State K9 Search &amp; Rescue
                  </div>
                </section>

                <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-400">
                    Contact
                  </div>
                  <div className="mt-3 space-y-3 text-sm text-slate-300">
                    <div>
                      <div className="text-slate-400">General inquiries</div>
                      <div className="text-emerald-400">info@tsk9sar.org</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Administrative contact</div>
                      <div>admin@tsk9sar.org</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-400">
                    Contact this site
                  </div>
                  <p className="mt-3 text-sm text-slate-300 leading-6">
                    Use the form below to request membership, ask questions
                    about standards, certification, registry listings, evaluator
                    qualifications, or organizational participation.
                  </p>
                </section>
              </aside>
            </div>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden">
            <PublicContactForm />
          </section>
        </div>
      </PageContainer>
    </>
  );
}