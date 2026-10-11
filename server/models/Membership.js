
const mongoose = require("mongoose");

// Membership Schema
const membershipSchema = new mongoose.Schema({

    // Student who requested to join
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Club information
    clubName: {
        type: String,
        required: true,
        trim: true
    },

    category: {
        type: String,
        required: true,
        trim: true
    },

    // Membership request status
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    },

    // Request date
    requestDate: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

// Prevent duplicate requests for the same student and club
membershipSchema.index(
    { student: 1, clubName: 1 },
    { unique: true }
);

// Create Membership Model
const Membership = mongoose.model(
    "Membership",
    membershipSchema
);

module.exports = Membership;
