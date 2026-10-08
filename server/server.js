const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
require("dotenv").config();

const User = require("./models/User");
const Membership = require("./models/Membership");

const Club = require("./models/Club");
const Announcement = require("./models/Announcement");

const Event = require("./EventModel");
const EventRegistration = require("./EventRegistration");

const app = express();

const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// MONGODB CONNECTION
// =====================================================

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {

        console.log("MongoDB Connected Successfully!");

        await seedDefaultData();

    })
    .catch(error => {

        console.log(
            "MongoDB Connection Error:",
            error.message
        );

    });

// =====================================================
// DEFAULT CLUBS
// =====================================================

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

// =====================================================
// DEFAULT DATA
// =====================================================

async function seedDefaultData() {

    try {

        // Default Clubs
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

        // Default Announcements
        if (await Announcement.countDocuments() === 0) {

            await Announcement.insertMany([

                {
                    title: "Coding Club Meeting",
                    clubName: "Coding Club",
                    date: new Date("2026-10-10"),
                    message:
                        "Coding Club meeting will be held at 2:00 PM in the Computer Lab."
                },

                {
                    title: "Cultural Fest Registration",
                    clubName: "Cultural Club",
                    date: new Date("2026-10-12"),
                    message:
                        "Registration for the Cultural Fest is now open for students."
                },

                {
                    title: "Sports Practice",
                    clubName: "Sports Club",
                    date: new Date("2026-10-18"),
                    message:
                        "Students participating in the tournament should attend the practice session."
                }

            ]);

            console.log("Default announcements created.");

        }

    }

    catch (error) {

        console.log(
            "Seed Error:",
            error.message
        );

    }

}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

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

// =====================================================
// REGISTER
// =====================================================

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

        if (await User.findOne({ email })) {

            return res.status(400).json({

                message: "Email is already registered."

            });

        }

        if (await User.findOne({ enrollment })) {

            return res.status(400).json({

                message:
                    "Enrollment number is already registered."

            });

        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const user = await User.create({

            name,
            enrollment,
            email,
            department,
            semester,
            password: hashedPassword,
            role: "student"

        });

        res.status(201).json({

            message: "Registration successful!",

            userId: user._id

        });

    }

    catch (error) {

        console.log(
            "Registration Error:",
            error.message
        );

        res.status(500).json({

            message: "Registration failed."

        });

    }

});

// =====================================================
// LOGIN
// =====================================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({

                message:
                    "Please enter email and password."

            });

        }

        // ADMIN LOGIN
        if (
            process.env.ADMIN_EMAIL &&
            process.env.ADMIN_PASSWORD &&
            email === process.env.ADMIN_EMAIL &&
            password === process.env.ADMIN_PASSWORD
        ) {

            return res.json({

                message: "Admin login successful!",

                user: {

                    id: "admin",
                    name: "Admin",
                    email,
                    role: "admin"

                }

            });

        }

        // STUDENT LOGIN

        const user =
            await User.findOne({ email });

        if (
            !user ||
            !(await bcrypt.compare(
                password,
                user.password
            ))
        ) {

            return res.status(400).json({

                message:
                    "Invalid email or password."

            });

        }

        res.json({

            message: "Login successful!",

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

    }

    catch (error) {

        console.log(
            "Login Error:",
            error.message
        );

        res.status(500).json({

            message: "Login failed."

        });

    }

});

// =====================================================
// CLUBS
// =====================================================

// GET ALL CLUBS

app.get("/api/clubs", async (req, res) => {

    try {

        const clubs =
            await Club.find()
                .sort({ name: 1 })
                .lean();

        const counts =
            await Membership.aggregate([

                {
                    $match: {
                        status: "Approved"
                    }
                },

                {
                    $group: {

                        _id: "$clubName",

                        count: {
                            $sum: 1
                        }

                    }

                }

            ]);

        const countMap =
            Object.fromEntries(

                counts.map(item => [

                    item._id,
                    item.count

                ])

            );

        const result =
            clubs.map(club => ({

                ...club,

                members:
                    countMap[club.name] || 0

            }));

        res.json({

            clubs: result

        });

    }

    catch (error) {

        console.log(
            "Load Clubs Error:",
            error.message
        );

        res.status(500).json({

            message:
                "Unable to load clubs."

        });

    }

});

// GET SINGLE CLUB

