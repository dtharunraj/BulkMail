
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

app.use(express.json());

// Gmail API OAuth2
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client
});

// Admin Login
app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: "Username and password are required"
        });
    }

    if (
        username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD
    ) {
        return res.json({
            message: "Login successful",
            token: "bulkmail-admin-session"
        });
    }

    return res.status(401).json({
        message: "Invalid username or password"
    });
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected successfully"))
    .catch(error => console.error("MongoDB error:", error.message));

// Email History Schema
const Mail = mongoose.model("Mail", new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    recipients: [String],
    sentTo: [String],
    failedTo: [String],
    status: {
        type: String,
        enum: ["success", "partial", "failed"],
        default: "failed"
    },
    error: {
        type: String,
        default: ""
    }
}, { timestamps: true }));

// Check Backend
app.get("/", (req, res) => {
    res.send("Bulk Mail Backend is running");
});

// Send one email using Gmail API
async function sendEmail(to, subject, body) {
    const encodedSubject = Buffer
        .from(subject, "utf8")
        .toString("base64");

    const encodedBody = Buffer
        .from(body, "utf8")
        .toString("base64");

    const message = [
        `From: ${process.env.EMAIL_USER}`,
        `To: ${to}`,
        `Subject: =?UTF-8?B?${encodedSubject}?=`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        encodedBody
    ].join("\r\n");

    const raw = Buffer
        .from(message, "utf8")
        .toString("base64url");

    return gmail.users.messages.send({
        userId: "me",
        requestBody: { raw }
    });
}

// Send Emails
app.post("/api/mail/send", async (req, res) => {
    const { subject, body, recipients } = req.body;

    console.log("\n========== BULKMAIL REQUEST ==========");
    console.log("Subject:", subject);
    console.log("Recipients received:", recipients);

    if (
        typeof subject !== "string" ||
        !subject.trim() ||
        typeof body !== "string" ||
        !body.trim() ||
        !Array.isArray(recipients) ||
        recipients.length === 0
    ) {
        return res.status(400).json({
            message: "Subject, body and recipient emails are required"
        });
    }

    const emails = [
        ...new Set(
            recipients
                .filter(email => typeof email === "string")
                .map(email => email.trim().toLowerCase())
                .filter(email =>
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                )
        )
    ];

    console.log("Valid email count:", emails.length);

    if (emails.length === 0) {
        return res.status(400).json({
            message: "Valid recipient emails are required"
        });
    }

    if (
        !process.env.EMAIL_USER ||
        !process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET ||
        !process.env.GOOGLE_REFRESH_TOKEN ||
        !process.env.GOOGLE_REDIRECT_URI
    ) {
        return res.status(500).json({
            message: "Gmail API environment variables are missing"
        });
    }

    let record;

    try {
        record = await Mail.create({
            subject: subject.trim(),
            body: body.trim(),
            recipients: emails,
            sentTo: [],
            failedTo: [],
            status: "failed"
        });

        // Gmail API sends emails over HTTPS
        for (const email of emails) {
            try {
                const response = await sendEmail(
                    email,
                    subject.trim(),
                    body.trim()
                );

                console.log("Email sent:", email);
                console.log("Message ID:", response.data.id);

                record.sentTo.push(email);
            } catch (error) {
                console.error(
                    "Email failed:",
                    email,
                    error.response?.data?.error?.message ||
                    error.message
                );

                record.failedTo.push(email);
            }

            // Save progress after each recipient
            record.status = record.sentTo.length === emails.length
                ? "success"
                : record.sentTo.length > 0
                    ? "partial"
                    : "failed";

            record.error = record.failedTo.length > 0
                ? `Failed for ${record.failedTo.length} recipient(s)`
                : "";

            await record.save();
        }

        console.log("---------- EMAIL SUMMARY ----------");
        console.log("Total:", emails.length);
        console.log("Sent:", record.sentTo.length);
        console.log("Failed:", record.failedTo.length);
        console.log("Status:", record.status);
        console.log("===================================\n");

        return res.status(200).json({
            message: record.status === "success"
                ? "Emails sent successfully"
                : record.status === "partial"
                    ? "Some emails failed"
                    : "Email sending failed",
            record
        });

    } catch (error) {
        console.error(
            "Send mail error:",
            error.response?.data?.error?.message || error.message
        );

        if (record) {
            record.status = record.sentTo.length > 0
                ? "partial"
                : "failed";

            record.error =
                error.response?.data?.error?.message ||
                error.message;

            await record.save().catch(saveError => {
                console.error("History save error:", saveError.message);
            });
        }

        return res.status(500).json({
            message: "Unable to send emails",
            record: record || null
        });
    }
});

// Get Email History
app.get("/api/mail/history", async (req, res) => {
    try {
        const history = await Mail.find().sort({ createdAt: -1 });

        return res.json({ history });
    } catch (error) {
        console.error("History error:", error.message);

        return res.status(500).json({
            message: "Unable to fetch history"
        });
    }
});

// Delete Email History
app.delete("/api/mail/history/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid history ID"
            });
        }

        const record = await Mail.findByIdAndDelete(req.params.id);

        if (!record) {
            return res.status(404).json({
                message: "History record not found"
            });
        }

        return res.json({
            message: "History deleted successfully"
        });
    } catch (error) {
        console.error("Delete error:", error.message);

        return res.status(500).json({
            message: "Unable to delete history"
        });
    }
});

// Start server after MongoDB connects
const PORT = process.env.PORT || 5000;

mongoose.connection.once("open", () => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
