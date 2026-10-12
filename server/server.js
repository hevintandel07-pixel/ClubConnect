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

// SERVE FRONTEND AND STATIC FILES
app.use(express.static(path.join(__dirname, "../public")));
app.use("/public", express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../views")));
app.use(express.static(path.join(__dirname, "../public/js")));

// HOME PAGE
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
            mobile,
            department,
            semester,
            password,
            confirmPassword
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
                message: "Please fill all required fields."
            });
        }

        if (String(password).length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters."
            });
        }

        if (
            confirmPassword !== undefined &&
            password !== confirmPassword
        ) {
            return res.status(400).json({
                message: "Passwords do not match."
            });
        }

        const semesterNumber = Number(semester);

        if (
            !Number.isInteger(semesterNumber) ||
            semesterNumber < 1 ||
            semesterNumber > 8
        ) {
            return res.status(400).json({
                message: "Semester must be between 1 and 8."
            });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const normalizedEnrollment = String(enrollment).trim();
        const normalizedMobile = String(mobile || "").trim();

        if (
            normalizedMobile &&
            !/^[0-9+\-\s()]{10,15}$/.test(normalizedMobile)
        ) {
            return res.status(400).json({
                message: "Please enter a valid mobile number."
            });
        }

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
            mobile: normalizedMobile,
            department: String(department).trim(),
            semester: semesterNumber,
            password: await bcrypt.hash(password, 10),
            role: "student"
        });

        res.status(201).json({
            message: "Registration successful!",
            user: {
                id: newUser._id,
                name: newUser.name,
                enrollment: newUser.enrollment,
                email: newUser.email,
                mobile: newUser.mobile,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error("Registration Error:", error.message);

        if (error.code === 11000) {
            return res.status(400).json({
                message: "Email or enrollment number is already registered."
            });
        }

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
app.post(
    "/api/clubs",
    requireAuth,
    requireAdmin,
    async (req, res) => {
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
    }
);

// CLUBS - ADMIN UPDATE
app.put(
    "/api/clubs/:id",
    requireAuth,
    requireAdmin,
    async (req, res) => {
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
    }
);

// CLUBS - ADMIN DELETE
app.delete(
    "/api/clubs/:id",
    requireAuth,
    requireAdmin,
    async (req, res) => {
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

            await Membership.deleteMany({
                clubName: club.name
            });

            await Announcement.deleteMany({
                clubName: club.name
            });

            const events = await Event.find({
                clubName: club.name
            }).select("_id");

            await EventRegistration.deleteMany({
                event: {
                    $in: events.map(event => event._id)
                }
            });

            await Event.deleteMany({
                clubName: club.name
            });

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
    }
);

// STUDENT DASHBOARD
app.get(
    "/api/student/dashboard/:studentId",
    requireAuth,
    async (req, res) => {
        try {
            if (req.user.role !== "student") {
                return res.status(403).json({
                    message: "Student access required."
                });
            }

            // Only allow students to access their own dashboard.
            if (String(req.user._id) !== String(req.params.studentId)) {
                return res.status(403).json({
                    message: "You can only view your own dashboard."
                });
            }

            const memberships = await Membership.find({
                student: req.user._id
            }).sort({ requestDate: -1 }).lean();

            const registrations = await EventRegistration.find({
                student: req.user._id
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
                registrations: registrations.map(registration => ({
                    ...registration,
                    eventName:
                        registration.event?.title ||
                        registration.event?.name ||
                        registration.event?.eventName ||
                        "Event"
                })),
                announcements
            });

        } catch (error) {
            console.error("Student Dashboard Error:", error);

            res.status(500).json({
                message: "Unable to load dashboard."
            });
        }
    }
);

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
app.get(
    "/api/admin/memberships",
    requireAuth,
    requireAdmin,
    async (req, res) => {
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
    }
);

// ADMIN - APPROVE / REJECT MEMBERSHIP
app.put(
    "/api/admin/memberships/:id",
    requireAuth,
    requireAdmin,
    async (req, res) => {
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
                .select(
                    "name email mobile enrollment department semester role createdAt"
                )
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
                mobile,
                department,
                semester
            } = req.body;

            if (
                !name ||
                !email ||
                !department ||
                semester === undefined
            ) {
                return res.status(400).json({
                    message: "Please fill all required profile fields."
                });
            }

            const cleanName = String(name).trim();
            const cleanEmail = String(email).trim().toLowerCase();
            const cleanMobile = String(mobile || "").trim();
            const cleanDepartment = String(department).trim();
            const semesterNumber = Number(semester);

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!cleanName) {
                return res.status(400).json({
                    message: "Name cannot be empty."
                });
            }

            if (!emailPattern.test(cleanEmail)) {
                return res.status(400).json({
                    message: "Please enter a valid email address."
                });
            }

            if (
                cleanMobile &&
                !/^[0-9+\-\s()]{10,15}$/.test(cleanMobile)
            ) {
                return res.status(400).json({
                    message: "Please enter a valid mobile number."
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
            user.mobile = cleanMobile;
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
                    mobile: user.mobile || "",
                    enrollment: user.enrollment,
                    department: user.department,
                    semester: user.semester,
                    role: user.role
                }
            });
        } catch (error) {
            console.error(
                "Update Student Profile Error:",
                error.message
            );

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
            console.error(
                "Change Student Password Error:",
                error.message
            );

            res.status(500).json({
                message: "Unable to change password."
            });
        }
    }
);


 // ADMIN DASHBOARD - STATISTICS
