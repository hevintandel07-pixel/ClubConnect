
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
        required: true,
        validate: {
            validator: value => !Number.isNaN(value.getTime()),
            message: "Please enter a valid announcement date."
        }
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