app.get("/api/clubs/:id", async (req, res) => {

    try {

        if (!validId(req.params.id)) {

            return res.status(400).json({

                message:
                    "Invalid club ID."

            });

        }

        const club =
            await Club.findById(
                req.params.id
            ).lean();

        if (!club) {

            return res.status(404).json({

                message:
                    "Club not found."

            });

        }

        const members =
            await Membership.countDocuments({

                clubName: club.name,

                status: "Approved"

            });

        res.json({

            club: {

                ...club,

                members

            }

        });

    }

    catch (error) {

        res.status(500).json({

            message:
                "Unable to load club."

        });

    }

});

// ADD CLUB

app.post("/api/clubs", async (req, res) => {

    try {

        const {
            name,
            category,
            coordinator,
            description,
            image
        } = req.body;

        if (
            !name ||
            !category ||
            !coordinator ||
            !description
        ) {

            return res.status(400).json({

                message:
                    "Please fill all club fields."

            });

        }

        const existing =
            await Club.findOne({

                name: name.trim()

            });

        if (existing) {

            return res.status(400).json({

                message:
                    "Club already exists."

            });

        }

        const club =
            await Club.create({

                name: name.trim(),
                category: category.trim(),
                coordinator: coordinator.trim(),
                description: description.trim(),
                image: image
                    ? image.trim()
                    : ""

            });

        res.status(201).json({

            message:
                "Club added successfully!",

            club

        });

    }

    catch (error) {

        console.log(
            "Add Club Error:",
            error.message
        );

        res.status(500).json({

            message:
                "Unable to add club."

        });

    }

});

// UPDATE CLUB

app.put("/api/clubs/:id", async (req, res) => {

    try {

        if (!validId(req.params.id)) {

            return res.status(400).json({

                message:
                    "Invalid club ID."

            });

        }

        const {
            name,
            category,
            coordinator,
            description,
            image
        } = req.body;

        if (
            !name ||
            !category ||
            !coordinator ||
            !description
        ) {

            return res.status(400).json({

                message:
                    "Please fill all club fields."

            });

        }

        const club =
            await Club.findById(
                req.params.id
            );

        if (!club) {

            return res.status(404).json({

                message:
                    "Club not found."

            });

        }

        const oldName =
            club.name;

        if (
            name.trim() !== oldName &&
            await Club.findOne({
                name: name.trim()
            })
        ) {

            return res.status(400).json({

                message:
                    "Another club already uses this name."

            });

        }

        club.name =
            name.trim();

        club.category =
            category.trim();

        club.coordinator =
            coordinator.trim();

        club.description =
            description.trim();

        club.image =
            image
                ? image.trim()
                : "";

        await club.save();

        // Update old club name in membership records
        if (oldName !== club.name) {

            await Membership.updateMany(

                {
                    clubName: oldName
                },

                {
                    $set: {
                        clubName: club.name
                    }
                }

            );

        }

        res.json({

            message:
                "Club updated successfully!",

            club

        });

    }

    catch (error) {

        console.log(
            "Update Club Error:",
            error.message
        );

        res.status(500).json({

            message:
                "Unable to update club."

        });

    }

});

// DELETE CLUB

app.delete("/api/clubs/:id", async (req, res) => {

    try {

        if (!validId(req.params.id)) {

            return res.status(400).json({

                message:
                    "Invalid club ID."

            });

        }

        const club =
            await Club.findById(
                req.params.id
            );

        if (!club) {

            return res.status(404).json({

                message:
                    "Club not found."

            });

        }

        // Remove related data
        await Membership.deleteMany({

            clubName: club.name

        });

        await Announcement.deleteMany({

            clubName: club.name

        });

        await Event.deleteMany({

            clubName: club.name

        });

        await Club.findByIdAndDelete(
            req.params.id
        );

        res.json({

            message:
                "Club deleted successfully!"

        });

    }

    catch (error) {

        console.log(
            "Delete Club Error:",
            error.message
        );

        res.status(500).json({

            message:
                "Unable to delete club."

        });

    }

});

// =====================================================
// MEMBERSHIP
// =====================================================

// STUDENT SEND MEMBERSHIP REQUEST

