const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
const crypto = require("crypto");
require("dotenv").config();

const User = require("./models/User");
const Membership = require("./models/Membership");
const Club = require("./models/Club");
const Announcement = require("./models/Announcement");
const Event = require("./EventModel");
const EventRegistration = require("./EventRegistration");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend pages and static files
app.use(express.static(path.join(__dirname, "../views")));
app.use(express.static(path.join(__dirname, "../public/js")));
app.use("/public", express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/index.html"));
});

// DATABASE CONNECTION
require("dotenv").config({
    path: path.join(__dirname, ".env")
});

if (!process.env.MONGO_URI) {
    console.error("ERROR: MONGO_URI not found in server/.env");
} else {
    mongoose.connect(process.env.MONGO_URI)
        .then(async () => {
            console.log("MongoDB Connected Successfully!");
            await seedDefaultData();
        })
        .catch(error => {
            console.log("MongoDB Connection Error:", error.message);
        });
}

// DEFAULT CLUBS
const defaultClubs = [
    [
        "Coding Club",
        "Technical",
        "Prof. ABC",
        "Learn programming, participate in coding competitions and build technical projects.",
        "/public/images/coding-club.png"
    ],
    [
        "Cultural Club",
        "Cultural",
        "Prof. XYZ",
        "Participate in dance, music, drama and different cultural activities.",
        "/public/images/cultural-event.png"
    ],
    [
        "Sports Club",
        "Sports",
        "Prof. PQR",
        "Participate in indoor and outdoor sports activities and college competitions.",
        "/public/images/sports-event.png"
    ],
    [
        "Photography Club",
        "Creative",
        "Prof. DEF",
        "Learn photography and capture memorable moments from college activities.",
        "/public/images/photography-club.png"
    ],
    [
        "Robotics Club",
        "Technical",
        "Prof. LMN",
        "Explore robotics, electronics and innovative technology-based projects.",
        "/public/images/robotics-club.png"
    ],
    [
        "Social Service Club",
        "Social",
        "Prof. UVW",
        "Take part in awareness programs, community activities and social service events.",
        "/public/images/social-service-club.png"
    ]
];

// INITIAL DATA
async function seedDefaultData() {
    try {
        // Default admin credentials for your demo.
        const adminEmail = "admin@clubconnect.com";
        const adminPassword = "ClubAdmin@123";

        let initialAdmin = await User.findOne({
            email: adminEmail
        });

        if (!initialAdmin) {
            initialAdmin = await User.create({
                name: "ClubConnect Admin",
                email: adminEmail,
                enrollment: `ADMIN-${Date.now()}`,
                department: "Administration",
                semester: 1,
                role: "admin",
                password: await bcrypt.hash(adminPassword, 10)
            });

            console.log("Initial admin account created.");
        } else if (initialAdmin.role !== "admin") {
            initialAdmin.role = "admin";
            await initialAdmin.save();
        }

        // Update images for existing clubs in MongoDB.
        const clubImages = {
            "Coding Club": "/public/images/coding-club.png",
            "Cultural Club": "/public/images/cultural-event.png",
            "Sports Club": "/public/images/sports-event.png",
            "Photography Club": "/public/images/photography-club.png",
            "Robotics Club": "/public/images/robotics-club.png",
            "Social Service Club": "/public/images/social-service-club.png"
        };

        for (const [clubName, imagePath] of Object.entries(clubImages)) {
            await Club.updateOne(
                { name: clubName },
                { $set: { image: imagePath } }
            );
        }

        console.log("Club images updated successfully.");

        // Insert default clubs if none exist.
        if (await Club.countDocuments() === 0) {
            await Club.insertMany(
                defaultClubs.map(club => ({
                    name: club[0],
                    category: club[1],
                    coordinator: club[2],
                    description: club[3],
                    image: club[4]
                }))
            );

            console.log("Default clubs created.");
        }

        // Insert default announcements if none exist.
        if (await Announcement.countDocuments() === 0) {
            await Announcement.insertMany([
                {
                    title: "Coding Club Meeting",
                    clubName: "Coding Club",
                    date: new Date("2026-10-10"),
                    message: "Coding Club meeting will be held at 2:00 PM in the Computer Lab."
                },
                {
                    title: "Cultural Fest Registration",
                    clubName: "Cultural Club",
                    date: new Date("2026-10-12"),
                    message: "Registration for the Cultural Fest is now open for students."
                },
                {
                    title: "Sports Practice",
                    clubName: "Sports Club",
                    date: new Date("2026-10-18"),
                    message: "Students participating in the tournament should attend the practice session."
                }
            ]);

            console.log("Default announcements created.");
        }

    } catch (error) {
        console.log("Seed Error:", error.message);
    }
}

// COMMON HELPERS
function validId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function excelResponse(res, filename) {
    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
    );
}

// TOKEN AUTHENTICATION
function createToken(user) {
    const secret = process.env.AUTH_SECRET;

    if (!secret) {
        throw new Error("AUTH_SECRET is not configured in server/.env");
    }

    const payload = Buffer.from(JSON.stringify({
        id: String(user._id),
        role: user.role,
        exp: Date.now() + 24 * 60 * 60 * 1000
    })).toString("base64url");

    const signature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("base64url");

    return `${payload}.${signature}`;
}

