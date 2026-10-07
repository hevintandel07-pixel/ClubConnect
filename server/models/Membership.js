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
        required: true
    },

    category: {
        type: String,
        required: true
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

});

// Create Membership Model
const Membership = mongoose.model(
    "Membership",
    membershipSchema
);

module.exports = Membership;