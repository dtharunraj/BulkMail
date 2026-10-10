import { useState } from "react";
import * as XLSX from "xlsx";
import api from "../api";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function ComposeForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [typed, setTyped] = useState("");
  const [fileEmails, setFileEmails] = useState([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  // merge typed + file emails, remove duplicates, split valid / invalid
  const all = [
    ...new Set(
      [...typed.split(/[\s,;]+/), ...fileEmails]
        .map((e) => String(e).trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  const valid = all.filter((e) => EMAIL_REGEX.test(e));
  const invalid = all.filter((e) => !EMAIL_REGEX.test(e));
  function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: "A" });
      setFileEmails(rows.map((r) => r.A).filter(Boolean));
    };
    reader.readAsBinaryString(file);
  }
  function send() {
 if (!subject.trim()) return setStatus({ type: "error", message: "Enter a subject" });
    if (!body.trim()) return setStatus({ type: "error", message: "Enter the email body" });
    if (valid.length === 0)
      return setStatus({ type: "error", message: "Add at least one valid email" });
    setSending(true);
    setStatus({ type: "info", message: `Sending to ${valid.length} recipients...` });
    api
      .post("/mail/send", { subject, body, recipients: valid })
      .then((res) => {
        const { record, message } = res.data;
        setStatus({
          type: record.status === "success" ? "success" : "error",
          message: `${message} (${record.status})`,
        });
        if (record.status === "success") {
          setSubject("");
          setBody("");
          setTyped("");
          setFileEmails([]);
        }
      })
      .catch((err) =>
        setStatus({
          type: "error",
          message: err.response?.data?.message || "Failed to send emails",
        })
      )
      .finally(() => setSending(false));
  }
  const colors = {
    success: "bg-green-100 text-green-900",
    error: "bg-red-100 text-red-900",
    info: "bg-blue-100 text-blue-900",
  };
  const input = "w-[80%] py-3 outline-none px-2 border border-black rounded-md mb-4";
  return (
    <div className="bg-slate-600 flex flex-col items-center px-5 py-6 min-h-[80vh]">
      {status.message && (
        <p className={`w-[80%] px-4 py-3 mb-4 rounded-md ${colors[status.type]}`}>
          {status.message}
        </p>
      )}
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className={input}
        placeholder="Subject"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={`${input} h-32`}
        placeholder="Enter email text....."
      ></textarea>
      <textarea
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className={`${input} h-24`}
        placeholder="Recipient emails (comma, space or new line)"
      ></textarea>
      <input
        onChange={handleFile}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="w-[80%] border-4 border-dashed border-white text-white py-4 px-4"
      />
      <p className="text-white mt-4"> <span className="text-green-300">Valid: {valid.length}</span>
        {"  |  "}
        <span className="text-red-300">Invalid: {invalid.length}</span>
      </p>
      {invalid.length > 0 && (
        <p className="w-[80%] text-sm text-red-300 text-center">
          Invalid: {invalid.slice(0, 5).join(", ")}
          {invalid.length > 5 && "..."}
        </p>
      )}
      <div className="bg-orange-300 py-2 px-2 mt-5">
        <button
          onClick={send}
          disabled={sending}
          className="bg-green-950 py-2 px-6 text-white font-medium rounded-md disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
export default ComposeForm