function readToken(token) {
    const secret = process.env.AUTH_SECRET;

    if (!secret || !token) {
        return null;
    }

    const parts = token.split(".");

    if (parts.length !== 2) {
        return null;
    }

    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(parts[0])
        .digest();

    let actualSignature;

    try {
        actualSignature = Buffer.from(parts[1], "base64url");
    } catch {
        return null;
    }

    if (
        actualSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(actualSignature, expectedSignature)
    ) {
        return null;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(parts[0], "base64url").toString("utf8")
        );

        if (
            !payload.id ||
            !payload.role ||
            !payload.exp ||
            payload.exp <= Date.now()
        ) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

async function requireAuth(req, res, next) {
    const authorization = req.headers.authorization || "";

    const token = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";

    const payload = readToken(token);

    if (!payload) {
        return res.status(401).json({
            message: "Please log in again."
        });
    }

    try {
        const user = await User.findById(payload.id)
            .select("-password");

        if (!user || user.role !== payload.role) {
            return res.status(401).json({
                message: "Invalid account."
            });
        }

        req.user = user;
        next();
    } catch {
        return res.status(401).json({
            message: "Authentication failed."
        });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access required."
        });
    }

    next();
}

// REGISTER
app.post("/api/register", async (req, res) => {
    try {
        const {
            name,
            enrollment,
            email,
            department,
            semester,
            password
        } = req.body;

        if (
            !name ||
            !enrollment ||
            !email ||
            !department ||
            !semester ||
            !password
        ) {
            return res.status(400).json({
                message: "Please fill all fields."
            });
        }

        if (
            String(password).length < 8 ||
            !Number.isInteger(Number(semester)) ||
            Number(semester) < 1 ||
            Number(semester) > 8
        ) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters and semester must be between 1 and 8."
            });
        }

        const normalizedEmail = String(email)
            .trim()
            .toLowerCase();

        const normalizedEnrollment = String(enrollment).trim();

        const existingEmail = await User.findOne({
            email: normalizedEmail
        });

        if (existingEmail) {
            return res.status(400).json({
                message: "Email is already registered."
            });
        }

        const existingEnrollment = await User.findOne({
            enrollment: normalizedEnrollment
        });

        if (existingEnrollment) {
            return res.status(400).json({
                message: "Enrollment number is already registered."
            });
        }

        const newUser = await User.create({
            name: String(name).trim(),
            enrollment: normalizedEnrollment,
            email: normalizedEmail,
            department: String(department).trim(),
            semester: Number(semester),
            password: await bcrypt.hash(password, 10),
            role: "student"
        });

        res.status(201).json({
            message: "Registration successful!",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error("Registration Error:", error.message);

        res.status(500).json({
            message: "Registration failed."
        });
    }
});

// LOGIN
app.post("/api/login", async (req, res) => {
    try {
        const { email, password, expectedRole } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Please enter email and password."
            });
        }

        if (!process.env.AUTH_SECRET) {
            return res.status(500).json({
                message: "Server authentication is not configured."
            });
        }

        if (
            expectedRole &&
            !["student", "admin"].includes(expectedRole)
        ) {
            return res.status(400).json({
                message: "Invalid login type."
            });
        }

        const user = await User.findOne({
            email: String(email).trim().toLowerCase()
        });

        if (
            !user ||
            !(await bcrypt.compare(String(password), user.password))
        ) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        if (expectedRole && user.role !== expectedRole) {
            return res.status(403).json({
                message: expectedRole === "admin"
                    ? "This account is not an administrator account."
                    : "Please use the student login."
            });
        }

        res.json({
            message: "Login successful!",
            token: createToken(user),
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                enrollment: user.enrollment,
                department: user.department,
                semester: user.semester,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login Error:", error.message);

        res.status(500).json({
            message: "Login failed."
        });
    }
});

// CLUBS - PUBLIC
app.get("/api/clubs", async (req, res) => {
    try {
        const clubs = await Club.find()
            .sort({ name: 1 })
            .lean();

        const counts = await Membership.aggregate([
            { $match: { status: "Approved" } },
            {
                $group: {
                    _id: "$clubName",
                    count: { $sum: 1 }
                }
            }
        ]);

        const countMap = Object.fromEntries(
            counts.map(item => [item._id, item.count])
        );

        res.json({
            clubs: clubs.map(club => ({
                ...club,
                members: countMap[club.name] || 0
            }))
        });
    } catch (error) {
        console.error("Load Clubs Error:", error.message);

        res.status(500).json({
            message: "Unable to load clubs."
        });
    }
});

// GET SINGLE CLUB
app.get("/api/clubs/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid club ID."
            });
        }

        const club = await Club.findById(req.params.id).lean();

        if (!club) {
            return res.status(404).json({
                message: "Club not found."
            });
        }

        const members = await Membership.countDocuments({
            clubName: club.name,
            status: "Approved"
        });

        res.json({
            club: { ...club, members }
        });
    } catch (error) {
        console.error("Load Single Club Error:", error.message);

        res.status(500).json({
            message: "Unable to load club."
        });
    }
});

// CLUBS - ADMIN CREATE
app.post("/api/clubs", requireAuth, requireAdmin, async (req, res) => {
    try {
        const {
            name,
            category,
            coordinator,
            description,
            image
        } = req.body;

        if (!name || !category || !coordinator || !description) {
            return res.status(400).json({
                message: "Please fill all club fields."
            });
        }

        const cleanName = String(name).trim();

        if (await Club.findOne({ name: cleanName })) {
            return res.status(400).json({
                message: "Club already exists."
            });
        }

        const club = await Club.create({
            name: cleanName,
            category: String(category).trim(),
            coordinator: String(coordinator).trim(),
            description: String(description).trim(),
            image: image || ""
        });

        res.status(201).json({
            message: "Club added successfully!",
            club
        });
    } catch (error) {
        console.error("Add Club Error:", error.message);

        res.status(500).json({
            message: "Unable to add club."
        });
    }
});

