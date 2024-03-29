import api from "../Config/Telegram.mjs";
import { settings } from "../Config/appConfig.mjs";
import { adsCollection } from "../Models/ads.model.mjs";
import { userCollection } from "../Models/user.model.mjs";
import { adsText, answerCallback, inlineKeys, invited_user, keyList, protect_content, showAdsText, userMention } from "../Utils/tele.mjs";

// start message

api.onText(/^\/start(?: (.+))?$|^🔙 Home$/, async (message, match) => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const user = await userCollection.findOne({ _id: from.id })
        if (!user) {
            invited_user[from.id] = match[1] || settings.ADMIN.ID
            if (invited_user[from.id] != settings.ADMIN.ID) {
                if (isNaN(invited_user[from.id]) || invited_user[from.id] == from.id) {
                    invited_user[from.id] = settings.ADMIN.ID
                }
                const validateInviter = await userCollection.findOne({ _id: invited_user[from.id] })
                if (!validateInviter) {
                    invited_user[from.id] = settings.ADMIN.ID
                }
            }
            const createdUser = await userCollection.create({
                _id: from.id,
                first_name: from.first_name,
                last_name: from.last_name,
                username: from.username,
                invited_by: invited_user[from.id]
            })
            if (createdUser?._id) {
                await userCollection.updateOne({ _id: createdUser.invited_by },{$inc:{invites: 1}})
                const userCount = await userCollection.countDocuments()
                const txt = `<b>🦉 Users: <code>${userCount}</code>\n🚀 UserName: ${userMention(from.id, from.username, from.first_name)}\n🆔 UserID: <code>${from.id}</code>\n☄️ InvitedBy: <code>${invited_user[from.id] == settings.ADMIN.ID ? `You` : `${invited_user[from.id]}`}</code></b>` 
                await api.sendMessage(settings.ADMIN.ID, txt, {
                    parse_mode: "HTML",
                    protect_content: protect_content
                })
            }
        }
        const text = `<b><i>🚀 Welcome to ${settings.BOT.NAME}\n\nThis bot allows you to earn by completing simple tasks.\n\nYou can also create your own ads with /advertise</i></b>`
        return await api.sendMessage(from.id, text, { 
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                keyboard: keyList.mainKey,
                resize_keyboard: true
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

// other buttons

api.onText(/^💷 Balance$|^🚫 Cancel$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const user = await userCollection.findOne({ _id: from.id })
        answerCallback[from.id] = null
        const text = `<b><i>💰 Balance: $${user.balance.balance.toFixed(4)}\n\n💶 Withdrawable: $${user.balance.withdrawable.toFixed(4)}</i></b>`
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                keyboard: keyList.balanceKey,
                resize_keyboard: true
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

api.onText(/^➕ Deposit$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const text = `<b><i>📥 Choose your payment method!</i></b>`
        const key = [
            [
                { text: "PAY WITH CRYPTO", callback_data: "/pay CRYPTO" }
            ]
        ]
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                inline_keyboard: key
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

api.onText(/^➖ Payout$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const user = await userCollection.findOne({ _id: from.id })
        if (user.balance.withdrawable < settings.PAYMENT.MIN.WITHDRAW) {
            const text = `<b><i>❌ Minimum withdrawal is $${settings.PAYMENT.MIN.WITHDRAW.toFixed(4)}</i></b>`
            return await api.sendMessage(from.id, text, {
                parse_mode: "HTML",
                protect_content: protect_content
            })
        }
        const text = `<b><i>💵 Enter the amount you want to withdraw</i></b>`
        answerCallback[from.id] = "PAYOUT_AMOUNT"
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content
        })
    } catch (err) {
        return console.log(err.message)
    }
})

api.onText(/^🔄 Convert$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const text = `<b><i>🔄 Convert withdrawable to balance</i></b>`
        answerCallback[from.id] = "CONVERT_BALANCE"
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                keyboard: [
                    ["🚫 Cancel"]
                ],
                resize_keyboard: true
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

api.onText(/^👭 Referrals$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const user = await userCollection.findOne({_id: from.id})
        const send = `👭 You have total : ${user.invites} Referrals\n\n💸 Total Earned : $${user.balance.referral.toFixed(4)}\n\n🔗 Your Referral Link : https://t.me/${settings.BOT.USERNAME}?start=${from.id}\n\n🎉 You will earn 10% of each user earnings from tasks, and 10% of USD they deposit in bot. Share your refer link and earn money ✅`
        const text = `<b><i>👭 You have total : ${user.invites} Referrals\n\n💸 Total Earned : $${user.balance.referral.toFixed(4)}\n\n🔗 Your Referral Link : https://t.me/${settings.BOT.USERNAME}?start=${from.id}\n\n🎉 You will earn 10% of each user"s earnings from tasks, and 10% of USD they deposit in bot. Share your refer link and earn money ✅</i></b>`
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Share Link", url: `https://t.me/share/url?url=${send}` }]
                ]
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

api.onText(/^⚙️ Settings$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const user = await userCollection.findOne({_id: from.id})
        const text = `<b><i>🛎️ Notification: ${ user.notification ? "✅" : "❌" }\n\n📅 Since: ${new Date(user.createdAt).toLocaleString("en-IN")}</i></b>`
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                inline_keyboard: [
                    [{ text: `${user.notification ? `🔕 Turn OFF` : `🔔 Turn ON` } Notification`, callback_data: `/notification ${user.notification ? false : true}` }]
                ]
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

// Tele Task Section

api.onText(/^🛰️ Tele Task$|^⛔ Cancel$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        answerCallback[from.id] = null
        const text = `<b><i>🛰️ Telegram Tasks</i></b>`
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                keyboard: keyList.teleKey,
                resize_keyboard: true
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

// start bots

api.onText(/^🤖 Start Bots$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        await adsCollection.updateMany({ $expr: { $lt: [ "$remaining_budget", "$cpc" ] } }, { $set: { status: false } })
        let ads = await adsCollection.findOne({
            type: "BOT",
            chat_id: {
                $ne: from.id
            },
            completed: {
                $nin: [from.id]
            },
            skip: {
                $nin: [from.id]
            },
            status: true
        })
        if (!ads) {
            const text = `<b><i>⛔ There are NO TASKS available at the moment.\n⏰ Please check back later!</i></b>`
            return await api.sendMessage(from.id, text, {
                parse_mode: "HTML",
                protect_content: protect_content
            })
        }
        const text = showAdsText.botAds(ads)
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                inline_keyboard: inlineKeys.start_bot(ads)
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

// Advertise Section

api.onText(/^📊 Advertise$|^\/advertise$|^🔙 Advertise$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const text = `<b><i>🚀 Here you can create new ad and check current ads status</i></b>`
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                keyboard: keyList.advertiseKey,
                resize_keyboard: true
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

// create new ads

api.onText(/^➕ New Ad$|^❌ Cancel$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        answerCallback[from.id] = null
        const text = `<b><i>🛰️ Here you can create new ad choose an option from below</i></b>`
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                keyboard: keyList.newAdsKey,
                resize_keyboard: true
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

// new bot ads

api.onText(/^🤖 New Bots$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const text = `<b><i>🔎 Forward a message from the bot you want to promote</i></b>`
        answerCallback[from.id] = "NEW_BOT_ADS"
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                keyboard: [
                    ["❌ Cancel"]
                ],
                resize_keyboard: true
            } 
        })
    } catch (err) {
        return console.log(err.message)
    }
})

// ads list

api.onText(/^📊 My Ads$|^✖️ Cancel$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        answerCallback[from.id] = null
        const text = `<b><i>🚀 Here you can manage all your running/expired ads.</i></b>`
        return await api.sendMessage(from.id, text, {
            parse_mode: "HTML",
            protect_content: protect_content,
            reply_markup: {
                keyboard: keyList.myAdsKey,
                resize_keyboard: true
            }
        })
    } catch (err) {
        return console.log(err.message)
    }
})

// my bot ads

api.onText(/^🤖 My Bots$/, async message => {
    try {
        if(message.chat.type != "private") return
        const from = message.from
        const ads = await adsCollection.find({ chat_id: from.id })
        if (ads.length === 0) {
            const text = `<b><i>🤖 No bot ads available</i></b>`
            return await api.sendMessage(from.id, text, {
                parse_mode: "HTML",
                protect_content: protect_content
            })
        }
        ads.forEach(item => {
            const text = adsText.botAds(item)
            api.sendMessage(from.id, text, {
                parse_mode: "HTML",
                protect_content: protect_content,
                reply_markup: {
                    inline_keyboard: inlineKeys.adsManageKey(item)
                }
            })
        })
    } catch (err) {
        return console.log(err.message)
    }
})