app.post("/api/membership", async (req, res) => {

    try {

        const {
            studentId,
            clubName,
            category
        } = req.body;

        if (
            !studentId ||
            !clubName ||
            !category
        ) {

            return res.status(400).json({

                message:
                    "Student and club information is required."

            });

        }

        if (!validId(studentId)) {

            return res.status(400).json({

                message:
                    "Invalid student ID."

            });

        }

        const existing =
            await Membership.findOne({

                student: studentId,

                clubName

            });

        if (existing) {

            return res.status(400).json({

                message:
                    "You have already requested to join this club."

            });

        }

        await Membership.create({

            student: studentId,

            clubName,

            category,

            status: "Pending"

        });

        res.status(201).json({

            message:
                "Club membership request sent successfully!"

        });

    }

    catch (error) {

        console.log(
            "Membership Error:",
            error.message
        );

        res.status(500).json({

            message:
                "Unable to send membership request."

        });

    }

});

// ADMIN GET MEMBERSHIPS

app.get(
    "/api/admin/memberships",
    async (req, res) => {

        try {

            const memberships =
                await Membership.find()
                    .populate(
                        "student",
                        "name enrollment email department"
                    )
                    .sort({
                        requestDate: -1
                    })
                    .lean();

            res.json({

                memberships

            });

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to load membership requests."

            });

        }

    }
);

// ADMIN APPROVE / REJECT

app.put(
    "/api/admin/memberships/:id",
    async (req, res) => {

        try {

            const {
                status
            } = req.body;

            if (!validId(req.params.id)) {

                return res.status(400).json({

                    message:
                        "Invalid membership request ID."

                });

            }

            if (
                !["Approved", "Rejected"]
                    .includes(status)
            ) {

                return res.status(400).json({

                    message:
                        "Invalid membership status."

                });

            }

            const membership =
                await Membership.findByIdAndUpdate(

                    req.params.id,

                    {
                        status
                    },

                    {
                        new: true,
                        runValidators: true
                    }

                );

            if (!membership) {

                return res.status(404).json({

                    message:
                        "Membership request not found."

                });

            }

            res.json({

                message:
                    `Membership request ${status.toLowerCase()} successfully.`,

                membership

            });

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to update membership request."

            });

        }

    }
);

// =====================================================
// EVENTS
// =====================================================

// GET EVENTS

app.get("/api/events", async (req, res) => {

    try {

        const events =
            await Event.find()
                .sort({
                    date: 1
                })
                .lean();

        res.json({

            events

        });

    }

    catch (error) {

        res.status(500).json({

            message:
                "Unable to load events."

        });

    }

});

// ADD EVENT

app.post("/api/events", async (req, res) => {

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

        const seats =
            Number(totalSeats);

        if (
            !title ||
            !clubName ||
            !date ||
            !time ||
            !venue ||
            !Number.isInteger(seats) ||
            seats < 1
        ) {

            return res.status(400).json({

                message:
                    "Please fill all required event fields correctly."

            });

        }

        const event =
            await Event.create({

                title: title.trim(),

                clubName:
                    clubName.trim(),

                date:
                    new Date(date),

                time:
                    time.trim(),

                venue:
                    venue.trim(),

                totalSeats:
                    seats,

                availableSeats:
                    seats,

                image:
                    image
                        ? image.trim()
                        : ""

            });

        res.status(201).json({

            message:
                "Event added successfully!",

            event

        });

    }

    catch (error) {

        console.log(
            "Add Event Error:",
            error.message
        );

        res.status(500).json({

            message:
                "Unable to add event."

        });

    }

});

// UPDATE EVENT

