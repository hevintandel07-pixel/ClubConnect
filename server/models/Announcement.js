const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true,
        trim: true
    },

    clubName: {
        type: String,
        required: true,
        trim: true
    },

    date: {
        type: Date,
        required: true
    },

    message: {
        type: String,
        required: true,
        trim: true
    }

}, {
    timestamps: true
});

const Announcement = mongoose.model(
    "Announcement",
    announcementSchema
);

module.exports = Announcement;