// CLUBS - ADMIN UPDATE
app.put("/api/clubs/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid club ID."
            });
        }

        const {
            name,
            category,
            coordinator,
            description,
            image
        } = req.body;

        if (!name || !category || !coordinator || !description) {
            return res.status(400).json({
                message: "Please fill all club fields."
            });
        }

        const club = await Club.findById(req.params.id);

        if (!club) {
            return res.status(404).json({
                message: "Club not found."
            });
        }

        const oldName = club.name;
        const newName = String(name).trim();

        if (
            newName !== oldName &&
            await Club.findOne({ name: newName })
        ) {
            return res.status(400).json({
                message: "Another club already uses this name."
            });
        }

        club.name = newName;
        club.category = String(category).trim();
        club.coordinator = String(coordinator).trim();
        club.description = String(description).trim();
        club.image = image || "";

        await club.save();

        if (oldName !== newName) {
            await Membership.updateMany(
                { clubName: oldName },
                { $set: { clubName: newName } }
            );

            await Announcement.updateMany(
                { clubName: oldName },
                { $set: { clubName: newName } }
            );

            await Event.updateMany(
                { clubName: oldName },
                { $set: { clubName: newName } }
            );
        }

        res.json({
            message: "Club updated successfully!",
            club
        });
    } catch (error) {
        console.error("Update Club Error:", error.message);

        res.status(500).json({
            message: "Unable to update club."
        });
    }
});

// CLUBS - ADMIN DELETE
app.delete("/api/clubs/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid club ID."
            });
        }

        const club = await Club.findById(req.params.id);

        if (!club) {
            return res.status(404).json({
                message: "Club not found."
            });
        }

        await Membership.deleteMany({ clubName: club.name });
        await Announcement.deleteMany({ clubName: club.name });

        const events = await Event.find({
            clubName: club.name
        }).select("_id");

        await EventRegistration.deleteMany({
            event: {
                $in: events.map(event => event._id)
            }
        });

        await Event.deleteMany({ clubName: club.name });
        await Club.findByIdAndDelete(req.params.id);

        res.json({
            message: "Club deleted successfully!"
        });
    } catch (error) {
        console.error("Delete Club Error:", error.message);

        res.status(500).json({
            message: "Unable to delete club."
        });
    }
});

// STUDENT MEMBERSHIP REQUEST
app.post("/api/membership", requireAuth, async (req, res) => {
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({
                message: "Student access required."
            });
        }

        const { clubName, category } = req.body;

        if (!clubName || !category) {
            return res.status(400).json({
                message: "Club information is required."
            });
        }

        const club = await Club.findOne({
            name: String(clubName).trim()
        });

        if (!club) {
            return res.status(404).json({
                message: "Club not found."
            });
        }

        const existing = await Membership.findOne({
            student: req.user._id,
            clubName: club.name
        });

        if (existing) {
            return res.status(400).json({
                message: "You have already requested to join this club."
            });
        }

        const membership = await Membership.create({
            student: req.user._id,
            clubName: club.name,
            category: String(category).trim(),
            status: "Pending"
        });

        res.status(201).json({
            message: "Club membership request sent successfully!",
            membership
        });
    } catch (error) {
        console.error("Membership Error:", error.message);

        res.status(500).json({
            message: "Unable to send membership request."
        });
    }
});

// ADMIN - VIEW MEMBERSHIPS
app.get("/api/admin/memberships", requireAuth, requireAdmin, async (req, res) => {
    try {
        const memberships = await Membership.find()
            .populate("student", "name enrollment email department")
            .sort({ requestDate: -1 })
            .lean();

        res.json({ memberships });
    } catch (error) {
        console.error("Load Memberships Error:", error.message);

        res.status(500).json({
            message: "Unable to load membership requests."
        });
    }
});

// ADMIN - APPROVE / REJECT MEMBERSHIP
app.put("/api/admin/memberships/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        if (!validId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid membership request ID."
            });
        }

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({
                message: "Invalid membership status."
            });
        }

        const membership = await Membership.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!membership) {
            return res.status(404).json({
                message: "Membership request not found."
            });
        }

        res.json({
            message: `Membership request ${status.toLowerCase()} successfully.`,
            membership
        });
    } catch (error) {
        console.error("Update Membership Error:", error.message);

        res.status(500).json({
            message: "Unable to update membership request."
        });
    }
});
// EVENTS - PUBLIC
app.get("/api/events", async (req, res) => {
    try {
        const events = await Event.find()
            .sort({ date: 1 })
            .lean();

        res.json({ events });
    } catch (error) {
        console.error("Load Events Error:", error.message);

        res.status(500).json({
            message: "Unable to load events."
        });
    }
});

// EVENTS - ADMIN CREATE
app.post("/api/events", requireAuth, requireAdmin, async (req, res) => {
    try {
        const {
            title,
            clubName,
            date,
            time,
            venue,
            totalSeats,
            image
        } = req.body;

        const seats = Number(totalSeats);
        const eventDate = new Date(date);

        if (
            !title ||
            !clubName ||
            !date ||
            Number.isNaN(eventDate.getTime()) ||
            !time ||
            !venue ||
            !Number.isInteger(seats) ||
            seats < 1
        ) {
            return res.status(400).json({
                message: "Please fill all required event fields correctly."
            });
        }

        const event = await Event.create({
            title: String(title).trim(),
            clubName: String(clubName).trim(),
            date: eventDate,
            time: String(time).trim(),
            venue: String(venue).trim(),
            totalSeats: seats,
            availableSeats: seats,
            image: image || ""
        });

        res.status(201).json({
            message: "Event added successfully!",
            event
        });
    } catch (error) {
        console.error("Add Event Error:", error.message);

        res.status(500).json({
            message: "Unable to add event."
        });
    }
});