app.put(
    "/api/events/:eventId",
    async (req, res) => {

        try {

            if (!validId(req.params.eventId)) {

                return res.status(400).json({

                    message:
                        "Invalid event ID."

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

            const seats =
                Number(totalSeats);

            const event =
                await Event.findById(
                    req.params.eventId
                );

            if (!event) {

                return res.status(404).json({

                    message:
                        "Event not found."

                });

            }

            if (
                !title ||
                !clubName ||
                !date ||
                !time ||
                !venue ||
                !Number.isInteger(seats) ||
                seats < 1
            ) {

                return res.status(400).json({

                    message:
                        "Please fill all required event fields correctly."

                });

            }

            const registeredCount =
                await EventRegistration.countDocuments({

                    event:
                        req.params.eventId,

                    status:
                        "Registered"

                });

            if (seats < registeredCount) {

                return res.status(400).json({

                    message:
                        `Total seats cannot be less than the ${registeredCount} registered student(s).`

                });

            }

            event.title =
                title.trim();

            event.clubName =
                clubName.trim();

            event.date =
                new Date(date);

            event.time =
                time.trim();

            event.venue =
                venue.trim();

            event.totalSeats =
                seats;

            event.availableSeats =
                seats - registeredCount;

            event.image =
                image
                    ? image.trim()
                    : "";

            await event.save();

            res.json({

                message:
                    "Event updated successfully!",

                event

            });

        }

        catch (error) {

            console.log(
                "Update Event Error:",
                error.message
            );

            res.status(500).json({

                message:
                    "Unable to update event."

            });

        }

    }
);

// DELETE EVENT

app.delete(
    "/api/events/:eventId",
    async (req, res) => {

        try {

            if (!validId(req.params.eventId)) {

                return res.status(400).json({

                    message:
                        "Invalid event ID."

                });

            }

            const event =
                await Event.findById(
                    req.params.eventId
                );

            if (!event) {

                return res.status(404).json({

                    message:
                        "Event not found."

                });

            }

            await EventRegistration.deleteMany({

                event:
                    req.params.eventId

            });

            await Event.findByIdAndDelete(
                req.params.eventId
            );

            res.json({

                message:
                    "Event deleted successfully!"

            });

        }

        catch (error) {

            console.log(
                "Delete Event Error:",
                error.message
            );

            res.status(500).json({

                message:
                    "Unable to delete event."

            });

        }

    }
);

// STUDENT EVENT REGISTRATION

app.post(
    "/api/events/:eventId/register",
    async (req, res) => {

        try {

            const {
                studentId
            } = req.body;

            const eventId =
                req.params.eventId;

            if (
                !validId(studentId) ||
                !validId(eventId)
            ) {

                return res.status(400).json({

                    message:
                        "Invalid student or event ID."

                });

            }

            const event =
                await Event.findById(
                    eventId
                );

            if (!event) {

                return res.status(404).json({

                    message:
                        "Event not found."

                });

            }

            if (event.availableSeats <= 0) {

                return res.status(400).json({

                    message:
                        "No seats available for this event."

                });

            }

            const existing =
                await EventRegistration.findOne({

                    student:
                        studentId,

                    event:
                        eventId

                });

            if (existing) {

                return res.status(400).json({

                    message:
                        "You have already registered for this event."

                });

            }

            await EventRegistration.create({

                student:
                    studentId,

                event:
                    eventId

            });

            event.availableSeats -= 1;

            await event.save();

            res.status(201).json({

                message:
                    "Event registration successful!"

            });

        }

        catch (error) {

            if (error.code === 11000) {

                return res.status(400).json({

                    message:
                        "You have already registered for this event."

                });

            }

            res.status(500).json({

                message:
                    "Unable to register for event."

            });

        }

    }
);

// STUDENT EVENT REGISTRATIONS

app.get(
    "/api/events/registrations/:studentId",
    async (req, res) => {

        try {

            if (!validId(req.params.studentId)) {

                return res.status(400).json({

                    message:
                        "Invalid student ID."

                });

            }

            const registrations =
                await EventRegistration.find({

                    student:
                        req.params.studentId,

                    status:
                        "Registered"

                })
                    .populate("event")
                    .sort({
                        registrationDate: -1
                    })
                    .lean();

            res.json({

                registrations

            });

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to load event registrations."

            });

        }

    }
);

// =====================================================
// ANNOUNCEMENTS
// =====================================================

// GET ANNOUNCEMENTS

app.get(
    "/api/announcements",
    async (req, res) => {

        try {

            const announcements =
                await Announcement.find()
                    .sort({
                        date: -1,
                        createdAt: -1
                    })
                    .lean();

            res.json({

                announcements

            });

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to load announcements."

            });

        }

    }
);

// ADD ANNOUNCEMENT

app.post(
    "/api/announcements",
    async (req, res) => {

        try {

            const {
                title,
                clubName,
                date,
                message
            } = req.body;

            if (
                !title ||
                !clubName ||
                !date ||
                !message
            ) {

                return res.status(400).json({

                    message:
                        "Please fill all announcement fields."

                });

            }

            const announcement =
                await Announcement.create({

                    title:
                        title.trim(),

                    clubName:
                        clubName.trim(),

                    date:
                        new Date(date),

                    message:
                        message.trim()

                });

            res.status(201).json({

                message:
                    "Announcement added successfully!",

                announcement

            });

        }

        catch (error) {

            console.log(
                "Add Announcement Error:",
                error.message
            );

            res.status(500).json({

                message:
                    "Unable to add announcement."

            });

        }

    }
);

