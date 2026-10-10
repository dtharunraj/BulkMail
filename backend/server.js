
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

app.use(express.json());

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
    .catch((error) => console.error("MongoDB error:", error.message));

// Email History Schema
const Mail = mongoose.model("Mail", new mongoose.Schema({
    subject: { type: String, required: true },
    body: { type: String, required: true },
    recipients: [String],
    sentTo: [String],
    failedTo: [String],
    status: {
        type: String,
        enum: ["success", "partial", "failed"],
        default: "failed"
    },
    error: { type: String, default: "" }
}, { timestamps: true }));

// Check Backend
app.get("/", (req, res) => {
    res.send("Bulk Mail Backend is running");
});

// Send Emails
app.post("/api/mail/send", async (req, res) => {
    const { subject, body, recipients } = req.body;

    console.log("\n========== BULKMAIL REQUEST ==========");
    console.log("Subject:", subject);
    console.log("Recipients received:", recipients);
    console.log("Is Array:", Array.isArray(recipients));

    if (
        typeof subject !== "string" || !subject.trim() ||
        typeof body !== "string" || !body.trim() ||
        !Array.isArray(recipients) || recipients.length === 0
    ) {
        console.log("Invalid request data");

        return res.status(400).json({
            message: "Subject, body and recipient emails are required"
        });
    }

    const emails = [...new Set(
        recipients
            .filter(email => typeof email === "string")
            .map(email => email.trim().toLowerCase())
            .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )];

    console.log("Email List:", emails);
    console.log("Is Email List Array:", Array.isArray(emails));
    console.log("Total valid emails:", emails.length);

    if (emails.length === 0) {
        console.log("No valid email addresses found");

        return res.status(400).json({
            message: "Valid recipient emails are required"
        });
    }

    let record;

    try {
        record = await Mail.create({
            subject: subject.trim(),
            body: body.trim(),
            recipients: emails,
            sentTo: [],
            failedTo: []
        });

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Verify email connection
        await transporter.verify();
        console.log("Email server connection successful");

        for (const email of emails) {
            try {
                const info = await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: subject.trim(),
                    text: body.trim()
                });

                console.log("Email sent successfully:", email);
                console.log("Message ID:", info.messageId);

                record.sentTo.push(email);
            } catch (error) {
                console.error("Email failed:", email, error.message);
                record.failedTo.push(email);
            }
        }

        if (record.sentTo.length === emails.length) {
            record.status = "success";
        } else if (record.sentTo.length > 0) {
            record.status = "partial";
        } else {
            record.status = "failed";
        }

        if (record.failedTo.length > 0) {
            record.error =
                `Failed for ${record.failedTo.length} recipient(s)`;
        }

        await record.save();

        console.log("---------- EMAIL SUMMARY ----------");
        console.log("Total emails:", emails.length);
        console.log("Sent successfully:", record.sentTo.length);
        console.log("Failed:", record.failedTo.length);
        console.log("Final status:", record.status);
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
        console.error("Send mail error:", error.message);

        if (record) {
            record.status = "failed";
            record.error = error.message;
            await record.save().catch(console.error);
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
        res.json({ history });
    } catch (error) {
        console.error("History error:", error.message);

        res.status(500).json({
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

        res.json({
            message: "History deleted successfully"
        });
    } catch (error) {
        console.error("Delete error:", error.message);

        res.status(500).json({
            message: "Unable to delete history"
        });
    }
});

// Start Server after MongoDB connects
const PORT = process.env.PORT || 5000;

mongoose.connection.once("open", () => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
