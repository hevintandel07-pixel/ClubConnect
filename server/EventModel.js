const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true
    },

    clubName: {
        type: String,
        required: true
    },

    date: {
        type: Date,
        required: true
    },

    time: {
        type: String,
        required: true
    },

    venue: {
        type: String,
        required: true
    },

    totalSeats: {
        type: Number,
        required: true,
        min: 1
    },

    availableSeats: {
        type: Number,
        required: true,
        min: 0
    },

    image: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

const Event = mongoose.model(
    "Event",
    eventSchema
);

module.exports = Event;