// UPDATE ANNOUNCEMENT

app.put(
    "/api/announcements/:id",
    async (req, res) => {

        try {

            if (!validId(req.params.id)) {

                return res.status(400).json({

                    message:
                        "Invalid announcement ID."

                });

            }

            const {
                title,
                clubName,
                date,
                message
            } = req.body;

            if (
                !title ||
                !clubName ||
                !date ||
                !message
            ) {

                return res.status(400).json({

                    message:
                        "Please fill all announcement fields."

                });

            }

            const announcement =
                await Announcement.findByIdAndUpdate(

                    req.params.id,

                    {

                        title:
                            title.trim(),

                        clubName:
                            clubName.trim(),

                        date:
                            new Date(date),

                        message:
                            message.trim()

                    },

                    {

                        new: true,
                        runValidators: true

                    }

                );

            if (!announcement) {

                return res.status(404).json({

                    message:
                        "Announcement not found."

                });

            }

            res.json({

                message:
                    "Announcement updated successfully!",

                announcement

            });

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to update announcement."

            });

        }

    }
);

// DELETE ANNOUNCEMENT

app.delete(
    "/api/announcements/:id",
    async (req, res) => {

        try {

            if (!validId(req.params.id)) {

                return res.status(400).json({

                    message:
                        "Invalid announcement ID."

                });

            }

            const announcement =
                await Announcement.findByIdAndDelete(
                    req.params.id
                );

            if (!announcement) {

                return res.status(404).json({

                    message:
                        "Announcement not found."

                });

            }

            res.json({

                message:
                    "Announcement deleted successfully!"

            });

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to delete announcement."

            });

        }

    }
);

// =====================================================
// ADMIN DASHBOARD STATS
// =====================================================

app.get(
    "/api/admin/stats",
    async (req, res) => {

        try {

            const [
                students,
                clubs,
                events,
                pendingMemberships
            ] =
                await Promise.all([

                    User.countDocuments({
                        role: "student"
                    }),

                    Club.countDocuments(),

                    Event.countDocuments(),

                    Membership.countDocuments({
                        status: "Pending"
                    })

                ]);

            const approved =
                await Membership.countDocuments({

                    status:
                        "Approved"

                });

            res.json({

                students,

                clubs,

                events,

                pendingMemberships,

                approvedMemberships:
                    approved

            });

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to load dashboard statistics."

            });

        }

    }
);

// =====================================================
// STUDENT DASHBOARD
// =====================================================

// =====================================================
// STUDENT DASHBOARD
// =====================================================

app.get(
    "/api/student/dashboard/:studentId",
    async (req, res) => {

        try {

            const studentId = req.params.studentId;


            // Validate Student ID
            if (!validId(studentId)) {

                return res.status(400).json({

                    message:
                        "Invalid student ID."

                });

            }


            // Find student
            const student =
                await User.findById(studentId)
                    .select("-password")
                    .lean();


            if (!student) {

                return res.status(404).json({

                    message:
                        "Student not found."

                });

            }


            // Get Memberships
            const memberships =
                await Membership.find({

                    student: studentId

                })
                .sort({

                    requestDate: -1

                })
                .lean();


            // Get Registered Events
            const registrations =
                await EventRegistration.find({

                    student: studentId,

                    status: "Registered"

                })
                .populate("event")
                .sort({

                    registrationDate: -1

                })
                .lean();


            // Convert registrations into events
            const events =
                registrations
                    .filter(
                        registration =>
                            registration.event
                    )
                    .map(
                        registration =>
                            registration.event
                    );


            // Get Announcements
            const announcements =
                await Announcement.find()
                    .sort({

                        date: -1,

                        createdAt: -1

                    })
                    .limit(10)
                    .lean();


            // Send dashboard data
            res.status(200).json({

                student: student,

                memberships: memberships,

                events: events,

                announcements: announcements

            });

        }


        catch (error) {

            console.error(
                "Student Dashboard Error:",
                error
            );


            res.status(500).json({

                message:
                    "Unable to load student dashboard.",

                error:
                    error.message

            });

        }

    }
);
   
