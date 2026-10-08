"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateCall = initiateCall;
require("dotenv/config");
async function initiateCall(to) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    const url = `${process.env.PUBLIC_URL}/twiml`;
    const body = new URLSearchParams({ To: to, From: from, Url: url }).toString();
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
        method: "POST",
        headers: {
            "Authorization": "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    const data = await res.json();
    if (!res.ok)
        throw new Error(data?.message ?? JSON.stringify(data));
    return data.sid;
}