// EVENTS - ADMIN UPDATE
app.put("/api/events/:eventId", requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.eventId)) {
            return res.status(400).json({
                message: "Invalid event ID."
            });
        }

        const {
            title,
            clubName,
            date,
            time,
            venue,
            totalSeats,
            image
        } = req.body;

        const seats = Number(totalSeats);
        const eventDate = new Date(date);

        const event = await Event.findById(req.params.eventId);

        if (!event) {
            return res.status(404).json({
                message: "Event not found."
            });
        }

        if (
            !title ||
            !clubName ||
            !date ||
            Number.isNaN(eventDate.getTime()) ||
            !time ||
            !venue ||
            !Number.isInteger(seats) ||
            seats < 1
        ) {
            return res.status(400).json({
                message: "Please fill all required event fields correctly."
            });
        }

        const registeredCount = await EventRegistration.countDocuments({
            event: event._id,
            status: "Registered"
        });

        if (seats < registeredCount) {
            return res.status(400).json({
                message: `Total seats cannot be less than the ${registeredCount} registered student(s).`
            });
        }

        Object.assign(event, {
            title: String(title).trim(),
            clubName: String(clubName).trim(),
            date: eventDate,
            time: String(time).trim(),
            venue: String(venue).trim(),
            totalSeats: seats,
            availableSeats: seats - registeredCount,
            image: image || ""
        });

        await event.save();

        res.json({
            message: "Event updated successfully!",
            event
        });
    } catch (error) {
        console.error("Update Event Error:", error.message);

        res.status(500).json({
            message: "Unable to update event."
        });
    }
});

// EVENTS - ADMIN DELETE
app.delete("/api/events/:eventId", requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.eventId)) {
            return res.status(400).json({
                message: "Invalid event ID."
            });
        }

        const event = await Event.findById(req.params.eventId);

        if (!event) {
            return res.status(404).json({
                message: "Event not found."
            });
        }

        await EventRegistration.deleteMany({
            event: event._id
        });

        await Event.findByIdAndDelete(event._id);

        res.json({
            message: "Event deleted successfully!"
        });
    } catch (error) {
        console.error("Delete Event Error:", error.message);

        res.status(500).json({
            message: "Unable to delete event."
        });
    }
});

// STUDENT EVENT REGISTRATION
app.post("/api/events/:eventId/register", requireAuth, async (req, res) => {
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({
                message: "Student access required."
            });
        }

        const eventId = req.params.eventId;

        if (!validId(eventId)) {
            return res.status(400).json({
                message: "Invalid event ID."
            });
        }

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({
                message: "Event not found."
            });
        }

        const existing = await EventRegistration.findOne({
            student: req.user._id,
            event: eventId
        });

        if (existing) {
            return res.status(400).json({
                message: "You have already registered for this event."
            });
        }

        if (event.availableSeats <= 0) {
            return res.status(400).json({
                message: "No seats available for this event."
            });
        }

        await EventRegistration.create({
            student: req.user._id,
            event: eventId
        });

        event.availableSeats -= 1;
        await event.save();

        res.status(201).json({
            message: "Event registration successful!"
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                message: "You have already registered for this event."
            });
        }

        console.error("Event Registration Error:", error.message);

        res.status(500).json({
            message: "Unable to register for event."
        });
    }
});

// STUDENT EVENT REGISTRATIONS
app.get("/api/events/registrations/:studentId", requireAuth, async (req, res) => {
    try {
        if (
            String(req.user._id) !== req.params.studentId &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                message: "Access denied."
            });
        }

        if (!validId(req.params.studentId)) {
            return res.status(400).json({
                message: "Invalid student ID."
            });
        }

        const registrations = await EventRegistration.find({
            student: req.params.studentId,
            status: "Registered"
        })
            .populate("event")
            .sort({ registrationDate: -1 })
            .lean();

        res.json({ registrations });
    } catch (error) {
        console.error("Load Registrations Error:", error.message);

        res.status(500).json({
            message: "Unable to load event registrations."
        });
    }
});

// ANNOUNCEMENTS - PUBLIC
app.get("/api/announcements", async (req, res) => {
    try {
        const records = await Announcement.find()
            .sort({ date: -1, createdAt: -1 })
            .lean();

        // Support older announcement records and the Audience field.
        const announcements = records.map(item => ({
            ...item,
            audience: item.audience || item.clubName || "All"
        }));

        res.json({ announcements });
    } catch (error) {
        console.error("Load Announcements Error:", error.message);

        res.status(500).json({
            message: "Unable to load announcements."
        });
    }
});

// ANNOUNCEMENTS - ADMIN CREATE
app.post("/api/announcements", requireAuth, requireAdmin, async (req, res) => {
    try {
        const {
            title,
            clubName,
            date,
            message,
            description,
            audience
        } = req.body;

        const announcementMessage = String(message || description || "").trim();
        const announcementDate = date ? new Date(date) : new Date();
        const selectedAudience = String(audience || "All").trim();

        if (
            !String(title || "").trim() ||
            !announcementMessage ||
            Number.isNaN(announcementDate.getTime())
        ) {
            return res.status(400).json({
                message: "Please enter a valid announcement title and message."
            });
        }

        const announcement = await Announcement.create({
            title: String(title).trim(),
            clubName: String(clubName || selectedAudience || "All").trim(),
            date: announcementDate,
            message: announcementMessage
        });

        res.status(201).json({
            message: "Announcement added successfully!",
            announcement
        });
    } catch (error) {
        console.error("Add Announcement Error:", error.message);

        res.status(500).json({
            message: "Unable to add announcement."
        });
    }
});

