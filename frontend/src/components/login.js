import { useState } from "react";
import axios from "axios";
function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  function submit(e) {
    e.preventDefault();
    setError("");
    axios
      .post("http://localhost:5000/api/auth/login", { username, password })
      .then((res) => {
        localStorage.setItem("token", res.data.token);
        onLogin();
      })
      .catch((err) => setError(err.response?.data?.message || "Login failed"));
  }
  return (
 <div className="min-h-screen bg-slate-600 flex flex-col items-center justify-center px-5">
      <h1 className="text-3xl font-medium text-white mb-6">BulkMail Admin</h1>
      {error && (
        <p className="bg-red-100 text-red-900 px-4 py-2 rounded-md mb-4">{error}</p>
      )}
      <form
        onSubmit={submit}
        className="bg-orange-300 p-6 rounded-md w-full max-w-sm flex flex-col gap-4"
      >
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="py-2 px-2 rounded-md outline-none border border-black"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="py-2 px-2 rounded-md outline-none border border-black"
        />
        <button className="bg-green-950 text-white py-2 rounded-md font-medium">
          Login
        </button>
      </form>
    </div>
  );
}
export default Login