// =====================================================
// EXCEL EXPORT - STUDENTS
// =====================================================

app.get(
    "/api/export/students",
    async (req, res) => {

        try {

            const students =
                await User.find({
                    role: "student"
                })
                    .sort({
                        name: 1
                    })
                    .lean();

            const workbook =
                new ExcelJS.Workbook();

            const worksheet =
                workbook.addWorksheet(
                    "Students"
                );

            worksheet.columns = [

                {
                    header: "Sr. No.",
                    key: "srNo",
                    width: 10
                },

                {
                    header: "Name",
                    key: "name",
                    width: 25
                },

                {
                    header: "Enrollment",
                    key: "enrollment",
                    width: 20
                },

                {
                    header: "Email",
                    key: "email",
                    width: 30
                },

                {
                    header: "Department",
                    key: "department",
                    width: 20
                },

                {
                    header: "Semester",
                    key: "semester",
                    width: 12
                },

                {
                    header: "Registration Date",
                    key: "createdAt",
                    width: 22
                }

            ];

            students.forEach(
                (student, index) => {

                    worksheet.addRow({

                        srNo:
                            index + 1,

                        name:
                            student.name,

                        enrollment:
                            student.enrollment,

                        email:
                            student.email,

                        department:
                            student.department,

                        semester:
                            student.semester,

                        createdAt:
                            student.createdAt
                                ? new Date(
                                    student.createdAt
                                ).toLocaleString()
                                : ""

                    });

                }
            );

            worksheet.getRow(1).font = {
                bold: true
            };

            worksheet.views = [
                {
                    state: "frozen",
                    ySplit: 1
                }
            ];

            excelResponse(
                res,
                "ClubConnect_Students.xlsx"
            );

            await workbook.xlsx.write(res);

            res.end();

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to export students."

            });

        }

    }
);

// =====================================================
// EXCEL EXPORT - MEMBERSHIPS
// =====================================================

app.get(
    "/api/export/memberships",
    async (req, res) => {

        try {

            const rows =
                await Membership.find()
                    .populate(
                        "student",
                        "name enrollment email department"
                    )
                    .sort({
                        requestDate: -1
                    })
                    .lean();

            const workbook =
                new ExcelJS.Workbook();

            const worksheet =
                workbook.addWorksheet(
                    "Memberships"
                );

            worksheet.columns = [

                {
                    header: "Sr. No.",
                    key: "srNo",
                    width: 10
                },

                {
                    header: "Student Name",
                    key: "studentName",
                    width: 25
                },

                {
                    header: "Enrollment",
                    key: "enrollment",
                    width: 20
                },

                {
                    header: "Email",
                    key: "email",
                    width: 30
                },

                {
                    header: "Department",
                    key: "department",
                    width: 20
                },

                {
                    header: "Club Name",
                    key: "clubName",
                    width: 25
                },

                {
                    header: "Category",
                    key: "category",
                    width: 18
                },

                {
                    header: "Status",
                    key: "status",
                    width: 15
                },

                {
                    header: "Request Date",
                    key: "requestDate",
                    width: 22
                }

            ];

            rows.forEach(
                (membership, index) => {

                    worksheet.addRow({

                        srNo:
                            index + 1,

                        studentName:
                            membership.student?.name || "",

                        enrollment:
                            membership.student?.enrollment || "",

                        email:
                            membership.student?.email || "",

                        department:
                            membership.student?.department || "",

                        clubName:
                            membership.clubName,

                        category:
                            membership.category,

                        status:
                            membership.status,

                        requestDate:
                            membership.requestDate
                                ? new Date(
                                    membership.requestDate
                                ).toLocaleString()
                                : ""

                    });

                }
            );

            worksheet.getRow(1).font = {
                bold: true
            };

            worksheet.views = [
                {
                    state: "frozen",
                    ySplit: 1
                }
            ];

            excelResponse(
                res,
                "ClubConnect_Memberships.xlsx"
            );

            await workbook.xlsx.write(res);

            res.end();

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to export memberships."

            });

        }

    }
);

// =====================================================
// EXCEL EXPORT - CLUBS
// =====================================================

