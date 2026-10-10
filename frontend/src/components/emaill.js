import { useEffect, useState } from "react";
import api from "./api";
const badge = {
    success: "bg-green-600",
    partial: "bg-yellow-600",
    failed: "bg-red-600",
    pending: "bg-gray-500",
};
function EmailHistory() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openId, setOpenId] = useState(null);
    function load() {
        setLoading(true);
        api
            .get("/mail/history")
            .then((res) => setHistory(res.data.history))
            .catch(() => setError("Could not load history"))
            .finally(() => setLoading(false));
    }
    useEffect(load, []);
    function remove(id) {
        if (!window.confirm("Delete this record?")) return;
        api.delete(`/mail/history/${id}`).then(load);
    }
    return (
        <div className="bg-slate-600 text-white px-5 py-6 min-h-[70vh]">
            <h2 className="text-xl font-medium mb-4">Sent Email History</h2>
            {loading && <p>Loading...</p>}
            {error && <p className="text-red-300">{error}</p>}
            {!loading && history.length === 0 && <p>No emails sent yet.</p>}
            <div className="flex flex-col gap-3">
                {history.map((item) => (
                    <div key={item._id} className="bg-slate-700 rounded-md p-4">
                        <div className="flex justify-between items-start gap-3">
                            <div>
                                <p className="font-medium">{item.subject}</p>
                                <p className="text-sm text-gray-300"> {new Date(item.createdAt).toLocaleString()} • {item.sentTo.length}/
                                    {item.recipients.length} delivered
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`${badge[item.status]} px-3 py-1 rounded-full text-sm`}>
                                    {item.status}
                                </span>
                                <button
                                    onClick={() => setOpenId(openId === item._id ? null : item._id)}
                                    className="text-sm bg-orange-700 px-3 py-1 rounded-md"
                                >
                                    {openId === item._id ? "Hide" : "View"}
                                </button>
                                <button
                                    onClick={() => remove(item._id)}
                                    className="text-sm bg-red-700 px-3 py-1 rounded-md"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                        {openId === item._id && (
                            <div className="mt-3 text-sm border-t border-slate-500 pt-3">
                                <p className="whitespace-pre-wrap mb-2">{item.body}</p>
                                <p className="text-green-300">Sent: {item.sentTo.join(", ") || "-"}</p>
                                <p className="text-red-300">Failed: {item.failedTo.join(", ") || "-"}</p>
                                {item.error && <p className="text-red-300">Error: {item.error}</p>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
export default EmailHistory