// ANNOUNCEMENTS - ADMIN UPDATE
app.put("/api/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid announcement ID."
            });
        }

        const {
            title,
            clubName,
            date,
            message,
            description,
            audience
        } = req.body;

        const announcementMessage = String(message || description || "").trim();
        const announcementDate = date ? new Date(date) : new Date();
        const selectedAudience = String(audience || "All").trim();

        if (
            !String(title || "").trim() ||
            !announcementMessage ||
            Number.isNaN(announcementDate.getTime())
        ) {
            return res.status(400).json({
                message: "Please enter a valid announcement title and message."
            });
        }

        const announcement = await Announcement.findByIdAndUpdate(
            req.params.id,
            {
                title: String(title).trim(),
                clubName: String(clubName || selectedAudience || "All").trim(),
                date: announcementDate,
                message: announcementMessage
            },
            { new: true, runValidators: true }
        );

        if (!announcement) {
            return res.status(404).json({
                message: "Announcement not found."
            });
        }

        res.json({
            message: "Announcement updated successfully!",
            announcement
        });
    } catch (error) {
        console.error("Update Announcement Error:", error.message);

        res.status(500).json({
            message: "Unable to update announcement."
        });
    }
});

// ANNOUNCEMENTS - ADMIN DELETE
app.delete("/api/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid announcement ID."
            });
        }

        const announcement = await Announcement.findByIdAndDelete(
            req.params.id
        );

        if (!announcement) {
            return res.status(404).json({
                message: "Announcement not found."
            });
        }

        res.json({
            message: "Announcement deleted successfully!"
        });
    } catch (error) {
        console.error("Delete Announcement Error:", error.message);

        res.status(500).json({
            message: "Unable to delete announcement."
        });
    }
});

// ADMIN - LIST STUDENTS
app.get("/api/students", requireAuth, requireAdmin, async (req, res) => {
    try {
        const students = await User.find({ role: "student" })
            .select("name email enrollment department semester createdAt")
            .sort({ name: 1 })
            .lean();

        res.json({ students });
    } catch (error) {
        console.error("Load Students Error:", error.message);

        res.status(500).json({
            message: "Unable to load students."
        });
    }
});

// Compatibility endpoint for older admin-profile.html versions.
// Admins can only access their own profile through this endpoint.
app.get("/api/profile/:userId", requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.userId)) {
            return res.status(400).json({
                message: "Invalid profile ID."
            });
        }

        if (String(req.user._id) !== String(req.params.userId)) {
            return res.status(403).json({
                message: "Access denied."
            });
        }

        const user = await User.findById(req.user._id)
            .select("name email role department createdAt")
            .lean();

        if (!user) {
            return res.status(404).json({
                message: "Admin profile not found."
            });
        }

        res.json({ user });
    } catch (error) {
        console.error("Load Admin Profile Error:", error.message);

        res.status(500).json({
            message: "Unable to load admin profile."
        });
    }
});

// ADMIN DASHBOARD STATISTICS
app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
        const [
            students,
            clubs,
            events,
            pendingMemberships,
            approvedMemberships
        ] = await Promise.all([
            User.countDocuments({ role: "student" }),
            Club.countDocuments(),
            Event.countDocuments(),
            Membership.countDocuments({ status: "Pending" }),
            Membership.countDocuments({ status: "Approved" })
        ]);

        res.json({
            students,
            clubs,
            events,
            pendingMemberships,
            approvedMemberships
        });
    } catch (error) {
        console.error("Admin Stats Error:", error.message);

        res.status(500).json({
            message: "Unable to load dashboard statistics."
        });
    }
});

// STUDENT DASHBOARD
app.get("/api/student/dashboard/:studentId", requireAuth, async (req, res) => {
    try {
        if (
            String(req.user._id) !== req.params.studentId &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                message: "Access denied."
            });
        }

        if (!validId(req.params.studentId)) {
            return res.status(400).json({
                message: "Invalid student ID."
            });
        }

        const memberships = await Membership.find({
            student: req.params.studentId
        })
            .sort({ requestDate: -1 })
            .lean();

        const registrations = await EventRegistration.find({
            student: req.params.studentId,
            status: "Registered"
        })
            .populate("event")
            .sort({ registrationDate: -1 })
            .lean();

        const announcements = await Announcement.find()
            .sort({ date: -1 })
            .limit(10)
            .lean();

        res.json({
            memberships,
            registrations,
            announcements
        });
    } catch (error) {
        console.error("Student Dashboard Error:", error.message);

        res.status(500).json({
            message: "Unable to load student dashboard."
        });
    }
});

// EXCEL EXPORT HELPERS
function createWorksheet(workbook, name, headers) {
    const worksheet = workbook.addWorksheet(name);

    worksheet.columns = headers.map(item => ({
        header: item.header,
        key: item.key,
        width: item.width || 20
    }));

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    return worksheet;
}

async function sendWorkbook(res, workbook, filename) {
    excelResponse(res, filename);
    await workbook.xlsx.write(res);
    res.end();
}