app.get(
    "/api/export/clubs",
    async (req, res) => {

        try {

            const clubs =
                await Club.find()
                    .sort({
                        name: 1
                    })
                    .lean();

            const counts =
                await Membership.aggregate([

                    {
                        $match: {
                            status: "Approved"
                        }
                    },

                    {
                        $group: {

                            _id: "$clubName",

                            count: {
                                $sum: 1
                            }

                        }

                    }

                ]);

            const countMap =
                Object.fromEntries(

                    counts.map(item => [

                        item._id,
                        item.count

                    ])

                );

            const workbook =
                new ExcelJS.Workbook();

            const worksheet =
                workbook.addWorksheet(
                    "Clubs"
                );

            worksheet.columns = [

                {
                    header: "Sr. No.",
                    key: "srNo",
                    width: 10
                },

                {
                    header: "Club Name",
                    key: "name",
                    width: 25
                },

                {
                    header: "Category",
                    key: "category",
                    width: 18
                },

                {
                    header: "Coordinator",
                    key: "coordinator",
                    width: 25
                },

                {
                    header: "Members",
                    key: "members",
                    width: 12
                },

                {
                    header: "Description",
                    key: "description",
                    width: 55
                }

            ];

            clubs.forEach(
                (club, index) => {

                    worksheet.addRow({

                        srNo:
                            index + 1,

                        name:
                            club.name,

                        category:
                            club.category,

                        coordinator:
                            club.coordinator,

                        members:
                            countMap[
                                club.name
                            ] || 0,

                        description:
                            club.description

                    });

                }
            );

            worksheet.getRow(1).font = {
                bold: true
            };

            worksheet.views = [
                {
                    state: "frozen",
                    ySplit: 1
                }
            ];

            excelResponse(
                res,
                "ClubConnect_Clubs.xlsx"
            );

            await workbook.xlsx.write(res);

            res.end();

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to export clubs."

            });

        }

    }
);

// =====================================================
// EXCEL EXPORT - EVENTS
// =====================================================

app.get(
    "/api/export/events",
    async (req, res) => {

        try {

            const events =
                await Event.find()
                    .sort({
                        date: 1
                    })
                    .lean();

            const workbook =
                new ExcelJS.Workbook();

            const worksheet =
                workbook.addWorksheet(
                    "Events"
                );

            worksheet.columns = [

                {
                    header: "Sr. No.",
                    key: "srNo",
                    width: 10
                },

                {
                    header: "Event Name",
                    key: "title",
                    width: 28
                },

                {
                    header: "Club",
                    key: "clubName",
                    width: 22
                },

                {
                    header: "Date",
                    key: "date",
                    width: 16
                },

                {
                    header: "Time",
                    key: "time",
                    width: 15
                },

                {
                    header: "Venue",
                    key: "venue",
                    width: 25
                },

                {
                    header: "Total Seats",
                    key: "totalSeats",
                    width: 14
                },

                {
                    header: "Available Seats",
                    key: "availableSeats",
                    width: 16
                }

            ];

            events.forEach(
                (event, index) => {

                    worksheet.addRow({

                        srNo:
                            index + 1,

                        title:
                            event.title,

                        clubName:
                            event.clubName,

                        date:
                            event.date
                                ? new Date(
                                    event.date
                                ).toLocaleDateString()
                                : "",

                        time:
                            event.time,

                        venue:
                            event.venue,

                        totalSeats:
                            event.totalSeats,

                        availableSeats:
                            event.availableSeats

                    });

                }
            );

            worksheet.getRow(1).font = {
                bold: true
            };

            worksheet.views = [
                {
                    state: "frozen",
                    ySplit: 1
                }
            ];

            excelResponse(
                res,
                "ClubConnect_Events.xlsx"
            );

            await workbook.xlsx.write(res);

            res.end();

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to export events."

            });

        }

    }
);

// =====================================================
// EXCEL EXPORT - EVENT REGISTRATIONS
// =====================================================

