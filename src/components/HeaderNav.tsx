import { NavLink, useNavigate } from "react-router-dom";
import { logoutUser } from "../../src/api/auth";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function HeaderNav() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const logout = () => {
    logoutUser();
    navigate("/");
  };

  if (!token) return null;

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-700">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Left: Brand + Nav */}
          <div className="flex items-center gap-6">
            <div
              className="font-semibold text-slate-100 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <span className="text-emerald-400">K9</span> SAR
            </div>

            <nav className="flex gap-3 text-sm">
              {[
                ["/", "Dashboard"],
                ["/my-teams", "My Teams"],
                ["/dogs", "Dogs"],
                ["/standards", "Standards"],
              ].map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    classNames(
                      "px-3 py-1.5 rounded-md transition-colors",
                      isActive
                        ? "bg-slate-700 text-emerald-200"
                        : "text-slate-300 hover:text-slate-100 hover:bg-slate-800"
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right: Account */}
          <div>
            <button
              onClick={logout}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-600 text-slate-200 hover:border-slate-400"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