app.get(
    "/api/admin/stats",
    requireAuth,
    requireAdmin,
    async (req, res) => {
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
            console.error("Admin Dashboard Stats Error:", error);

            res.status(500).json({
                message: "Unable to load admin dashboard statistics."
            });
        }
    }
);


 // ADMIN - VIEW ADMINISTRATORS
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

            return res.status(200).json({ admins });
        } catch (error) {
            console.error("Load Administrators Error:", error);

            return res.status(500).json({
                message: "Unable to load administrators."
            });
        }
    }
);


/* ADMIN - VIEW OWN PROFILE */
app.get(
    "/api/profile/:id",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            // Admin can only view their own profile
            if (String(req.user._id) !== String(req.params.id)) {
                return res.status(403).json({
                    message: "You can only view your own profile."
                });
            }

            const admin = await User.findById(req.user._id)
                .select("-password")
                .lean();

            if (!admin) {
                return res.status(404).json({
                    message: "Administrator profile not found."
                });
            }

            return res.status(200).json({
                user: admin
            });
        } catch (error) {
            console.error("Admin Profile Error:", error);

            return res.status(500).json({
                message: "Unable to load profile information."
            });
        }
    }
);


/* ADMIN - EXCEL EXPORT */
app.get(
    "/api/export/:type",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const ExcelJS = require("exceljs");
            const type = req.params.type;

            const config = {
                students: {
                    model: User,
                    filter: { role: "student" },
                    columns: ["name", "enrollment", "email", "mobile", "department", "semester", "role", "createdAt"]
                },
                clubs: {
                    model: Club,
                    columns: null
                },
                memberships: {
                    model: Membership,
                    columns: null
                },
                events: {
                    model: Event,
                    columns: null
                },
                "event-registrations": {
                    model: EventRegistration,
                    columns: null
                },
                announcements: {
                    model: Announcement,
                    columns: null
                }
            };

            const selected = config[type];

            if (!selected) {
                return res.status(400).json({
                    message: "Invalid export type."
                });
            }

            const records = await selected.model
                .find(selected.filter || {})
                .lean();

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("ClubConnect");

            if (records.length > 0) {
                const columns = selected.columns ||
                    Object.keys(records[0]).filter(key => key !== "__v" && key !== "password");

                sheet.columns = columns.map(key => ({
                    header: key,
                    key,
                    width: 22
                }));

                records.forEach(record => {
                    const row = {};
                    columns.forEach(key => {
                        const value = record[key];
                        row[key] = value && typeof value === "object"
                            ? JSON.stringify(value)
                            : value ?? "";
                    });
                    sheet.addRow(row);
                });
            } else {
                sheet.columns = [{ header: "Message", key: "message", width: 30 }];
                sheet.addRow({ message: "No records found" });
            }

            sheet.getRow(1).font = { bold: true };

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="ClubConnect_${type}.xlsx"`
            );

            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error("Excel Export Error:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    message: "Excel export failed."
                });
            }
        }
    }
);



/* ADMIN - ANNOUNCEMENTS CRUD */

// GET ALL ANNOUNCEMENTS
app.get("/api/announcements", requireAuth, requireAdmin, async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .sort({ createdAt: -1 })
            .lean();

        res.json({ announcements });
    } catch (error) {
        console.error("Load Announcements Error:", error);
        res.status(500).json({ message: "Unable to load announcements." });
    }
});

// CREATE ANNOUNCEMENT
app.post("/api/announcements", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { title, message, description, audience } = req.body;
        const content = String(message || description || "").trim();

        if (!String(title || "").trim() || !content) {
            return res.status(400).json({
                message: "Title and announcement message are required."
            });
        }

        const announcement = await Announcement.create({
            title: String(title).trim(),
            clubName: "General",
            date: new Date(),
            message: content
        });

        res.status(201).json({
            message: "Announcement published successfully.",
            announcement: {
                ...announcement.toObject(),
                audience: audience || "All"
            }
        });
    } catch (error) {
        console.error("Create Announcement Error:", error);
        res.status(500).json({ message: "Unable to publish announcement." });
    }
});

// UPDATE ANNOUNCEMENT
app.put("/api/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({ message: "Invalid announcement ID." });
        }

        const { title, message, description, audience } = req.body;
        const content = String(message || description || "").trim();

        if (!String(title || "").trim() || !content) {
            return res.status(400).json({
                message: "Title and announcement message are required."
            });
        }

        const announcement = await Announcement.findByIdAndUpdate(
            req.params.id,
            {
                title: String(title).trim(),
                message: content
            },
            { new: true, runValidators: true }
        );

        if (!announcement) {
            return res.status(404).json({ message: "Announcement not found." });
        }

        res.json({
            message: "Announcement updated successfully.",
            announcement: {
                ...announcement.toObject(),
                audience: audience || "All"
            }
        });
    } catch (error) {
        console.error("Update Announcement Error:", error);
        res.status(500).json({ message: "Unable to update announcement." });
    }
});

// DELETE ANNOUNCEMENT
app.delete("/api/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({ message: "Invalid announcement ID." });
        }

        const announcement = await Announcement.findByIdAndDelete(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: "Announcement not found." });
        }

        res.json({ message: "Announcement deleted successfully." });
    } catch (error) {
        console.error("Delete Announcement Error:", error);
        res.status(500).json({ message: "Unable to delete announcement." });
    }
});



/* ADMIN - EVENTS CRUD */

// Get all events
app.get("/api/events", requireAuth, requireAdmin, async (req, res) => {
    try {
        const events = await Event.find()
            .sort({ date: 1 })
            .lean();

        res.status(200).json({ events });
    } catch (error) {
        console.error("Load Events Error:", error);
        res.status(500).json({
            message: "Unable to load events."
        });
    }
});


// Create event
app.post("/api/events", requireAuth, requireAdmin, async (req, res) => {
    try {
        const {
            title,
            clubName,
            date,
            time,
            venue,
            image,
            description,
            totalSeats
        } = req.body;

        const seats = Number(totalSeats);

        if (
            !title?.trim() ||
            !clubName?.trim() ||
            !date ||
            !time?.trim() ||
            !venue?.trim() ||
            !description?.trim() ||
            !Number.isInteger(seats) ||
            seats < 1
        ) {
            return res.status(400).json({
                message: "Please provide all required event details and valid total seats."
            });
        }

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                message: "Please provide a valid event date."
            });
        }

        const newEvent = await Event.create({
            title: title.trim(),
            clubName: clubName.trim(),
            date: parsedDate,
            time: time.trim(),
            venue: venue.trim(),
            image: image?.trim() || "",
            description: description.trim(),
            totalSeats: seats,
            availableSeats: seats
        });

        res.status(201).json({
            message: "Event created successfully.",
            event: newEvent
        });
    } catch (error) {
        console.error("Create Event Error:", error);

        res.status(500).json({
            message: "Unable to create event."
        });
    }
});


// Update event
app.put("/api/events/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
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
            image,
            description,
            totalSeats
        } = req.body;

        const seats = Number(totalSeats);

        if (
            !title?.trim() ||
            !clubName?.trim() ||
            !date ||
            !time?.trim() ||
            !venue?.trim() ||
            !description?.trim() ||
            !Number.isInteger(seats) ||
            seats < 1
        ) {
            return res.status(400).json({
                message: "Please provide all required event details and valid total seats."
            });
        }

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                message: "Please provide a valid event date."
            });
        }

        const existingEvent = await Event.findById(id);

        if (!existingEvent) {
            return res.status(404).json({
                message: "Event not found."
            });
        }

        const registeredCount = await EventRegistration.countDocuments({
            event: existingEvent._id,
            status: "Registered"
        });

        if (seats < registeredCount) {
            return res.status(400).json({
                message: `Total seats cannot be less than ${registeredCount}, because that many registrations already exist.`
            });
        }

        existingEvent.title = title.trim();
        existingEvent.clubName = clubName.trim();
        existingEvent.date = parsedDate;
        existingEvent.time = time.trim();
        existingEvent.venue = venue.trim();
        existingEvent.image = image?.trim() || "";
        existingEvent.description = description.trim();
        existingEvent.totalSeats = seats;
        existingEvent.availableSeats = seats - registeredCount;

        await existingEvent.save();

        res.status(200).json({
            message: "Event updated successfully.",
            event: existingEvent
        });
    } catch (error) {
        console.error("Update Event Error:", error);

        res.status(500).json({
            message: "Unable to update event."
        });
    }
});


// Delete event
app.delete("/api/events/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid event ID."
            });
        }

        const event = await Event.findById(id);

        if (!event) {
            return res.status(404).json({
                message: "Event not found."
            });
        }

        await EventRegistration.deleteMany({
            event: event._id
        });

        await Event.findByIdAndDelete(id);

        res.status(200).json({
            message: "Event deleted successfully."
        });
    } catch (error) {
        console.error("Delete Event Error:", error);

        res.status(500).json({
            message: "Unable to delete event."
        });
    }
});

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