app.get(
    "/api/export/event-registrations",
    async (req, res) => {

        try {

            const rows =
                await EventRegistration.find()
                    .populate(
                        "student",
                        "name enrollment email department"
                    )
                    .populate(
                        "event",
                        "title clubName date time venue"
                    )
                    .sort({
                        registrationDate: -1
                    })
                    .lean();

            const workbook =
                new ExcelJS.Workbook();

            const worksheet =
                workbook.addWorksheet(
                    "Event Registrations"
                );

            worksheet.columns = [

                {
                    header: "Sr. No.",
                    key: "srNo",
                    width: 10
                },

                {
                    header: "Student Name",
                    key: "studentName",
                    width: 25
                },

                {
                    header: "Enrollment",
                    key: "enrollment",
                    width: 20
                },

                {
                    header: "Email",
                    key: "email",
                    width: 30
                },

                {
                    header: "Department",
                    key: "department",
                    width: 20
                },

                {
                    header: "Event",
                    key: "event",
                    width: 28
                },

                {
                    header: "Club",
                    key: "club",
                    width: 22
                },

                {
                    header: "Event Date",
                    key: "eventDate",
                    width: 16
                },

                {
                    header: "Time",
                    key: "time",
                    width: 15
                },

                {
                    header: "Venue",
                    key: "venue",
                    width: 25
                },

                {
                    header: "Registration Date",
                    key: "registrationDate",
                    width: 22
                },

                {
                    header: "Status",
                    key: "status",
                    width: 15
                }

            ];

            rows.forEach(
                (row, index) => {

                    worksheet.addRow({

                        srNo:
                            index + 1,

                        studentName:
                            row.student?.name || "",

                        enrollment:
                            row.student?.enrollment || "",

                        email:
                            row.student?.email || "",

                        department:
                            row.student?.department || "",

                        event:
                            row.event?.title || "",

                        club:
                            row.event?.clubName || "",

                        eventDate:
                            row.event?.date
                                ? new Date(
                                    row.event.date
                                ).toLocaleDateString()
                                : "",

                        time:
                            row.event?.time || "",

                        venue:
                            row.event?.venue || "",

                        registrationDate:
                            row.registrationDate
                                ? new Date(
                                    row.registrationDate
                                ).toLocaleString()
                                : "",

                        status:
                            row.status

                    });

                }
            );

            worksheet.getRow(1).font = {
                bold: true
            };

            worksheet.views = [
                {
                    state: "frozen",
                    ySplit: 1
                }
            ];

            excelResponse(
                res,
                "ClubConnect_Event_Registrations.xlsx"
            );

            await workbook.xlsx.write(res);

            res.end();

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to export event registrations."

            });

        }

    }
);

// =====================================================
// EXCEL EXPORT - ANNOUNCEMENTS
// =====================================================

app.get(
    "/api/export/announcements",
    async (req, res) => {

        try {

            const rows =
                await Announcement.find()
                    .sort({
                        date: -1
                    })
                    .lean();

            const workbook =
                new ExcelJS.Workbook();

            const worksheet =
                workbook.addWorksheet(
                    "Announcements"
                );

            worksheet.columns = [

                {
                    header: "Sr. No.",
                    key: "srNo",
                    width: 10
                },

                {
                    header: "Title",
                    key: "title",
                    width: 30
                },

                {
                    header: "Club",
                    key: "clubName",
                    width: 22
                },

                {
                    header: "Date",
                    key: "date",
                    width: 16
                },

                {
                    header: "Announcement",
                    key: "message",
                    width: 70
                }

            ];

            rows.forEach(
                (announcement, index) => {

                    worksheet.addRow({

                        srNo:
                            index + 1,

                        title:
                            announcement.title,

                        clubName:
                            announcement.clubName,

                        date:
                            announcement.date
                                ? new Date(
                                    announcement.date
                                ).toLocaleDateString()
                                : "",

                        message:
                            announcement.message

                    });

                }
            );

            worksheet.getRow(1).font = {
                bold: true
            };

            worksheet.views = [
                {
                    state: "frozen",
                    ySplit: 1
                }
            ];

            excelResponse(
                res,
                "ClubConnect_Announcements.xlsx"
            );

            await workbook.xlsx.write(res);

            res.end();

        }

        catch (error) {

            res.status(500).json({

                message:
                    "Unable to export announcements."

            });

        }

    }
);

// =====================================================
// STATIC FILES
// =====================================================

app.use(
    "/public",
    express.static(
        path.join(
            __dirname,
            "../public"
        )
    )
);

app.use(
    express.static(
        path.join(
            __dirname,
            "../views"
        )
    )
);

// =====================================================
// HOME PAGE
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "../views/index.html"
            )
        );

    }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    () => {

        console.log(
            `ClubConnect server is running on port ${PORT}`
        );

    }
);