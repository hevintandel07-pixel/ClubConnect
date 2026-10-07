const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    category: {
        type: String,
        required: true,
        trim: true
    },

    coordinator: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        required: true,
        trim: true
    },

    image: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

const Club = mongoose.model(
    "Club",
    clubSchema
);

module.exports = Club;