// EXPORT STUDENTS
app.get("/api/export/students", requireAuth, requireAdmin, async (req, res) => {
    try {
        const students = await User.find({ role: "student" })
            .sort({ name: 1 })
            .lean();

        const workbook = new ExcelJS.Workbook();

        const worksheet = createWorksheet(workbook, "Students", [
            { header: "Sr. No.", key: "srNo", width: 10 },
            { header: "Name", key: "name", width: 25 },
            { header: "Enrollment", key: "enrollment", width: 20 },
            { header: "Email", key: "email", width: 30 },
            { header: "Department", key: "department", width: 22 },
            { header: "Semester", key: "semester", width: 12 },
            { header: "Registered On", key: "createdAt", width: 24 }
        ]);

        students.forEach((student, index) => {
            worksheet.addRow({
                srNo: index + 1,
                name: student.name,
                enrollment: student.enrollment,
                email: student.email,
                department: student.department,
                semester: student.semester,
                createdAt: student.createdAt
                    ? new Date(student.createdAt).toLocaleString()
                    : ""
            });
        });

        await sendWorkbook(res, workbook, "ClubConnect_Students.xlsx");
    } catch (error) {
        console.error("Export Students Error:", error.message);

        if (!res.headersSent) {
            res.status(500).json({
                message: "Unable to export students."
            });
        }
    }
});

// EXPORT MEMBERSHIPS
app.get("/api/export/memberships", requireAuth, requireAdmin, async (req, res) => {
    try {
        const memberships = await Membership.find()
            .populate("student", "name enrollment email department")
            .sort({ requestDate: -1 })
            .lean();

        const workbook = new ExcelJS.Workbook();

        const worksheet = createWorksheet(workbook, "Memberships", [
            { header: "Sr. No.", key: "srNo", width: 10 },
            { header: "Student Name", key: "studentName", width: 25 },
            { header: "Enrollment", key: "enrollment", width: 20 },
            { header: "Email", key: "email", width: 30 },
            { header: "Department", key: "department", width: 22 },
            { header: "Club Name", key: "clubName", width: 25 },
            { header: "Category", key: "category", width: 18 },
            { header: "Status", key: "status", width: 15 },
            { header: "Request Date", key: "requestDate", width: 24 }
        ]);

        memberships.forEach((membership, index) => {
            worksheet.addRow({
                srNo: index + 1,
                studentName: membership.student?.name || "",
                enrollment: membership.student?.enrollment || "",
                email: membership.student?.email || "",
                department: membership.student?.department || "",
                clubName: membership.clubName,
                category: membership.category,
                status: membership.status,
                requestDate: membership.requestDate
                    ? new Date(membership.requestDate).toLocaleString()
                    : ""
            });
        });

        await sendWorkbook(res, workbook, "ClubConnect_Memberships.xlsx");
    } catch (error) {
        console.error("Export Memberships Error:", error.message);

        if (!res.headersSent) {
            res.status(500).json({
                message: "Unable to export memberships."
            });
        }
    }
});

// EXPORT CLUBS
app.get("/api/export/clubs", requireAuth, requireAdmin, async (req, res) => {
    try {
        const clubs = await Club.find()
            .sort({ name: 1 })
            .lean();

        const counts = await Membership.aggregate([
            { $match: { status: "Approved" } },
            {
                $group: {
                    _id: "$clubName",
                    count: { $sum: 1 }
                }
            }
        ]);

        const countMap = Object.fromEntries(
            counts.map(item => [item._id, item.count])
        );

        const workbook = new ExcelJS.Workbook();

        const worksheet = createWorksheet(workbook, "Clubs", [
            { header: "Sr. No.", key: "srNo", width: 10 },
            { header: "Club Name", key: "name", width: 25 },
            { header: "Category", key: "category", width: 18 },
            { header: "Coordinator", key: "coordinator", width: 25 },
            { header: "Members", key: "members", width: 12 },
            { header: "Description", key: "description", width: 55 }
        ]);

        clubs.forEach((club, index) => {
            worksheet.addRow({
                srNo: index + 1,
                name: club.name,
                category: club.category,
                coordinator: club.coordinator,
                members: countMap[club.name] || 0,
                description: club.description
            });
        });

        await sendWorkbook(res, workbook, "ClubConnect_Clubs.xlsx");
    } catch (error) {
        console.error("Export Clubs Error:", error.message);

        if (!res.headersSent) {
            res.status(500).json({
                message: "Unable to export clubs."
            });
        }
    }
});

// EXPORT EVENTS
app.get("/api/export/events", requireAuth, requireAdmin, async (req, res) => {
    try {
        const events = await Event.find()
            .sort({ date: 1 })
            .lean();

        const workbook = new ExcelJS.Workbook();

        const worksheet = createWorksheet(workbook, "Events", [
            { header: "Sr. No.", key: "srNo", width: 10 },
            { header: "Event Name", key: "title", width: 28 },
            { header: "Club", key: "clubName", width: 22 },
            { header: "Date", key: "date", width: 16 },
            { header: "Time", key: "time", width: 15 },
            { header: "Venue", key: "venue", width: 25 },
            { header: "Total Seats", key: "totalSeats", width: 14 },
            { header: "Available Seats", key: "availableSeats", width: 16 }
        ]);

        events.forEach((event, index) => {
            worksheet.addRow({
                srNo: index + 1,
                title: event.title,
                clubName: event.clubName,
                date: event.date
                    ? new Date(event.date).toLocaleDateString()
                    : "",
                time: event.time,
                venue: event.venue,
                totalSeats: event.totalSeats,
                availableSeats: event.availableSeats
            });
        });

        await sendWorkbook(
            res,
            workbook,
            "ClubConnect_Events.xlsx"
        );
    } catch (error) {
        console.error("Export Events Error:", error.message);

        if (!res.headersSent) {
            res.status(500).json({
                message: "Unable to export events."
            });
        }
    }
});

