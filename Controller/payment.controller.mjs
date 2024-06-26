import { createHmac } from "crypto"
import { userCollection } from "../Models/user.model.mjs"
import { paymentCollection } from "../Models/payment.model.mjs"
import api from "../Config/Telegram.mjs"
import { protect_content } from "../Utils/tele.mjs"
import { settings } from "../Config/appConfig.mjs"
import { createOrderId } from "../Utils/helper.mjs"

const onPaymentIPN = async (req, res) => {
    try {
        const postData = req.body
        const apiSecretKey = postData.type == "payment" ? process.env.OXAPAY_MERCHANT : process.env.OXAPAY_PAYOUT
        const hmacHeader = req.headers['hmac']
        const calculatedHmac = createHmac("sha512", apiSecretKey).update(JSON.stringify(postData)).digest("hex")
        if (calculatedHmac === hmacHeader) {
            const chat_id = postData.description
            const status = postData.status
            const payInfo = await paymentCollection.findOne({
                user_id: chat_id,
                trackId: postData.trackId
            })

            if (postData.type === "payment") {

                if (status === "Waiting" && !payInfo) {
                    const createdDoc = await paymentCollection.create({
                        user_id: Number(chat_id),
                        amount: parseFloat(postData.amount).toFixed(4),
                        type: postData.type,
                        status: status,
                        currency: "USDT",
                        orderId: postData.orderId,
                        date: postData.date,
                        trackId: postData.trackId
                    })
                    if (createdDoc?._id) {
                        await api.sendMessage(chat_id, `<b><i>⌛ Awaiting payment...</i></b>`, {
                            parse_mode: "HTML",
                            protect_content: protect_content
                        })
                    }
                }

                if (status === "Confirming" && payInfo.status === "Waiting") {
                    const updatedDoc = await paymentCollection.updateOne({
                        user_id: chat_id,
                        trackId: postData.trackId
                    }, {
                        payAmount: postData.payAmount,
                        payCurrency: postData.payCurrency,
                        network: postData.network,
                        status: status,
                        payDate: postData.payDate,
                        txID: postData.txID
                    })
                    if (updatedDoc.matchedCount==1 && updatedDoc.modifiedCount==1) {
                        await api.sendMessage(chat_id, `<b><i>⌛ Awaiting blockchain network confirmation...</i></b>`, {
                            parse_mode: "HTML",
                            protect_content: protect_content
                        })
                    }
                }

                if (status === "Paid" && payInfo.status === "Confirming") {
                    const updatedDoc = await paymentCollection.updateOne({
                        user_id: chat_id,
                        trackId: postData.trackId
                    }, {
                        status: status
                    })
                    if (updatedDoc.matchedCount==1 && updatedDoc.modifiedCount==1) {
                        await api.sendMessage(chat_id, `<b><i>✅ Payment is confirmed by the network and has been credited to your account</i></b>`, {
                            parse_mode: "HTML",
                            protect_content: protect_content
                        })
                        const deposit = parseFloat(postData.amount).toFixed(4)
                        const commission = (deposit * settings.REF.INCOME.DEPOSIT).toFixed(4)
                        const userUpdate = await userCollection.findOneAndUpdate({
                            _id: chat_id
                        }, {
                            $inc: {
                                "balance.balance": deposit
                            }
                        })
                        await userCollection.updateOne({
                            _id: userUpdate.invited_by
                        }, {
                            $inc: {
                                "balance.withdrawable": commission,
                                "balance.referral": commission
                            }
                        })
                    }
                }
                
                if (status === "Expired" && payInfo.status != "Paid") {
                    const updatedDoc = await paymentCollection.updateOne({
                        user_id: chat_id,
                        trackId: postData.trackId
                    }, {
                        status: status
                    })
                    if (updatedDoc.matchedCount==1 && updatedDoc.modifiedCount==1) {
                        await api.sendMessage(chat_id, `<b><i>❌ Invoice (#${postData.orderId}) expired.</i></b>`, {
                            parse_mode: "HTML",
                            protect_content: protect_content
                        })
                    }
                }

            } else if (postData.type === "payout") {
                
                if (status === "Confirming" && !payInfo) {
                    const orderId = createOrderId()
                    const createdDoc = await paymentCollection.create({
                        user_id: Number(chat_id),
                        amount: parseFloat(postData.amount).toFixed(4),
                        type: postData.type,
                        status: status,
                        currency: "USDT",
                        orderId: orderId,
                        date: postData.date,
                        network: postData.network,
                        trackId: postData.trackId
                    })
                    if (createdDoc?._id) {
                        await api.sendMessage(chat_id, `<b><i>⌛ Your payout request sent and awaiting blockchain network confirmation...</i></b>`, {
                            parse_mode: "HTML",
                            protect_content: protect_content
                        })
                    }
                }

                if (status === "Complete" && payInfo.status === "Confirming") {
                    const updatedDoc = await paymentCollection.updateOne({
                        user_id: chat_id,
                        trackId: postData.trackId
                    }, {
                        status: status,
                        txID: postData.txID,
                        address: postData.address
                    })
                    if (updatedDoc.matchedCount==1 && updatedDoc.modifiedCount==1) {
                        await api.sendMessage(chat_id, `<b><i>✅ Payout is confirmed by the network.</i></b>`, {
                            parse_mode: "HTML",
                            protect_content: protect_content
                        })
                        const payout = parseFloat(postData.amount).toFixed(4)
                        await userCollection.updateOne({
                            _id: chat_id
                        }, {
                            $inc: {
                                "balance.payouts": payout
                            }
                        })
                    }
                }

            }
            res.status(200).send({ message: "OK" })
        } else {
            res.status(400).send({ message: "Invalid HMAC signature" })
        }
    } catch (err) {
        return res.status(500).send({ message: err.message })
    }
}

export default { onPaymentIPN }