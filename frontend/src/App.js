import { useState } from "react";
import Login from "./components/login";

import ComposeForm from "./components/form";
import EmailHistory from "./components/emaill";


function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));
  const [page, setPage] = useState("compose");
  function logout() {
    localStorage.removeItem("token");
    setLoggedIn(false)
  }
  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  const tab = (name) =>
    `px-4 py-1 rounded-md font-medium ${page === name ? "bg-orange-600" : "hover:bg-orange-900"
    }`;
  return (
    <div>
      {/* Header */}
      <div className="bg-orange-950 text-white flex items-center justify-between px-5 py-3">
        <h1 className="text-2xl font-medium">BulkMail</h1>
        <div className="flex gap-2">
          <button onClick={() => setPage("compose")} className={tab("compose")}>
            Compose
          </button>
          <button onClick={() => setPage("history")} className={tab("history")}>
            History
          </button>
          <button onClick={logout} className="px-4 py-1 rounded-md bg-red-700">
            Logout
          </button>
        </div>
      </div>
      {page === "compose" ? <ComposeForm /> : <EmailHistory />}
    </div>
  );
}
export default App