// EXPORT EVENT REGISTRATIONS
app.get(
    "/api/export/event-registrations",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const registrations = await EventRegistration.find()
                .populate("student", "name enrollment email department")
                .populate("event", "title clubName date time venue")
                .sort({ registrationDate: -1 })
                .lean();

            const workbook = new ExcelJS.Workbook();

            const worksheet = createWorksheet(
                workbook,
                "Event Registrations",
                [
                    { header: "Sr. No.", key: "srNo", width: 10 },
                    { header: "Student Name", key: "studentName", width: 25 },
                    { header: "Enrollment", key: "enrollment", width: 20 },
                    { header: "Email", key: "email", width: 30 },
                    { header: "Department", key: "department", width: 20 },
                    { header: "Event", key: "event", width: 28 },
                    { header: "Club", key: "club", width: 22 },
                    { header: "Event Date", key: "eventDate", width: 16 },
                    { header: "Time", key: "time", width: 15 },
                    { header: "Venue", key: "venue", width: 25 },
                    { header: "Registration Date", key: "registrationDate", width: 24 },
                    { header: "Status", key: "status", width: 15 }
                ]
            );

            registrations.forEach((registration, index) => {
                worksheet.addRow({
                    srNo: index + 1,
                    studentName: registration.student?.name || "",
                    enrollment: registration.student?.enrollment || "",
                    email: registration.student?.email || "",
                    department: registration.student?.department || "",
                    event: registration.event?.title || "",
                    club: registration.event?.clubName || "",
                    eventDate: registration.event?.date
                        ? new Date(
                            registration.event.date
                        ).toLocaleDateString()
                        : "",
                    time: registration.event?.time || "",
                    venue: registration.event?.venue || "",
                    registrationDate: registration.registrationDate
                        ? new Date(
                            registration.registrationDate
                        ).toLocaleString()
                        : "",
                    status: registration.status
                });
            });

            await sendWorkbook(
                res,
                workbook,
                "ClubConnect_Event_Registrations.xlsx"
            );
        } catch (error) {
            console.error("Export Registrations Error:", error.message);

            if (!res.headersSent) {
                res.status(500).json({
                    message: "Unable to export event registrations."
                });
            }
        }
    }
);

// EXPORT ANNOUNCEMENTS
app.get(
    "/api/export/announcements",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const announcements = await Announcement.find()
                .sort({ date: -1 })
                .lean();

            const workbook = new ExcelJS.Workbook();

            const worksheet = createWorksheet(
                workbook,
                "Announcements",
                [
                    { header: "Sr. No.", key: "srNo", width: 10 },
                    { header: "Title", key: "title", width: 30 },
                    { header: "Club", key: "clubName", width: 22 },
                    { header: "Date", key: "date", width: 16 },
                    { header: "Announcement", key: "message", width: 70 }
                ]
            );

            announcements.forEach((announcement, index) => {
                worksheet.addRow({
                    srNo: index + 1,
                    title: announcement.title,
                    clubName: announcement.clubName,
                    date: announcement.date
                        ? new Date(
                            announcement.date
                        ).toLocaleDateString()
                        : "",
                    message: announcement.message
                });
            });

            await sendWorkbook(
                res,
                workbook,
                "ClubConnect_Announcements.xlsx"
            );
        } catch (error) {
            console.error("Export Announcements Error:", error.message);

            if (!res.headersSent) {
                res.status(500).json({
                    message: "Unable to export announcements."
                });
            }
        }
    }
);

// ADMIN - VIEW OWN PROFILE
app.get(
    "/api/admin/profile",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const admin = await User.findById(req.user._id)
                .select("name email role createdAt")
                .lean();

            if (!admin) {
                return res.status(404).json({
                    message: "Admin profile not found."
                });
            }

            res.json({ user: admin });
        } catch (error) {
            console.error("Admin Profile Error:", error.message);

            res.status(500).json({
                message: "Unable to load admin profile."
            });
        }
    }
);

// ADMIN - UPDATE OWN PROFILE
app.put(
    "/api/admin/profile",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const {
                name,
                email,
                currentPassword,
                newPassword
            } = req.body;

            if (!name || !email) {
                return res.status(400).json({
                    message: "Name and email are required."
                });
            }

            const cleanName = String(name).trim();
            const cleanEmail = String(email).trim().toLowerCase();
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(cleanEmail)) {
                return res.status(400).json({
                    message: "Please enter a valid email address."
                });
            }

            const duplicateEmail = await User.findOne({
                email: cleanEmail,
                _id: { $ne: req.user._id }
            });

            if (duplicateEmail) {
                return res.status(400).json({
                    message: "This email is already in use."
                });
            }

            const admin = await User.findById(req.user._id);

            if (!admin || admin.role !== "admin") {
                return res.status(404).json({
                    message: "Admin account not found."
                });
            }

            admin.name = cleanName;
            admin.email = cleanEmail;

            if (newPassword) {
                if (!currentPassword) {
                    return res.status(400).json({
                        message: "Enter your current password to change it."
                    });
                }

                if (String(newPassword).length < 8) {
                    return res.status(400).json({
                        message: "New password must contain at least 8 characters."
                    });
                }

                const passwordMatches = await bcrypt.compare(
                    currentPassword,
                    admin.password
                );

                if (!passwordMatches) {
                    return res.status(400).json({
                        message: "Current password is incorrect."
                    });
                }

                admin.password = await bcrypt.hash(newPassword, 10);
            }

            await admin.save();

            res.json({
                message: "Profile updated successfully!",
                user: {
                    id: admin._id,
                    _id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role
                }
            });
        } catch (error) {
            console.error("Update Admin Profile Error:", error.message);

            res.status(500).json({
                message: "Unable to update admin profile."
            });
        }
    }
);

// ADMIN - VIEW ADMIN USERS
app.get(
    "/api/admin/users",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const admins = await User.find({ role: "admin" })
                .select("name email role createdAt")
                .sort({ createdAt: -1 })
                .lean();

            res.json({ admins });
        } catch (error) {
            console.error("Load Admin Users Error:", error.message);

            res.status(500).json({
                message: "Unable to load admin users."
            });
        }
    }
);

