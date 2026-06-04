import React, { useEffect, useState } from "react";
import { fetchCertificationMatrix } from "../api/client";
import type { CertificationMatrixDto, MatrixCell } from "../types/matrix";
import PageContainer from "../components/PageContainer";

function cellClass(cell: MatrixCell): string {
  switch (cell.status) {
    case "active":
      return "bg-green-400 text-white";
    case "expiring":
      return "bg-yellow-300 text-gray-900";
    case "expired":
      return "bg-red-400 text-white";
    case "none":
    default:
      return "bg-gray-200 text-gray-700";
  }
}

function formatExpiry(expires?: string): string {
  if (!expires) return "";
  const d = new Date(expires);
  return d.toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

export const CertificationMatrix: React.FC = () => {
  const [data, setData] = useState<CertificationMatrixDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const dto = await fetchCertificationMatrix();
        setData(dto);
        setError(null);
      } catch (e) {
        console.error(e);
        setError("Failed to load certification matrix.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading team certifications…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { disciplines, teams } = data;

  const filteredTeams = teams.filter((t) => {
    if (!filter.trim()) return true;
    const term = filter.toLowerCase();
    return (
      t.handler_first.toLowerCase().includes(term) ||
      t.handler_last.toLowerCase().includes(term) ||
      t.dog_name.toLowerCase().includes(term)
    );
  });

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
    <div className="min-h-screen bg-gray-100 px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Team Certification Matrix
              </h1>
              <p className="text-xs text-gray-500">
                Each cell shows cert expiry (MM/YY) and color-coded status.
              </p>
            </div>

            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by handler or dog…"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="overflow-auto border border-gray-200 rounded-xl bg-white">
            <table className="min-w-full border-collapse text-xs md:text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 border-b text-left font-medium text-gray-700 whitespace-nowrap">
                    Handler
                  </th>
                  <th className="px-3 py-2 border-b text-left font-medium text-gray-700 whitespace-nowrap">
                    Dog
                  </th>
                  {disciplines.map((disc) => (
                    <th
                      key={disc}
                      className="px-2 py-2 border-b text-center font-medium text-gray-700 whitespace-nowrap"
                    >
                      {disc}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredTeams.map((t) => (
                  <tr key={t.team_id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-3 py-2 border-t whitespace-nowrap">
                      {t.handler_first} {t.handler_last}
                    </td>
                    <td className="px-3 py-2 border-t whitespace-nowrap">
                      {t.dog_name}
                    </td>

                    {disciplines.map((disc) => {
                      const cell: MatrixCell =
                        t.certifications[disc] ?? { status: "none" };
                      return (
                        <td key={disc} className="px-2 py-1 border-t text-center">
                          <div
                            className={`rounded-md px-1 py-1 leading-tight ${cellClass(
                              cell
                            )}`}
                            title={
                              cell.expires
                                ? `Expires: ${new Date(
                                  cell.expires
                                ).toLocaleDateString()}`
                                : "No certification"
                            }
                          >
                            {formatExpiry(cell.expires)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

