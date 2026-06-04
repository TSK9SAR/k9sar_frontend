import React, { useEffect } from "react";
import PublicMatrixTable from "../components/PublicMatrixTable";
import PageContainer from "../components/PageContainer";
import Seo from "../utils/Seo";
import { apiJson } from "../lib/api";

function getPublicSessionId() {
  let sid = sessionStorage.getItem("public_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
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

export default function PublicMatrixPage() {
  useEffect(() => {
    trackPublicSection("directory");
  }, []);

  return (
    <>
  <Seo
    title="TSK9SAR Certified and operational K9 Search & Rescuue resource directory"
    description="A certification matrix for certified and operational K9 search and rescue resources."
  />
    <PageContainer>
    <div className="rounded-xl min-h-screen w-full bg-slate-900 px-4 sm:px-6 lg:px-8 py-6">
      {/* <div className="mx-auto w-full"> */}
        <PublicMatrixTable />
      </div>
    {/* </div> */}
    </PageContainer>
    </>
  );
}