// ADMIN - CREATE ADMIN USER
app.post(
    "/api/admin/users",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const {
                name,
                email,
                password,
                confirmPassword
            } = req.body;

            if (!name || !email || !password || !confirmPassword) {
                return res.status(400).json({
                    message: "Please fill all admin user fields."
                });
            }

            const cleanName = String(name).trim();
            const cleanEmail = String(email).trim().toLowerCase();
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(cleanEmail)) {
                return res.status(400).json({
                    message: "Please enter a valid email address."
                });
            }

            if (String(password).length < 8) {
                return res.status(400).json({
                    message: "Password must contain at least 8 characters."
                });
            }

            if (password !== confirmPassword) {
                return res.status(400).json({
                    message: "Passwords do not match."
                });
            }

            const existingAdmin = await User.findOne({
                email: cleanEmail
            });

            if (existingAdmin) {
                return res.status(400).json({
                    message: "An account with this email already exists."
                });
            }

            const admin = await User.create({
                name: cleanName,
                email: cleanEmail,
                password: await bcrypt.hash(password, 10),
                enrollment: `ADMIN-${crypto.randomUUID()}`,
                department: "Administration",
                semester: 1,
                role: "admin"
            });

            res.status(201).json({
                message: "Admin user created successfully!",
                admin: {
                    _id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role,
                    createdAt: admin.createdAt
                }
            });
        } catch (error) {
            console.error("Create Admin User Error:", error.message);

            if (error.code === 11000) {
                return res.status(400).json({
                    message: "An account with this email already exists."
                });
            }

            res.status(500).json({
                message: "Unable to create admin user."
            });
        }
    }
);

// STUDENT - VIEW OWN PROFILE
app.get(
    "/api/student/profile",
    requireAuth,
    async (req, res) => {
        try {
            if (req.user.role !== "student") {
                return res.status(403).json({
                    message: "Student access required."
                });
            }

            const user = await User.findById(req.user._id)
                .select("name email enrollment department semester role createdAt")
                .lean();

            if (!user) {
                return res.status(404).json({
                    message: "Student profile not found."
                });
            }

            res.json({ user });
        } catch (error) {
            console.error("Student Profile Error:", error.message);

            res.status(500).json({
                message: "Unable to load student profile."
            });
        }
    }
);

// STUDENT - UPDATE OWN PROFILE
app.put(
    "/api/student/profile",
    requireAuth,
    async (req, res) => {
        try {
            if (req.user.role !== "student") {
                return res.status(403).json({
                    message: "Student access required."
                });
            }

            const {
                name,
                email,
                department,
                semester
            } = req.body;

            if (!name || !email || !department || semester === undefined) {
                return res.status(400).json({
                    message: "Please fill all required profile fields."
                });
            }

            const cleanName = String(name).trim();
            const cleanEmail = String(email).trim().toLowerCase();
            const cleanDepartment = String(department).trim();
            const semesterNumber = Number(semester);
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(cleanEmail)) {
                return res.status(400).json({
                    message: "Please enter a valid email address."
                });
            }

            if (
                !Number.isInteger(semesterNumber) ||
                semesterNumber < 1 ||
                semesterNumber > 8
            ) {
                return res.status(400).json({
                    message: "Semester must be between 1 and 8."
                });
            }

            const duplicateEmail = await User.findOne({
                email: cleanEmail,
                _id: { $ne: req.user._id }
            });

            if (duplicateEmail) {
                return res.status(400).json({
                    message: "This email is already in use."
                });
            }

            const user = await User.findById(req.user._id);

            if (!user || user.role !== "student") {
                return res.status(404).json({
                    message: "Student account not found."
                });
            }

            user.name = cleanName;
            user.email = cleanEmail;
            user.department = cleanDepartment;
            user.semester = semesterNumber;

            await user.save();

            res.json({
                message: "Student profile updated successfully!",
                user: {
                    id: user._id,
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    enrollment: user.enrollment,
                    department: user.department,
                    semester: user.semester,
                    role: user.role
                }
            });
        } catch (error) {
            console.error("Update Student Profile Error:", error.message);

            res.status(500).json({
                message: "Unable to update student profile."
            });
        }
    }
);

// STUDENT - CHANGE PASSWORD
app.put(
    "/api/student/profile/password",
    requireAuth,
    async (req, res) => {
        try {
            if (req.user.role !== "student") {
                return res.status(403).json({
                    message: "Student access required."
                });
            }

            const {
                currentPassword,
                newPassword,
                confirmPassword
            } = req.body;

            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    message: "Please fill all password fields."
                });
            }

            if (String(newPassword).length < 8) {
                return res.status(400).json({
                    message: "New password must contain at least 8 characters."
                });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    message: "New passwords do not match."
                });
            }

            const user = await User.findById(req.user._id);

            if (!user || user.role !== "student") {
                return res.status(404).json({
                    message: "Student account not found."
                });
            }

            const passwordMatches = await bcrypt.compare(
                currentPassword,
                user.password
            );

            if (!passwordMatches) {
                return res.status(400).json({
                    message: "Current password is incorrect."
                });
            }

            user.password = await bcrypt.hash(newPassword, 10);
            await user.save();

            res.json({
                message: "Password changed successfully!"
            });
        } catch (error) {
            console.error("Change Student Password Error:", error.message);

            res.status(500).json({
                message: "Unable to change password."
            });
        }
    }
);

// HEALTH CHECK
app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "ClubConnect server is running."
    });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`ClubConnect server is running on port ${PORT}`);
});